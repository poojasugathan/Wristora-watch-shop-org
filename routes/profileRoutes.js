const express = require("express");

const router = express.Router();

const profileController = require("../controllers/profileController");
const requireAuth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");


// =====================================================
// PROFILE PAGE
// =====================================================

router.get(
    "/",
    requireAuth,
    profileController.loadProfile
);


// =====================================================
// EDIT PROFILE PAGE
// =====================================================

router.get(
    "/edit",
    requireAuth,
    profileController.loadEditProfile
);


// =====================================================
// UPDATE PERSONAL DETAILS
// =====================================================

router.post(
    "/edit",
    requireAuth,
    profileController.updateProfile
);
// =====================================================
// CHANGE PASSWORD PAGE
// =====================================================

router.get(
    "/change-password",
    requireAuth,
    profileController.loadChangePassword
);



// =====================================================
// CHANGE PASSWORD
// =====================================================

router.post(
    "/change-password",
    requireAuth,
    profileController.changePassword
);

// =====================================================
// UPDATE EMAIL
// =====================================================

router.post(
    "/edit/email",
    requireAuth,
    profileController.updateEmail
);
// =====================================================
// EMAIL CHANGE OTP PAGE
// =====================================================

router.get(
    "/change-email/otp",
    requireAuth,
    profileController.loadEmailChangeOtp
);


// =====================================================
// VERIFY EMAIL CHANGE OTP
// =====================================================

router.post(
    "/change-email/otp",
    requireAuth,
    profileController.verifyEmailChangeOtp
);


// =====================================================
// RESEND EMAIL CHANGE OTP
// =====================================================

router.post(
    "/change-email/resend",
    requireAuth,
    profileController.resendEmailChangeOtp
);


// =====================================================
// UPLOAD / CHANGE PROFILE IMAGE
// =====================================================

router.post(
    "/image",
    requireAuth,
    upload.single("profileImage"),
    profileController.uploadProfileImage
);


// =====================================================
// DELETE PROFILE IMAGE
// =====================================================

router.post(
    "/image/delete",
    requireAuth,
    profileController.deleteProfileImage
);


module.exports = router;