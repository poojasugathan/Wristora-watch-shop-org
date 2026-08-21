const express = require("express");

const router = express.Router();

const profileController = require("../controllers/profileController");
const requireAuth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");


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
    profileController.loadChangePassword
);

router.post(
    "/change-password",
    requireAuth,
    profileController.changePassword
);



router.post(
    "/edit/email",
    requireAuth,
    profileController.updateEmail
);


router.get(
    "/change-email/otp",
    requireAuth,
    profileController.loadEmailChangeOtp
);


router.post(
    "/change-email/otp",
    requireAuth,
    profileController.verifyEmailChangeOtp
);



router.post(
    "/change-email/resend",
    requireAuth,
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