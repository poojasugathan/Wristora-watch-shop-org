// =====================================================
// DASHBOARD SERVICE (PHASE 58)
//
// Everything on the admin dashboard is calculated here, inside
// MongoDB, from real orders:
//
//   getDashboard -> summary cards (with growth vs the previous period),
//                   the chart data, and the Top 10 products /
//                   categories / brands.
//
// THE SAME SALES RULE AS THE SALES REPORT
//   This file does not have its own idea of "what is a sale". It uses
//   buildSalesStages() from salesReportService.js - the very same
//   pipeline the Sales Report uses - so the dashboard and the report
//   always show the same numbers for the same dates.
//   (The rule is written at the top of config/reportConstants.js.)
//
// The browser only receives small, ready-made numbers - never the
// orders themselves.
// =====================================================

const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");

const {
    ORDER_STATUS,
    PAYMENT_METHOD,
    PAYMENT_STATUS
} = require("../config/orderConstants");

const {
    DASHBOARD_PERIODS,
    DASHBOARD_DEFAULT_PERIOD,
    DASHBOARD_TOP_LIMIT,
    DASHBOARD_DAILY_BUCKET_MAX_DAYS
} = require("../config/dashboardConstants");

const { IST_OFFSET_TEXT } = require("../config/reportConstants");

const {
    resolveRange,
    buildRange,
    buildSalesStages,
    getSummary,
    todayInIndia,
    addDays,
    round2
} = require("./salesReportService");


// ---------------------------------------------------------
// DATES
// ---------------------------------------------------------

const toDate = (text) => new Date(`${text}T00:00:00Z`);

// Both dates are included: 2026-10-03 to 2026-10-09 = 7 days.
const daysBetween = (fromText, toText) =>
    Math.round((toDate(toText) - toDate(fromText)) / 86400000) + 1;

const lastDayOfMonth = (year, month) =>
    new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-12

const pad = (n) => String(n).padStart(2, "0");


// Weekly / Monthly / Yearly / Custom. Anything else becomes the default.
const resolveDashboardRange = (query = {}) => {

    const requested =
        typeof query.period === "string" ? query.period : DASHBOARD_DEFAULT_PERIOD;

    const period = DASHBOARD_PERIODS.some((p) => p.value === requested)
        ? requested
        : DASHBOARD_DEFAULT_PERIOD;

    if (period === "monthly") {

        // 1st of this month until today.
        const today = todayInIndia();

        return buildRange("monthly", `${today.slice(0, 7)}-01`, today);
    }

    // daily, weekly, yearly and custom are handled (and validated) by the
    // Sales Report's own date code.  (Daily = today only.)
    return resolveRange({
        period,
        from: query.from,
        to: query.to
    });
};


// The period right before this one, used for the "growth" badges.
//   daily   -> yesterday
//   weekly  -> the 7 days before
//   monthly -> the same days of last month
//   yearly  -> the same dates of last year
//   custom  -> the same number of days right before "From"
const resolvePreviousRange = (range) => {

    const { period, fromText, toText } = range;

    if (period === "monthly") {

        const year = Number(fromText.slice(0, 4));
        const month = Number(fromText.slice(5, 7));

        const prevYear = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : month - 1;

        const dayNumber = Number(toText.slice(8, 10));
        const prevDay = Math.min(dayNumber, lastDayOfMonth(prevYear, prevMonth));

        return buildRange(
            "monthly",
            `${prevYear}-${pad(prevMonth)}-01`,
            `${prevYear}-${pad(prevMonth)}-${pad(prevDay)}`
        );
    }

    if (period === "yearly") {

        const prevYear = Number(fromText.slice(0, 4)) - 1;
        const month = Number(toText.slice(5, 7));
        const day = Number(toText.slice(8, 10));

        // 29 February does not exist every year.
        const prevDay = Math.min(day, lastDayOfMonth(prevYear, month));

        return buildRange(
            "yearly",
            `${prevYear}-01-01`,
            `${prevYear}-${pad(month)}-${pad(prevDay)}`
        );
    }

    // daily, weekly and custom: the same number of days, right before "From".
    // (For one day that is simply yesterday.)
    const length = daysBetween(fromText, toText);
    const prevTo = addDays(fromText, -1);
    const prevFrom = addDays(prevTo, -(length - 1));

    return buildRange(period, prevFrom, prevTo);
};


// % change. When there was nothing before, a percentage is meaningless,
// so null is returned and the page shows "New" instead.
const growth = (current, previous) => {

    if (!previous) {
        return current ? null : 0;
    }

    return Math.round(((current - previous) / previous) * 1000) / 10;
};


// ---------------------------------------------------------
// PENDING + CANCELLED COUNTS
// ---------------------------------------------------------

const countOrders = async (range) => {

    const inRange = { $gte: range.start, $lt: range.end };

    const [pending, cancelled] = await Promise.all([

        // Pending = placed, not yet shipped, and not an unpaid online order.
        Order.countDocuments({
            createdAt: inRange,
            orderStatus: ORDER_STATUS.PENDING,
            $or: [
                { paymentMethod: { $ne: PAYMENT_METHOD.ONLINE } },
                { paymentStatus: PAYMENT_STATUS.PAID }
            ]
        }),

        Order.countDocuments({
            createdAt: inRange,
            orderStatus: ORDER_STATUS.CANCELLED
        })
    ]);

    return { pending, cancelled };
};


// ---------------------------------------------------------
// CHART (sales amount + order count per day, or per month)
// ---------------------------------------------------------

const SHORT_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const dayLabel = (text) =>
    `${text.slice(8, 10)} ${SHORT_MONTHS[Number(text.slice(5, 7)) - 1]}`;

const monthLabel = (text) =>
    `${SHORT_MONTHS[Number(text.slice(5, 7)) - 1]} ${text.slice(0, 4)}`;

// 0 -> "12 AM", 9 -> "9 AM", 13 -> "1 PM"
const hourLabel = (hour) => {

    const suffix = hour < 12 ? "AM" : "PM";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;

    return `${twelve} ${suffix}`;
};

const getChart = async (range) => {

    const days = daysBetween(range.fromText, range.toText);

    // ONE day (the Daily filter) is shown hour by hour.
    const byHour = days === 1;

    // A long range is shown month by month, so the chart stays readable.
    const byMonth = days > DASHBOARD_DAILY_BUCKET_MAX_DAYS;

    let format = "%Y-%m-%d";

    if (byHour) {
        format = "%H";
    } else if (byMonth) {
        format = "%Y-%m";
    }

    const rows = await Order.aggregate([
        ...buildSalesStages(range),
        {
            $group: {
                _id: {
                    $dateToString: {
                        format,
                        date: "$createdAt",
                        timezone: IST_OFFSET_TEXT
                    }
                },
                sales: { $sum: "$netSales" },
                orders: { $sum: 1 }
            }
        }
    ]);

    const found = new Map(rows.map((row) => [row._id, row]));

    // Every hour / day / month in the range gets a point, even with 0 sales.
    const labels = [];
    const sales = [];
    const orders = [];

    if (byHour) {

        for (let hour = 0; hour < 24; hour++) {

            const row = found.get(pad(hour));

            labels.push(hourLabel(hour));
            sales.push(row ? round2(row.sales) : 0);
            orders.push(row ? row.orders : 0);
        }

    } else if (byMonth) {

        let year = Number(range.fromText.slice(0, 4));
        let month = Number(range.fromText.slice(5, 7));

        const lastKey = range.toText.slice(0, 7);

        for (;;) {

            const key = `${year}-${pad(month)}`;
            const row = found.get(key);

            labels.push(monthLabel(`${key}-01`));
            sales.push(row ? round2(row.sales) : 0);
            orders.push(row ? row.orders : 0);

            if (key >= lastKey) {
                break;
            }

            month += 1;

            if (month > 12) {
                month = 1;
                year += 1;
            }
        }

    } else {

        for (let i = 0; i < days; i++) {

            const key = addDays(range.fromText, i);
            const row = found.get(key);

            labels.push(dayLabel(key));
            sales.push(row ? round2(row.sales) : 0);
            orders.push(row ? row.orders : 0);
        }
    }

    let grouping = "day";

    if (byHour) {
        grouping = "hour";
    } else if (byMonth) {
        grouping = "month";
    }

    return { labels, sales, orders, grouping };
};


// ---------------------------------------------------------
// TOP 10 LISTS (products, categories, brands)
// ---------------------------------------------------------

// Every ACTIVE item of every counted order, one row per item.
const itemStages = (range) => [
    ...buildSalesStages(range),
    { $unwind: "$activeItems" }
];

// Same sale rule, grouped by product. Categories are built on top of this.
const productGroupStages = (range) => [
    ...itemStages(range),
    {
        $group: {
            _id: "$activeItems.product",
            name: { $first: "$activeItems.productName" },
            image: { $first: "$activeItems.productImage" },
            quantity: { $sum: "$activeItems.quantity" },
            // Price after the product/offer discount, before the coupon
            // (a coupon belongs to the whole order, not to one product).
            sales: { $sum: "$activeItems.itemTotal" }
        }
    }
];

const RANK_SORT = { $sort: { quantity: -1, sales: -1, name: 1 } };

const getTopProducts = async (range, limit) => {

    const rows = await Order.aggregate([
        ...productGroupStages(range),
        RANK_SORT,
        { $limit: limit }
    ]);

    // Is each product still in stock right now?
    const products = await Product.find({
        _id: { $in: rows.map((row) => row._id) }
    })
        .select("stock")
        .lean();

    const byId = new Map(products.map((p) => [String(p._id), p]));

    return rows.map((row) => {

        const product = byId.get(String(row._id));

        let status = "Removed";

        if (product) {
            status = product.stock > 0 ? "In stock" : "Out of stock";
        }

        return {
            name: row.name,
            image: row.image || "",
            quantity: row.quantity,
            sales: round2(row.sales),
            status
        };
    });
};

const getTopCategories = async (range, limit) => {

    const rows = await Order.aggregate([
        ...productGroupStages(range),

        // Orders do not store the category, so it is read from the product.
        {
            $lookup: {
                from: Product.collection.name,
                localField: "_id",
                foreignField: "_id",
                as: "product"
            }
        },
        {
            $addFields: {
                categoryId: { $arrayElemAt: ["$product.category", 0] }
            }
        },
        {
            $group: {
                _id: "$categoryId",
                quantity: { $sum: "$quantity" },
                sales: { $sum: "$sales" }
            }
        },
        {
            $lookup: {
                from: Category.collection.name,
                localField: "_id",
                foreignField: "_id",
                as: "category"
            }
        },
        {
            $addFields: {
                name: {
                    $ifNull: [
                        { $arrayElemAt: ["$category.name", 0] },
                        "Unknown (removed)"
                    ]
                }
            }
        },
        RANK_SORT,
        { $limit: limit }
    ]);

    return rows.map((row) => ({
        name: row.name,
        quantity: row.quantity,
        sales: round2(row.sales)
    }));
};

const getTopBrands = async (range, limit) => {

    // The brand written on the ORDER (what it was when it was bought),
    // so a later change to the product does not rewrite history.
    const trimmedBrand = {
        $trim: { input: { $ifNull: ["$activeItems.brand", ""] } }
    };

    const rows = await Order.aggregate([
        ...itemStages(range),
        {
            $group: {
                _id: { $toLower: trimmedBrand },
                name: { $first: trimmedBrand },
                quantity: { $sum: "$activeItems.quantity" },
                sales: { $sum: "$activeItems.itemTotal" }
            }
        },
        RANK_SORT,
        { $limit: limit }
    ]);

    return rows.map((row) => ({
        name: row.name || "Unbranded",
        quantity: row.quantity,
        sales: round2(row.sales)
    }));
};


// ---------------------------------------------------------
// EVERYTHING FOR ONE DASHBOARD PAGE
// ---------------------------------------------------------

const getDashboard = async (range) => {

    const previousRange = resolvePreviousRange(range);

    const [
        summary,
        previousSummary,
        counts,
        chart,
        topProducts,
        topCategories,
        topBrands
    ] = await Promise.all([
        getSummary(range),
        getSummary(previousRange),
        countOrders(range),
        getChart(range),
        getTopProducts(range, DASHBOARD_TOP_LIMIT),
        getTopCategories(range, DASHBOARD_TOP_LIMIT),
        getTopBrands(range, DASHBOARD_TOP_LIMIT)
    ]);

    return {
        summary,
        previous: {
            label: previousRange.label,
            netSales: previousSummary.netSales,
            totalOrders: previousSummary.totalOrders
        },
        salesGrowth: growth(summary.netSales, previousSummary.netSales),
        orderGrowth: growth(summary.totalOrders, previousSummary.totalOrders),
        pendingOrders: counts.pending,
        cancelledOrders: counts.cancelled,
        chart,
        topProducts,
        topCategories,
        topBrands
    };
};


module.exports = {
    resolveDashboardRange,
    resolvePreviousRange,
    getDashboard,
    // exported for tests
    growth,
    daysBetween
};