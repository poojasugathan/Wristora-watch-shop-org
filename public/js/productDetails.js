// =====================================================
// PRODUCT DETAILS PAGE — FRONTEND INTERACTIONS
//
// This file only handles UI interactions:
//   - switching the main image via thumbnails
//   - a click-to-zoom modal
//   - a quantity stepper
//   - Add to Cart (PHASE 43 — real backend call)
//   - Add to Wishlist (PHASE 45 — real backend call)
//
// No product availability or pricing decisions are made
// here — the backend is always asked fresh whether the
// product can actually be added, regardless of whether
// this button appears enabled.
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    // -------------------------------------------------
    // THUMBNAIL SWITCHING
    // -------------------------------------------------

    const mainImage = document.getElementById("productMainImage");
    const thumbButtons = document.querySelectorAll(".product-gallery-thumb");

    thumbButtons.forEach((thumb) => {

        thumb.addEventListener("click", () => {

            const fullSrc = thumb.getAttribute("data-full-src");

            if (!mainImage || !fullSrc) {
                return;
            }

            mainImage.src = fullSrc;

            thumbButtons.forEach((btn) => btn.classList.remove("active"));
            thumb.classList.add("active");

        });

    });


    // -------------------------------------------------
    // ZOOM MODAL
    // -------------------------------------------------

    const zoomBtn = document.getElementById("productZoomBtn");
    const zoomModal = document.getElementById("productZoomModal");
    const zoomModalImage = document.getElementById("productZoomModalImage");
    const zoomModalClose = document.getElementById("productZoomModalClose");

    const openZoomModal = () => {

        if (!mainImage || !zoomModal || !zoomModalImage) {
            return;
        }

        zoomModalImage.src = mainImage.src;
        zoomModalImage.alt = mainImage.alt;

        zoomModal.classList.add("active");

    };

    const closeZoomModal = () => {

        if (!zoomModal) {
            return;
        }

        zoomModal.classList.remove("active");

    };

    if (zoomBtn) {
        zoomBtn.addEventListener("click", openZoomModal);
    }

    if (mainImage) {
        mainImage.addEventListener("click", openZoomModal);
    }

    if (zoomModalClose) {
        zoomModalClose.addEventListener("click", closeZoomModal);
    }

    if (zoomModal) {

        zoomModal.addEventListener("click", (event) => {

            if (event.target === zoomModal) {
                closeZoomModal();
            }

        });

    }

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {
            closeZoomModal();
        }

    });


    // -------------------------------------------------
    // QUANTITY STEPPER
    // -------------------------------------------------

    const qtyMinusBtn = document.getElementById("productQtyMinus");
    const qtyPlusBtn = document.getElementById("productQtyPlus");
    const qtyValueEl = document.getElementById("productQtyValue");

    const MIN_QTY = 1;
    const MAX_QTY = 10;

    const getQty = () => parseInt(qtyValueEl ? qtyValueEl.textContent : "1", 10) || 1;

    const setQty = (value) => {

        if (!qtyValueEl) {
            return;
        }

        const clamped = Math.min(MAX_QTY, Math.max(MIN_QTY, value));
        qtyValueEl.textContent = clamped;

    };

    if (qtyMinusBtn) {

        qtyMinusBtn.addEventListener("click", () => {
            setQty(getQty() - 1);
        });

    }

    if (qtyPlusBtn) {

        qtyPlusBtn.addEventListener("click", () => {
            setQty(getQty() + 1);
        });

    }


    // -------------------------------------------------
    // SHARED MESSAGE HELPER
    // -------------------------------------------------

    const showMessage = (icon, title, text) => {

        if (typeof Swal !== "undefined") {

            Swal.fire({
                icon,
                title,
                text,
                confirmButtonColor: "#292929"
            });

        } else {

            alert(text);

        }

    };


    // -------------------------------------------------
    // ADD TO CART (PHASE 43 — real backend call)
    //
    // Note: the quantity stepper above is purely a display
    // feature for now. Add to Cart always adds 1 unit (or
    // increments by 1 if already in the cart) — sending the
    // stepper's value here would let the browser dictate
    // quantity, which isn't validated against stock at this
    // entry point.
    // -------------------------------------------------

    const addToCartBtn = document.getElementById("productAddToCartBtn");

    if (addToCartBtn) {

        addToCartBtn.addEventListener("click", async () => {

            if (addToCartBtn.disabled) {
                return;
            }

            const productId = addToCartBtn.getAttribute("data-product-id");

            if (!productId) {
                return;
            }

            addToCartBtn.disabled = true;

            try {

                const response = await fetch("/cart/add", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({ productId })

                });

                const data = await response.json();

                if (response.ok && data.success) {

                    showMessage(
                        "success",
                        "Added to Cart",
                        data.message || "Product added to cart successfully."
                    );

                } else {

                    showMessage(
                        "error",
                        "Unable to Add",
                        data.message || "Unable to add this product to your cart."
                    );

                }

            } catch (error) {

                console.error("Add to cart request failed:", error);

                showMessage(
                    "error",
                    "Something Went Wrong",
                    "Unable to add this product to your cart. Please try again."
                );

            } finally {

                if (addToCartBtn.getAttribute("data-out-of-stock") !== "true") {
                    addToCartBtn.disabled = false;
                }

            }

        });

    }


    // -------------------------------------------------
    // ADD TO WISHLIST (PHASE 45 — real backend call)
    //
    // This button only ever ADDS. It does not reflect
    // whether the product is already in the wishlist on
    // page load — the backend already handles a repeat add
    // gracefully (returns success with an "already in your
    // wishlist" message instead of erroring or duplicating).
    // -------------------------------------------------

    const wishlistBtn = document.getElementById("productWishlistBtn");

    if (wishlistBtn) {

        wishlistBtn.addEventListener("click", async () => {

            if (wishlistBtn.disabled) {
                return;
            }

            const productId = wishlistBtn.getAttribute("data-product-id");

            if (!productId) {
                return;
            }

            wishlistBtn.disabled = true;

            try {

                const response = await fetch("/wishlist/add", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({ productId })

                });

                const data = await response.json();

                if (response.ok && data.success) {

                    wishlistBtn.classList.add("active");

                    showMessage(
                        "success",
                        "Added to Wishlist",
                        data.message || "Added to your wishlist."
                    );

                } else {

                    showMessage(
                        "error",
                        "Unable to Add",
                        data.message || "Unable to add this product to your wishlist."
                    );

                }

            } catch (error) {

                console.error("Add to wishlist request failed:", error);

                showMessage(
                    "error",
                    "Something Went Wrong",
                    "Unable to add this product to your wishlist. Please try again."
                );

            } finally {

                wishlistBtn.disabled = false;

            }

        });

    }

});