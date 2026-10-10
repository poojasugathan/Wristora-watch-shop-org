const express = require("express");

const router = express.Router();

const adminController =
    require("../controllers/adminController");

const requireAdmin =
    require("../middlewares/adminMiddleware");

const productUpload =
    require("../middlewares/productUploadMiddleware");

const handleProductImageUpload =
    require("../middlewares/handleMulterError");    

const adminOrderController =
    require("../controllers/adminOrderController");

const adminInventoryController =
    require("../controllers/adminInventoryController");

const adminCouponController =
    require("../controllers/adminCouponController");

const adminReportController =
    require("../controllers/adminReportController");

const adminDashboardController =
    require("../controllers/adminDashboardController");

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
    adminDashboardController.loadDashboard
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
    handleProductImageUpload(
        productUpload.array("images", 8)
    ),
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
    handleProductImageUpload(
        productUpload.array("images", 8)
    ),
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


router.post(
    "/products/toggle-block/:id",
    requireAdmin,
    adminController.toggleProductBlock
);




router.get(
    "/orders",
    requireAdmin,
    adminOrderController.loadOrders
);


router.get(
    "/orders/:orderId",
    requireAdmin,
    adminOrderController.loadOrderDetails
);


router.post(
    "/orders/:orderId/status",
    requireAdmin,
    adminOrderController.updateOrderStatus
);


router.post(
    "/orders/:orderId/items/:itemId/cancel",
    requireAdmin,
    adminOrderController.cancelOrderItem
);


// Phase 57: sales report + downloads (admin only).
router.get(
    "/sales-report",
    requireAdmin,
    adminReportController.loadSalesReport
);

router.get(
    "/sales-report/download/pdf",
    requireAdmin,
    adminReportController.downloadPdf
);

router.get(
    "/sales-report/download/excel",
    requireAdmin,
    adminReportController.downloadExcel
);


// Phase 56: answer a customer's return request.
router.post(
    "/orders/:orderId/return/approve",
    requireAdmin,
    adminOrderController.approveOrderReturn
);

router.post(
    "/orders/:orderId/return/reject",
    requireAdmin,
    adminOrderController.rejectOrderReturn
);



router.get(
    "/inventory",
    requireAdmin,
    adminInventoryController.loadInventory
);


router.post(
    "/inventory/:id/stock",
    requireAdmin,
    adminInventoryController.updateStock
);



// =====================================================
// COUPON MANAGEMENT (PHASE 55)
// =====================================================

router.get(
    "/coupons",
    requireAdmin,
    adminCouponController.loadCoupons
);

router.post(
    "/coupons",
    requireAdmin,
    adminCouponController.createCoupon
);

router.post(
    "/coupons/:id/toggle",
    requireAdmin,
    adminCouponController.toggleCoupon
);

router.post(
    "/coupons/:id/delete",
    requireAdmin,
    adminCouponController.deleteCoupon
);


module.exports = router;