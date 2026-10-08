const User = require("../models/userModel");

// Sets res.locals.isGoogleUser so every EJS view can use it
const attachAuthProvider = async (req, res, next) => {
    res.locals.isGoogleUser = false;

    try {
        if (req.session && req.session.user && req.session.user.id) {
            const user = await User.findById(req.session.user.id)
                .select("googleId")
                .lean();

            res.locals.isGoogleUser = Boolean(user && user.googleId);
        }
    } catch (error) {
        console.error("Auth provider check error:", error);
    }

    next();
};

// Use on email-change and password-change routes
const blockGoogleUsers = (req, res, next) => {
    if (!res.locals.isGoogleUser) {
        return next();
    }

    // fetch/JSON routes (OTP verify / resend)
    if (req.xhr || req.is("json")) {
        return res.status(403).json({
            success: false,
            reason: "google_account",
            message: "Email and password are managed by your Google account."
        });
    }

    return res.redirect("/profile/edit");
};

module.exports = {
    attachAuthProvider,
    blockGoogleUsers
};