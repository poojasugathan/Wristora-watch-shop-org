const mongoose = require("mongoose");

const Address = require("../models/addressModel");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");

const {
    CheckoutError,
    ORDER_ID_PATTERN,
    evaluateCartItems,
    calculatePricing,
    placeOrder: placeOrderService
} = require("../services/orderService");

const {
    PAYMENT_METHOD_LABEL
} = require("../config/orderConstants");


// =====================================================
// CHECKOUT PAGE  (GET /checkout)
// =====================================================

const loadCheckout = async (req, res) => {

    try {

        const userId = req.session.user.id;

        // Coming back to checkout ends any "return here after
        // saving an address" trip.
        delete req.session.checkoutReturn;

        const cart = await Cart.findOne({ user: userId }).lean();

        const cartItems = cart ? cart.items : [];

        if (cartItems.length === 0) {
            return res.redirect("/cart?checkoutError=empty");
        }

        // Same rules as placing the order, using fresh database data.
        const { lines, problems } = await evaluateCartItems(cartItems);

        if (problems.length > 0) {
            return res.redirect("/cart?checkoutError=invalid");
        }

        const pricing = calculatePricing(lines);

        const addresses = await Address.find({ userId })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        // One-time error message left by placeOrder (then removed).
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
            error,
            notice
        });

    } catch (error) {

        console.error("Load checkout error:", error);

        return res.redirect("/cart?checkoutError=server");
    }
};


// =====================================================
// PLACE ORDER  (POST /checkout/place-order)
// =====================================================

const placeOrder = async (req, res) => {

    const userId = req.session.user.id;

    try {

        const order = await placeOrderService(userId, {
            addressId: req.body.selectedAddress,
            paymentMethod: req.body.paymentMethod
        });

        // Redirect (not render) so refreshing the success page
        // is a harmless GET and never re-submits the order.
        return res.redirect(`/checkout/success/${order.orderId}`);

    } catch (error) {

        if (error instanceof CheckoutError) {

            if (error.type === "empty") {
                return res.redirect("/cart?checkoutError=empty");
            }

            if (error.type === "items") {
                return res.redirect("/cart?checkoutError=invalid");
            }

            // address / payment problems: back to checkout with a message
            req.session.checkoutError = error.message;
            return res.redirect("/checkout");
        }

        console.error("Place order error:", error);

        req.session.checkoutError =
            "We couldn't place your order right now. Your cart is safe. Please try again.";

        return res.redirect("/checkout");
    }
};


// =====================================================
// ORDER SUCCESS PAGE  (GET /checkout/success/:orderId)
// Only the owner of the order can open it.
// =====================================================

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
// ADD / EDIT ADDRESS FROM CHECKOUT
// These reuse the existing address pages. We only leave a
// small note in the session so that, after saving, the user
// is sent back to checkout instead of the address list.
// =====================================================

const startAddAddress = (req, res) => {

    req.session.checkoutReturn = Date.now();

    return res.redirect("/addresses/add");
};

const startEditAddress = async (req, res) => {

    const addressId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.redirect("/checkout");
    }

    // ownership check: only this user's own address
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
    startAddAddress,
    startEditAddress
};