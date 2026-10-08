
const {
    OrderError
} = require("../services/orderManagementService");

const {
    listAdminOrders,
    getAdminOrder,
    changeOrderStatus,
    cancelOrderItemAsAdmin
} = require("../services/adminOrderService");

const { setFlash, takeFlash } = require("../helpers/adminFlash");

const {
    ADMIN_ORDER_STATUS_FILTERS,
    ADMIN_ORDER_SORT_OPTIONS,
    PAYMENT_METHOD_LABEL
} = require("../config/orderConstants");

const asText = (value) => (typeof value === "string" ? value : "");

const buildOrdersUrl = ({ search, status, sort, page }) => {

    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (status && status !== "all") params.set("status", status);
    if (sort && sort !== "latest") params.set("sort", sort);
    if (page && page > 1) params.set("page", String(page));

    const queryString = params.toString();

    return "/admin/orders" + (queryString ? `?${queryString}` : "");
};

const loadOrders = async (req, res) => {

    const flash = takeFlash(req);

    try {

        const page = parseInt(asText(req.query.page), 10);

        const result = await listAdminOrders({
            search: asText(req.query.search),
            status: asText(req.query.status),
            sort: asText(req.query.sort),
            page
        });

        const urlFor = (changes = {}) =>
            buildOrdersUrl({
                search: result.search,
                status: result.status,
                sort: result.sort,
                page: 1,
                ...changes
            });

        return res.render("admin/orders", {
            title: "Order Management",
            ...result,
            statusFilters: ADMIN_ORDER_STATUS_FILTERS,
            sortOptions: ADMIN_ORDER_SORT_OPTIONS,
            urlFor,
            flash,
            error: null
        });

    } catch (error) {

        console.error("Admin order listing error:", error);

        return res.status(500).render("admin/orders", {
            title: "Order Management",
            orders: [],
            search: "",
            status: "all",
            sort: "latest",
            totalOrders: 0,
            totalPages: 1,
            currentPage: 1,
            pageNumbers: [1],
            statusFilters: ADMIN_ORDER_STATUS_FILTERS,
            sortOptions: ADMIN_ORDER_SORT_OPTIONS,
            urlFor: () => "/admin/orders",
            flash,
            error: "Unable to load orders right now. Please try again."
        });
    }
};


const loadOrderDetails = async (req, res) => {

    try {

        const order = await getAdminOrder(req.params.orderId);

        return res.render("admin/orderDetails", {
            title: `Order ${order.orderId}`,
            order,
            paymentLabel: PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod,
            flash: takeFlash(req)
        });

    } catch (error) {

        if (error instanceof OrderError) {
            setFlash(req, "error", error.message);
        } else {
            console.error("Admin order details error:", error);
            setFlash(req, "error", "Unable to load this order right now. Please try again.");
        }

        return res.redirect("/admin/orders");
    }
};


const updateOrderStatus = async (req, res) => {

    const orderId = req.params.orderId;
    const detailsUrl = `/admin/orders/${encodeURIComponent(orderId)}`;

    try {

        const newStatus = asText(req.body.status);

        const result = await changeOrderStatus(
            orderId,
            newStatus,
            asText(req.body.reason)
        );

        setFlash(
            req,
            "success",
            result.orderCancelled
                ? `Order ${orderId} cancelled. Stock was restored for ${result.cancelledCount} item(s).`
                : `Order ${orderId} is now ${newStatus}.`
        );

        return res.redirect(detailsUrl);

    } catch (error) {

        if (error instanceof OrderError) {

            setFlash(req, "error", error.message);

            return res.redirect(error.status === 404 ? "/admin/orders" : detailsUrl);
        }

        console.error("Admin order status error:", error);

        setFlash(req, "error", "Unable to update this order right now. Please try again.");

        return res.redirect(detailsUrl);
    }
};


const cancelOrderItem = async (req, res) => {

    const orderId = req.params.orderId;
    const detailsUrl = `/admin/orders/${encodeURIComponent(orderId)}`;

    try {

        const result = await cancelOrderItemAsAdmin(
            orderId,
            req.params.itemId,
            asText(req.body.reason)
        );

        setFlash(
            req,
            "success",
            result.orderCancelled
                ? `${result.productName} cancelled. No active items were left, so the whole order is now Cancelled. Stock restored.`
                : `${result.productName} cancelled and its stock was restored.`
        );

        return res.redirect(detailsUrl);

    } catch (error) {

        if (error instanceof OrderError) {

            setFlash(req, "error", error.message);

            
            return res.redirect(detailsUrl);
        }

        console.error("Admin item cancellation error:", error);

        setFlash(req, "error", "Unable to cancel this item right now. Please try again.");

        return res.redirect(detailsUrl);
    }
};


module.exports = {
    loadOrders,
    loadOrderDetails,
    updateOrderStatus,
    cancelOrderItem
};