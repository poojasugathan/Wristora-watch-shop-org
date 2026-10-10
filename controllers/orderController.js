
const User = require("../models/userModel");

const {
    OrderError,
    listUserOrders,
    getUserOrder,
    cancelOrderItems,
    returnOrder
} = require("../services/orderManagementService");

const { generateInvoiceBuffer } = require("../services/invoiceService");

const { expireStalePaymentOrders } = require("../services/paymentService");

const {
    PAYMENT_METHOD_LABEL
} = require("../config/orderConstants");


// Phase 56: builds the message shown after a cancellation.
const cancelMessage = (baseMessage, result) => {

    if (result.refundFailed) {
        return `${baseMessage} We couldn't send your refund automatically - our team has been notified and will fix it.`;
    }

    if (result.refundedAmount > 0) {

        const amount = Number(result.refundedAmount).toLocaleString("en-IN", {
            minimumFractionDigits: Number.isInteger(result.refundedAmount) ? 0 : 2,
            maximumFractionDigits: 2
        });

        return `${baseMessage} \u20B9${amount} has been refunded to your wallet.`;
    }

    return baseMessage;
};

const sendJsonError = (res, error, logLabel) => {

    if (error instanceof OrderError) {
        return res.status(error.status).json({
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

const loadOrders = async (req, res) => {

    const search =
        typeof req.query.search === "string" ? req.query.search : "";

    const page = parseInt(req.query.page, 10) || 1;

    try {

        await expireStalePaymentOrders(req.session.user.id);

        const result = await listUserOrders(req.session.user.id, {
            search,
            page
        });

        const baseQueryString = result.search
            ? new URLSearchParams({ search: result.search }).toString()
            : "";

        return res.render("user/orders", {
            title: "My Orders",
            user: req.session.user,
            ...result,
            baseQueryString,
            notice:
                req.query.error === "notfound"
                    ? "We couldn't find that order."
                    : null,
            errorMessage: null
        });

    } catch (error) {

        console.error("Load orders error:", error);

        return res.status(500).render("user/orders", {
            title: "My Orders",
            user: req.session.user,
            orders: [],
            search: "",
            totalOrders: 0,
            totalPages: 1,
            currentPage: 1,
            pageNumbers: [1],
            baseQueryString: "",
            notice: null,
            errorMessage: "We couldn't load your orders right now. Please try again."
        });
    }
};


const loadOrderDetails = async (req, res) => {

    try {

        const order = await getUserOrder(
            req.session.user.id,
            req.params.orderId
        );

        return res.render("user/orderDetails", {
            title: `Order ${order.orderId}`,
            user: req.session.user,
            order,
            paymentLabel:
                PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod
        });

    } catch (error) {

        if (error instanceof OrderError) {
            return res.redirect("/orders?error=notfound");
        }

        console.error("Load order details error:", error);

        return res.redirect("/orders");
    }
};


const cancelOrder = async (req, res) => {

    try {

        const result = await cancelOrderItems(
            req.session.user.id,
            req.params.orderId,
            { reason: req.body.reason }
        );

        return res.json({
            success: true,
            ...result,
            message: cancelMessage("Your order has been cancelled.", result)
        });

    } catch (error) {
        return sendJsonError(res, error, "Cancel order error");
    }
};

const cancelOrderItem = async (req, res) => {

    try {

        const result = await cancelOrderItems(
            req.session.user.id,
            req.params.orderId,
            {
                itemId: req.params.itemId,
                reason: req.body.reason
            }
        );

        return res.json({
            success: true,
            ...result,
            message: cancelMessage(
                result.orderCancelled
                    ? "Your order has been cancelled."
                    : "The item has been cancelled.",
                result
            )
        });

    } catch (error) {
        return sendJsonError(res, error, "Cancel item error");
    }
};


const requestReturn = async (req, res) => {

    try {

        await returnOrder(
            req.session.user.id,
            req.params.orderId,
            req.body.reason
        );

        return res.json({
            success: true,
            message: "Your return request has been submitted."
        });

    } catch (error) {
        return sendJsonError(res, error, "Return order error");
    }
};



const downloadInvoice = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const order = await getUserOrder(userId, req.params.orderId);

        if (!order.canDownloadInvoice) {
            return res.redirect(`/orders/${order.orderId}`);
        }

        const customer = await User.findById(userId)
            .select("firstName lastName email phone")
            .lean();

        const pdf = await generateInvoiceBuffer(order, customer);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="Invoice-${order.orderId}.pdf"`,
            "Content-Length": pdf.length
        });

        return res.send(pdf);

    } catch (error) {

        if (error instanceof OrderError) {
            return res.redirect("/orders?error=notfound");
        }

        console.error("Invoice error:", error);

        return res.redirect("/orders");
    }
};


module.exports = {
    loadOrders,
    loadOrderDetails,
    cancelOrder,
    cancelOrderItem,
    requestReturn,
    downloadInvoice
};