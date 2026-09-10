// =====================================================
// CART COUNT MIDDLEWARE (PHASE 43)
//
// Runs on every request (mirrors headerDataMiddleware).
// Makes res.locals.cartCount available to every EJS view,
// so the navbar badge always reflects the real, current
// database state — never a stale number left over from
// an earlier page load.
// =====================================================

const { getCartItemCount } = require("../controllers/cartController");

const attachCartCount = async (req, res, next) => {

    try {

        const userId =
            req.session && req.session.user
                ? req.session.user.id
                : null;

        res.locals.cartCount = await getCartItemCount(userId);

    } catch (error) {

        console.error("Cart count middleware error:", error);

        // Fail safe: never let a database hiccup break page
        // rendering for an unrelated reason. Worst case, the
        // badge just shows 0 for that one request.
        res.locals.cartCount = 0;

    }

    next();

};

module.exports = attachCartCount;