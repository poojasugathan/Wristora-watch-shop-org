const Address = require("../models/addressModel");
const { buildCartSummary } = require("./cartController");



const loadCheckout = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const { cartItems, cartTotal } = await buildCartSummary(userId);

       
        if (cartItems.length === 0) {
            return res.redirect("/cart?checkoutError=empty");
        }

        const hasInvalidItem = cartItems.some((item) =>
            item.isMissing ||
            !item.isAvailable ||
            item.isOutOfStock ||
            item.exceedsStock
        );

        if (hasInvalidItem) {
            return res.redirect("/cart?checkoutError=invalid");
        }

       
        const addresses = await Address.find({ userId })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        return res.render(
            "user/checkout",
            {
                title: "Checkout",
                user: req.session.user,
                cartItems,
                cartTotal,
                addresses,
                error: null
            }
        );

    } catch (error) {

        console.error("Load checkout error:", error);

        
        return res.redirect("/cart?checkoutError=server");

    }

};

module.exports = {
    loadCheckout
};