// =====================================================
// COUPON CONSTANTS (PHASE 55)
// One place for every coupon rule, so the controller,
// the service and the views never disagree.
// =====================================================

const COUPON_DISCOUNT_TYPE = {
    PERCENT: "PERCENT",
    FIXED: "FIXED"
};

const COUPON_DISCOUNT_TYPE_LABEL = {
    PERCENT: "Percentage",
    FIXED: "Fixed amount"
};

// Letters + numbers only, 4 to 20 characters (we always store UPPERCASE).
const COUPON_CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

// A percentage coupon may not give more than this much off.
const COUPON_MAX_PERCENT = 90;

// Safety ceiling for money fields typed by the admin.
const COUPON_MAX_AMOUNT = 1000000;

const COUPON_DESCRIPTION_MAX_LENGTH = 200;

const ADMIN_COUPONS_PER_PAGE = 8;

module.exports = {
    COUPON_DISCOUNT_TYPE,
    COUPON_DISCOUNT_TYPE_LABEL,
    COUPON_CODE_PATTERN,
    COUPON_MAX_PERCENT,
    COUPON_MAX_AMOUNT,
    COUPON_DESCRIPTION_MAX_LENGTH,
    ADMIN_COUPONS_PER_PAGE
};
