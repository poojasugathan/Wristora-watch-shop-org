// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

const requireAuth = (req, res, next) => {

    if (
        req.session &&
        req.session.user &&
        req.session.user.id
    ) {
        return next();
    }


    return res.redirect("/auth/login");
};


module.exports = requireAuth;