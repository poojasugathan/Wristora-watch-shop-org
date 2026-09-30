// =====================================================
// ADMIN FLASH MESSAGES (PHASE 52)
//
// After a form POST (change status, update stock ...) we
// REDIRECT back to a page. A redirect cannot carry a message,
// so we park it in the admin session for one page view:
//
//   setFlash(req, "success", "Stock updated.")   <- before redirect
//   const flash = takeFlash(req)                 <- when rendering
//
// The message lives on the server (in the session), so nobody
// can fake a message by editing the URL.
// =====================================================

const setFlash = (req, type, message) => {
    req.session.adminFlash = { type, message };
};

// Reads the message AND removes it, so it shows only once.
const takeFlash = (req) => {

    const flash = req.session.adminFlash || null;

    if (flash) {
        delete req.session.adminFlash;
    }

    return flash;
};

module.exports = { setFlash, takeFlash };