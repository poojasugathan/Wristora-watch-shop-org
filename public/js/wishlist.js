document.addEventListener("DOMContentLoaded", () => {

    const wishlistItems = document.querySelectorAll(".wishlist-item");

    wishlistItems.forEach((itemEl) => {

        const productId = itemEl.dataset.productId;
        const addToCartBtn = itemEl.querySelector(".wishlist-add-to-cart-btn");
        const inlineMessageEl = itemEl.querySelector('[data-role="inline-message"]');

        if (!addToCartBtn) return;

        addToCartBtn.addEventListener("click", async () => {

            addToCartBtn.disabled = true;

            try {

                const response = await fetch("/wishlist/add-to-cart", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productId })
                });

                const data = await response.json();

                if (data.success) {

                    
                    itemEl.remove();

                    if (document.querySelectorAll(".wishlist-item").length === 0) {
                        window.location.reload();
                    }

                    
                    const cartCountEl = document.querySelector(".wristora-cart-count");
                    if (cartCountEl && typeof data.cartCount !== "undefined") {
                        cartCountEl.textContent = data.cartCount;
                    }

                    
                    const wishlistCountEl = document.querySelector(".wristora-wishlist-count");
                    if (wishlistCountEl && typeof data.wishlistCount !== "undefined") {
                        wishlistCountEl.textContent = data.wishlistCount;
                    }

                } else {

                    if (inlineMessageEl) {
                        inlineMessageEl.textContent = data.message;
                        inlineMessageEl.classList.add("wishlist-item-message-error");
                    }

                    addToCartBtn.disabled = false;

                }

            } catch (error) {

                console.error("Add to cart from wishlist error:", error);

                if (inlineMessageEl) {
                    inlineMessageEl.textContent = "Something went wrong. Please try again.";
                }

                addToCartBtn.disabled = false;

            }

        });

    });

});