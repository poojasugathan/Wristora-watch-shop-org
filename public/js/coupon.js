// =====================================================
// CHECKOUT COUPON BOX (PHASE 55)
//
// This file only TALKS to the server and shows the answer:
//   Apply  -> POST /checkout/coupon/apply   { code }
//   Remove -> POST /checkout/coupon/remove
//
// The server validates the coupon, calculates the discount and
// sends back the new price breakdown. We just draw those numbers.
// Nothing here decides how much the discount is.
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("coupon-input");
    const applyBtn = document.getElementById("coupon-apply-btn");
    const removeBtn = document.getElementById("coupon-remove-btn");
    const applyArea = document.getElementById("coupon-apply-area");
    const appliedArea = document.getElementById("coupon-applied-area");
    const appliedCode = document.getElementById("coupon-applied-code");
    const message = document.getElementById("coupon-message");

    const couponRow = document.getElementById("coupon-row");
    const couponAmount = document.getElementById("coupon-amount");
    const taxRow = document.getElementById("tax-row");
    const taxAmount = document.getElementById("tax-amount");
    const totalEl = document.getElementById("summary-total");

    if (!input || !applyBtn || !removeBtn) {
        return;
    }

    const money = (n) =>
        Number(n).toLocaleString("en-IN", {
            minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
            maximumFractionDigits: 2
        });

    const showMessage = (text, isError) => {
        message.textContent = text || "";
        message.className = "coupon-message" + (text ? (isError ? " is-error" : " is-ok") : "");
    };

    // Draws the numbers the server sent.
    const renderPricing = (pricing) => {

        const hasCoupon = pricing.couponDiscount > 0;

        couponRow.style.display = hasCoupon ? "" : "none";
        couponAmount.textContent = "- \u20B9" + money(pricing.couponDiscount || 0);

        taxRow.style.display = pricing.tax > 0 ? "" : "none";
        taxAmount.textContent = "\u20B9" + money(pricing.tax);

        totalEl.textContent = "\u20B9" + money(pricing.finalTotal);
    };

    const post = async (url, body) => {

        const response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(body || {})
        });

        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        return { ok: response.ok, data };
    };

    let busy = false;

    const setBusy = (value) => {
        busy = value;
        applyBtn.disabled = value;
        removeBtn.disabled = value;
    };

    const applyCoupon = async () => {

        if (busy) {
            return;
        }

        const code = input.value.trim();

        if (code === "") {
            showMessage("Please enter a coupon code.", true);
            return;
        }

        setBusy(true);
        showMessage("");

        try {

            const result = await post("/checkout/coupon/apply", { code });

            if (!result.data) {
                showMessage("Please refresh the page and try again.", true);
                return;
            }

            if (!result.ok || !result.data.success) {
                showMessage(result.data.message || "Could not apply this coupon.", true);
                return;
            }

            appliedCode.textContent = result.data.coupon.code;
            applyArea.style.display = "none";
            appliedArea.style.display = "";
            input.value = "";

            renderPricing(result.data.pricing);
            showMessage(result.data.message, false);

        } catch (error) {
            showMessage("Network problem. Please try again.", true);
        } finally {
            setBusy(false);
        }
    };

    const removeCoupon = async () => {

        if (busy) {
            return;
        }

        setBusy(true);
        showMessage("");

        try {

            const result = await post("/checkout/coupon/remove");

            if (!result.data || !result.ok || !result.data.success) {
                showMessage(
                    (result.data && result.data.message) || "Could not remove the coupon.",
                    true
                );
                return;
            }

            appliedArea.style.display = "none";
            applyArea.style.display = "";
            appliedCode.textContent = "";

            renderPricing(result.data.pricing);
            showMessage(result.data.message, false);

        } catch (error) {
            showMessage("Network problem. Please try again.", true);
        } finally {
            setBusy(false);
        }
    };

    applyBtn.addEventListener("click", applyCoupon);
    removeBtn.addEventListener("click", removeCoupon);

    // Pressing Enter must apply the coupon, NOT place the order.
    input.addEventListener("keydown", (event) => {

        if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
        }
    });
});
