// =====================================================
// ORDERS PAGE SCRIPT (PHASE 51)
//
// Handles the Cancel Order / Cancel Item / Return buttons.
// This script only collects the reason and shows messages.
// The server decides whether the action is really allowed.
// =====================================================

(function () {

    const RETURN_REASON_MIN_LENGTH = 10;

    // Send a JSON POST. Returns { ok, data } or null when the
    // user had to be sent to the login page.
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

    // Runs inside the SweetAlert "confirm" step: calls the server
    // and shows the server's message inside the popup on failure.
    const runRequest = async (url, reason) => {

        try {

            const result = await postJson(url, { reason });

            if (!result) {
                return false;
            }

            if (!result.ok) {
                Swal.showValidationMessage(
                    result.data.message || "Something went wrong. Please try again."
                );
                return false;
            }

            return result.data;

        } catch (error) {

            Swal.showValidationMessage(
                "Network problem. Please check your connection and try again."
            );

            return false;
        }
    };

    const showDoneAndReload = (message) => {

        Swal.fire({
            icon: "success",
            title: message,
            confirmButtonColor: "#1c1c1c"
        }).then(() => {
            window.location.reload();
        });
    };


    const askCancel = ({ title, text, url }) => {

        Swal.fire({
            title,
            text,
            icon: "warning",
            input: "textarea",
            inputLabel: "Reason (optional)",
            inputPlaceholder: "Tell us why you are cancelling...",
            inputAttributes: { maxlength: 300 },
            showCancelButton: true,
            confirmButtonText: "Yes, Cancel",
            cancelButtonText: "Keep It",
            confirmButtonColor: "#c8202f",
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            preConfirm: (reason) => runRequest(url, reason)
        }).then((result) => {

            if (result.isConfirmed && result.value) {
                showDoneAndReload(result.value.message);
            }
        });
    };


    document.addEventListener("click", (event) => {

        const cancelOrderBtn = event.target.closest(".js-cancel-order");
        const cancelItemBtn = event.target.closest(".js-cancel-item");
        const returnBtn = event.target.closest(".js-return-order");

        if (cancelOrderBtn) {

            const orderId = cancelOrderBtn.dataset.orderId;

            askCancel({
                title: "Are you sure?",
                text: "Do you want to cancel this order?",
                url: `/orders/${encodeURIComponent(orderId)}/cancel`
            });

            return;
        }

        if (cancelItemBtn) {

            const orderId = cancelItemBtn.dataset.orderId;
            const itemId = cancelItemBtn.dataset.itemId;

            askCancel({
                title: "Cancel this item?",
                text: "The other items in your order will stay active.",
                url: `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/cancel`
            });

            return;
        }

        if (returnBtn) {

            const orderId = returnBtn.dataset.orderId;

            Swal.fire({
                title: "Return this product?",
                text: "Why do you want to return this product?",
                input: "textarea",
                inputPlaceholder: "Please describe your reason...",
                inputAttributes: { maxlength: 500 },
                showCancelButton: true,
                confirmButtonText: "Request for Return",
                cancelButtonText: "Close",
                confirmButtonColor: "#1c1c1c",
                showLoaderOnConfirm: true,
                allowOutsideClick: () => !Swal.isLoading(),
                inputValidator: (value) => {

                    if (!value || !value.trim()) {
                        return "A reason is required to return an order.";
                    }

                    if (value.trim().length < RETURN_REASON_MIN_LENGTH) {
                        return `Please write at least ${RETURN_REASON_MIN_LENGTH} characters.`;
                    }

                    return null;
                },
                preConfirm: (reason) =>
                    runRequest(`/orders/${encodeURIComponent(orderId)}/return`, reason)
            }).then((result) => {

                if (result.isConfirmed && result.value) {
                    showDoneAndReload(result.value.message);
                }
            });
        }
    });

})();