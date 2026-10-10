// =====================================================
// SALES REPORT CONSTANTS (PHASE 57)
//
// WHAT COUNTS AS A "SALE"?  (the business rule for every number)
//
//   An order is counted when ALL of these are true:
//     1. It is not Cancelled.
//     2. Its return was not Approved (that money went back to the customer).
//     3. If it was paid online, the payment was verified (Paid).
//        Failed / unpaid online orders are NOT sales.
//
//   Pending, Shipped, Out for Delivery and Delivered orders all count,
//   because the customer has placed the order and (COD aside) paid for it.
//
//   Inside a counted order, only ACTIVE items count. An item the customer
//   or admin cancelled is left out, and the coupon / tax are reduced by
//   the same share - exactly like the order page and invoice already do.
//
//   The date used is the day the order was PLACED (createdAt), in Indian
//   time (IST), because that is the day the admin sees on the order list.
//
// If the business rule ever changes, the one place to edit is
// buildSalesStages() in services/salesReportService.js.
// =====================================================

const REPORT_PERIODS = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom" }
];

const REPORT_DEFAULT_PERIOD = "daily";

// Table rows per page on the report screen.
const REPORT_ROWS_PER_PAGE = 10;

// A download never contains more than this many orders.
const REPORT_EXPORT_MAX_ROWS = 5000;

// India has no daylight saving, so a fixed offset is safe.
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_TEXT = "+05:30";

module.exports = {
    REPORT_PERIODS,
    REPORT_DEFAULT_PERIOD,
    REPORT_ROWS_PER_PAGE,
    REPORT_EXPORT_MAX_ROWS,
    IST_OFFSET_MINUTES,
    IST_OFFSET_TEXT
};
