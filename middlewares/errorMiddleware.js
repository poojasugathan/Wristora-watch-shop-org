
const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[ch]));

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



const pickStatus = (error) => {

    if (error && error.name === "CastError") {
        return 404;
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
        
        bare: isAdminPage,
        homeUrl: isAdminPage ? "/admin/dashboard" : "/",
        homeLabel: isAdminPage ? "Back to Dashboard" : "Back to Home"
    };

    
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

const errorHandler = (error, req, res, next) => {

    if (res.headersSent) {
        return next(error);
    }

    const status = pickStatus(error);

   
    if (status >= 500) {
        console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
    }

    return sendErrorPage(req, res, status);
};


module.exports = {
    notFoundHandler,
    errorHandler
};