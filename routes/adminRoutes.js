const express = require("express");

const router = express.Router();

const adminController =
    require("../controllers/adminController");

const requireAdmin =
    require("../middlewares/adminMiddleware");



// =====================================================
// ADMIN LOGIN PAGE
// =====================================================

router.get(
    "/login",
    adminController.loadAdminLogin
);



// =====================================================
// ADMIN LOGIN
// =====================================================

router.post(
    "/login",
    adminController.adminLogin
);



// =====================================================
// ADMIN LOGOUT
// =====================================================

router.post(
    "/logout",
    requireAdmin,
    adminController.adminLogout
);



// =====================================================
// ADMIN DASHBOARD
// =====================================================

router.get(
    "/dashboard",
    requireAdmin,
    adminController.loadDashboard
);



// =====================================================
// ADMIN USER MANAGEMENT
// =====================================================

// CUSTOMER LIST

router.get(
    "/users",
    requireAdmin,
    adminController.loadUsers
);



// CUSTOMER DETAILS

router.get(
    "/users/:id",
    requireAdmin,
    adminController.loadUserDetails
);



// BLOCK CUSTOMER

router.post(
    "/users/:id/block",
    requireAdmin,
    adminController.blockUser
);



module.exports = router;