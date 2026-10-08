
const mongoose = require("mongoose");

const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");

const { ORDER_ID_PATTERN } = require("./orderService");

const {
    OrderError,
    calculateActiveAmounts
} = require("./orderManagementService");

const {
    escapeRegex,
    buildPageNumbers
} = require("../helpers/pagination");

const {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_STATUS,
    PAYMENT_STATUS,
    ORDER_SEARCH_MAX_LENGTH,
    CANCEL_REASON_MAX_LENGTH,
    ADMIN_ORDERS_PER_PAGE,
    ADMIN_CANCELLABLE_ORDER_STATUSES,
    ORDER_STATUS_TRANSITIONS,
    ADMIN_DEFAULT_CANCEL_REASON,
    ADMIN_ORDER_STATUS_FILTERS,
    ADMIN_ORDER_SORT_OPTIONS,
    toSlug
} = require("../config/orderConstants");

const isActive = (item) => item.itemStatus !== ITEM_STATUS.CANCELLED;

const cleanText = (value) =>
    typeof value === "string" ? value.trim() : "";

const decorateAdminOrder = (order) => {

    const items = order.items || [];
    const activeItems = items.filter(isActive);

    const returnStatus = order.returnStatus || RETURN_STATUS.NONE;

    const displayStatus =
        returnStatus === RETURN_STATUS.REQUESTED
            ? "Return Requested"
            : order.orderStatus;

    const canCancel =
        ADMIN_CANCELLABLE_ORDER_STATUSES.includes(order.orderStatus) &&
        activeItems.length > 0;

    return {
        ...order,
        returnStatus,
        amounts: calculateActiveAmounts(order),
        itemCount: items.length,
        activeItemCount: activeItems.length,
        displayStatus,
        statusClass: toSlug(displayStatus),
        nextStatuses: ORDER_STATUS_TRANSITIONS[order.orderStatus] || [],
        canCancelItems: canCancel && activeItems.length > 1
    };
};


const listAdminOrders = async ({
    search = "",
    status = "all",
    sort = "latest",
    page = 1
} = {}) => {

    const cleanSearch = cleanText(search).slice(0, ORDER_SEARCH_MAX_LENGTH);

   
    const statusFilter =
        ADMIN_ORDER_STATUS_FILTERS.find((f) => f.value === status) ||
        ADMIN_ORDER_STATUS_FILTERS[0];

    const sortOption =
        ADMIN_ORDER_SORT_OPTIONS.find((s) => s.value === sort) ||
        ADMIN_ORDER_SORT_OPTIONS[0];

    const filter = {};

    if (statusFilter.orderStatus) {
        filter.orderStatus = statusFilter.orderStatus;
    }

    if (statusFilter.returnStatus) {
        filter.returnStatus = statusFilter.returnStatus;
    }

    if (cleanSearch) {

        const escaped = escapeRegex(cleanSearch);
        const pattern = new RegExp(escaped, "i");

        const matchingUsers = await User.find({
            $or: [
                { firstName: pattern },
                { lastName: pattern },
                { email: pattern },
                {
                    $expr: {
                        $regexMatch: {
                            input: { $concat: ["$firstName", " ", "$lastName"] },
                            regex: escaped,
                            options: "i"
                        }
                    }
                }
            ]
        })
            .select("_id")
            .limit(500)
            .lean();

        
        filter.$or = [{ orderId: pattern }];

        if (matchingUsers.length > 0) {
            filter.$or.push({ user: { $in: matchingUsers.map((u) => u._id) } });
        }
    }

    const totalOrders = await Order.countDocuments(filter);

    const totalPages = Math.max(1, Math.ceil(totalOrders / ADMIN_ORDERS_PER_PAGE));

    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const currentPage = Math.min(requestedPage, totalPages);

    const orders = await Order.find(filter)
        .populate("user", "firstName lastName email phone")
        .sort(sortOption.sort)
        .skip((currentPage - 1) * ADMIN_ORDERS_PER_PAGE)
        .limit(ADMIN_ORDERS_PER_PAGE)
        .lean();

    return {
        orders: orders.map(decorateAdminOrder),
        search: cleanSearch,
        status: statusFilter.value,
        sort: sortOption.value,
        totalOrders,
        totalPages,
        currentPage,
        pageNumbers: buildPageNumbers(currentPage, totalPages)
    };
};



const findOrderByOrderId = async (orderId) => {

    if (typeof orderId !== "string" || !ORDER_ID_PATTERN.test(orderId)) {
        throw new OrderError("Order not found.", 404);
    }

    const order = await Order.findOne({ orderId }).lean();

    if (!order) {
        throw new OrderError("Order not found.", 404);
    }

    return order;
};

const getAdminOrder = async (orderId) => {

    if (typeof orderId !== "string" || !ORDER_ID_PATTERN.test(orderId)) {
        throw new OrderError("Order not found.", 404);
    }

    const order = await Order.findOne({ orderId })
        .populate("user", "firstName lastName email phone")
        .lean();

    if (!order) {
        throw new OrderError("Order not found.", 404);
    }

    return decorateAdminOrder(order);
};

const cancelItems = async (order, targets, reason) => {

    let cancelledCount = 0;

    for (const item of targets) {

       
        const claim = await Order.updateOne(
            {
                _id: order._id,
                orderStatus: { $in: ADMIN_CANCELLABLE_ORDER_STATUSES },
                items: {
                    $elemMatch: {
                        _id: item._id,
                        itemStatus: ITEM_STATUS.ACTIVE
                    }
                }
            },
            {
                $set: {
                    "items.$.itemStatus": ITEM_STATUS.CANCELLED,
                    "items.$.cancellationReason": reason
                }
            }
        );

        if (claim.modifiedCount !== 1) {
            continue; 
        }

        cancelledCount++;

        
        try {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { stock: item.quantity } }
            );
        } catch (stockError) {
            console.error(
                `Stock restore failed for order ${order.orderId}, item ${item._id}:`,
                stockError
            );
        }
    }

    if (cancelledCount === 0) {
        throw new OrderError("These items were already cancelled.");
    }

    const closeOrder = await Order.updateOne(
        {
            _id: order._id,
            orderStatus: { $in: ADMIN_CANCELLABLE_ORDER_STATUSES },
            items: { $not: { $elemMatch: { itemStatus: ITEM_STATUS.ACTIVE } } }
        },
        {
            $set: {
                orderStatus: ORDER_STATUS.CANCELLED,
                cancellationReason: reason
            }
        }
    );

    return {
        cancelledCount,
        orderCancelled: closeOrder.modifiedCount === 1
    };
};


const cleanCancelReason = (reason) => {

    const cleanReason = cleanText(reason);

    if (cleanReason.length > CANCEL_REASON_MAX_LENGTH) {
        throw new OrderError(
            `Please keep the reason under ${CANCEL_REASON_MAX_LENGTH} characters.`
        );
    }

    return cleanReason || ADMIN_DEFAULT_CANCEL_REASON;
};


const changeOrderStatus = async (orderId, newStatus, reason = "") => {

    const order = await findOrderByOrderId(orderId);

   
    if (
        typeof newStatus !== "string" ||
        !Object.values(ORDER_STATUS).includes(newStatus)
    ) {
        throw new OrderError("Please choose a valid order status.");
    }

    if (newStatus === order.orderStatus) {
        throw new OrderError(`This order is already ${order.orderStatus}.`);
    }

    const allowed = ORDER_STATUS_TRANSITIONS[order.orderStatus] || [];

    if (!allowed.includes(newStatus)) {
        throw new OrderError(
            `An order that is ${order.orderStatus} cannot be changed to ${newStatus}.`
        );
    }

   
    if (newStatus === ORDER_STATUS.CANCELLED) {

        const cleanReason = cleanCancelReason(reason);

        const targets = order.items.filter(isActive);

        if (targets.length === 0) {
            throw new OrderError("There is nothing left to cancel in this order.");
        }

        return cancelItems(order, targets, cleanReason);
    }

   
    const changes = { orderStatus: newStatus };

    if (newStatus === ORDER_STATUS.DELIVERED) {
        changes.paymentStatus = PAYMENT_STATUS.PAID;
    }

    const result = await Order.updateOne(
        { _id: order._id, orderStatus: order.orderStatus },
        { $set: changes }
    );

    if (result.modifiedCount !== 1) {
        throw new OrderError(
            "This order was just changed by someone else. Please reload the page and try again.",
            409
        );
    }

    return { cancelledCount: 0, orderCancelled: false };
};


const cancelOrderItemAsAdmin = async (orderId, itemId, reason = "") => {

    const cleanReason = cleanCancelReason(reason);

    const order = await findOrderByOrderId(orderId);

    if (order.orderStatus === ORDER_STATUS.CANCELLED) {
        throw new OrderError("This order is already cancelled.");
    }

    if (!ADMIN_CANCELLABLE_ORDER_STATUSES.includes(order.orderStatus)) {
        throw new OrderError(
            `Items can no longer be cancelled because the order is ${order.orderStatus}.`
        );
    }

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
        throw new OrderError("Item not found in this order.", 404);
    }

    const item = order.items.find(
        (entry) => entry._id.toString() === String(itemId)
    );

    if (!item) {
        throw new OrderError("Item not found in this order.", 404);
    }

    if (!isActive(item)) {
        throw new OrderError("This item is already cancelled.");
    }

    const result = await cancelItems(order, [item], cleanReason);

    return { ...result, productName: item.productName };
};


module.exports = {
    listAdminOrders,
    getAdminOrder,
    changeOrderStatus,
    cancelOrderItemAsAdmin
};