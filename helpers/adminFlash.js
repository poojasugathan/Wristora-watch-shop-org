

const setFlash = (req, type, message) => {
    req.session.adminFlash = { type, message };
};


const takeFlash = (req) => {

    const flash = req.session.adminFlash || null;

    if (flash) {
        delete req.session.adminFlash;
    }

    return flash;
};

module.exports = { setFlash, takeFlash };