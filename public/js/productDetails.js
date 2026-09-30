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

        // Puts the full-screen image back to normal size
    const resetModalZoom = () => {

        if (!zoomModalImage) {
            return;
        }

        zoomModalImage.classList.remove("zoomed");
        zoomModalImage.style.transformOrigin = "center center";

    };

    const openZoomModal = () => {

        if (!mainImage || !zoomModal || !zoomModalImage) {
            return;
        }

        zoomModalImage.src = mainImage.src;
        zoomModalImage.alt = mainImage.alt;

        resetModalZoom();

        zoomModal.classList.add("active");

    };

    const closeZoomModal = () => {

        if (!zoomModal) {
            return;
        }

              zoomModal.classList.remove("active");

        resetModalZoom();

    };

    if (zoomBtn) {
        zoomBtn.addEventListener("click", openZoomModal);
    }

        if (mainImage) {
        mainImage.addEventListener("dblclick", openZoomModal);
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


        // -------------------------------------------------
    // DOUBLE CLICK INSIDE THE FULL-SCREEN VIEW
    // 1st double click -> zoom in at the clicked spot
    // 2nd double click -> zoom back out
    // While zoomed, moving the mouse pans the image.
    // -------------------------------------------------

    if (zoomModalImage) {

        zoomModalImage.addEventListener("dblclick", (event) => {

            if (zoomModalImage.classList.contains("zoomed")) {
                resetModalZoom();
                return;
            }

            const rect = zoomModalImage.getBoundingClientRect();

            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;

            zoomModalImage.style.transformOrigin = x + "% " + y + "%";
            zoomModalImage.classList.add("zoomed");

        });

    }

    if (zoomModal && zoomModalImage) {

        zoomModal.addEventListener("mousemove", (event) => {

            if (!zoomModalImage.classList.contains("zoomed")) {
                return;
            }

            const rect = zoomModal.getBoundingClientRect();

            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;

            zoomModalImage.style.transformOrigin = x + "% " + y + "%";

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

    // Same limit as MAX_QUANTITY_PER_PRODUCT in cartController.js.
    // This is only for the buttons. The server still checks the
    // real limit and the real stock.
    const MAX_QTY = 5;

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
    // The quantity chosen with the stepper is sent to the server.
    // The server checks it against the current stock and the
    // per-product maximum, and refuses it if it is not allowed.
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

                    body: JSON.stringify({ productId, quantity: getQty() })

                });

                const data = await response.json();

                if (response.ok && data.success) {

                    // keep the navbar cart badge in sync (no reload needed)
                    if (typeof data.cartCount === "number") {

                        document
                            .querySelectorAll(".wristora-cart-count")
                            .forEach((badge) => {
                                badge.textContent = data.cartCount;
                            });

                    }

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
    // WISHLIST (PHASE 49)
    //
    // The heart button is now handled by public/js/wishlistToggle.js,
    // which is shared with the product cards. Nothing to do here.
    // -------------------------------------------------

});