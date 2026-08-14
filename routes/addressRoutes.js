const express = require("express");

const router = express.Router();

const addressController = require("../controllers/addressController");

const requireAuth = require("../middlewares/authMiddleware");


// =====================================================
// ADDRESS LIST PAGE
// =====================================================

router.get(
    "/",
    requireAuth,
    addressController.loadAddresses
);


// =====================================================
// ADD NEW ADDRESS PAGE
// =====================================================

router.get(
    "/add",
    requireAuth,
    addressController.loadAddAddress
);


// =====================================================
// ADD NEW ADDRESS
// =====================================================

router.post(
    "/add",
    requireAuth,
    addressController.addAddress
);


// // =====================================================
// // EDIT ADDRESS PAGE
// // =====================================================

router.get(
    "/edit/:id",
    requireAuth,
    addressController.loadEditAddress
);


// // =====================================================
// // UPDATE ADDRESS
// // =====================================================

router.post(
    "/edit/:id",
    requireAuth,
    addressController.updateAddress
);


// =====================================================
// DELETE ADDRESS
// =====================================================

router.post(
    "/delete/:id",
    requireAuth,
    addressController.deleteAddress
);


// =====================================================
// SET DEFAULT ADDRESS
// =====================================================

router.post(
    "/default/:id",
    requireAuth,
    addressController.setDefaultAddress
);


module.exports = router;