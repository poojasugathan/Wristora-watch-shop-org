const express = require("express");

const router = express.Router();

const addressController = require("../controllers/addressController");

const requireAuth = require("../middlewares/authMiddleware");

const {
    returnToCheckout,
    clearCheckoutReturn
} = require("../middlewares/checkoutReturnMiddleware");


router.get(
    "/",
    requireAuth,
    clearCheckoutReturn,
    addressController.loadAddresses
);



router.get(
    "/add",
    requireAuth,
    addressController.loadAddAddress
);


router.post(
    "/add",
    requireAuth,
    returnToCheckout,
    addressController.addAddress
);


router.get(
    "/edit/:id",
    requireAuth,
    addressController.loadEditAddress
);


router.post(
    "/edit/:id",
    requireAuth,
    returnToCheckout,
    addressController.updateAddress
);



router.post(
    "/delete/:id",
    requireAuth,
    addressController.deleteAddress
);


router.post(
    "/default/:id",
    requireAuth,
    addressController.setDefaultAddress
);


module.exports = router;