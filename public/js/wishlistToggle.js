

document.addEventListener("click", async (event) => {

    const button = event.target.closest("[data-wishlist-toggle]");

    if (!button) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (button.disabled) {
        return;
    }

    const productId = button.getAttribute("data-product-id");

    if (!productId) {
        return;
    }

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

    button.disabled = true;

    try {

        const response = await fetch("/wishlist/toggle", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ productId })
        });

        let data = null;

        try {
            data = await response.json();
        } catch (parseError) {
            data = null;
        }

       
        if (response.status === 401 || (data && data.requiresLogin)) {

            const loginUrl = (data && data.redirectUrl) || "/auth/login";

            if (typeof Swal !== "undefined") {

                const result = await Swal.fire({
                    icon: "info",
                    title: "Login Required",
                    text: "Please log in to save products to your wishlist.",
                    showCancelButton: true,
                    confirmButtonText: "Log In",
                    cancelButtonText: "Not Now",
                    confirmButtonColor: "#292929"
                });

                if (result.isConfirmed) {
                    window.location.href = loginUrl;
                }

            } else {

                window.location.href = loginUrl;

            }

            return;
        }

        if (!response.ok || !data || !data.success) {

            showMessage(
                "error",
                "Unable to Update Wishlist",
                (data && data.message) ||
                    "Something went wrong. Please try again."
            );

            return;
        }

        document
            .querySelectorAll('[data-wishlist-toggle][data-product-id="' + productId + '"]')
            .forEach((heart) => {

                const icon = heart.querySelector("i");

                heart.classList.toggle("active", data.inWishlist);
                heart.setAttribute("aria-pressed", data.inWishlist ? "true" : "false");
                heart.setAttribute(
                    "aria-label",
                    data.inWishlist ? "Remove from wishlist" : "Add to wishlist"
                );

                if (icon) {
                    icon.classList.toggle("bi-heart-fill", data.inWishlist);
                    icon.classList.toggle("bi-heart", !data.inWishlist);
                }

            });

       
        const wishlistCountEl = document.querySelector(".wristora-wishlist-count");

        if (wishlistCountEl && typeof data.wishlistCount !== "undefined") {
            wishlistCountEl.textContent = data.wishlistCount;
        }

    } catch (error) {

        console.error("Wishlist toggle failed:", error);

        showMessage(
            "error",
            "Something Went Wrong",
            "Unable to update your wishlist. Please try again."
        );

    } finally {

        button.disabled = false;

    }

});