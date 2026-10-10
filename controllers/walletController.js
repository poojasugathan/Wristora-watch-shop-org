// =====================================================
// WALLET CONTROLLER (PHASE 56)
//
// Every function here uses req.session.user.id - the logged-in user -
// and nothing else. A user id is never read from the URL or the form,
// so one user can never open or change another user's wallet.
// =====================================================

const {
    WalletError,
    getBalance,
    listTransactions,
    createTopup,
    verifyTopup
} = require("../services/walletService");

const { isConfigured } = require("../config/razorpay");

const {
    WALLET_TOPUP_MIN,
    WALLET_TOPUP_MAX,
    WALLET_TOPUP_QUICK_AMOUNTS,
    WALLET_DESCRIPTION_MAX_LENGTH
} = require("../config/walletConstants");


const sendWalletError = (res, error, logLabel) => {

    if (error instanceof WalletError) {

        return res.status(error.status || 400).json({
            success: false,
            message: error.message
        });
    }

    console.error(`${logLabel}:`, error);

    return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again."
    });
};


const loadWallet = async (req, res) => {

    const userId = req.session.user.id;

    const page = parseInt(req.query.page, 10) || 1;

    try {

        const balance = await getBalance(userId);

        const history = await listTransactions(userId, { page });

        return res.render("user/wallet", {
            title: "My Wallet",
            user: req.session.user,
            balance,
            ...history,
            topupEnabled: isConfigured(),
            quickAmounts: WALLET_TOPUP_QUICK_AMOUNTS,
            topupMin: WALLET_TOPUP_MIN,
            topupMax: WALLET_TOPUP_MAX,
            descriptionMax: WALLET_DESCRIPTION_MAX_LENGTH,
            errorMessage: null
        });

    } catch (error) {

        console.error("Load wallet error:", error);

        return res.status(500).render("user/wallet", {
            title: "My Wallet",
            user: req.session.user,
            balance: 0,
            transactions: [],
            totalTransactions: 0,
            totalPages: 1,
            currentPage: 1,
            pageNumbers: [1],
            topupEnabled: false,
            quickAmounts: WALLET_TOPUP_QUICK_AMOUNTS,
            topupMin: WALLET_TOPUP_MIN,
            topupMax: WALLET_TOPUP_MAX,
            descriptionMax: WALLET_DESCRIPTION_MAX_LENGTH,
            errorMessage: "We couldn't load your wallet right now. Please try again."
        });
    }
};


// Step 1 of "Add Money": the server checks the amount and prepares the payment.
const startTopup = async (req, res) => {

    try {

        const body = req.body || {};

        const payload = await createTopup(req.session.user.id, {
            amount: body.amount,
            description: body.description
        });

        return res.json({ success: true, ...payload });

    } catch (error) {
        return sendWalletError(res, error, "Start wallet top-up error");
    }
};


// Step 2: after paying, the server verifies the payment before adding any money.
const confirmTopup = async (req, res) => {

    try {

        const result = await verifyTopup(req.session.user.id, req.body || {});

        return res.json({
            success: true,
            message: result.alreadyAdded
                ? "This payment was already added to your wallet."
                : "Money added to your wallet.",
            balance: result.balance
        });

    } catch (error) {
        return sendWalletError(res, error, "Verify wallet top-up error");
    }
};


module.exports = {
    loadWallet,
    startTopup,
    confirmTopup
};
