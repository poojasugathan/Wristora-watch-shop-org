const express = require("express");

const router = express.Router();

const checkoutController = require("../controllers/checkoutController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// CHECKOUT (PHASE 46 + PHASE 50)
// Every route requires login (same pattern as cart/address).
// =====================================================

router.get(
    "/",
    requireAuth,
    checkoutController.loadCheckout
);

// Place the order (Cash on Delivery)
router.post(
    "/place-order",
    requireAuth,
    checkoutController.placeOrder
);

// Order success page (owner only)
router.get(
    "/success/:orderId",
    requireAuth,
    checkoutController.loadOrderSuccess
);

// Add / edit address, then return to checkout
router.get(
    "/address/new",
    requireAuth,
    checkoutController.startAddAddress
);

router.get(
    "/address/:id/edit",
    requireAuth,
    checkoutController.startEditAddress
);


module.exports = router;