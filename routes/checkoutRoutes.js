const express = require("express");

const router = express.Router();

const checkoutController = require("../controllers/checkoutController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// CHECKOUT (PHASE 46)
// Same pattern as cartRoutes/addressRoutes: every route
// requires login, no separate auth system.
// =====================================================

router.get(
    "/",
    requireAuth,
    checkoutController.loadCheckout
);


module.exports = router;