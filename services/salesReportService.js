// =====================================================
// SALES REPORT SERVICE (PHASE 57)
//
//   resolveRange   -> turns "daily / weekly / yearly / custom" (and
//                     From / To dates) into a start and end Date.
//   getSalesReport -> totals + one page of orders, for the screen.
//   getExportData  -> totals + all orders (up to a limit), for PDF / Excel.
//
// All the maths runs INSIDE MongoDB (an "aggregation pipeline"). The
// browser never receives the whole orders collection, and nothing here
// trusts a number sent from the browser: only the period and the dates.
// =====================================================

const Order = require("../models/orderModel");

const {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_STATUS,
    PAYMENT_METHOD,
    PAYMENT_STATUS
} = require("../config/orderConstants");

const {
    REPORT_PERIODS,
    REPORT_DEFAULT_PERIOD,
    REPORT_ROWS_PER_PAGE,
    REPORT_EXPORT_MAX_ROWS,
    IST_OFFSET_MINUTES,
    IST_OFFSET_TEXT
} = require("../config/reportConstants");

const { buildPageNumbers } = require("../helpers/pagination");


class ReportError extends Error {
    constructor(message) {
        super(message);
        this.name = "ReportError";
    }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;


// ---------------------------------------------------------
// DATES (Indian time)
// ---------------------------------------------------------

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-09" for today in India.
const todayInIndia = () =>
    new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000)
        .toISOString()
        .slice(0, 10);

// Is it a real calendar date? ("2026-02-30" is not.)
const isRealDate = (text) => {

    if (typeof text !== "string" || !DATE_PATTERN.test(text)) {
        return false;
    }

    const parsed = new Date(`${text}T00:00:00Z`);

    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === text;
};

const addDays = (text, days) => {

    const date = new Date(`${text}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
};

// Midnight at the start of that day in India, as a real Date.
const startOfDay = (text) => new Date(`${text}T00:00:00${IST_OFFSET_TEXT}`);

const prettyDate = (text) =>
    new Date(`${text}T00:00:00Z`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });


// Packs a period + two dates into the range object used everywhere.
// (Phase 58: shared with the dashboard, which also has a "monthly" period.)
const buildRange = (period, fromText, toText) => ({
    period,
    fromText,
    toText,
    start: startOfDay(fromText),
    // The end is "the start of the next day", and is NOT included.
    end: startOfDay(addDays(toText, 1)),
    label: fromText === toText
        ? prettyDate(fromText)
        : `${prettyDate(fromText)} to ${prettyDate(toText)}`
});

// Turns the period the admin picked into a start and an end.
//   daily   = today
//   weekly  = the last 7 days, including today
//   yearly  = 1 January of this year until today
//   custom  = the From and To dates the admin typed (both included)
const resolveRange = (query = {}) => {

    const requestedPeriod =
        typeof query.period === "string" ? query.period : REPORT_DEFAULT_PERIOD;

    const known = REPORT_PERIODS.some((p) => p.value === requestedPeriod);

    const period = known ? requestedPeriod : REPORT_DEFAULT_PERIOD;

    const today = todayInIndia();

    let fromText;
    let toText;

    if (period === "daily") {

        fromText = today;
        toText = today;

    } else if (period === "weekly") {

        fromText = addDays(today, -6);
        toText = today;

    } else if (period === "yearly") {

        fromText = `${today.slice(0, 4)}-01-01`;
        toText = today;

    } else {

        fromText = typeof query.from === "string" ? query.from.trim() : "";
        toText = typeof query.to === "string" ? query.to.trim() : "";

        if (!fromText || !toText) {
            throw new ReportError("Please choose both a From date and a To date.");
        }

        if (!isRealDate(fromText) || !isRealDate(toText)) {
            throw new ReportError("Please enter valid dates.");
        }

        if (fromText > toText) {
            throw new ReportError("The From date cannot be after the To date.");
        }
    }

    return buildRange(period, fromText, toText);
};


// ---------------------------------------------------------
// THE AGGREGATION PIPELINE (the "what is a sale" rule lives here)
// ---------------------------------------------------------

const round = (expression) => ({ $round: [expression, 2] });

const buildSalesStages = (range) => [

    // 1. Pick the orders that count as sales (see config/reportConstants.js).
    {
        $match: {
            createdAt: { $gte: range.start, $lt: range.end },
            orderStatus: { $ne: ORDER_STATUS.CANCELLED },
            returnStatus: { $ne: RETURN_STATUS.APPROVED },
            $or: [
                { paymentMethod: { $ne: PAYMENT_METHOD.ONLINE } },
                { paymentStatus: PAYMENT_STATUS.PAID }
            ]
        }
    },

    // 2. Keep only the items that were not cancelled.
    {
        $addFields: {
            activeItems: {
                $filter: {
                    input: { $ifNull: ["$items", []] },
                    as: "item",
                    cond: { $ne: ["$$item.itemStatus", ITEM_STATUS.CANCELLED] }
                }
            }
        }
    },

    // 3. Item totals. itemTotal is the price AFTER the product/offer
    //    discount, so gross = itemTotal + discountAmount.
    {
        $addFields: {
            allTotal: { $sum: "$items.itemTotal" },
            activeTotal: { $sum: "$activeItems.itemTotal" },
            itemsSold: { $sum: "$activeItems.quantity" },
            productDiscount: { $sum: "$activeItems.discountAmount" },
            grossSales: {
                $sum: {
                    $map: {
                        input: "$activeItems",
                        as: "item",
                        in: { $add: ["$$item.itemTotal", "$$item.discountAmount"] }
                    }
                }
            }
        }
    },

    // 4. The share of the order that is still active. The coupon and the
    //    tax shrink by the same share when an item is cancelled.
    {
        $addFields: {
            ratio: {
                $cond: [
                    { $gt: ["$allTotal", 0] },
                    { $divide: ["$activeTotal", "$allTotal"] },
                    0
                ]
            }
        }
    },

    {
        $addFields: {
            couponAmount: round({
                $multiply: [{ $ifNull: ["$couponDiscount", 0] }, "$ratio"]
            }),
            taxAmount: round({
                $multiply: [{ $ifNull: ["$tax", 0] }, "$ratio"]
            }),
            shippingAmount: {
                $cond: [
                    { $gt: [{ $size: "$activeItems" }, 0] },
                    { $ifNull: ["$shipping", 0] },
                    0
                ]
            }
        }
    },

    // 5. Net sales = what was sold, after every discount.
    //    Final amount = what the customer pays (net sales + tax + shipping).
    {
        $addFields: {
            netSales: round({ $subtract: ["$activeTotal", "$couponAmount"] }),
            finalAmount: round({
                $add: [
                    { $subtract: ["$activeTotal", "$couponAmount"] },
                    "$taxAmount",
                    "$shippingAmount"
                ]
            })
        }
    },

    // 6. An order with nothing active is not a sale.
    { $match: { itemsSold: { $gt: 0 } } }
];


const getSummary = async (range) => {

    const result = await Order.aggregate([
        ...buildSalesStages(range),
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                itemsSold: { $sum: "$itemsSold" },
                grossSales: { $sum: "$grossSales" },
                productDiscount: { $sum: "$productDiscount" },
                couponDiscount: { $sum: "$couponAmount" },
                netSales: { $sum: "$netSales" },
                orderAmount: { $sum: "$finalAmount" }
            }
        }
    ]);

    const row = result[0] || {};

    return {
        totalOrders: row.totalOrders || 0,
        itemsSold: row.itemsSold || 0,
        grossSales: round2(row.grossSales),
        productDiscount: round2(row.productDiscount),
        couponDiscount: round2(row.couponDiscount),
        totalDiscount: round2((row.productDiscount || 0) + (row.couponDiscount || 0)),
        netSales: round2(row.netSales),
        orderAmount: round2(row.orderAmount)
    };
};


const getRows = async (range, { skip = 0, limit }) => {

    const rows = await Order.aggregate([
        ...buildSalesStages(range),
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            // Only what the report needs - no addresses, phones or emails.
            $project: {
                orderId: 1,
                createdAt: 1,
                user: 1,
                paymentMethod: 1,
                orderStatus: 1,
                itemsSold: 1,
                grossSales: 1,
                productDiscount: 1,
                couponCode: 1,
                couponAmount: 1,
                netSales: 1,
                finalAmount: 1,
                products: {
                    $map: {
                        input: "$activeItems",
                        as: "item",
                        in: {
                            name: "$$item.productName",
                            quantity: "$$item.quantity"
                        }
                    }
                }
            }
        }
    ]);

    // Only the customer's NAME is looked up.
    await Order.populate(rows, { path: "user", select: "firstName lastName" });

    return rows.map((row) => ({
        orderId: row.orderId,
        createdAt: row.createdAt,
        customer: row.user
            ? `${row.user.firstName || ""} ${row.user.lastName || ""}`.trim() || "Customer"
            : "Customer removed",
        paymentMethod: row.paymentMethod || PAYMENT_METHOD.COD,
        orderStatus: row.orderStatus,
        itemsSold: row.itemsSold || 0,
        products: (row.products || [])
            .map((p) => `${p.name} x${p.quantity}`)
            .join(", "),
        grossSales: round2(row.grossSales),
        productDiscount: round2(row.productDiscount),
        couponCode: row.couponCode || "",
        couponDiscount: round2(row.couponAmount),
        netSales: round2(row.netSales),
        finalAmount: round2(row.finalAmount)
    }));
};


// One page of the report, for the admin screen.
const getSalesReport = async (range, requestedPage = 1) => {

    const summary = await getSummary(range);

    const totalPages = Math.max(
        1,
        Math.ceil(summary.totalOrders / REPORT_ROWS_PER_PAGE)
    );

    const page = Number.isInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, totalPages)
        : 1;

    const rows = summary.totalOrders === 0
        ? []
        : await getRows(range, {
            skip: (page - 1) * REPORT_ROWS_PER_PAGE,
            limit: REPORT_ROWS_PER_PAGE
        });

    return {
        summary,
        rows,
        currentPage: page,
        totalPages,
        pageNumbers: buildPageNumbers(page, totalPages)
    };
};


// Every order in the range (capped), for PDF and Excel.
const getExportData = async (range) => {

    const summary = await getSummary(range);

    const rows = summary.totalOrders === 0
        ? []
        : await getRows(range, { skip: 0, limit: REPORT_EXPORT_MAX_ROWS });

    return {
        summary,
        rows,
        truncated: summary.totalOrders > REPORT_EXPORT_MAX_ROWS,
        maxRows: REPORT_EXPORT_MAX_ROWS
    };
};


module.exports = {
    ReportError,
    resolveRange,
    getSalesReport,
    getExportData,
    // Phase 58: the dashboard reuses the SAME sales rule and the same
    // date helpers, so its numbers always match the Sales Report.
    buildSalesStages,
    getSummary,
    buildRange,
    todayInIndia,
    addDays,
    isRealDate,
    round2
};