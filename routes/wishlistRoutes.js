const express = require("express");

const router = express.Router();

const wishlistController = require("../controllers/wishlistController");

const requireAuth = require("../middlewares/authMiddleware");


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