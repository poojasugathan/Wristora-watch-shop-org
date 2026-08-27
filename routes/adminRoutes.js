const express = require("express");

const router = express.Router();

const adminController =
    require("../controllers/adminController");

const requireAdmin =
    require("../middlewares/adminMiddleware");

const productUpload =
    require("../middlewares/productUploadMiddleware");

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


// =====================================================
// CATEGORY MANAGEMENT (PHASE 34)
// =====================================================

router.get(
    "/categories",
    requireAdmin,
    adminController.loadCategories
);


router.get(
    "/categories/add",
    requireAdmin,
    adminController.loadAddCategory
);


router.post(
    "/categories/add",
    requireAdmin,
    adminController.addCategory
);


router.get(
    "/categories/edit/:id",
    requireAdmin,
    adminController.loadEditCategory
);


router.post(
    "/categories/edit/:id",
    requireAdmin,
    adminController.editCategory
);


router.post(
    "/categories/delete/:id",
    requireAdmin,
    adminController.deleteCategory
);


// =====================================================
// PRODUCT MANAGEMENT (PHASE 35)
// =====================================================

router.get(
    "/products",
    requireAdmin,
    adminController.loadProducts
);


router.get(
    "/products/add",
    requireAdmin,
    adminController.loadAddProduct
);


router.post(
    "/products/add",
    requireAdmin,
    productUpload.array("images", 8),
    adminController.addProduct
);


router.get(
    "/products/edit/:id",
    requireAdmin,
    adminController.loadEditProduct
);


router.post(
    "/products/edit/:id",
    requireAdmin,
    adminController.editProduct
);


router.post(
    "/products/delete/:id",
    requireAdmin,
    adminController.deleteProduct
);


router.post(
    "/products/toggle-list/:id",
    requireAdmin,
    adminController.toggleProductListing
);



module.exports = router;