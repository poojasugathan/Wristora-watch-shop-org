const express = require("express");

const router = express.Router();

const cartController = require("../controllers/cartController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// USER CART (PHASE 43)
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


router.post(
    "/remove/:productId",
    requireAuth,
    cartController.removeFromCart
);


module.exports = router;