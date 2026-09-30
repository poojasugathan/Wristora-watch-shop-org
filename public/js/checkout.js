// =====================================================
// CHECKOUT PAGE (PHASE 50)
//
// Only two small jobs here:
//  1. Make sure an address is selected before submitting.
//  2. Disable the Place Order button after the first click, so
//     a double-click can't send the form twice.
//
// The real safety is on the server (it re-checks everything and
// empties the cart in one atomic step). This file is just UX.
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("checkout-form");
    const button = document.getElementById("place-order-btn");
    const errorBox = document.getElementById("checkout-client-error");

    if (!form || !button) {
        return;
    }

    let submitting = false;

    const resetButton = () => {
        submitting = false;
        button.disabled = false;
        button.textContent = "Place Order";
    };

    form.addEventListener("submit", (event) => {

        if (submitting) {
            event.preventDefault();
            return;
        }

        const selectedAddress = form.querySelector(
            'input[name="selectedAddress"]:checked'
        );

        if (!selectedAddress) {

            event.preventDefault();

            if (errorBox) {
                errorBox.textContent = "Please select a delivery address.";
                errorBox.style.display = "block";
                errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            return;
        }

        submitting = true;
        button.disabled = true;
        button.textContent = "Placing Order...";
    });

    // If the user presses Back and the page is restored from the
    // browser's memory, make the button usable again.
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            resetButton();
        }
    });

});