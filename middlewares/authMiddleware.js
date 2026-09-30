// =====================================================
// USER AUTH MIDDLEWARE
//
// Normal page requests  -> redirect to the login page.
// JSON/fetch requests   -> reply with a 401 JSON message
//                          (a redirect would hand the
//                          browser a login HTML page
//                          instead of JSON and break the
//                          wishlist / cart buttons).
// =====================================================

const requireAuth = (req, res, next) => {

    if (
        req.session &&
        req.session.user &&
        req.session.user.id
    ) {
        return next();
    }

    const isJsonRequest =
        req.is("application/json") ||
        (req.headers.accept || "").includes("application/json");

    if (isJsonRequest) {

        return res.status(401).json({
            success: false,
            requiresLogin: true,
            message: "Please log in to continue.",
            redirectUrl: "/auth/login"
        });

    }

    return res.redirect("/auth/login");
};


module.exports = requireAuth;