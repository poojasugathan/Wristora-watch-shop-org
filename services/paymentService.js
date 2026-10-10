// =====================================================
// PAYMENT SERVICE (PHASE 54) — Razorpay online payments
//
// Life of an online order:
//
//   1. createOnlinePayment  -> validates cart, reserves stock,
//                              saves the order as  "Pending",
//                              asks Razorpay for a payment order.
//   2. Browser opens the Razorpay window; the user pays.
//   3. verifyPayment        -> backend checks the signature.
//                              Only then: "Paid" + cart cleared.
//   4. If payment fails     -> markPaymentFailed: "Failed" and the
//                              reserved stock is given back.
//   5. retryPayment         -> a Failed order can be paid again.
//
// The browser is NEVER trusted for the amount or for "success".
// =====================================================

const crypto = require("crypto");

const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");

const { AVAILABILITY_FILTER } = require("../controllers/cartController");

const {
    ORDER_ID_PATTERN,
    evaluateCartItems,
    calculatePricing,
    createOrderWithUniqueId,
    findAddressForUser,
    toAddressSnapshot,
    toOrderItems
} = require("./orderService");

const {
    isConfigured,
    getRazorpayClient,
    getPublicKeyId
} = require("../config/razorpay");

const {
    CouponError,
    resolveCouponForLines,
    redeemCoupon,
    releaseCoupon
} = require("./couponService");

const {
    ORDER_STATUS,
    ITEM_STATUS,
    PAYMENT_METHOD,
    PAYMENT_STATUS,
    PAYMENT_PENDING_EXPIRY_MS,
    RAZORPAY_CHECKOUT_TIMEOUT_SECONDS,
    RAZORPAY_CURRENCY
} = require("../config/orderConstants");


class PaymentError extends Error {
    constructor(message, status = 400, redirectUrl = null) {
        super(message);
        this.name = "PaymentError";
        this.status = status;
        this.redirectUrl = redirectUrl;
    }
}

const ONLINE_UNAVAILABLE_MESSAGE =
    "Online payment is not available right now. Please choose Cash on Delivery.";

// Razorpay works in paise (1 rupee = 100 paise), whole numbers only.
const toPaise = (rupees) => Math.round(rupees * 100);

const isActiveItem = (item) => item.itemStatus !== ITEM_STATUS.CANCELLED;

const ID_PATTERN = /^[A-Za-z0-9_]{5,64}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;


// ---------------------------------------------------------
// STOCK
// ---------------------------------------------------------

const releaseStock = async (lines) => {

    for (const line of lines) {

        try {
            await Product.updateOne(
                { _id: line.productId },
                { $inc: { stock: line.quantity } }
            );
        } catch (error) {
            console.error("Stock release failed:", error);
        }
    }
};

// Takes stock one product at a time. If any product cannot be
// reserved, everything already taken is given back.
const reserveStock = async (lines) => {

    const reserved = [];

    for (const line of lines) {

        const result = await Product.updateOne(
            {
                _id: line.productId,
                ...AVAILABILITY_FILTER,
                stock: { $gte: line.quantity }
            },
            { $inc: { stock: -line.quantity } }
        );

        if (result.modifiedCount !== 1) {

            await releaseStock(reserved);

            throw new PaymentError(
                `${line.productName} just went out of stock. Please review your order.`,
                409
            );
        }

        reserved.push(line);
    }
};

const orderToStockLines = (order) =>
    order.items
        .filter(isActiveItem)
        .map((item) => ({
            productId: item.product,
            productName: item.productName,
            quantity: item.quantity
        }));


// ---------------------------------------------------------
// RAZORPAY
// ---------------------------------------------------------

const createGatewayOrder = (order) =>
    getRazorpayClient().orders.create({
        amount: toPaise(order.finalTotal),
        currency: RAZORPAY_CURRENCY,
        receipt: order.orderId,
        notes: { orderId: order.orderId }
    });

const buildClientPayload = async (userId, order, gatewayOrderId) => {

    const customer = await User.findById(userId)
        .select("firstName lastName email")
        .lean();

    const addr = order.addressSnapshot;

    const name =
        customer && (customer.firstName || customer.lastName)
            ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
            : `${addr.firstName} ${addr.lastName}`;

    return {
        orderId: order.orderId,
        razorpayOrderId: gatewayOrderId,
        // The amount comes from OUR database, never from the browser.
        amount: toPaise(order.finalTotal),
        currency: RAZORPAY_CURRENCY,
        keyId: getPublicKeyId(),
        timeoutSeconds: RAZORPAY_CHECKOUT_TIMEOUT_SECONDS,
        prefill: {
            name,
            email: (customer && customer.email) || "",
            contact: addr.phone || ""
        }
    };
};

// Checks that the payment really came from Razorpay.
// Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with our
// secret key. Only someone who knows the secret can produce a match.
const isValidSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret || typeof razorpaySignature !== "string") {
        return false;
    }

    const expected = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(razorpaySignature.toLowerCase());

    return a.length === b.length && crypto.timingSafeEqual(a, b);
};


// ---------------------------------------------------------
// ORDER LOOKUP
// ---------------------------------------------------------

const getOwnedOnlineOrder = async (userId, orderId) => {

    if (typeof orderId !== "string" || !ORDER_ID_PATTERN.test(orderId)) {
        throw new PaymentError("Order not found.", 404);
    }

    const order = await Order.findOne({ orderId, user: userId }).lean();

    if (!order || order.paymentMethod !== PAYMENT_METHOD.ONLINE) {
        throw new PaymentError("Order not found.", 404);
    }

    return order;
};

// Pending -> Failed. Only the request that wins this atomic update
// gives the stock back, so stock can never be released twice.
const failPendingOrder = async (order) => {

    const claim = await Order.updateOne(
        { _id: order._id, paymentStatus: PAYMENT_STATUS.PENDING },
        { $set: { paymentStatus: PAYMENT_STATUS.FAILED } }
    );

    if (claim.modifiedCount === 1) {
        await releaseStock(orderToStockLines(order));
        return true;
    }

    return false;
};


// ---------------------------------------------------------
// 1. START A PAYMENT
// ---------------------------------------------------------

const createOnlinePayment = async (userId, { addressId, couponCode = "" }) => {

    if (!isConfigured()) {
        throw new PaymentError(ONLINE_UNAVAILABLE_MESSAGE, 503);
    }

    await expireStalePaymentOrders(userId);

    const address = await findAddressForUser(userId, addressId);

    const cart = await Cart.findOne({ user: userId }).lean();

    if (!cart || cart.items.length === 0) {
        throw new PaymentError(
            "Your cart is empty.",
            400,
            "/cart?checkoutError=empty"
        );
    }

    const { lines, problems } = await evaluateCartItems(cart.items);

    if (problems.length > 0) {
        throw new PaymentError(problems[0], 409, "/cart?checkoutError=invalid");
    }

    // Phase 55: check the coupon (read only) BEFORE taking any stock.
    let couponResult = null;

    try {
        couponResult = await resolveCouponForLines(couponCode, userId, lines);
    } catch (couponError) {

        if (couponError instanceof CouponError) {
            const failure = new PaymentError(couponError.message, 409);
            failure.couponProblem = true;
            throw failure;
        }

        throw couponError;
    }

    // The cart is NOT touched here. It is cleared only after the
    // payment is verified, so a failed payment never loses the cart.
    await reserveStock(lines);

    let order = null;
    let redeemedCoupon = null;

    try {

        // Spend one use of the coupon (atomic: it can fail if someone
        // else just used the last one).
        if (couponResult) {

            try {
                await redeemCoupon(couponResult.coupon, userId);
                redeemedCoupon = couponResult.coupon;
            } catch (couponError) {

                if (couponError instanceof CouponError) {
                    const failure = new PaymentError(couponError.message, 409);
                    failure.couponProblem = true;
                    throw failure;
                }

                throw couponError;
            }
        }

        const pricing = calculatePricing(
            lines,
            couponResult ? couponResult.discount : 0
        );

        order = await createOrderWithUniqueId({
            user: userId,
            items: toOrderItems(lines),
            subtotal: pricing.subtotal,
            discountTotal: pricing.discountTotal,
            couponCode: couponResult ? couponResult.coupon.code : "",
            couponDiscount: pricing.couponDiscount,
            tax: pricing.tax,
            shipping: pricing.shipping,
            finalTotal: pricing.finalTotal,
            addressSnapshot: toAddressSnapshot(address),
            paymentMethod: PAYMENT_METHOD.ONLINE,
            paymentStatus: PAYMENT_STATUS.PENDING
        });

        const gatewayOrder = await createGatewayOrder(order);

        await Order.updateOne(
            { _id: order._id },
            { $set: { razorpayOrderId: gatewayOrder.id } }
        );

        return await buildClientPayload(userId, order, gatewayOrder.id);

    } catch (error) {

        // Nothing was shown to the user yet, so undo everything.
        await releaseStock(lines);

        if (redeemedCoupon) {
            await releaseCoupon(redeemedCoupon, userId);
        }

        if (order) {
            try {
                await Order.deleteOne({
                    _id: order._id,
                    paymentStatus: PAYMENT_STATUS.PENDING
                });
            } catch (deleteError) {
                console.error("Could not remove unstarted order:", deleteError);
            }
        }

        if (error instanceof PaymentError) {
            throw error;
        }

        console.error("Create online payment error:", error);

        throw new PaymentError(
            "We couldn't start the payment right now. Your cart is safe. Please try again.",
            502
        );
    }
};


// ---------------------------------------------------------
// 2. VERIFY A PAYMENT (the most important function in this file)
// ---------------------------------------------------------

const verifyPayment = async (userId, body) => {

    const orderId = body.orderId;
    const razorpayOrderId = body.razorpay_order_id;
    const razorpayPaymentId = body.razorpay_payment_id;
    const razorpaySignature = body.razorpay_signature;

    const order = await getOwnedOnlineOrder(userId, orderId);

    const looksValid =
        typeof razorpayOrderId === "string" && ID_PATTERN.test(razorpayOrderId) &&
        typeof razorpayPaymentId === "string" && ID_PATTERN.test(razorpayPaymentId) &&
        typeof razorpaySignature === "string" && SIGNATURE_PATTERN.test(razorpaySignature);

    // The payment must belong to THIS order's current Razorpay order.
    if (!looksValid || razorpayOrderId !== order.razorpayOrderId) {
        throw new PaymentError("We couldn't verify this payment.", 400);
    }

    const signatureOk = isValidSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    });

    if (!signatureOk) {

        console.warn(`Invalid payment signature for order ${order.orderId}`);

        await failPendingOrder(order);

        throw new PaymentError(
            "We couldn't verify this payment.",
            400,
            `/checkout/payment-failed/${order.orderId}`
        );
    }

    // Verified. A repeated request for an already-paid order is harmless.
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
        return { orderId: order.orderId, alreadyPaid: true };
    }

    // Normal case: Pending -> Paid. Rare case: the order was marked
    // Failed (for example it expired) but the payment really went
    // through, so we must take the stock again first.
    const wasFailed = order.paymentStatus === PAYMENT_STATUS.FAILED;

    if (wasFailed) {

        try {
            await reserveStock(orderToStockLines(order));
        } catch (error) {

            console.error(
                `Payment ${razorpayPaymentId} received for order ${order.orderId} but stock is gone.`
            );

            throw new PaymentError(
                "We received your payment but couldn't confirm the order. Please contact support with your order ID.",
                409
            );
        }
    }

    const claim = await Order.updateOne(
        {
            _id: order._id,
            paymentStatus: order.paymentStatus,
            razorpayOrderId
        },
        {
            $set: {
                paymentStatus: PAYMENT_STATUS.PAID,
                razorpayPaymentId,
                paidAt: new Date()
            }
        }
    );

    if (claim.modifiedCount !== 1) {

        // We lost a race with another request for the same order.
        if (wasFailed) {
            await releaseStock(orderToStockLines(order));
        }

        const fresh = await Order.findById(order._id)
            .select("paymentStatus")
            .lean();

        if (fresh && fresh.paymentStatus === PAYMENT_STATUS.PAID) {
            return { orderId: order.orderId, alreadyPaid: true };
        }

        throw new PaymentError(
            "We couldn't confirm this payment. If money was deducted, please contact support.",
            409
        );
    }

    // Payment confirmed -> now (and only now) remove these products from the cart.
    try {
        await Cart.updateOne(
            { user: userId },
            { $pull: { items: { product: { $in: order.items.map((i) => i.product) } } } }
        );
    } catch (error) {
        console.error("Cart clear after payment failed:", error);
    }

    return { orderId: order.orderId, alreadyPaid: false };
};


// ---------------------------------------------------------
// 3. PAYMENT FAILED / CLOSED
// ---------------------------------------------------------

const markPaymentFailed = async (userId, orderId) => {

    const order = await getOwnedOnlineOrder(userId, orderId);

    await failPendingOrder(order);

    const fresh = await Order.findById(order._id)
        .select("paymentStatus orderId")
        .lean();

    // If the order turned out to be paid, never show a failure page.
    if (fresh && fresh.paymentStatus === PAYMENT_STATUS.PAID) {
        return { redirectUrl: `/checkout/success/${order.orderId}` };
    }

    return { redirectUrl: `/checkout/payment-failed/${order.orderId}` };
};


// ---------------------------------------------------------
// 4. RETRY A FAILED PAYMENT
// ---------------------------------------------------------

const retryPayment = async (userId, orderId) => {

    if (!isConfigured()) {
        throw new PaymentError(ONLINE_UNAVAILABLE_MESSAGE, 503);
    }

    const order = await getOwnedOnlineOrder(userId, orderId);

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
        throw new PaymentError("This order has already been paid.", 409);
    }

    if (order.paymentStatus === PAYMENT_STATUS.PENDING) {
        throw new PaymentError(
            "A payment for this order is already in progress. If you closed the payment window, please try again in a few minutes.",
            409
        );
    }

    if (order.orderStatus !== ORDER_STATUS.PENDING) {
        throw new PaymentError("This order can no longer be paid.", 409);
    }

    // Products may have sold out or been removed since the first attempt.
    const { lines, problems } = await evaluateCartItems(
        order.items
            .filter(isActiveItem)
            .map((item) => ({ product: item.product, quantity: item.quantity }))
    );

    if (problems.length > 0 || lines.length === 0) {
        throw new PaymentError(
            problems[0] || "These items are no longer available.",
            409
        );
    }

    // Failed -> Pending. Only one request can win this step, so a
    // double click cannot reserve the stock twice.
    const claim = await Order.updateOne(
        { _id: order._id, paymentStatus: PAYMENT_STATUS.FAILED },
        { $set: { paymentStatus: PAYMENT_STATUS.PENDING } }
    );

    if (claim.modifiedCount !== 1) {
        throw new PaymentError(
            "A payment for this order is already in progress.",
            409
        );
    }

    const backToFailed = () =>
        Order.updateOne(
            { _id: order._id, paymentStatus: PAYMENT_STATUS.PENDING },
            { $set: { paymentStatus: PAYMENT_STATUS.FAILED } }
        );

    try {
        await reserveStock(lines);
    } catch (error) {
        await backToFailed();
        throw error;
    }

    try {

        // The order keeps the price the customer originally saw.
        const gatewayOrder = await createGatewayOrder(order);

        await Order.updateOne(
            { _id: order._id },
            { $set: { razorpayOrderId: gatewayOrder.id } }
        );

        return await buildClientPayload(userId, order, gatewayOrder.id);

    } catch (error) {

        await releaseStock(lines);
        await backToFailed();

        console.error("Retry payment error:", error);

        throw new PaymentError(
            "We couldn't restart the payment right now. Please try again.",
            502
        );
    }
};


// ---------------------------------------------------------
// 5. CLEAN UP ABANDONED PAYMENTS
// (the user closed the browser in the middle of paying)
// ---------------------------------------------------------

const expireStalePaymentOrders = async (userId) => {

    try {

        const cutoff = new Date(Date.now() - PAYMENT_PENDING_EXPIRY_MS);

        const stale = await Order.find({
            user: userId,
            paymentMethod: PAYMENT_METHOD.ONLINE,
            paymentStatus: PAYMENT_STATUS.PENDING,
            updatedAt: { $lt: cutoff }
        }).lean();

        for (const order of stale) {

            const claim = await Order.updateOne(
                {
                    _id: order._id,
                    paymentStatus: PAYMENT_STATUS.PENDING,
                    updatedAt: { $lt: cutoff }
                },
                { $set: { paymentStatus: PAYMENT_STATUS.FAILED } }
            );

            if (claim.modifiedCount === 1) {
                await releaseStock(orderToStockLines(order));
            }
        }

    } catch (error) {
        console.error("Expire stale payments error:", error);
    }
};


module.exports = {
    PaymentError,
    isValidSignature,
    getOwnedOnlineOrder,
    createOnlinePayment,
    verifyPayment,
    markPaymentFailed,
    retryPayment,
    expireStalePaymentOrders
};