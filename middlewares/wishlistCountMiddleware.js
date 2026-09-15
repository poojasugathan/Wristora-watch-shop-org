// =====================================================
// WISHLIST COUNT MIDDLEWARE (PHASE 45)
// Identical pattern to cartCountMiddleware — runs on every
// request, makes res.locals.wishlistCount available to
// every EJS view.
// =====================================================

const { getWishlistItemCount } = require("../controllers/wishlistController");

const attachWishlistCount = async (req, res, next) => {

    try {

        const userId =
            req.session && req.session.user
                ? req.session.user.id
                : null;

        res.locals.wishlistCount = await getWishlistItemCount(userId);

    } catch (error) {

        console.error("Wishlist count middleware error:", error);
        res.locals.wishlistCount = 0;

    }

    next();

};

module.exports = attachWishlistCount;