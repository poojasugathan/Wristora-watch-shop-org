// =====================================================
// ORDER CONSTANTS (PHASE 50 + PHASE 51 + PHASE 52)
//
// ONE place for every order-related status string and
// pricing rule. Models, controllers, EJS files and (later)
// admin filters must import values from here, so a status
// like "Out for Delivery" is never typed two different ways.
// =====================================================

const ORDER_STATUS = {
    PENDING: "Pending",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled"
};

// Status of ONE product line inside an order.
// Needed later for cancelling a single item (Phase 51).
const ITEM_STATUS = {
    ACTIVE: "Active",
    CANCELLED: "Cancelled"
};

// Return workflow for a DELIVERED order (Phase 51).
// "None"      -> no return asked for
// "Requested" -> customer asked for a return (admin handling
//                of returns can extend this list later)
const RETURN_STATUS = {
    NONE: "None",
    REQUESTED: "Requested"
};

// An order can only be cancelled while its status is in this
// list. Want to allow cancelling Shipped orders too? Add
// ORDER_STATUS.SHIPPED here and every page + the backend follow.
const CANCELLABLE_ORDER_STATUSES = [ORDER_STATUS.PENDING];

// My Orders page + reasons
const ORDERS_PER_PAGE = 5;
const ORDER_SEARCH_MAX_LENGTH = 60;
const CANCEL_REASON_MAX_LENGTH = 300;
const RETURN_REASON_MIN_LENGTH = 10;
const RETURN_REASON_MAX_LENGTH = 500;

const PAYMENT_METHOD = {
    COD: "COD"
};

const PAYMENT_METHOD_LABEL = {
    COD: "Cash on Delivery"
};

const PAYMENT_STATUS = {
    PENDING: "Pending",
    PAID: "Paid"
};

// Pricing rules. Change them here and every page follows.
// 0 means "not charged" — the checkout page hides a tax row
// when it is 0 and shows shipping as "Free".
const TAX_RATE_PERCENT = 0;
const SHIPPING_CHARGE = 0;

// -----------------------------------------------------
// PHASE 52 - ADMIN ORDER MANAGEMENT
// -----------------------------------------------------

// Admin orders page
const ADMIN_ORDERS_PER_PAGE = 8;

// The admin may cancel an order until it is Delivered.
// (Customers can still only cancel while it is Pending -
// that rule is CANCELLABLE_ORDER_STATUSES above.)
const ADMIN_CANCELLABLE_ORDER_STATUSES = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY
];

// Which status may follow which. The backend checks every
// status change against this table - the browser is not trusted.
// Delivered and Cancelled are final.
const ORDER_STATUS_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: []
};

// Reason saved when the admin cancels without typing one.
const ADMIN_DEFAULT_CANCEL_REASON = "Cancelled by admin";

// "Out for Delivery" -> "out-for-delivery" (used in URLs / CSS classes)
const toSlug = (text) => String(text).toLowerCase().replace(/\s+/g, "-");

// Status filter buttons: All, one per order status, and Return Requested.
const ADMIN_ORDER_STATUS_FILTERS = [
    { value: "all", label: "All" },
    ...Object.values(ORDER_STATUS).map((status) => ({
        value: toSlug(status),
        label: status,
        orderStatus: status
    })),
    {
        value: "return-requested",
        label: "Return Requested",
        returnStatus: RETURN_STATUS.REQUESTED
    }
];

// Sort options (both sort by order date).
const ADMIN_ORDER_SORT_OPTIONS = [
    { value: "latest", label: "Latest first", sort: { createdAt: -1, _id: -1 } },
    { value: "oldest", label: "Oldest first", sort: { createdAt: 1, _id: 1 } }
];

module.exports = {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_STATUS,
    CANCELLABLE_ORDER_STATUSES,
    ORDERS_PER_PAGE,
    ORDER_SEARCH_MAX_LENGTH,
    CANCEL_REASON_MAX_LENGTH,
    RETURN_REASON_MIN_LENGTH,
    RETURN_REASON_MAX_LENGTH,
    PAYMENT_METHOD,
    PAYMENT_METHOD_LABEL,
    PAYMENT_STATUS,
    TAX_RATE_PERCENT,
    SHIPPING_CHARGE,
    ADMIN_ORDERS_PER_PAGE,
    ADMIN_CANCELLABLE_ORDER_STATUSES,
    ORDER_STATUS_TRANSITIONS,
    ADMIN_DEFAULT_CANCEL_REASON,
    ADMIN_ORDER_STATUS_FILTERS,
    ADMIN_ORDER_SORT_OPTIONS,
    toSlug
};