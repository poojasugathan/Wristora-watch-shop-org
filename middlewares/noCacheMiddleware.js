// =====================================================
// NO-CACHE MIDDLEWARE
//
// Without this, browsers can restore a page from their
// "back-forward cache" (bfcache) when you press Back —
// showing an old snapshot instead of asking the server for
// a fresh page. That's why logging in, then pressing Back,
// can show the login page again even though you're actually
// still logged in: the browser never re-checked.
//
// These headers tell the browser "don't keep this page
// around — always ask the server again." Apply this to any
// route where showing a stale/cached version would be
// confusing or unsafe: auth pages, cart, checkout, profile,
// admin pages, etc.
// =====================================================

const noCache = (req, res, next) => {

    res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    next();

};

module.exports = noCache;