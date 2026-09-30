// =====================================================
// ERROR MIDDLEWARE (PHASE 53)
//
// notFoundHandler -> runs when NO route matched (404)
// errorHandler    -> runs when ANY route/middleware throws
//
// Why we need it:
//   Without it, Express shows its own error page, which can
//   include the stack trace and file paths. Visitors must
//   never see that (or raw MongoDB / Mongoose / Cloudinary
//   messages). Here the real error is only written to the
//   server console, and the visitor gets a friendly page.
// =====================================================

const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[ch]));


// fetch() calls from cart.js / wishlist.js / orders.js want JSON back
const wantsJson = (req) =>
    Boolean(req.is("application/json")) ||
    (req.headers.accept || "").includes("application/json");


const MESSAGES = {
    400: { heading: "Something was wrong with that request", message: "Please go back and try again." },
    403: { heading: "You can't open this page", message: "You don't have permission to view it." },
    404: { heading: "Page not found", message: "The page you are looking for doesn't exist or has moved." },
    413: { heading: "That upload is too large", message: "Please choose a smaller file and try again." },
    500: { heading: "Something went wrong", message: "We hit a problem on our side. Please try again in a moment." }
};


// Only real HTTP error codes are trusted; anything else is a 500.
const pickStatus = (error) => {

    if (error && error.name === "CastError") {
        return 404; // e.g. an invalid ID typed in the URL
    }

    const status = error && (error.status || error.statusCode);

    return Number.isInteger(status) && status >= 400 && status < 600
        ? status
        : 500;
};


const sendErrorPage = (req, res, status) => {

    const text = MESSAGES[status] || MESSAGES[status >= 500 ? 500 : 400];

    if (wantsJson(req)) {
        return res.status(status).json({
            success: false,
            message: text.message
        });
    }

    const isAdminPage = req.path.startsWith("/admin");

    const data = {
        title: text.heading,
        status,
        heading: text.heading,
        message: text.message,
        // admin pages have their own layout, so they get a plain page
        bare: isAdminPage,
        homeUrl: isAdminPage ? "/admin/dashboard" : "/",
        homeLabel: isAdminPage ? "Back to Dashboard" : "Back to Home"
    };

    // Callback form: if the error page itself cannot render (for
    // example the error came from the header middleware), we fall
    // back to a tiny page instead of failing twice.
    return res.status(status).render("user/error", data, (renderError, html) => {

        if (renderError) {

            console.error("Error page render failed:", renderError);

            return res
                .type("html")
                .send(
                    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">` +
                    `<title>${escapeHtml(text.heading)}</title></head>` +
                    `<body style="font-family:Arial,sans-serif;text-align:center;padding:80px 20px;">` +
                    `<h1>${escapeHtml(text.heading)}</h1>` +
                    `<p>${escapeHtml(text.message)}</p>` +
                    `<p><a href="${escapeHtml(data.homeUrl)}">${escapeHtml(data.homeLabel)}</a></p>` +
                    `</body></html>`
                );
        }

        return res.send(html);
    });
};


const notFoundHandler = (req, res) => sendErrorPage(req, res, 404);


// Express recognises an error handler by its 4 parameters -
// keep all four, even though `next` is used only once.
const errorHandler = (error, req, res, next) => {

    // The response already started - Express must close it.
    if (res.headersSent) {
        return next(error);
    }

    const status = pickStatus(error);

    // Full details go to the SERVER log only.
    if (status >= 500) {
        console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
    }

    return sendErrorPage(req, res, status);
};


module.exports = {
    notFoundHandler,
    errorHandler
};