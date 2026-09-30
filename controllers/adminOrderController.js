// =====================================================
// ADMIN ORDER CONTROLLER (PHASE 52)
//
// Thin layer: read the request, call adminOrderService,
// render a page or redirect. All rules live in the service.
// =====================================================

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


// Query values can be arrays (?search=a&search=b) - only accept text.
const asText = (value) => (typeof value === "string" ? value : "");


// Builds /admin/orders?search=..&status=..&sort=..&page=..
// Default values are left out so the URL stays short.
const buildOrdersUrl = ({ search, status, sort, page }) => {

    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (status && status !== "all") params.set("status", status);
    if (sort && sort !== "latest") params.set("sort", sort);
    if (page && page > 1) params.set("page", String(page));

    const queryString = params.toString();

    return "/admin/orders" + (queryString ? `?${queryString}` : "");
};


// -----------------------------------------------------
// GET /admin/orders
// -----------------------------------------------------
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

        // urlFor({ status: "shipped" }) keeps the current search + sort
        // and changes only what you pass. Changing anything except the
        // page number sends you back to page 1.
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


// -----------------------------------------------------
// GET /admin/orders/:orderId
// -----------------------------------------------------
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


// -----------------------------------------------------
// POST /admin/orders/:orderId/status
// body: status, reason (reason only used when cancelling)
// -----------------------------------------------------
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


// -----------------------------------------------------
// POST /admin/orders/:orderId/items/:itemId/cancel
// body: reason (optional)
// -----------------------------------------------------
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

            // (if the order itself is missing, the details page sends
            //  the admin on to the order list with a message)
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