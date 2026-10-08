

const mongoose = require("mongoose");

const Order = require("../models/orderModel");
const Product = require("../models/productModel");

const { ORDER_ID_PATTERN } = require("./orderService");

const {
    escapeRegex,
    buildPageNumbers
} = require("../helpers/pagination");

const {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_STATUS,
    CANCELLABLE_ORDER_STATUSES,
    ORDERS_PER_PAGE,
    ORDER_SEARCH_MAX_LENGTH,
    CANCEL_REASON_MAX_LENGTH,
    RETURN_REASON_MIN_LENGTH,
    RETURN_REASON_MAX_LENGTH
} = require("../config/orderConstants");



class OrderError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "OrderError";
        this.status = status;
    }
}

const round2 = (n) => Math.round(n * 100) / 100;

const sum = (list, pick) =>
    list.reduce((total, entry) => total + pick(entry), 0);


const isActive = (item) => item.itemStatus !== ITEM_STATUS.CANCELLED;

const cleanText = (value) =>
    typeof value === "string" ? value.trim() : "";


const calculateActiveAmounts = (order) => {

    const allItems = order.items || [];
    const activeItems = allItems.filter(isActive);

    const allTotal = sum(allItems, (i) => i.itemTotal);
    const activeTotal = sum(activeItems, (i) => i.itemTotal);

    const subtotal = round2(
        sum(activeItems, (i) => i.itemTotal + i.discountAmount)
    );

    const discountTotal = round2(
        sum(activeItems, (i) => i.discountAmount)
    );

    
    const ratio = allTotal > 0 ? activeTotal / allTotal : 0;
    const tax = round2((order.tax || 0) * ratio);

    const shipping = activeItems.length > 0 ? (order.shipping || 0) : 0;

    const finalTotal = round2(activeTotal + tax + shipping);

    const cancelledCount = allItems.length - activeItems.length;

    return {
        subtotal,
        discountTotal,
        tax,
        shipping,
        finalTotal,
        cancelledCount
    };
};

const decorateOrder = (order) => {

    const items = order.items || [];
    const activeItems = items.filter(isActive);

    const returnStatus = order.returnStatus || RETURN_STATUS.NONE;

    const canCancel =
        CANCELLABLE_ORDER_STATUSES.includes(order.orderStatus) &&
        activeItems.length > 0;

    const canReturn =
        order.orderStatus === ORDER_STATUS.DELIVERED &&
        returnStatus === RETURN_STATUS.NONE &&
        activeItems.length > 0;

    const displayStatus =
        returnStatus === RETURN_STATUS.REQUESTED
            ? "Return Requested"
            : order.orderStatus;

    return {
        ...order,
        returnStatus,
        amounts: calculateActiveAmounts(order),
        activeItemCount: activeItems.length,
        leadItem: activeItems[0] || items[0],
        canCancel,
        canCancelItems: canCancel && activeItems.length > 1,
        canReturn,
        canDownloadInvoice: order.orderStatus !== ORDER_STATUS.CANCELLED,
        displayStatus,
        statusClass: displayStatus.toLowerCase().replace(/\s+/g, "-")
    };
};

const listUserOrders = async (userId, { search = "", page = 1 } = {}) => {

    const cleanSearch = cleanText(search).slice(0, ORDER_SEARCH_MAX_LENGTH);

    const filter = { user: userId};

    if (cleanSearch) {

        const pattern = new RegExp(escapeRegex(cleanSearch), "i");

        filter.$or = [
            { orderId: pattern },
            { "items.productName": pattern }
        ];
    }

    const totalOrders = await Order.countDocuments(filter);

    const totalPages = Math.max(1, Math.ceil(totalOrders / ORDERS_PER_PAGE));

    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const currentPage = Math.min(requestedPage, totalPages);

    const orders = await Order.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * ORDERS_PER_PAGE)
        .limit(ORDERS_PER_PAGE)
        .lean();

    return {
        orders: orders.map(decorateOrder),
        search: cleanSearch,
        totalOrders,
        totalPages,
        currentPage,
        pageNumbers: buildPageNumbers(currentPage, totalPages)
    };
};

const findOwnedOrder = async (userId, orderId) => {

    if (typeof orderId !== "string" || !ORDER_ID_PATTERN.test(orderId)) {
        throw new OrderError("Order not found.", 404);
    }

    const order = await Order.findOne({ orderId, user: userId }).lean();

    if (!order) {
        throw new OrderError("Order not found.", 404);
    }

    return order;
};

const getUserOrder = async (userId, orderId) =>
    decorateOrder(await findOwnedOrder(userId, orderId));

const cancelOrderItems = async (userId, orderId, { itemId = null, reason = "" } = {}) => {

    const cleanReason = cleanText(reason);




    if (cleanReason.length > CANCEL_REASON_MAX_LENGTH) {
        throw new OrderError(
            `Please keep the reason under ${CANCEL_REASON_MAX_LENGTH} characters.`
        );
    }

    const order = await findOwnedOrder(userId, orderId);

    if (order.orderStatus === ORDER_STATUS.CANCELLED) {
        throw new OrderError("This order is already cancelled.");
    }

    if (!CANCELLABLE_ORDER_STATUSES.includes(order.orderStatus)) {
        throw new OrderError(
            `This order can no longer be cancelled because it is ${order.orderStatus}.`
        );
    }

    let targets;

    if (itemId) {

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

        targets = [item];

    } else {

        targets = order.items.filter(isActive);
    }

    if (targets.length === 0) {
        throw new OrderError("There is nothing left to cancel in this order.");
    }

    let cancelledCount = 0;

    for (const item of targets) {

       
        const claim = await Order.updateOne(
            {
                _id: order._id,
                user: userId,
                orderStatus: { $in: CANCELLABLE_ORDER_STATUSES },
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
                    "items.$.cancellationReason": cleanReason
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
            orderStatus: { $in: CANCELLABLE_ORDER_STATUSES },
            items: { $not: { $elemMatch: { itemStatus: ITEM_STATUS.ACTIVE } } }
        },
        {
            $set: {
                orderStatus: ORDER_STATUS.CANCELLED,
                cancellationReason: cleanReason
            }
        }
    );

    return {
        cancelledCount,
        orderCancelled: closeOrder.modifiedCount === 1
    };
};


const returnOrder = async (userId, orderId, reason) => {

    const cleanReason = cleanText(reason);

    if (!cleanReason) {
        throw new OrderError("Please tell us why you want to return this order.");
    }

    if (cleanReason.length < RETURN_REASON_MIN_LENGTH) {
        throw new OrderError(
            `Please explain the reason in at least ${RETURN_REASON_MIN_LENGTH} characters.`
        );
    }

    if (cleanReason.length > RETURN_REASON_MAX_LENGTH) {
        throw new OrderError(
            `Please keep the reason under ${RETURN_REASON_MAX_LENGTH} characters.`
        );
    }

    const order = await findOwnedOrder(userId, orderId);

    if (order.orderStatus !== ORDER_STATUS.DELIVERED) {
        throw new OrderError("Only delivered orders can be returned.");
    }

    if ((order.returnStatus || RETURN_STATUS.NONE) !== RETURN_STATUS.NONE) {
        throw new OrderError("A return has already been requested for this order.");
    }

  
    const updated = await Order.findOneAndUpdate(
        {
            _id: order._id,
            user: userId,
            orderStatus: ORDER_STATUS.DELIVERED,
            returnStatus: { $in: [RETURN_STATUS.NONE, null] }
        },
        {
            $set: {
                returnStatus: RETURN_STATUS.REQUESTED,
                returnReason: cleanReason,
                returnRequestedAt: new Date()
            }
        },
        { new: true }
    ).lean();

    if (!updated) {
        throw new OrderError("A return has already been requested for this order.");
    }

    return updated;
};


module.exports = {
    OrderError,
    calculateActiveAmounts,
    listUserOrders,
    getUserOrder,
    cancelOrderItems,
    returnOrder
};