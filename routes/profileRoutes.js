const express = require("express");

const router = express.Router();

const profileController = require("../controllers/profileController");
const requireAuth = require("../middlewares/authMiddleware");


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


module.exports = router;