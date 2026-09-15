const express = require("express");

const router = express.Router();

const cartController = require("../controllers/cartController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// USER CART (PHASE 43 + PHASE 44)
// Every route here requires the user to be logged in —
// there is no public/guest cart in this project.
// =====================================================

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


// PHASE 44 — quantity controls on the cart page.
// These follow the same pattern as /add: a POST route,
// requireAuth, JSON in/out (called via fetch() from cart.js).
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