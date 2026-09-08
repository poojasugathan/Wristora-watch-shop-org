const { getActiveBrands } = require("../services/brandService");

const attachHeaderData = async (req, res, next) => {

    try {

        res.locals.headerBrands = await getActiveBrands();

    } catch (error) {

        console.error("Header brand fetch error:", error);
        res.locals.headerBrands = [];

    }

    next();

};

module.exports = attachHeaderData;