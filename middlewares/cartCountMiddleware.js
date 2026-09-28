

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

        
        res.locals.cartCount = 0;

    }

    next();

};

module.exports = attachCartCount;