

const User = require("../models/userModel");


const rejectRequest = (req, res) => {

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


const requireAuth = async (req, res, next) => {

    const sessionUser = req.session && req.session.user;

  
    if (!sessionUser || !sessionUser.id) {
        return rejectRequest(req, res);
    }

    try {

        const account = await User
            .findById(sessionUser.id)
            .select("isBlocked")
            .lean();

        if (account && account.isBlocked !== true) {
            return next();
        }

    } catch (error) {

       
        return next(error);
    }

    
    return req.session.destroy(() => rejectRequest(req, res));
};


module.exports = requireAuth;