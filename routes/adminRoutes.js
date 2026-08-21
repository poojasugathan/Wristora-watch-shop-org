const express = require("express");

const router = express.Router();

const adminController =
    require("../controllers/adminController");

const requireAdmin =
    require("../middlewares/adminMiddleware");

router.get(
    "/login",
    adminController.loadAdminLogin
);


router.post(
    "/login",
    adminController.adminLogin
);


router.post(
    "/logout",
    requireAdmin,
    adminController.adminLogout
);

router.get(
    "/dashboard",
    requireAdmin,
    adminController.loadDashboard
);


router.get(
    "/users",
    requireAdmin,
    adminController.loadUsers
);


router.get(
    "/users/:id",
    requireAdmin,
    adminController.loadUserDetails
);



router.post(
    "/users/:id/block",
    requireAdmin,
    adminController.blockUser
);



module.exports = router;