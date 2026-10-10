// =====================================================
// WALLET PAGE - "ADD MONEY" (PHASE 56)
//
// This script only:
//   1. opens / closes the Add Money window,
//   2. asks the server to prepare the payment,
//   3. opens the Razorpay window,
//   4. asks the server to VERIFY the payment.
//
// It never adds money itself. The wallet changes only after the
// server has checked the Razorpay signature.
// =====================================================

(function () {

    "use strict";

    const modal = document.getElementById("wallet-modal");
    const openBtn = document.getElementById("wallet-open-modal");
    const closeBtn = document.getElementById("wallet-close-modal");
    const submitBtn = document.getElementById("wallet-submit");
    const amountInput = document.getElementById("wallet-amount");
    const descriptionInput = document.getElementById("wallet-description");
    const errorBox = document.getElementById("wallet-modal-error");

    if (!modal || !openBtn || !submitBtn || !amountInput) {
        return;
    }

    const limits = window.WALLET_LIMITS || { min: 100, max: 50000 };

    let busy = false;

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

    const showError = (message) => {
        errorBox.textContent = message;
        errorBox.style.display = "block";
    };

    const hideError = () => {
        errorBox.style.display = "none";
    };

    const setBusy = (isBusy) => {
        busy = isBusy;
        submitBtn.disabled = isBusy;
        submitBtn.textContent = isBusy ? "Please wait..." : "Add Money";
    };

    const openModal = () => {
        hideError();
        modal.hidden = false;
        document.body.style.overflow = "hidden";
        amountInput.focus();
    };

    const closeModal = () => {

        if (busy) {
            return;
        }

        modal.hidden = true;
        document.body.style.overflow = "";
    };

    openBtn.addEventListener("click", openModal);

    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });

    // Quick amount buttons fill the amount box.
    modal.querySelectorAll(".wallet-quick-btn").forEach((button) => {

        button.addEventListener("click", () => {

            amountInput.value = button.dataset.amount;

            modal.querySelectorAll(".wallet-quick-btn").forEach((other) => {
                other.classList.toggle("is-selected", other === button);
            });

            hideError();
        });
    });

    amountInput.addEventListener("input", () => {

        modal.querySelectorAll(".wallet-quick-btn").forEach((button) => {
            button.classList.toggle(
                "is-selected",
                button.dataset.amount === amountInput.value.trim()
            );
        });
    });

    // After paying: ask the server to verify. Retries on a network
    // problem, because the customer's money may already be taken.
    const verifyOnServer = async (response) => {

        for (let attempt = 1; attempt <= 3; attempt++) {

            try {

                const result = await postJson("/wallet/add-money/verify", {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                });

                if (!result) {
                    return;
                }

                if (result.ok) {

                    await Swal.fire({
                        icon: "success",
                        title: result.data.message,
                        confirmButtonColor: "#1c1c1c"
                    });

                    window.location.reload();
                    return;
                }

                // The server said "no" - final, do not retry.
                setBusy(false);

                Swal.fire({
                    icon: "error",
                    title: result.data.message || "We couldn't verify your payment.",
                    confirmButtonColor: "#1c1c1c"
                });

                return;

            } catch (error) {

                if (attempt < 3) {
                    await sleep(1500);
                }
            }
        }

        setBusy(false);

        Swal.fire({
            icon: "warning",
            title: "We couldn't confirm your payment because of a network problem. " +
                   "Please do not pay again - check your wallet in a minute.",
            confirmButtonColor: "#1c1c1c"
        });
    };

    const openRazorpay = (payload) => {

        if (typeof window.Razorpay === "undefined") {
            setBusy(false);
            showError("The payment window could not be loaded. Please refresh the page.");
            return;
        }

        let finished = false;

        const razorpay = new window.Razorpay({
            key: payload.keyId,
            amount: payload.amount,
            currency: payload.currency,
            name: "Wristora",
            description: "Add money to wallet",
            order_id: payload.razorpayOrderId,
            prefill: payload.prefill || {},
            theme: { color: "#1c1c1c" },

            handler: (response) => {
                finished = true;
                modal.hidden = true;
                document.body.style.overflow = "";
                verifyOnServer(response);
            },

            modal: {
                ondismiss: () => {
                    if (!finished) {
                        finished = true;
                        setBusy(false);
                    }
                }
            }
        });

        razorpay.on("payment.failed", () => {

            if (!finished) {
                finished = true;
                setBusy(false);
                showError("The payment did not go through. No money was added. Please try again.");
            }
        });

        razorpay.open();
    };

    submitBtn.addEventListener("click", async () => {

        if (busy) {
            return;
        }

        hideError();

        const text = amountInput.value.trim();
        const amount = Number(text);

        if (!text) {
            showError("Please enter an amount or choose one below.");
            return;
        }

        if (!Number.isInteger(amount)) {
            showError("Please enter a whole-rupee amount.");
            return;
        }

        if (amount < limits.min || amount > limits.max) {
            showError(
                "You can add between \u20B9" + limits.min + " and \u20B9" +
                limits.max.toLocaleString("en-IN") + " at a time."
            );
            return;
        }

        setBusy(true);

        try {

            const result = await postJson("/wallet/add-money/create", {
                amount,
                description: descriptionInput ? descriptionInput.value : ""
            });

            if (!result) {
                return; // sent to the login page
            }

            if (!result.ok) {
                setBusy(false);
                showError(
                    result.data.message ||
                    "We couldn't start the payment. Please try again."
                );
                return;
            }

            openRazorpay(result.data);

        } catch (error) {
            setBusy(false);
            showError("Network problem. Please check your connection and try again.");
        }
    });

    // Back button: make the page usable again.
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            setBusy(false);
        }
    });

})();
