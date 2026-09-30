const express = require("express");

const router = express.Router();

const wishlistController = require("../controllers/wishlistController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// USER WISHLIST (PHASE 45 + PHASE 49)
// Every route requires login.
// =====================================================

router.get(
    "/",
    requireAuth,
    wishlistController.loadWishlist
);

router.post(
    "/add",
    requireAuth,
    wishlistController.addToWishlist
);

// PHASE 49 — one JSON route used by every heart button
// (product cards + product details). It adds the product
// if it is not in the wishlist and removes it if it is.
router.post(
    "/toggle",
    requireAuth,
    wishlistController.toggleWishlist
);

router.post(
    "/remove/:productId",
    requireAuth,
    wishlistController.removeFromWishlist
);

router.post(
    "/add-to-cart",
    requireAuth,
    wishlistController.addWishlistItemToCart
);

module.exports = router;