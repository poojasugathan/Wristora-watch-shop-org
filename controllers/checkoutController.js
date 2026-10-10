const mongoose = require("mongoose");

const Address = require("../models/addressModel");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");

const {
    CheckoutError,
    ORDER_ID_PATTERN,
    evaluateCartItems,
    calculatePricing,
    placeOrder: placeOrderService
} = require("../services/orderService");

const {
    PaymentError,
    createOnlinePayment,
    verifyPayment,
    markPaymentFailed,
    retryPayment,
    expireStalePaymentOrders
} = require("../services/paymentService");

const {
    CouponError,
    getCouponBase,
    validateCoupon
} = require("../services/couponService");

const { isConfigured } = require("../config/razorpay");

// Phase 56: wallet balance shown on the checkout page.
const { getBalance } = require("../services/walletService");

const {
    PAYMENT_METHOD,
    PAYMENT_METHOD_LABEL,
    PAYMENT_STATUS
} = require("../config/orderConstants");


// Turns an error into a friendly JSON answer for the payment requests.
const sendPaymentError = (res, error, logLabel) => {

    if (error instanceof PaymentError || error instanceof CheckoutError) {

        return res.status(error.status || 400).json({
            success: false,
            message: error.message,
            redirectUrl: error.redirectUrl || null
        });
    }

    console.error(`${logLabel}:`, error);

    return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again."
    });
};


// ---------------------------------------------------------
// COUPON HELPERS (PHASE 55)
// The session remembers ONLY the coupon CODE. The discount is
// recalculated from the database every single time.
// ---------------------------------------------------------

const readSessionCoupon = async (req, userId, base) => {

    const code = req.session.appliedCoupon;

    if (!code) {
        return { applied: null, removedMessage: null };
    }

    try {

        const { coupon, discount } = await validateCoupon(code, userId, base);

        return {
            applied: {
                code: coupon.code,
                description: coupon.description || "",
                discount
            },
            removedMessage: null
        };

    } catch (error) {

        if (error instanceof CouponError) {

            delete req.session.appliedCoupon;

            return {
                applied: null,
                removedMessage: `Coupon ${code} was removed. ${error.message}`
            };
        }

        throw error;
    }
};

const loadCartLines = async (userId) => {

    const cart = await Cart.findOne({ user: userId }).lean();

    const cartItems = cart ? cart.items : [];

    if (cartItems.length === 0) {
        throw new CheckoutError("Your cart is empty.", "empty");
    }

    const { lines, problems } = await evaluateCartItems(cartItems);

    if (problems.length > 0) {
        throw new CheckoutError(problems[0], "items");
    }

    return lines;
};

const sendCouponError = (res, error, logLabel) => {

    if (error instanceof CouponError || error instanceof CheckoutError) {

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


const loadCheckout = async (req, res) => {

    try {

        const userId = req.session.user.id;

        delete req.session.checkoutReturn;

        await expireStalePaymentOrders(userId);

        const cart = await Cart.findOne({ user: userId }).lean();

        const cartItems = cart ? cart.items : [];

        if (cartItems.length === 0) {
            return res.redirect("/cart?checkoutError=empty");
        }

        const { lines, problems } = await evaluateCartItems(cartItems);

        if (problems.length > 0) {
            return res.redirect("/cart?checkoutError=invalid");
        }

        const couponState = await readSessionCoupon(
            req,
            userId,
            getCouponBase(lines)
        );

        const pricing = calculatePricing(
            lines,
            couponState.applied ? couponState.applied.discount : 0
        );

        const addresses = await Address.find({ userId })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        // Phase 56: always read the wallet from MongoDB. This number is
        // only DISPLAYED here; the real check happens again when the
        // order is placed.
        const walletBalance = await getBalance(userId);

        const error = req.session.checkoutError || null;
        delete req.session.checkoutError;

        const notice =
            req.query.addressSaved === "1"
                ? "Your address has been saved."
                : null;

        return res.render("user/checkout", {
            title: "Checkout",
            user: req.session.user,
            lines,
            pricing,
            addresses,
            paymentLabel: PAYMENT_METHOD_LABEL.COD,
            onlineLabel: PAYMENT_METHOD_LABEL.ONLINE,
            onlineEnabled: isConfigured(),
            walletLabel: PAYMENT_METHOD_LABEL.WALLET,
            walletBalance,
            appliedCoupon: couponState.applied,
            couponNotice: couponState.removedMessage,
            error,
            notice
        });

    } catch (error) {

        console.error("Load checkout error:", error);

        return res.redirect("/cart?checkoutError=server");
    }
};

const placeOrder = async (req, res) => {

    const userId = req.session.user.id;

    try {

        const order = await placeOrderService(userId, {
            addressId: req.body.selectedAddress,
            paymentMethod: req.body.paymentMethod,
            couponCode: req.session.appliedCoupon || ""
        });

        // The coupon is used up by this order.
        delete req.session.appliedCoupon;

        return res.redirect(`/checkout/success/${order.orderId}`);

    } catch (error) {

        if (error instanceof CheckoutError) {

            if (error.type === "empty") {
                return res.redirect("/cart?checkoutError=empty");
            }

            if (error.type === "items") {
                return res.redirect("/cart?checkoutError=invalid");
            }

            if (error.type === "coupon") {
                delete req.session.appliedCoupon;
            }

            req.session.checkoutError = error.message;
            return res.redirect("/checkout");
        }

        console.error("Place order error:", error);

        req.session.checkoutError =
            "We couldn't place your order right now. Your cart is safe. Please try again.";

        return res.redirect("/checkout");
    }
};


const loadOrderSuccess = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const { orderId } = req.params;

        if (!ORDER_ID_PATTERN.test(orderId)) {
            return res.status(404).send("Order not found");
        }

        const order = await Order.findOne({
            orderId,
            user: userId
        }).lean();

        if (!order) {
            return res.status(404).send("Order not found");
        }

        // Online orders: this page is only for PAID orders.
        if (order.paymentMethod === PAYMENT_METHOD.ONLINE) {

            if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
                return res.redirect(
                    order.paymentStatus === PAYMENT_STATUS.FAILED
                        ? `/checkout/payment-failed/${order.orderId}`
                        : `/orders/${order.orderId}`
                );
            }

            const customer = await User.findById(userId)
                .select("firstName lastName")
                .lean();

            const addr = order.addressSnapshot;

            const customerName =
                customer && (customer.firstName || customer.lastName)
                    ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                    : `${addr.firstName} ${addr.lastName}`;

            return res.render("user/paymentSuccess", {
                title: "Payment Success",
                user: req.session.user,
                order,
                customerName
            });
        }

        return res.render("user/orderSuccess", {
            title: "Order Placed",
            user: req.session.user,
            order,
            paymentLabel: PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod
        });

    } catch (error) {

        console.error("Order success page error:", error);

        return res.redirect("/cart");
    }
};



// =====================================================
// ONLINE PAYMENT (PHASE 54)
// =====================================================

const startOnlinePayment = async (req, res) => {

    try {

        const payload = await createOnlinePayment(req.session.user.id, {
            addressId: req.body.selectedAddress,
            couponCode: req.session.appliedCoupon || ""
        });

        // The order now owns this coupon use.
        delete req.session.appliedCoupon;

        return res.json({ success: true, ...payload });

    } catch (error) {

        if (error && error.couponProblem) {
            delete req.session.appliedCoupon;
        }

        return sendPaymentError(res, error, "Start online payment error");
    }
};

const verifyOnlinePayment = async (req, res) => {

    try {

        const result = await verifyPayment(req.session.user.id, req.body || {});

        delete req.session.appliedCoupon;

        return res.json({
            success: true,
            redirectUrl: `/checkout/success/${result.orderId}`
        });

    } catch (error) {
        return sendPaymentError(res, error, "Verify online payment error");
    }
};

const failOnlinePayment = async (req, res) => {

    try {

        const result = await markPaymentFailed(
            req.session.user.id,
            (req.body || {}).orderId
        );

        return res.json({ success: true, redirectUrl: result.redirectUrl });

    } catch (error) {
        return sendPaymentError(res, error, "Mark payment failed error");
    }
};

const retryOnlinePayment = async (req, res) => {

    try {

        const payload = await retryPayment(
            req.session.user.id,
            (req.body || {}).orderId
        );

        return res.json({ success: true, ...payload });

    } catch (error) {
        return sendPaymentError(res, error, "Retry online payment error");
    }
};

const loadPaymentFailed = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const { orderId } = req.params;

        if (!ORDER_ID_PATTERN.test(orderId)) {
            return res.redirect("/orders");
        }

        const order = await Order.findOne({ orderId, user: userId }).lean();

        if (!order || order.paymentMethod !== PAYMENT_METHOD.ONLINE) {
            return res.redirect("/orders");
        }

        if (order.paymentStatus === PAYMENT_STATUS.PAID) {
            return res.redirect(`/checkout/success/${order.orderId}`);
        }

        if (order.paymentStatus !== PAYMENT_STATUS.FAILED) {
            return res.redirect(`/orders/${order.orderId}`);
        }

        return res.render("user/paymentFailed", {
            title: "Payment Failed",
            user: req.session.user,
            order,
            supportEmail: process.env.SUPPORT_EMAIL || ""
        });

    } catch (error) {

        console.error("Payment failed page error:", error);

        return res.redirect("/orders");
    }
};


// =====================================================
// COUPONS (PHASE 55)
// =====================================================

const applyCoupon = async (req, res) => {

    try {

        const userId = req.session.user.id;

        // Only ONE coupon per order. Remove the old one first.
        if (req.session.appliedCoupon) {
            return res.status(409).json({
                success: false,
                message: "A coupon is already applied. Remove it first to use a different one."
            });
        }

        const lines = await loadCartLines(userId);

        const { coupon, discount } = await validateCoupon(
            (req.body || {}).code,
            userId,
            getCouponBase(lines)
        );

        req.session.appliedCoupon = coupon.code;

        return res.json({
            success: true,
            message: `Coupon ${coupon.code} applied.`,
            coupon: { code: coupon.code, discount },
            pricing: calculatePricing(lines, discount)
        });

    } catch (error) {
        return sendCouponError(res, error, "Apply coupon error");
    }
};

const removeCoupon = async (req, res) => {

    try {

        const userId = req.session.user.id;

        delete req.session.appliedCoupon;

        const lines = await loadCartLines(userId);

        return res.json({
            success: true,
            message: "Coupon removed.",
            pricing: calculatePricing(lines, 0)
        });

    } catch (error) {
        return sendCouponError(res, error, "Remove coupon error");
    }
};


const startAddAddress = (req, res) => {

    req.session.checkoutReturn = Date.now();

    return res.redirect("/addresses/add");
};

const startEditAddress = async (req, res) => {

    const addressId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.redirect("/checkout");
    }

   
    const address = await Address.findOne({
        _id: addressId,
        userId: req.session.user.id
    }).lean();

    if (!address) {
        return res.redirect("/checkout");
    }

    req.session.checkoutReturn = Date.now();

    return res.redirect(`/addresses/edit/${addressId}`);
};


module.exports = {
    loadCheckout,
    placeOrder,
    loadOrderSuccess,
    startOnlinePayment,
    verifyOnlinePayment,
    failOnlinePayment,
    retryOnlinePayment,
    loadPaymentFailed,
    applyCoupon,
    removeCoupon,
    startAddAddress,
    startEditAddress
};