const express = require("express");

const router = express.Router();

const orderController = require("../controllers/orderController");

const requireAuth = require("../middlewares/authMiddleware");

router.get(
    "/",
    requireAuth,
    orderController.loadOrders
);


router.get(
    "/:orderId",
    requireAuth,
    orderController.loadOrderDetails
);


router.get(
    "/:orderId/invoice",
    requireAuth,
    orderController.downloadInvoice
);


router.post(
    "/:orderId/cancel",
    requireAuth,
    orderController.cancelOrder
);


router.post(
    "/:orderId/items/:itemId/cancel",
    requireAuth,
    orderController.cancelOrderItem
);


router.post(
    "/:orderId/return",
    requireAuth,
    orderController.requestReturn
);


module.exports = router;