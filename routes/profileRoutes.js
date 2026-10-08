const express = require("express");

const router = express.Router();

const profileController = require("../controllers/profileController");
const requireAuth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const {
    attachAuthProvider,
    blockGoogleUsers
} = require("../middlewares/authProviderMiddleware");

router.use(attachAuthProvider);


router.get(
    "/",
    requireAuth,
    profileController.loadProfile
);



router.get(
    "/edit",
    requireAuth,
    profileController.loadEditProfile
);


router.post(
    "/edit",
    requireAuth,
    profileController.updateProfile
);

router.get(
    "/change-password",
    requireAuth,
    blockGoogleUsers,
    profileController.loadChangePassword
);

router.post(
    "/change-password",
    requireAuth,
    blockGoogleUsers,
    profileController.changePassword
);



router.post(
    "/edit/email",
    requireAuth,
    blockGoogleUsers,
    profileController.updateEmail
);


router.get(
    "/change-email/otp",
    requireAuth,
    blockGoogleUsers,
    profileController.loadEmailChangeOtp
);


router.post(
    "/change-email/otp",
    requireAuth,
    blockGoogleUsers,
    profileController.verifyEmailChangeOtp
);



router.post(
    "/change-email/resend",
    requireAuth,
    blockGoogleUsers,
    profileController.resendEmailChangeOtp
);



router.post(
    "/image",
    requireAuth,
    upload.single("profileImage"),
    profileController.uploadProfileImage
);




router.post(
    "/image/delete",
    requireAuth,
    profileController.deleteProfileImage
);


module.exports = router;