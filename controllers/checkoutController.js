const Address = require("../models/addressModel");
const { buildCartSummary } = require("./cartController");

// =====================================================
// PHASE 46 — CHECKOUT PROTECTION
//
// This is the single entry point into checkout. It never
// trusts anything from the browser — no submitted price,
// quantity, total, or product id. Everything here comes
// straight from the database, via the SAME buildCartSummary
// helper the cart page already uses (Phase 44). That means
// there is only one definition of "is this cart valid right
// now" in the whole app — cart and checkout can never
// disagree with each other.
//
// requireAuth (in the route) already guarantees
// req.session.user.id exists before this function runs, so
// there is no unauthenticated path through here.
// =====================================================

const loadCheckout = async (req, res) => {

    try {

        const userId = req.session.user.id;

        // Re-read the cart and every product in it from
        // MongoDB right now — not whatever was rendered on
        // the cart page a moment ago.
        const { cartItems, cartTotal } = await buildCartSummary(userId);

        // ---- Empty cart protection ----
        if (cartItems.length === 0) {
            return res.redirect("/cart?checkoutError=empty");
        }

        // ---- Product availability / stock / quantity protection ----
        // Any one bad item blocks the whole checkout. The cart
        // page already shows exactly which item is the problem
        // (isMissing / isOutOfStock / exceedsStock messages), so
        // sending the user back there is the right place for them
        // to actually fix it.
        const hasInvalidItem = cartItems.some((item) =>
            item.isMissing ||
            !item.isAvailable ||
            item.isOutOfStock ||
            item.exceedsStock
        );

        if (hasInvalidItem) {
            return res.redirect("/cart?checkoutError=invalid");
        }

        // ---- Address ownership ----
        // Only this user's own addresses are ever fetched — the
        // query is scoped by userId, exactly like addressController
        // already does everywhere else.
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

        // Never leak a MongoDB error or stack trace — send the
        // user back to the cart with a generic, friendly reason.
        return res.redirect("/cart?checkoutError=server");

    }

};

module.exports = {
    loadCheckout
};