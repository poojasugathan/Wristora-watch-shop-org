const express = require("express");

const router = express.Router();

const orderController = require("../controllers/orderController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// USER ORDERS (PHASE 51)
// Every route requires login, and every controller action
// only ever looks up orders that belong to the logged-in user.
// =====================================================

// My Orders (search + pagination)
router.get(
    "/",
    requireAuth,
    orderController.loadOrders
);

// Order details
router.get(
    "/:orderId",
    requireAuth,
    orderController.loadOrderDetails
);

// Invoice PDF
router.get(
    "/:orderId/invoice",
    requireAuth,
    orderController.downloadInvoice
);

// Cancel the whole order
router.post(
    "/:orderId/cancel",
    requireAuth,
    orderController.cancelOrder
);

// Cancel one item of an order
router.post(
    "/:orderId/items/:itemId/cancel",
    requireAuth,
    orderController.cancelOrderItem
);

// Request a return (reason is mandatory)
router.post(
    "/:orderId/return",
    requireAuth,
    orderController.requestReturn
);


module.exports = router;