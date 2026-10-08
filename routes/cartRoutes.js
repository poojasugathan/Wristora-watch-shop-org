const express = require("express");

const router = express.Router();

const cartController = require("../controllers/cartController");

const requireAuth = require("../middlewares/authMiddleware");



router.get(
    "/",
    requireAuth,
    cartController.loadCart
);


router.post(
    "/add",
    requireAuth,
    cartController.addToCart
);


router.post(
    "/increase",
    requireAuth,
    cartController.increaseQuantity
);

router.post(
    "/decrease",
    requireAuth,
    cartController.decreaseQuantity
);


router.post(
    "/remove/:productId",
    requireAuth,
    cartController.removeFromCart
);


module.exports = router;