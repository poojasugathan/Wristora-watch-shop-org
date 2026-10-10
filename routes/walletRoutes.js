const express = require("express");

const router = express.Router();

const walletController = require("../controllers/walletController");

const requireAuth = require("../middlewares/authMiddleware");

// Phase 56: every wallet route needs a logged-in user.

router.get(
    "/",
    requireAuth,
    walletController.loadWallet
);

router.post(
    "/add-money/create",
    requireAuth,
    walletController.startTopup
);

router.post(
    "/add-money/verify",
    requireAuth,
    walletController.confirmTopup
);

module.exports = router;
