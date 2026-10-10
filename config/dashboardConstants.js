// =====================================================
// DASHBOARD CONSTANTS (PHASE 58)
// =====================================================

// The filter buttons on the admin dashboard.
//   Daily   = today only (the chart then shows one point per HOUR)
//   Weekly  = the last 7 days (including today)
//   Monthly = 1st of this month until today
//   Yearly  = 1 January of this year until today
//   Custom  = the From and To dates the admin picks
const DASHBOARD_PERIODS = [
    { value: "Today", label: "Today" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom" }
];

const DASHBOARD_DEFAULT_PERIOD = "weekly";

// How many rows the "best selling" lists show.
const DASHBOARD_TOP_LIMIT = 10;

// Up to this many days the chart shows one point per DAY.
// A longer range (a year, a long custom range) shows one point per MONTH.
const DASHBOARD_DAILY_BUCKET_MAX_DAYS = 92;

module.exports = {
    DASHBOARD_PERIODS,
    DASHBOARD_DEFAULT_PERIOD,
    DASHBOARD_TOP_LIMIT,
    DASHBOARD_DAILY_BUCKET_MAX_DAYS
};