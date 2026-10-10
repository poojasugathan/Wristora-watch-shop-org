// =====================================================
// WALLET SERVICE (PHASE 56)
//
// Every change to a wallet balance happens in THIS file, on the
// server. The browser never sends a balance and is never trusted.
//
//   getOrCreateWallet / getBalance  -> read the wallet from MongoDB
//   creditWallet                    -> money IN  (refunds, top-ups)
//   debitWallet                     -> money OUT (paying for an order)
//   listTransactions                -> the history table
//   createTopup / verifyTopup       -> "Add Money" through Razorpay
//
// Two safety ideas are used everywhere:
//
//   1. ATOMIC UPDATES. "Take Rs. 500 out, but ONLY IF the balance is
//      at least Rs. 500" is ONE MongoDB command, so two requests at the
//      same moment can never spend the same money twice.
//
//   2. A UNIQUE referenceKey on every transaction. If the same refund
//      or payment is attempted again, MongoDB refuses the second row,
//      so the money can never move twice.
// =====================================================

const crypto = require("crypto");

const Wallet = require("../models/walletModel");
const WalletTransaction = require("../models/walletTransactionModel");
const User = require("../models/userModel");

const {
    isConfigured,
    getRazorpayClient,
    getPublicKeyId,
    verifySignature
} = require("../config/razorpay");

const { RAZORPAY_CURRENCY } = require("../config/orderConstants");

const {
    WALLET_TX_TYPE,
    WALLET_TX_REASON,
    WALLET_TX_REASON_LABEL,
    WALLET_TX_STATUS,
    WALLET_TX_PER_PAGE,
    WALLET_TOPUP_MIN,
    WALLET_TOPUP_MAX,
    WALLET_DESCRIPTION_MAX_LENGTH
} = require("../config/walletConstants");

const { buildPageNumbers } = require("../helpers/pagination");


class WalletError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "WalletError";
        this.status = status;
    }
}

const round2 = (n) => Math.round(n * 100) / 100;

const ID_PATTERN = /^[A-Za-z0-9_]{5,64}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;

const isDuplicateKeyError = (error, field) =>
    Boolean(
        error &&
        error.code === 11000 &&
        error.keyPattern &&
        error.keyPattern[field]
    );


// ---------------------------------------------------------
// SMALL HELPERS
// ---------------------------------------------------------

// Money must be a real, positive number.
const cleanAmount = (amount) => {

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
        throw new WalletError("Invalid amount.");
    }

    return round2(value);
};

// The long number shown in the "Transaction ID" column.
const generateTransactionId = () =>
    String(crypto.randomInt(1000000000, 9999999999));

// Saves one history row. Retries if (very rarely) the random
// transaction number already exists.
const createTransactionRow = async (data) => {

    for (let attempt = 0; attempt < 5; attempt++) {

        try {

            return await WalletTransaction.create({
                ...data,
                transactionId: generateTransactionId()
            });

        } catch (error) {

            if (isDuplicateKeyError(error, "transactionId")) {
                continue;
            }

            throw error;
        }
    }

    throw new Error("Could not generate a unique transaction ID.");
};


// ---------------------------------------------------------
// READING THE WALLET
// ---------------------------------------------------------

// Every user has at most one wallet. It is created the first time
// it is needed.
const getOrCreateWallet = async (userId) => {

    try {

        return await Wallet.findOneAndUpdate(
            { user: userId },
            { $setOnInsert: { user: userId, balance: 0 } },
            { upsert: true, new: true }
        ).lean();

    } catch (error) {

        // Two requests created it at the same moment: just read it.
        if (error && error.code === 11000) {
            return Wallet.findOne({ user: userId }).lean();
        }

        throw error;
    }
};

const getBalance = async (userId) => {

    const wallet = await getOrCreateWallet(userId);

    return round2(wallet.balance || 0);
};


// ---------------------------------------------------------
// MONEY IN  (refunds, completed top-ups)
// ---------------------------------------------------------

// referenceKey makes the credit happen only ONCE.
// Returns { credited: true, balance } or { credited: false, duplicate: true }.
const creditWallet = async (userId, {
    amount,
    reason,
    description = "",
    orderId = "",
    referenceKey
}) => {

    const value = cleanAmount(amount);

    if (!referenceKey) {
        throw new WalletError("A reference key is required.", 500);
    }

    await getOrCreateWallet(userId);

    // Step 1: write the history row FIRST. If this exact credit was
    // already done, MongoDB refuses it here and no money is added.
    let row;

    try {

        row = await createTransactionRow({
            user: userId,
            type: WALLET_TX_TYPE.CREDIT,
            amount: value,
            reason,
            description: description || WALLET_TX_REASON_LABEL[reason] || "",
            orderId,
            referenceKey,
            status: WALLET_TX_STATUS.COMPLETED
        });

    } catch (error) {

        if (isDuplicateKeyError(error, "referenceKey")) {
            return { credited: false, duplicate: true };
        }

        throw error;
    }

    // Step 2: add the money.
    try {

        const wallet = await Wallet.findOneAndUpdate(
            { user: userId },
            { $inc: { balance: value } },
            { new: true }
        ).lean();

        await WalletTransaction.updateOne(
            { _id: row._id },
            { $set: { balanceAfter: round2(wallet.balance) } }
        );

        return {
            credited: true,
            balance: round2(wallet.balance),
            transactionId: row.transactionId
        };

    } catch (error) {

        // The money was not added, so remove the row that said it was.
        try {
            await WalletTransaction.deleteOne({ _id: row._id });
        } catch (cleanupError) {
            console.error("Wallet credit cleanup failed:", cleanupError);
        }

        throw error;
    }
};


// ---------------------------------------------------------
// MONEY OUT  (paying for an order)
// ---------------------------------------------------------

// Takes the money ONLY IF the balance is enough, in one atomic step.
// Throws WalletError when the balance is too low.
const debitWallet = async (userId, {
    amount,
    reason = WALLET_TX_REASON.ORDER_PAYMENT,
    description = "",
    orderId = "",
    referenceKey
}) => {

    const value = cleanAmount(amount);

    if (!referenceKey) {
        throw new WalletError("A reference key is required.", 500);
    }

    // "balance >= value" is checked INSIDE this update. Two requests
    // at the same time cannot both succeed on the same money.
    const wallet = await Wallet.findOneAndUpdate(
        { user: userId, balance: { $gte: value } },
        { $inc: { balance: -value } },
        { new: true }
    ).lean();

    if (!wallet) {
        throw new WalletError(
            "Your wallet balance is not enough for this order.",
            402
        );
    }

    try {

        const row = await createTransactionRow({
            user: userId,
            type: WALLET_TX_TYPE.DEBIT,
            amount: value,
            reason,
            description: description || WALLET_TX_REASON_LABEL[reason] || "",
            orderId,
            referenceKey,
            status: WALLET_TX_STATUS.COMPLETED,
            balanceAfter: round2(wallet.balance)
        });

        return {
            balance: round2(wallet.balance),
            transactionId: row.transactionId,
            referenceKey
        };

    } catch (error) {

        // The history row could not be saved, so give the money back.
        try {
            await Wallet.updateOne(
                { user: userId },
                { $inc: { balance: value } }
            );
        } catch (undoError) {
            console.error("Wallet debit undo failed:", undoError);
        }

        if (isDuplicateKeyError(error, "referenceKey")) {
            throw new WalletError("This payment was already processed.", 409);
        }

        throw error;
    }
};

// After the order exists, link the payment row to it.
const attachOrderToTransaction = async (referenceKey, orderId) => {

    try {

        await WalletTransaction.updateOne(
            { referenceKey },
            {
                $set: {
                    orderId,
                    description: `Payment for order ${orderId}`
                }
            }
        );

    } catch (error) {
        console.error("Could not link wallet payment to order:", error);
    }
};


// ---------------------------------------------------------
// HISTORY (the table on the Wallet page)
// ---------------------------------------------------------

const listTransactions = async (userId, { page = 1 } = {}) => {

    // Pending / failed top-ups are not shown.
    const filter = { user: userId, status: WALLET_TX_STATUS.COMPLETED };

    const totalTransactions = await WalletTransaction.countDocuments(filter);

    const totalPages = Math.max(
        1,
        Math.ceil(totalTransactions / WALLET_TX_PER_PAGE)
    );

    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const currentPage = Math.min(requestedPage, totalPages);

    const transactions = await WalletTransaction.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * WALLET_TX_PER_PAGE)
        .limit(WALLET_TX_PER_PAGE)
        .select("transactionId type amount description createdAt")
        .lean();

    return {
        transactions,
        totalTransactions,
        totalPages,
        currentPage,
        pageNumbers: buildPageNumbers(currentPage, totalPages)
    };
};


// ---------------------------------------------------------
// ADD MONEY (Razorpay top-up)
//
//   createTopup -> checks the amount, asks Razorpay for a payment
//                  order, saves a PENDING row linked to that order.
//   (browser opens Razorpay, the user pays)
//   verifyTopup -> checks the Razorpay signature on the server.
//                  Only then is the wallet credited - exactly once.
// ---------------------------------------------------------

const toPaise = (rupees) => Math.round(rupees * 100);

const createTopup = async (userId, { amount, description }) => {

    if (!isConfigured()) {
        throw new WalletError(
            "Adding money is not available right now. Please try again later.",
            503
        );
    }

    const value = Number(amount);

    if (!Number.isInteger(value)) {
        throw new WalletError("Please enter a whole-rupee amount.");
    }

    if (value < WALLET_TOPUP_MIN || value > WALLET_TOPUP_MAX) {
        throw new WalletError(
            `You can add between \u20B9${WALLET_TOPUP_MIN} and \u20B9${WALLET_TOPUP_MAX.toLocaleString("en-IN")} at a time.`
        );
    }

    const note = typeof description === "string" ? description.trim() : "";

    if (note.length > WALLET_DESCRIPTION_MAX_LENGTH) {
        throw new WalletError(
            `Please keep the description under ${WALLET_DESCRIPTION_MAX_LENGTH} characters.`
        );
    }

    await getOrCreateWallet(userId);

    let gatewayOrder;

    try {

        gatewayOrder = await getRazorpayClient().orders.create({
            // The amount is OUR validated number, in paise.
            amount: toPaise(value),
            currency: RAZORPAY_CURRENCY,
            receipt: `WLT${Date.now()}${crypto.randomInt(1000, 9999)}`,
            notes: { purpose: "wallet_topup" }
        });

    } catch (error) {

        console.error("Wallet top-up: Razorpay order failed:", error);

        throw new WalletError(
            "We couldn't start the payment right now. Please try again.",
            502
        );
    }

    // Saved as PENDING. It becomes a real credit only after verifyTopup.
    await createTransactionRow({
        user: userId,
        type: WALLET_TX_TYPE.CREDIT,
        amount: value,
        reason: WALLET_TX_REASON.ADD_MONEY,
        description: note || WALLET_TX_REASON_LABEL.ADD_MONEY,
        referenceKey: `TOPUP:${gatewayOrder.id}`,
        status: WALLET_TX_STATUS.PENDING,
        razorpayOrderId: gatewayOrder.id
    });

    const customer = await User.findById(userId)
        .select("firstName lastName email phone")
        .lean();

    return {
        razorpayOrderId: gatewayOrder.id,
        amount: toPaise(value),
        currency: RAZORPAY_CURRENCY,
        keyId: getPublicKeyId(),
        prefill: {
            name: customer
                ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                : "",
            email: (customer && customer.email) || "",
            contact: (customer && customer.phone) || ""
        }
    };
};

const verifyTopup = async (userId, body) => {

    const razorpayOrderId = body.razorpay_order_id;
    const razorpayPaymentId = body.razorpay_payment_id;
    const razorpaySignature = body.razorpay_signature;

    const looksValid =
        typeof razorpayOrderId === "string" && ID_PATTERN.test(razorpayOrderId) &&
        typeof razorpayPaymentId === "string" && ID_PATTERN.test(razorpayPaymentId) &&
        typeof razorpaySignature === "string" && SIGNATURE_PATTERN.test(razorpaySignature);

    if (!looksValid) {
        throw new WalletError("We couldn't verify this payment.");
    }

    // The top-up must belong to THIS user.
    const row = await WalletTransaction.findOne({
        user: userId,
        reason: WALLET_TX_REASON.ADD_MONEY,
        referenceKey: `TOPUP:${razorpayOrderId}`
    }).lean();

    if (!row) {
        throw new WalletError("We couldn't verify this payment.");
    }

    const signatureOk = verifySignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    });

    if (!signatureOk) {

        console.warn(`Invalid wallet top-up signature for ${razorpayOrderId}`);

        await WalletTransaction.updateOne(
            { _id: row._id, status: WALLET_TX_STATUS.PENDING },
            { $set: { status: WALLET_TX_STATUS.FAILED } }
        );

        throw new WalletError("We couldn't verify this payment.");
    }

    // Verified. A repeated request for a finished top-up is harmless.
    if (row.status === WALLET_TX_STATUS.COMPLETED) {
        return { alreadyAdded: true, balance: await getBalance(userId) };
    }

    // Only ONE request can win this Pending -> Completed step,
    // so a double click can never credit the money twice.
    const claim = await WalletTransaction.updateOne(
        { _id: row._id, status: WALLET_TX_STATUS.PENDING },
        { $set: { status: WALLET_TX_STATUS.COMPLETED, razorpayPaymentId } }
    );

    if (claim.modifiedCount !== 1) {

        const fresh = await WalletTransaction.findById(row._id)
            .select("status")
            .lean();

        if (fresh && fresh.status === WALLET_TX_STATUS.COMPLETED) {
            return { alreadyAdded: true, balance: await getBalance(userId) };
        }

        throw new WalletError(
            "We couldn't confirm this payment. If money was deducted, please contact support."
        );
    }

    try {

        const wallet = await Wallet.findOneAndUpdate(
            { user: userId },
            { $inc: { balance: row.amount } },
            { new: true }
        ).lean();

        await WalletTransaction.updateOne(
            { _id: row._id },
            { $set: { balanceAfter: round2(wallet.balance) } }
        );

        return { alreadyAdded: false, balance: round2(wallet.balance) };

    } catch (error) {

        // The wallet was not credited: let the user verify again.
        await WalletTransaction.updateOne(
            { _id: row._id },
            { $set: { status: WALLET_TX_STATUS.PENDING, razorpayPaymentId: "" } }
        );

        console.error("Wallet top-up credit failed:", error);

        throw new WalletError(
            "We couldn't add the money right now. Please try again, or contact support if money was deducted.",
            500
        );
    }
};


module.exports = {
    WalletError,
    getOrCreateWallet,
    getBalance,
    creditWallet,
    debitWallet,
    attachOrderToTransaction,
    listTransactions,
    createTopup,
    verifyTopup
};
