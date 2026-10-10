// =====================================================
// ADMIN DASHBOARD (PHASE 58)
//
// 1. Shows the From / To dates only for "Custom".
// 2. Draws the sales chart with Chart.js.
//
// The chart numbers are prepared by the server and arrive inside the
// <script id="chart-data"> tag. Nothing is calculated here.
// =====================================================

(function () {

    "use strict";

    // ---------- filter buttons ----------

    const dates = document.getElementById("an-dates");
    const radios = document.querySelectorAll('#an-filter input[name="period"]');

    radios.forEach((radio) => {

        radio.addEventListener("change", () => {

            if (dates) {
                dates.hidden = radio.value !== "custom";
            }

            document.querySelectorAll(".an-period").forEach((label) => {
                label.classList.toggle(
                    "active",
                    label.contains(radio) && radio.checked
                );
            });

            // Weekly / Monthly / Yearly apply straight away.
            // Custom waits for the dates and the Apply button.
            if (radio.value !== "custom") {
                radio.form.submit();
            }
        });
    });


    // ---------- chart ----------

    const canvas = document.getElementById("sales-chart");
    const dataTag = document.getElementById("chart-data");
    const note = document.getElementById("an-chart-note");

    if (!canvas || !dataTag) {
        return;
    }

    const showNote = (message) => {
        canvas.style.display = "none";
        note.textContent = message;
        note.hidden = false;
    };

    if (typeof window.Chart === "undefined") {
        showNote(
            "The chart could not be loaded. Run \"npm install chart.js@4\" " +
            "and restart the server."
        );
        return;
    }

    let chart;

    try {
        chart = JSON.parse(dataTag.textContent);
    } catch (error) {
        showNote("The chart data could not be read.");
        return;
    }

    const hasSales =
        chart.orders.some((n) => n > 0) || chart.sales.some((n) => n > 0);

    if (!hasSales) {
        showNote("No sales in this period yet.");
        return;
    }

    const money = (value) =>
        "\u20B9" + Number(value).toLocaleString("en-IN", {
            maximumFractionDigits: 2
        });

    // Short axis numbers: 12.5k, 1.2L (lakh), 2.0Cr (crore)
    const shortMoney = (value) => {

        if (value >= 10000000) return "\u20B9" + (value / 10000000).toFixed(1) + "Cr";
        if (value >= 100000) return "\u20B9" + (value / 100000).toFixed(1) + "L";
        if (value >= 1000) return "\u20B9" + (value / 1000).toFixed(1) + "k";

        return "\u20B9" + value;
    };

    new window.Chart(canvas, {

        data: {
            labels: chart.labels,
            datasets: [
                {
                    type: "line",
                    label: "Net Sales",
                    data: chart.sales,
                    yAxisID: "ySales",
                    borderColor: "#c6a16f",
                    backgroundColor: "rgba(198, 161, 111, 0.15)",
                    borderWidth: 2,
                    pointRadius: chart.labels.length > 40 ? 0 : 3,
                    pointBackgroundColor: "#c6a16f",
                    tension: 0.3,
                    fill: true,
                    order: 1
                },
                {
                    type: "bar",
                    label: "Orders",
                    data: chart.orders,
                    yAxisID: "yOrders",
                    backgroundColor: "rgba(23, 32, 51, 0.18)",
                    borderRadius: 3,
                    maxBarThickness: 22,
                    order: 2
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },

            plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },

                tooltip: {
                    callbacks: {
                        label: (item) =>
                            item.dataset.yAxisID === "ySales"
                                ? " Net Sales: " + money(item.parsed.y)
                                : " Orders: " + item.parsed.y
                    }
                }
            },

            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true, font: { size: 10 } }
                },

                ySales: {
                    position: "left",
                    beginAtZero: true,
                    ticks: { callback: (v) => shortMoney(v), font: { size: 10 } },
                    grid: { color: "#f0f0f0" }
                },

                yOrders: {
                    position: "right",
                    beginAtZero: true,
                    ticks: { precision: 0, font: { size: 10 } },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });

})();