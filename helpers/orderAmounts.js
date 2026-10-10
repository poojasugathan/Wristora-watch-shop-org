// =====================================================
// ORDER AMOUNTS (moved here in PHASE 56)
//
// calculateActiveAmounts used to live inside
// orderManagementService.js. The refund code needs the very same
// calculation, and putting it in its own small file avoids two
// services requiring each other in a circle.
// orderManagementService.js still exports it, so nothing else changes.
// =====================================================

const { ITEM_STATUS } = require("../config/orderConstants");

const round2 = (n) => Math.round(n * 100) / 100;

const sum = (list, pick) =>
    list.reduce((total, entry) => total + pick(entry), 0);

const isActive = (item) => item.itemStatus !== ITEM_STATUS.CANCELLED;

// What the order is worth NOW: cancelled items are left out.
const calculateActiveAmounts = (order) => {

    const allItems = order.items || [];
    const activeItems = allItems.filter(isActive);

    const allTotal = sum(allItems, (i) => i.itemTotal);
    const activeTotal = sum(activeItems, (i) => i.itemTotal);

    const subtotal = round2(
        sum(activeItems, (i) => i.itemTotal + i.discountAmount)
    );

    const discountTotal = round2(
        sum(activeItems, (i) => i.discountAmount)
    );


    const ratio = allTotal > 0 ? activeTotal / allTotal : 0;
    const tax = round2((order.tax || 0) * ratio);

    const shipping = activeItems.length > 0 ? (order.shipping || 0) : 0;

    // Phase 55: the coupon discount is shared between the items in
    // proportion to their value, so cancelling an item also removes
    // that item's share of the coupon.
    const couponDiscount = round2((order.couponDiscount || 0) * ratio);

    const finalTotal = round2(activeTotal - couponDiscount + tax + shipping);

    const cancelledCount = allItems.length - activeItems.length;

    return {
        subtotal,
        discountTotal,
        couponDiscount,
        couponCode: order.couponCode || "",
        tax,
        shipping,
        finalTotal,
        cancelledCount
    };
};

module.exports = { round2, isActive, calculateActiveAmounts };
