// =====================================================
// RETURN TO CHECKOUT AFTER SAVING AN ADDRESS (PHASE 50)
//
// The existing addressController always redirects to
// "/addresses?added=1" or "/addresses?updated=1" after a
// successful save. We don't want to rewrite that big file, so:
//
//  - /checkout/address/new and /checkout/address/:id/edit put a
//    timestamp in the session (req.session.checkoutReturn).
//  - returnToCheckout (used on the address POST routes) sees that
//    timestamp and, ONLY for a successful save, sends the user
//    to /checkout instead.
//  - clearCheckoutReturn (used on the address list page) forgets
//    the timestamp, so a normal visit to "My Addresses" later is
//    never hijacked.
//
// The timestamp also expires after 15 minutes.
// =====================================================

const RETURN_WINDOW_MS = 15 * 60 * 1000;

const returnToCheckout = (req, res, next) => {

    const startedAt = req.session && req.session.checkoutReturn;

    if (!startedAt) {
        return next();
    }

    if (Date.now() - startedAt > RETURN_WINDOW_MS) {
        delete req.session.checkoutReturn;
        return next();
    }

    const originalRedirect = res.redirect.bind(res);

    res.redirect = (...args) => {

        const target = args[args.length - 1];

        const isSuccessfulSave =
            typeof target === "string" &&
            (
                target.startsWith("/addresses?added=1") ||
                target.startsWith("/addresses?updated=1")
            );

        if (isSuccessfulSave) {
            delete req.session.checkoutReturn;
            return originalRedirect("/checkout?addressSaved=1");
        }

        return originalRedirect(...args);
    };

    return next();
};


const clearCheckoutReturn = (req, res, next) => {

    if (req.session && req.session.checkoutReturn) {
        delete req.session.checkoutReturn;
    }

    return next();
};


module.exports = {
    returnToCheckout,
    clearCheckoutReturn
};