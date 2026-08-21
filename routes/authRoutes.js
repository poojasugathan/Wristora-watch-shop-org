const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");

const passport = require("../config/passport");

const {
    signupValidator
} = require("../validators/authValidator");

const validate = require("../middlewares/validationMiddleware");

router.get(
    "/login",
    authController.loadLogin
);


router.post(
    "/login",
    authController.login
);


router.get(
    "/forgot-password",
    authController.loadForgotPassword
);

router.post(
    "/forgot-password",
    authController.forgotPassword
);

router.get(
    "/forgot-password/otp",
    authController.loadForgotPasswordOtp
);


router.post(
    "/forgot-password/verify-otp",
    authController.verifyForgotPasswordOtp
);


router.post(
    "/forgot-password/resend-otp",
    authController.resendForgotPasswordOtp
);


router.get(
    "/reset-password",
    authController.loadResetPassword
);

router.post(
    "/reset-password",
    authController.resetPassword
);


router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"]
    })
);

router.get(
    "/google/callback",

    passport.authenticate("google", {
        session: false,
        failureRedirect: "/auth/login?error=google"
    }),

    authController.googleCallback
);

router.get(
    "/signup",
    authController.loadSignup
);

router.post(
    "/signup",
    signupValidator,
    validate,
    authController.signup
);

router.get(
    "/otp",
    authController.loadOtp
);



router.post(
    "/verify-otp",
    authController.verifyOtpController
);


router.post(
    "/resend-otp",
    authController.resendOtp
);

router.post("/logout", authController.logout);

module.exports = router;