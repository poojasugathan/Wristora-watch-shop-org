const express = require("express");

const router = express.Router();

const addressController = require("../controllers/addressController");

const requireAuth = require("../middlewares/authMiddleware");


router.get(
    "/",
    requireAuth,
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