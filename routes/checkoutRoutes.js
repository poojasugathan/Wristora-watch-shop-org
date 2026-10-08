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