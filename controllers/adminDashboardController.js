// =====================================================
// ADMIN DASHBOARD CONTROLLER (PHASE 58)
//
// Replaces the old loadDashboard in adminController.js, which showed
// fixed demo numbers. This one shows real, calculated numbers.
//
//   GET /admin/dashboard?period=weekly|monthly|yearly|custom&from=&to=
//
// Only "period", "from" and "to" are read from the browser. Every
// number is calculated by MongoDB on the server.
// =====================================================

const {
    ReportError
} = require("../services/salesReportService");

const {
    resolveDashboardRange,
    getDashboard
} = require("../services/dashboardService");

const {
    DASHBOARD_PERIODS,
    DASHBOARD_DEFAULT_PERIOD
} = require("../config/dashboardConstants");

const asText = (value) => (typeof value === "string" ? value : "");

// Safe to put inside a <script type="application/json"> tag:
// "<" is written as \u003c so nothing can close the tag early.
const toSafeJson = (data) =>
    JSON.stringify(data).replace(/</g, "\\u003c");

const EMPTY_DASHBOARD = {
    summary: {
        totalOrders: 0,
        itemsSold: 0,
        grossSales: 0,
        productDiscount: 0,
        couponDiscount: 0,
        totalDiscount: 0,
        netSales: 0,
        orderAmount: 0
    },
    previous: { label: "", netSales: 0, totalOrders: 0 },
    salesGrowth: 0,
    orderGrowth: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    chart: { labels: [], sales: [], orders: [], grouping: "day" },
    topProducts: [],
    topCategories: [],
    topBrands: []
};


const loadDashboard = async (req, res) => {

    const period = asText(req.query.period) || DASHBOARD_DEFAULT_PERIOD;
    const from = asText(req.query.from);
    const to = asText(req.query.to);

    const baseView = {
        title: "Admin Dashboard",
        periods: DASHBOARD_PERIODS,
        period,
        from,
        to,
        range: null,
        error: null,
        data: EMPTY_DASHBOARD,
        chartJson: toSafeJson(EMPTY_DASHBOARD.chart)
    };

    try {

        const range = resolveDashboardRange({ period, from, to });

        const data = await getDashboard(range);

        return res.render("admin/dashboard", {
            ...baseView,
            // Show the period and dates that were really used.
            period: range.period,
            from: range.fromText,
            to: range.toText,
            range,
            data,
            chartJson: toSafeJson(data.chart)
        });

    } catch (error) {

        if (error instanceof ReportError) {

            return res.status(400).render("admin/dashboard", {
                ...baseView,
                error: error.message
            });
        }

        console.error("Admin dashboard error:", error);

        return res.status(500).render("admin/dashboard", {
            ...baseView,
            error: "We couldn't load the dashboard right now. Please try again."
        });
    }
};


module.exports = {
    loadDashboard
};