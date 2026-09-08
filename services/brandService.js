const Product = require("../models/productModel");

const getActiveBrands = async () => {

    const brandsRaw = await Product.distinct("brand", {
        isDeleted: false,
        isListed: true,
        isBlocked: false,
        brand: { $ne: "" }
    });

    return brandsRaw.sort((a, b) => a.localeCompare(b));

};

module.exports = { getActiveBrands };