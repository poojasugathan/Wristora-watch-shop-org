// =====================================================
// ADMIN SALES REPORT CONTROLLER (PHASE 57)
//
// Three pages, all behind requireAdmin in routes/adminRoutes.js:
//   GET /admin/sales-report                 -> the report screen
//   GET /admin/sales-report/download/pdf    -> PDF download
//   GET /admin/sales-report/download/excel  -> Excel download
//
// Only "period", "from", "to" and "page" are read from the browser.
// Every number in the report is calculated by MongoDB on the server.
// =====================================================

const {
    ReportError,
    resolveRange,
    getSalesReport,
    getExportData
} = require("../services/salesReportService");

const {
    buildPdfBuffer,
    buildExcelBuffer
} = require("../services/reportExportService");

const { setFlash, takeFlash } = require("../helpers/adminFlash");

const {
    REPORT_PERIODS,
    REPORT_DEFAULT_PERIOD
} = require("../config/reportConstants");

const asText = (value) => (typeof value === "string" ? value : "");

const REPORT_URL = "/admin/sales-report";


// The query string that keeps the same period when downloading.
const buildQuery = (range) => {

    const params = new URLSearchParams({ period: range.period });

    if (range.period === "custom") {
        params.set("from", range.fromText);
        params.set("to", range.toText);
    }

    return params.toString();
};

// "wristora-sales-report-2026-10-03_to_2026-10-09"
const buildFileName = (range) =>
    `wristora-sales-report-${range.fromText}_to_${range.toText}`;


const loadSalesReport = async (req, res) => {

    const period = asText(req.query.period) || REPORT_DEFAULT_PERIOD;
    const from = asText(req.query.from);
    const to = asText(req.query.to);

    const baseView = {
        title: "Sales Report",
        flash: takeFlash(req),
        periods: REPORT_PERIODS,
        period,
        from,
        to,
        error: null,
        range: null,
        report: null,
        downloadQuery: ""
    };

    try {

        const range = resolveRange({ period, from, to });

        const report = await getSalesReport(
            range,
            parseInt(req.query.page, 10) || 1
        );

        return res.render("admin/salesReport", {
            ...baseView,
            // Show the dates that were really used.
            period: range.period,
            from: range.fromText,
            to: range.toText,
            range,
            report,
            downloadQuery: buildQuery(range)
        });

    } catch (error) {

        if (error instanceof ReportError) {

            return res.status(400).render("admin/salesReport", {
                ...baseView,
                error: error.message
            });
        }

        console.error("Load sales report error:", error);

        return res.status(500).render("admin/salesReport", {
            ...baseView,
            error: "We couldn't build the report right now. Please try again."
        });
    }
};


// Shared by both downloads.
const sendDownload = async (req, res, { extension, mimeType, build }) => {

    let range;

    try {

        range = resolveRange({
            period: asText(req.query.period),
            from: asText(req.query.from),
            to: asText(req.query.to)
        });

    } catch (error) {

        if (error instanceof ReportError) {
            setFlash(req, "error", error.message);
            return res.redirect(REPORT_URL);
        }

        throw error;
    }

    try {

        const data = await getExportData(range);

        const buffer = await build({ range, ...data });

        res.setHeader("Content-Type", mimeType);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${buildFileName(range)}.${extension}"`
        );
        res.setHeader("Content-Length", buffer.length);

        return res.send(buffer);

    } catch (error) {

        console.error(`Sales report ${extension} download error:`, error);

        setFlash(
            req,
            "error",
            error.code === "EXCELJS_MISSING"
                ? "Excel download is not set up yet. Please run: npm install exceljs"
                : "We couldn't create the file right now. Please try again."
        );

        return res.redirect(`${REPORT_URL}?${buildQuery(range)}`);
    }
};

const downloadPdf = (req, res) =>
    sendDownload(req, res, {
        extension: "pdf",
        mimeType: "application/pdf",
        build: buildPdfBuffer
    });

const downloadExcel = (req, res) =>
    sendDownload(req, res, {
        extension: "xlsx",
        mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        build: buildExcelBuffer
    });


module.exports = {
    loadSalesReport,
    downloadPdf,
    downloadExcel
};

