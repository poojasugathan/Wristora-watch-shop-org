

const PDFDocument = require("pdfkit");

const {
    ITEM_STATUS,
    PAYMENT_METHOD_LABEL
} = require("../config/orderConstants");

const MARGIN = 50;
const PAGE_BOTTOM = 760;


const COL = {
    item: { x: 50, w: 210 },
    qty: { x: 265, w: 35 },
    mrp: { x: 305, w: 75 },
    discount: { x: 385, w: 70 },
    amount: { x: 460, w: 85 }
};

const money = (n) =>
    "Rs. " +
    Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

const formatDate = (date) =>
    new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    });


const generateInvoiceBuffer = (order, customer) =>
    new Promise((resolve, reject) => {

        const doc = new PDFDocument({
            size: "A4",
            margin: MARGIN,
            info: {
                Title: `Invoice ${order.orderId}`,
                Author: "Wristora"
            }
        });

        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {

            const amounts = order.amounts;
            const addr = order.addressSnapshot;
            const activeItems = order.items.filter(
                (item) => item.itemStatus !== ITEM_STATUS.CANCELLED
            );

            
            doc.font("Helvetica-Bold").fontSize(26).fillColor("#1c1c1c")
                .text("Wristora", MARGIN, MARGIN);

            doc.font("Helvetica").fontSize(10).fillColor("#666666")
                .text("Luxury Timepieces", MARGIN, MARGIN + 30);

            doc.font("Helvetica-Bold").fontSize(20).fillColor("#b08d57")
                .text("INVOICE", MARGIN, MARGIN + 2, {
                    width: 495,
                    align: "right"
                });

            doc.moveTo(MARGIN, 105).lineTo(545, 105)
                .strokeColor("#dddddd").stroke();

           
            const detailRows = [
                ["Order ID", order.orderId],
                ["Order Date", formatDate(order.createdAt)],
                ["Order Status", order.orderStatus],
                [
                    "Payment Method",
                    PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod
                ],
                ["Payment Status", order.paymentStatus]
            ];

            let y = 120;

            detailRows.forEach(([label, value]) => {
                doc.font("Helvetica").fontSize(9).fillColor("#888888")
                    .text(label, MARGIN, y, { width: 90 });
                doc.font("Helvetica-Bold").fontSize(10).fillColor("#1c1c1c")
                    .text(value, MARGIN + 95, y - 1, { width: 175 });
                y += 18;
            });

            
            const rightX = 310;
            let ry = 120;

            doc.font("Helvetica").fontSize(9).fillColor("#888888")
                .text("BILLED TO / DELIVER TO", rightX, ry);
            ry += 15;

            const customerName =
                customer && (customer.firstName || customer.lastName)
                    ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                    : `${addr.firstName} ${addr.lastName}`;

            const addressLines = [
                `${addr.firstName} ${addr.lastName}`,
                addr.addressLine1,
                addr.addressLine2,
                `${addr.city}, ${addr.state} - ${addr.pinCode}`,
                addr.country,
                `Phone: ${addr.phone}`
            ].filter(Boolean);

            doc.font("Helvetica-Bold").fontSize(10).fillColor("#1c1c1c")
                .text(`Customer: ${customerName}`, rightX, ry, { width: 235 });
            ry += 15;

            if (customer && customer.email) {
                doc.font("Helvetica").fontSize(9).fillColor("#444444")
                    .text(`Email: ${customer.email}`, rightX, ry, { width: 235 });
                ry += 14;
            }

            addressLines.forEach((line) => {
                doc.font("Helvetica").fontSize(9).fillColor("#444444")
                    .text(line, rightX, ry, { width: 235 });
                ry += 13;
            });

            y = Math.max(y, ry) + 20;

            
            const drawTableHeader = (atY) => {

                doc.rect(MARGIN, atY, 495, 22).fill("#efede8");

                doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1c1c");

                doc.text("ITEM", COL.item.x + 6, atY + 7, { width: COL.item.w });
                doc.text("QTY", COL.qty.x, atY + 7, { width: COL.qty.w, align: "center" });
                doc.text("MRP", COL.mrp.x, atY + 7, { width: COL.mrp.w, align: "right" });
                doc.text("DISCOUNT", COL.discount.x, atY + 7, { width: COL.discount.w, align: "right" });
                doc.text("AMOUNT", COL.amount.x, atY + 7, { width: COL.amount.w - 6, align: "right" });

                return atY + 28;
            };

            y = drawTableHeader(y);

            activeItems.forEach((item) => {

                const nameText = item.brand
                    ? `${item.productName} (${item.brand})`
                    : item.productName;

                doc.font("Helvetica").fontSize(10);

                const nameHeight = doc.heightOfString(nameText, { width: COL.item.w - 6 });
                const rowHeight = Math.max(22, nameHeight + 10);

                if (y + rowHeight > PAGE_BOTTOM) {
                    doc.addPage();
                    y = drawTableHeader(MARGIN);
                }

                doc.font("Helvetica").fontSize(10).fillColor("#1c1c1c")
                    .text(nameText, COL.item.x + 6, y, { width: COL.item.w - 6 });

                doc.text(String(item.quantity), COL.qty.x, y, { width: COL.qty.w, align: "center" });
                doc.text(money(item.mrp * item.quantity), COL.mrp.x, y, { width: COL.mrp.w, align: "right" });
                doc.text(
                    item.discountAmount > 0 ? "- " + money(item.discountAmount) : "-",
                    COL.discount.x, y, { width: COL.discount.w, align: "right" }
                );
                doc.text(money(item.itemTotal), COL.amount.x, y, { width: COL.amount.w - 6, align: "right" });

                y += rowHeight;

                doc.moveTo(MARGIN, y - 4).lineTo(545, y - 4)
                    .strokeColor("#eeeeee").stroke();
            });

            // ---------- totals ----------
            const totalsHeight = 110;

            if (y + totalsHeight > PAGE_BOTTOM) {
                doc.addPage();
                y = MARGIN;
            }

            y += 10;

            const totalRow = (label, value, bold = false, color = "#1c1c1c") => {
                doc.font(bold ? "Helvetica-Bold" : "Helvetica")
                    .fontSize(bold ? 12 : 10).fillColor(color);
                doc.text(label, 300, y, { width: 140 });
                doc.text(value, 440, y, { width: 105, align: "right" });
                y += bold ? 24 : 18;
            };

            totalRow("Subtotal", money(amounts.subtotal));

            if (amounts.discountTotal > 0) {
                totalRow("Discount", "- " + money(amounts.discountTotal), false, "#2e7d32");
            }

            if (amounts.couponDiscount > 0) {
                totalRow(
                    amounts.couponCode ? `Coupon (${amounts.couponCode})` : "Coupon",
                    "- " + money(amounts.couponDiscount),
                    false,
                    "#2e7d32"
                );
            }

            if (amounts.tax > 0) {
                totalRow("Tax", money(amounts.tax));
            }

            totalRow("Shipping", amounts.shipping > 0 ? money(amounts.shipping) : "Free");

            doc.moveTo(300, y).lineTo(545, y).strokeColor("#1c1c1c").stroke();
            y += 8;

            totalRow("Total", money(amounts.finalTotal), true);

           
            if (amounts.cancelledCount > 0) {
                doc.font("Helvetica-Oblique").fontSize(9).fillColor("#888888")
                    .text(
                        `${amounts.cancelledCount} cancelled item(s) are not included in this invoice.`,
                        MARGIN, y + 6, { width: 495 }
                    );
                y += 24;
            }

            doc.font("Helvetica").fontSize(9).fillColor("#888888")
                .text(
                    "Thank you for shopping with Wristora. This is a computer-generated invoice.",
                    MARGIN, Math.max(y + 30, 700) > 780 ? 780 : Math.max(y + 30, 700),
                    { width: 495, align: "center", lineBreak: false }
                );

            doc.end();

        } catch (error) {
            reject(error);
        }
    });


module.exports = { generateInvoiceBuffer };