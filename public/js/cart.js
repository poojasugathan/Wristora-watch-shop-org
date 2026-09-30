// =====================================================
// CART QUANTITY CONTROLS (PHASE 44)
//
// This file is new — Phase 43 had no +/- buttons yet.
//
// How it works, in plain terms:
// 1. When + or - is clicked, we send a fetch() request to
//    the backend telling it which product and which
//    direction.
// 2. The backend re-checks everything (stock, availability,
//    max quantity) and sends back the REAL new numbers.
// 3. We only ever update the page using what the backend
//    sent back — never numbers we calculated ourselves in
//    the browser. The backend is the source of truth.
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const cartItems = document.querySelectorAll(".cart-item[data-product-id]");

    cartItems.forEach((cartItem) => {

        const productId = cartItem.getAttribute("data-product-id");

        const increaseBtn = cartItem.querySelector(".cart-qty-increase");
        const decreaseBtn = cartItem.querySelector(".cart-qty-decrease");

        if (increaseBtn) {
            increaseBtn.addEventListener("click", () => {
                handleQuantityChange(cartItem, productId, "/cart/increase");
            });
        }

        if (decreaseBtn) {
            decreaseBtn.addEventListener("click", () => {
                handleQuantityChange(cartItem, productId, "/cart/decrease");
            });
        }

    });

});


async function handleQuantityChange(cartItem, productId, url) {

    const increaseBtn = cartItem.querySelector(".cart-qty-increase");
    const decreaseBtn = cartItem.querySelector(".cart-qty-decrease");
    const quantityEl = cartItem.querySelector("[data-role='quantity']");
    const subtotalEl = cartItem.querySelector("[data-role='subtotal']");
    const messageEl = cartItem.querySelector("[data-role='inline-message']");

    // Prevent double-clicks from firing two requests before
    // the first one comes back.
    if (increaseBtn) increaseBtn.disabled = true;
    if (decreaseBtn) decreaseBtn.disabled = true;

    if (messageEl) {
        messageEl.textContent = "";
        messageEl.classList.remove("cart-item-message-error");
    }

    try {

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ productId })
        });

        const data = await response.json();

        if (!data.success) {

            // Backend rejected it (max reached, out of stock,
            // product no longer available, etc). Show the
            // message it gave us and re-enable the buttons
            // based on what it told us, if it told us.
            if (messageEl) {
                messageEl.textContent = data.message || "Unable to update quantity.";
                messageEl.classList.add("cart-item-message-error");
            }

            if (typeof data.quantity === "number" && decreaseBtn) {
                decreaseBtn.disabled = data.quantity <= 1;
            }

            if (increaseBtn) {
                increaseBtn.disabled = true;
            }

            return;

        }

        // Success — update this item's numbers using exactly
        // what the backend calculated.
        if (quantityEl) {
            quantityEl.textContent = data.quantity;
        }

        if (subtotalEl) {
            subtotalEl.textContent = formatRupees(data.subtotal);
        }

        if (decreaseBtn) {
            decreaseBtn.disabled = data.quantity <= 1;
        }

        if (increaseBtn) {
            increaseBtn.disabled = !!data.atMax;
        }

        updateCartTotals(data.cartTotal);
        updateCartCountBadge(data.cartCount);

    } catch (error) {

        console.error("Cart quantity update failed:", error);

        if (messageEl) {
            messageEl.textContent = "Something went wrong. Please try again.";
            messageEl.classList.add("cart-item-message-error");
        }

        if (increaseBtn) increaseBtn.disabled = false;
        if (decreaseBtn) decreaseBtn.disabled = false;

    }

}


function formatRupees(amount) {
    return "\u20B9" + Number(amount).toLocaleString("en-IN");
}


function updateCartTotals(cartTotal) {

    const subtotalEl = document.querySelector("[data-role='cart-subtotal']");
    const totalEl = document.querySelector("[data-role='cart-total']");

    if (subtotalEl) {
        subtotalEl.textContent = formatRupees(cartTotal);
    }

    if (totalEl) {
        totalEl.textContent = formatRupees(cartTotal);
    }

}


function updateCartCountBadge(cartCount) {

    // The navbar badge in partials/header.ejs is
    // <span class="wristora-cart-count">.
    document
        .querySelectorAll(".wristora-cart-count")
        .forEach((badge) => {
            badge.textContent = cartCount;
        });

}