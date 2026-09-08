const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");


// =====================================================
// USER PRODUCT LISTING (PHASE 38)
// Public route — no login required to browse products.
// =====================================================

router.get(
    "/",
    productController.loadProductListing
);


module.exports = router;