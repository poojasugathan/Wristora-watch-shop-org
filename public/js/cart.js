

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

    
    document
        .querySelectorAll(".wristora-cart-count")
        .forEach((badge) => {
            badge.textContent = cartCount;
        });

}