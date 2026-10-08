
const ORDER_STATUS = {
    PENDING: "Pending",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled"
};

const ITEM_STATUS = {
    ACTIVE: "Active",
    CANCELLED: "Cancelled"
};

const RETURN_STATUS = {
    NONE: "None",
    REQUESTED: "Requested"
};


const CANCELLABLE_ORDER_STATUSES = [ORDER_STATUS.PENDING];


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


const TAX_RATE_PERCENT = 0;
const SHIPPING_CHARGE = 0;

const ADMIN_ORDERS_PER_PAGE = 8;


const ADMIN_CANCELLABLE_ORDER_STATUSES = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY
];

const ORDER_STATUS_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: []
};

const ADMIN_DEFAULT_CANCEL_REASON = "Cancelled by admin";

const toSlug = (text) => String(text).toLowerCase().replace(/\s+/g, "-");

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