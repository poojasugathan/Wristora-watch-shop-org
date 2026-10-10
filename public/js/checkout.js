// =====================================================
// CHECKOUT PAGE (PHASE 50, extended in PHASE 54)
//
// Jobs here:
//  1. Make sure an address is selected before submitting.
//  2. Disable the button after the first click, so a double-click
//     can't send the form twice.
//  3. (Phase 54) If "Online Payment" is chosen, do not submit the
//     form. Ask the server to prepare the payment, then open Razorpay
//     (see payment.js). Cash on Delivery still uses the normal form.
//
// The real safety is on the server (it re-checks everything).
// This file is just UX.
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("checkout-form");
    const button = document.getElementById("place-order-btn");
    const errorBox = document.getElementById("checkout-client-error");
    const paymentLabel = document.getElementById("summary-payment-label");

    if (!form || !button) {
        return;
    }

    let submitting = false;

    const LABELS = {
        COD: { button: "Place Order", busy: "Placing Order...", summary: "Cash on Delivery" },
        ONLINE: { button: "Pay Now", busy: "Starting Payment...", summary: "Online Payment (Razorpay)" },
        WALLET: { button: "Pay with Wallet", busy: "Processing Payment...", summary: "Wristora Wallet" }
    };

    const selectedMethod = () => {

        const chosen = form.querySelector('input[name="paymentMethod"]:checked');

        return chosen && LABELS[chosen.value] ? chosen.value : "COD";
    };

    const showError = (message) => {

        if (!errorBox) {
            return;
        }

        errorBox.textContent = message;
        errorBox.style.display = "block";
        errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const hideError = () => {

        if (errorBox) {
            errorBox.style.display = "none";
        }
    };

    const refreshLabels = () => {

        const labels = LABELS[selectedMethod()];

        button.textContent = labels.button;

        if (paymentLabel) {
            paymentLabel.textContent = labels.summary;
        }
    };

    const resetButton = () => {
        submitting = false;
        button.disabled = false;
        refreshLabels();
    };

    form.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
        radio.addEventListener("change", refreshLabels);
    });

    // Phase 56: the Wallet option is only usable when the balance covers
    // the total. The total on the page can change when a coupon is applied
    // or removed, so this check runs again whenever it changes.
    // (This is only a convenience: the server checks the balance again.)
    const walletOption = document.getElementById("wallet-option");
    const walletShortfall = document.getElementById("wallet-shortfall");
    const totalEl = document.getElementById("summary-total");

    const readTotal = () => {

        if (!totalEl) {
            return 0;
        }

        return Number(totalEl.textContent.replace(/[^0-9.]/g, "")) || 0;
    };

    const syncWalletOption = () => {

        if (!walletOption) {
            return;
        }

        const radio = walletOption.querySelector('input[name="paymentMethod"]');
        const balance = Number(walletOption.dataset.balance) || 0;
        const enough = balance >= readTotal();

        radio.disabled = !enough;
        walletOption.classList.toggle("is-disabled", !enough);

        if (walletShortfall) {
            walletShortfall.style.display = enough ? "none" : "";
        }

        // If Wallet was chosen but is no longer affordable, go back to COD.
        if (!enough && radio.checked) {

            const cod = form.querySelector('input[name="paymentMethod"][value="COD"]');

            if (cod) {
                cod.checked = true;
            }

            refreshLabels();
        }
    };

    if (totalEl && walletOption) {
        new MutationObserver(syncWalletOption).observe(totalEl, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    syncWalletOption();
    refreshLabels();

    form.addEventListener("submit", async (event) => {

        if (submitting) {
            event.preventDefault();
            return;
        }

        const selectedAddress = form.querySelector(
            'input[name="selectedAddress"]:checked'
        );

        if (!selectedAddress) {

            event.preventDefault();
            showError("Please select a delivery address.");

            return;
        }

        hideError();

        const method = selectedMethod();

        submitting = true;
        button.disabled = true;
        button.textContent = LABELS[method].busy;

        // Cash on Delivery and Wallet: let the form submit normally.
        // (The server takes the money from the wallet and re-checks the balance.)
        if (method === "COD" || method === "WALLET") {
            return;
        }

        // Online payment: handle it with JavaScript instead.
        event.preventDefault();

        if (!window.WristoraPayment) {
            showError("Online payment could not be loaded. Please refresh the page.");
            resetButton();
            return;
        }

        try {

            const result = await window.WristoraPayment.startPayment(
                selectedAddress.value
            );

            if (!result) {
                return; // sent to the login page
            }

            if (!result.ok) {

                if (result.data.redirectUrl) {
                    window.location.href = result.data.redirectUrl;
                    return;
                }

                showError(
                    result.data.message ||
                    "We couldn't start the payment. Please try again."
                );

                resetButton();
                return;
            }

            // Razorpay window opens. The button stays disabled until the
            // page changes (success / failure page).
            window.WristoraPayment.openCheckout(result.data);

        } catch (error) {

            showError("Network problem. Please check your connection and try again.");
            resetButton();
        }
    });

    // If the user presses Back and the page is restored from the
    // browser's memory, make the button usable again.
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            resetButton();
        }
    });

});
