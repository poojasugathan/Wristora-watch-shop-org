// =====================================================
// REPORT EXPORT SERVICE (PHASE 57)
//
// Builds the downloadable files from the report data:
//   buildPdfBuffer   -> PDF   (uses PDFKit, already used for invoices)
//   buildExcelBuffer -> Excel (uses ExcelJS)
//
// Both files are created in memory on the server and sent straight
// to the admin's browser. Nothing is saved on disk.
// =====================================================

const PDFDocument = require("pdfkit");

const { PAYMENT_METHOD_LABEL } = require("../config/orderConstants");

// "Rs." is used (not the rupee symbol) because PDFKit's built-in
// fonts do not contain it - the invoice does the same.
const money = (n) =>
    "Rs. " +
    Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata"
    });

const formatDateTime = (date) =>
    new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    });

const paymentLabel = (method) => PAYMENT_METHOD_LABEL[method] || method;


const SUMMARY_LINES = (summary) => [
    ["Total Orders", summary.totalOrders],
    ["Items Sold", summary.itemsSold],
    ["Gross Sales", summary.grossSales, true],
    ["Product / Offer Discount", summary.productDiscount, true],
    ["Coupon Discount", summary.couponDiscount, true],
    ["Total Discount", summary.totalDiscount, true],
    ["Net Sales", summary.netSales, true],
    ["Total Order Amount", summary.orderAmount, true]
];


// ---------------------------------------------------------
// PDF
// ---------------------------------------------------------

// Page is A4 landscape: 842 x 595 points.
const PDF = {
    left: 36,
    right: 806,
    bottomLimit: 530,
    rowHeight: 20
};

const PDF_COLUMNS = [
    { title: "Order ID", x: 36, w: 118, align: "left" },
    { title: "Date", x: 156, w: 68, align: "left" },
    { title: "Customer", x: 226, w: 108, align: "left" },
    { title: "Payment", x: 336, w: 92, align: "left" },
    { title: "Qty", x: 430, w: 28, align: "right" },
    { title: "Gross", x: 462, w: 72, align: "right" },
    { title: "Discount", x: 538, w: 66, align: "right" },
    { title: "Coupon", x: 608, w: 66, align: "right" },
    { title: "Net Sales", x: 678, w: 62, align: "right" },
    { title: "Final", x: 744, w: 62, align: "right" }
];

const buildPdfBuffer = ({ range, summary, rows, truncated, maxRows }) =>
    new Promise((resolve, reject) => {

        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margin: 36,
            bufferPages: true
        });

        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // ----- title -----
        doc.font("Helvetica-Bold").fontSize(20).fillColor("#172033")
            .text("Wristora - Sales Report", PDF.left, 36);

        doc.font("Helvetica").fontSize(10).fillColor("#555")
            .text(`Period: ${range.label}`, PDF.left, 64)
            .text(`Generated: ${formatDateTime(new Date())}`, PDF.left, 78);

        // ----- summary -----
        let y = 104;

        doc.font("Helvetica-Bold").fontSize(12).fillColor("#172033")
            .text("Summary", PDF.left, y);

        y += 20;

        SUMMARY_LINES(summary).forEach(([label, value, isMoney]) => {

            doc.font("Helvetica").fontSize(10).fillColor("#333")
                .text(label, PDF.left, y, { width: 200, lineBreak: false });

            doc.font("Helvetica-Bold")
                .text(isMoney ? money(value) : String(value), 240, y, {
                    width: 140,
                    align: "right",
                    lineBreak: false
                });

            y += 16;
        });

        y += 14;

        // ----- table -----
        const drawHeader = () => {

            doc.rect(PDF.left, y - 4, PDF.right - PDF.left, PDF.rowHeight)
                .fill("#172033");

            doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");

            PDF_COLUMNS.forEach((col) => {
                doc.text(col.title, col.x + 2, y + 2, {
                    width: col.w - 4,
                    align: col.align,
                    lineBreak: false
                });
            });

            y += PDF.rowHeight + 2;
        };

        if (rows.length === 0) {

            doc.font("Helvetica").fontSize(11).fillColor("#555")
                .text("No sales were found for this period.", PDF.left, y);

        } else {

            doc.font("Helvetica-Bold").fontSize(12).fillColor("#172033")
                .text("Orders", PDF.left, y);

            y += 20;

            if (y + PDF.rowHeight * 2 > PDF.bottomLimit) {
                doc.addPage();
                y = 36;
            }

            drawHeader();

            rows.forEach((row, index) => {

                if (y + PDF.rowHeight > PDF.bottomLimit) {
                    doc.addPage();
                    y = 36;
                    drawHeader();
                }

                if (index % 2 === 1) {
                    doc.rect(PDF.left, y - 4, PDF.right - PDF.left, PDF.rowHeight)
                        .fill("#f4f5f7");
                }

                const cells = [
                    row.orderId,
                    formatDate(row.createdAt),
                    row.customer,
                    paymentLabel(row.paymentMethod),
                    String(row.itemsSold),
                    money(row.grossSales).replace("Rs. ", ""),
                    money(row.productDiscount).replace("Rs. ", ""),
                    money(row.couponDiscount).replace("Rs. ", ""),
                    money(row.netSales).replace("Rs. ", ""),
                    money(row.finalAmount).replace("Rs. ", "")
                ];

                doc.font("Helvetica").fontSize(8).fillColor("#222");

                PDF_COLUMNS.forEach((col, i) => {
                    doc.text(cells[i], col.x + 2, y + 2, {
                        width: col.w - 4,
                        align: col.align,
                        lineBreak: false,
                        ellipsis: true
                    });
                });

                y += PDF.rowHeight;
            });

            if (truncated) {

                y += 8;

                if (y + 20 > PDF.bottomLimit) {
                    doc.addPage();
                    y = 36;
                }

                doc.font("Helvetica-Oblique").fontSize(9).fillColor("#a3202c")
                    .text(
                        `Only the latest ${maxRows} orders are listed. The summary above covers all ${summary.totalOrders} orders.`,
                        PDF.left,
                        y
                    );
            }
        }

        // ----- page numbers -----
        const pages = doc.bufferedPageRange();

        for (let i = 0; i < pages.count; i++) {

            doc.switchToPage(pages.start + i);

            // Writing below the bottom margin would otherwise add a new page.
            doc.page.margins.bottom = 0;

            doc.font("Helvetica").fontSize(8).fillColor("#888")
                .text(
                    `Page ${i + 1} of ${pages.count}`,
                    PDF.left,
                    560,
                    { width: PDF.right - PDF.left, align: "center", lineBreak: false }
                );
        }

        doc.end();
    });


// ---------------------------------------------------------
// EXCEL
// ---------------------------------------------------------

const buildExcelBuffer = async ({ range, summary, rows, truncated, maxRows }) => {

    // Loaded here (not at the top) so the rest of the app still starts
    // even if "npm install exceljs" has not been run yet.
    let ExcelJS;

    try {
        ExcelJS = require("exceljs");
    } catch (error) {
        const missing = new Error("ExcelJS is not installed.");
        missing.code = "EXCELJS_MISSING";
        throw missing;
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Wristora";
    workbook.created = new Date();

    const MONEY_FORMAT = "#,##0.00";

    // ----- sheet 1: summary -----
    const summarySheet = workbook.addWorksheet("Summary");

    summarySheet.columns = [
        { header: "", key: "label", width: 30 },
        { header: "", key: "value", width: 22 }
    ];

    summarySheet.addRow(["Wristora - Sales Report"]).font = { bold: true, size: 16 };
    summarySheet.addRow(["Period", range.label]);
    summarySheet.addRow(["Generated", formatDateTime(new Date())]);
    summarySheet.addRow([]);

    const headerRow = summarySheet.addRow(["Metric", "Value"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } };

    SUMMARY_LINES(summary).forEach(([label, value, isMoney]) => {

        const row = summarySheet.addRow([label, value]);

        row.getCell(2).alignment = { horizontal: "right" };

        if (isMoney) {
            row.getCell(2).numFmt = MONEY_FORMAT;
        }
    });

    if (truncated) {
        summarySheet.addRow([]);
        summarySheet.addRow([
            `Only the latest ${maxRows} orders are listed on the Orders sheet. ` +
            `The totals above cover all ${summary.totalOrders} orders.`
        ]);
    }

    // ----- sheet 2: orders -----
    const sheet = workbook.addWorksheet("Orders");

    sheet.columns = [
        { header: "Order ID", key: "orderId", width: 24 },
        { header: "Date", key: "date", width: 20 },
        { header: "Customer", key: "customer", width: 24 },
        { header: "Payment", key: "payment", width: 26 },
        { header: "Order Status", key: "status", width: 18 },
        { header: "Products", key: "products", width: 50 },
        { header: "Qty", key: "qty", width: 8 },
        { header: "Gross Sales", key: "gross", width: 14 },
        { header: "Product Discount", key: "discount", width: 18 },
        { header: "Coupon Code", key: "couponCode", width: 16 },
        { header: "Coupon Discount", key: "coupon", width: 18 },
        { header: "Net Sales", key: "net", width: 14 },
        { header: "Final Amount", key: "final", width: 16 }
    ];

    const head = sheet.getRow(1);

    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } };
    head.alignment = { vertical: "middle" };

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    rows.forEach((row) => {
        sheet.addRow({
            orderId: row.orderId,
            date: formatDateTime(row.createdAt),
            customer: row.customer,
            payment: paymentLabel(row.paymentMethod),
            status: row.orderStatus,
            products: row.products,
            qty: row.itemsSold,
            gross: row.grossSales,
            discount: row.productDiscount,
            couponCode: row.couponCode,
            coupon: row.couponDiscount,
            net: row.netSales,
            final: row.finalAmount
        });
    });

    ["gross", "discount", "coupon", "net", "final"].forEach((key) => {
        sheet.getColumn(key).numFmt = MONEY_FORMAT;
    });

    if (rows.length > 0) {

        const total = sheet.addRow({
            orderId: "TOTAL (all orders in period)",
            qty: summary.itemsSold,
            gross: summary.grossSales,
            discount: summary.productDiscount,
            coupon: summary.couponDiscount,
            net: summary.netSales,
            final: summary.orderAmount
        });

        total.font = { bold: true };
        total.border = { top: { style: "thin" } };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
};


module.exports = {
    buildPdfBuffer,
    buildExcelBuffer
};
