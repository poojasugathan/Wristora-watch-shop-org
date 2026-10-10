// =====================================================
// ONLINE PAYMENT SCRIPT (PHASE 54)
//
// Shared by: checkout page, My Orders, Order Details and the
// "Payment failed" page. It only OPENS the Razorpay window and
// reports what happened. The server decides if a payment is real
// (it verifies the signature) - nothing here is trusted.
//
// Needs the Razorpay script (checkout.razorpay.com) loaded first.
// =====================================================

(function () {

    "use strict";

    const postJson = async (url, body) => {

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(body || {})
        });

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (response.status === 401 && data.redirectUrl) {
            window.location.href = data.redirectUrl;
            return null;
        }

        return { ok: response.ok && data.success === true, data };
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const showMessage = (message) => {

        const box = document.getElementById("checkout-client-error");

        if (box) {
            box.textContent = message;
            box.style.display = "block";
            box.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        if (window.Swal) {
            Swal.fire({
                icon: "error",
                title: message,
                confirmButtonColor: "#1c1c1c"
            });
            return;
        }

        alert(message);
    };

    // Tell the server the payment did not happen, then show the failure page.
    const reportFailure = async (orderId) => {

        let target = "/checkout/payment-failed/" + encodeURIComponent(orderId);

        try {

            const result = await postJson("/checkout/online/failed", { orderId });

            if (result && result.data && result.data.redirectUrl) {
                target = result.data.redirectUrl;
            }

        } catch (error) {
            // Even if this request fails, the failure page is still the right place.
        }

        window.location.href = target;
    };

    // Ask the server to verify the payment. Tries a few times if the
    // network is slow, because the customer's money may already be taken.
    const verifyOnServer = async (orderId, response) => {

        for (let attempt = 1; attempt <= 3; attempt++) {

            try {

                const result = await postJson("/checkout/online/verify", {
                    orderId,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                });

                if (!result) {
                    return;
                }

                if (result.ok) {
                    window.location.href = result.data.redirectUrl;
                    return;
                }

                // The server answered "no" - this is final, do not retry.
                if (result.data.redirectUrl) {
                    window.location.href = result.data.redirectUrl;
                    return;
                }

                showMessage(
                    result.data.message ||
                    "We couldn't verify your payment. Please check My Orders."
                );

                return;

            } catch (error) {

                if (attempt < 3) {
                    await sleep(1500);
                }
            }
        }

        showMessage(
            "We couldn't confirm your payment because of a network problem. " +
            "Please do not pay again - check My Orders in a minute."
        );
    };

    // Opens the Razorpay window for an order the server just prepared.
    const openCheckout = (payload) => {

        if (typeof window.Razorpay === "undefined") {
            reportFailure(payload.orderId);
            return;
        }

        let finished = false;

        const options = {
            key: payload.keyId,
            amount: payload.amount,
            currency: payload.currency,
            name: "Wristora",
            description: "Order " + payload.orderId,
            order_id: payload.razorpayOrderId,
            prefill: payload.prefill || {},
            timeout: payload.timeoutSeconds,
            theme: { color: "#1c1c1c" },

            // Razorpay calls this after the customer paid.
            handler: (response) => {
                finished = true;
                verifyOnServer(payload.orderId, response);
            },

            modal: {
                // Customer closed the window without paying.
                ondismiss: () => {
                    if (!finished) {
                        finished = true;
                        reportFailure(payload.orderId);
                    }
                }
            }
        };

        const razorpay = new window.Razorpay(options);

        razorpay.on("payment.failed", () => {
            if (!finished) {
                finished = true;
                reportFailure(payload.orderId);
            }
        });

        razorpay.open();
    };

    // Used by the checkout page: create the order + Razorpay order.
    const startPayment = async (addressId) => {

        const result = await postJson("/checkout/online/create", {
            selectedAddress: addressId
        });

        return result;
    };

    // Used by every "Retry Payment" button.
    const retryPayment = async (orderId) => {

        const result = await postJson("/checkout/online/retry", { orderId });

        return result;
    };

    window.WristoraPayment = {
        openCheckout,
        startPayment,
        retryPayment,
        showMessage
    };


    // ---------- Retry Payment buttons (orders, details, failure page) ----------

    document.addEventListener("click", async (event) => {

        const button = event.target.closest(".js-retry-payment");

        if (!button || button.dataset.busy === "1") {
            return;
        }

        button.dataset.busy = "1";

        const originalText = button.dataset.label || button.textContent;
        button.dataset.label = originalText;
        button.textContent = "Please wait...";
        button.disabled = true;

        const restore = () => {
            button.dataset.busy = "0";
            button.textContent = originalText;
            button.disabled = false;
        };

        try {

            const result = await retryPayment(button.dataset.orderId);

            if (!result) {
                return;
            }

            if (!result.ok) {
                restore();
                showMessage(
                    result.data.message ||
                    "We couldn't restart the payment. Please try again."
                );
                return;
            }

            openCheckout(result.data);

        } catch (error) {
            restore();
            showMessage("Network problem. Please check your connection and try again.");
        }
    });

    // If the user comes back with the Back button, make buttons usable again.
    window.addEventListener("pageshow", (event) => {

        if (!event.persisted) {
            return;
        }

        document.querySelectorAll(".js-retry-payment").forEach((button) => {
            button.dataset.busy = "0";
            button.disabled = false;
            if (button.dataset.label) {
                button.textContent = button.dataset.label;
            }
        });
    });

})();