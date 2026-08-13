const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");

const passport = require("../config/passport");

const {
    signupValidator
} = require("../validators/authValidator");

const validate = require("../middlewares/validationMiddleware");


// =====================================================
// LOGIN PAGE
// =====================================================

router.get(
    "/login",
    authController.loadLogin
);


// =====================================================
// NORMAL LOGIN
// =====================================================

router.post(
    "/login",
    authController.login
);

// =====================================================
// FORGOT PASSWORD PAGE
// =====================================================

router.get(
    "/forgot-password",
    authController.loadForgotPassword
);


// =====================================================
// SEND FORGOT PASSWORD OTP
// =====================================================

router.post(
    "/forgot-password",
    authController.forgotPassword
);


// =====================================================
// FORGOT PASSWORD OTP PAGE
// =====================================================

router.get(
    "/forgot-password/otp",
    authController.loadForgotPasswordOtp
);


// =====================================================
// VERIFY FORGOT PASSWORD OTP
// =====================================================

router.post(
    "/forgot-password/verify-otp",
    authController.verifyForgotPasswordOtp
);


// =====================================================
// RESEND FORGOT PASSWORD OTP
// =====================================================

router.post(
    "/forgot-password/resend-otp",
    authController.resendForgotPasswordOtp
);


// =====================================================
// RESET PASSWORD PAGE
// =====================================================

router.get(
    "/reset-password",
    authController.loadResetPassword
);


// =====================================================
// UPDATE PASSWORD
// =====================================================

router.post(
    "/reset-password",
    authController.resetPassword
);

// =====================================================
// GOOGLE LOGIN
// =====================================================

router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"]
    })
);


// =====================================================
// GOOGLE CALLBACK
// =====================================================

router.get(
    "/google/callback",

    passport.authenticate("google", {
        session: false,
        failureRedirect: "/auth/login?error=google"
    }),

    authController.googleCallback
);


// =====================================================
// SIGNUP PAGE
// =====================================================

router.get(
    "/signup",
    authController.loadSignup
);


// =====================================================
// SIGNUP FORM
// =====================================================

router.post(
    "/signup",
    signupValidator,
    validate,
    authController.signup
);


// =====================================================
// OTP PAGE
// =====================================================

router.get(
    "/otp",
    authController.loadOtp
);


// =====================================================
// VERIFY OTP
// =====================================================

router.post(
    "/verify-otp",
    authController.verifyOtpController
);


// =====================================================
// RESEND OTP
// =====================================================

router.post(
    "/resend-otp",
    authController.resendOtp
);

router.post("/logout", authController.logout);

module.exports = router;