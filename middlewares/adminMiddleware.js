// =====================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// =====================================================

const requireAdmin = (req, res, next) => {

    // =================================================
    // CHECK ADMIN SESSION
    // =================================================

    if (
        req.session &&
        req.session.admin &&
        req.session.admin.id &&
        req.session.admin.role === "admin"
    ) {

        return next();

    }


    // =================================================
    // NOT AUTHENTICATED AS ADMIN
    // =================================================

    return res.redirect("/admin/login");

};


module.exports = requireAdmin;