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


const loadCheckout = async (req, res) => {

    try {

        const userId = req.session.user.id;

        delete req.session.checkoutReturn;

        const cart = await Cart.findOne({ user: userId }).lean();

        const cartItems = cart ? cart.items : [];

        if (cartItems.length === 0) {
            return res.redirect("/cart?checkoutError=empty");
        }

        const { lines, problems } = await evaluateCartItems(cartItems);

        if (problems.length > 0) {
            return res.redirect("/cart?checkoutError=invalid");
        }

        const pricing = calculatePricing(lines);

        const addresses = await Address.find({ userId })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

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

const placeOrder = async (req, res) => {

    const userId = req.session.user.id;

    try {

        const order = await placeOrderService(userId, {
            addressId: req.body.selectedAddress,
            paymentMethod: req.body.paymentMethod
        });

        return res.redirect(`/checkout/success/${order.orderId}`);

    } catch (error) {

        if (error instanceof CheckoutError) {

            if (error.type === "empty") {
                return res.redirect("/cart?checkoutError=empty");
            }

            if (error.type === "items") {
                return res.redirect("/cart?checkoutError=invalid");
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
    startAddAddress,
    startEditAddress
};