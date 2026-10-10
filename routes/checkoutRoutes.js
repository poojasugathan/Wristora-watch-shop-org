const express = require("express");

const router = express.Router();

const checkoutController = require("../controllers/checkoutController");

const requireAuth = require("../middlewares/authMiddleware");

router.get(
    "/",
    requireAuth,
    checkoutController.loadCheckout
);


router.post(
    "/place-order",
    requireAuth,
    checkoutController.placeOrder
);

router.get(
    "/success/:orderId",
    requireAuth,
    checkoutController.loadOrderSuccess
);


// ---------- Coupons (Phase 55) ----------

router.post(
    "/coupon/apply",
    requireAuth,
    checkoutController.applyCoupon
);

router.post(
    "/coupon/remove",
    requireAuth,
    checkoutController.removeCoupon
);


// ---------- Online payment (Razorpay) ----------

router.post(
    "/online/create",
    requireAuth,
    checkoutController.startOnlinePayment
);

router.post(
    "/online/verify",
    requireAuth,
    checkoutController.verifyOnlinePayment
);

router.post(
    "/online/failed",
    requireAuth,
    checkoutController.failOnlinePayment
);

router.post(
    "/online/retry",
    requireAuth,
    checkoutController.retryOnlinePayment
);

router.get(
    "/payment-failed/:orderId",
    requireAuth,
    checkoutController.loadPaymentFailed
);


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