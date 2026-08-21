
const requireAdmin = (req, res, next) => {

    
    if (
        req.session &&
        req.session.admin &&
        req.session.admin.id &&
        req.session.admin.role === "admin"
    ) {

        return next();

    }


    return res.redirect("/admin/login");

};


module.exports = requireAdmin;