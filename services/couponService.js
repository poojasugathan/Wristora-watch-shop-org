// =====================================================
// COUPON SERVICE (PHASE 55)
//
// All coupon rules live here, on the server:
//   validateCoupon  -> is this coupon usable right now, and how much
//                      does it take off?  (read only)
//   redeemCoupon    -> really "spend" one use of the coupon (atomic)
//   releaseCoupon   -> give that use back if the order failed
//
// The browser only ever sends a coupon CODE. The discount amount
// is always calculated here from the database.
// =====================================================

const mongoose = require("mongoose");

const Coupon = require("../models/couponModel");

const {
    COUPON_DISCOUNT_TYPE,
    COUPON_CODE_PATTERN
} = require("../config/couponConstants");

class CouponError extends Error {
    constructor(message) {
        super(message);
        this.name = "CouponError";
    }
}

const round2 = (n) => Math.round(n * 100) / 100;

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// The amount a coupon is measured against: the cart total AFTER
// product/category offers and BEFORE tax and shipping.
const getCouponBase = (lines) =>
    round2(lines.reduce((sum, line) => sum + line.itemTotal, 0));

const normalizeCode = (raw) => {

    if (typeof raw !== "string") {
        throw new CouponError("Please enter a coupon code.");
    }

    const code = raw.trim().toUpperCase();

    if (code === "") {
        throw new CouponError("Please enter a coupon code.");
    }

    if (!COUPON_CODE_PATTERN.test(code)) {
        throw new CouponError("This coupon code is not valid.");
    }

    return code;
};

// How much does this coupon take off a given amount?
const calculateDiscount = (coupon, base) => {

    let discount = 0;

    if (coupon.discountType === COUPON_DISCOUNT_TYPE.PERCENT) {

        discount = round2((base * coupon.discountValue) / 100);

        if (coupon.maximumDiscount > 0) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }

    } else {
        discount = coupon.discountValue;
    }

    // A coupon can never take off more than the cart is worth.
    return round2(Math.max(0, Math.min(discount, base)));
};

const formatRupees = (n) =>
    "\u20B9" + Number(n).toLocaleString("en-IN");

// Checks every rule. Returns { coupon, discount } or throws CouponError.
const validateCoupon = async (rawCode, userId, base) => {

    const code = normalizeCode(rawCode);

    const coupon = await Coupon.findOne({ code, isDeleted: false }).lean();

    if (!coupon) {
        throw new CouponError("This coupon code is not valid.");
    }

    if (!coupon.isActive) {
        throw new CouponError("This coupon is not active.");
    }

    const now = new Date();

    if (now < new Date(coupon.startDate)) {
        throw new CouponError("This coupon is not valid yet.");
    }

    if (now > new Date(coupon.expiryDate)) {
        throw new CouponError("This coupon has expired.");
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        throw new CouponError("This coupon has reached its usage limit.");
    }

    const mine = (coupon.usedBy || []).find(
        (entry) => String(entry.user) === String(userId)
    );

    if (mine && mine.count >= coupon.perUserLimit) {
        throw new CouponError("You have already used this coupon.");
    }

    if (base < coupon.minimumPurchase) {
        throw new CouponError(
            `This coupon needs a minimum purchase of ${formatRupees(coupon.minimumPurchase)}.`
        );
    }

    const discount = calculateDiscount(coupon, base);

    if (discount <= 0) {
        throw new CouponError("This coupon cannot be applied to your cart.");
    }

    return { coupon, discount };
};

// Used by the order services: "no code" simply means "no coupon".
const resolveCouponForLines = async (rawCode, userId, lines) => {

    if (!rawCode) {
        return null;
    }

    return validateCoupon(rawCode, userId, getCouponBase(lines));
};


// ---------------------------------------------------------
// SPENDING ONE USE OF A COUPON
// These updates are "conditional": MongoDB only changes the
// coupon if the rules STILL hold at that exact moment. So two
// people (or one double click) can never use the last copy twice.
// ---------------------------------------------------------

const undoUserUse = (couponId, userId) =>
    Coupon.updateOne(
        {
            _id: couponId,
            usedBy: { $elemMatch: { user: toObjectId(userId), count: { $gt: 0 } } }
        },
        { $inc: { "usedBy.$.count": -1 } }
    );

const redeemCoupon = async (coupon, userId) => {

    const now = new Date();
    const user = toObjectId(userId);

    const stillUsable = {
        _id: coupon._id,
        isActive: true,
        isDeleted: false,
        startDate: { $lte: now },
        expiryDate: { $gte: now }
    };

    // Step 1: this user's own limit.
    const bump = await Coupon.updateOne(
        {
            ...stillUsable,
            usedBy: {
                $elemMatch: { user, count: { $lt: coupon.perUserLimit } }
            }
        },
        { $inc: { "usedBy.$.count": 1 } }
    );

    if (bump.modifiedCount !== 1) {

        const firstUse = await Coupon.updateOne(
            { ...stillUsable, "usedBy.user": { $ne: user } },
            { $push: { usedBy: { user, count: 1 } } }
        );

        if (firstUse.modifiedCount !== 1) {
            throw new CouponError("You have already used this coupon.");
        }
    }

    // Step 2: the overall limit.
    const overall = { ...stillUsable };

    if (coupon.usageLimit > 0) {
        overall.usedCount = { $lt: coupon.usageLimit };
    }

    const total = await Coupon.updateOne(overall, { $inc: { usedCount: 1 } });

    if (total.modifiedCount !== 1) {

        await undoUserUse(coupon._id, userId);

        throw new CouponError("This coupon has reached its usage limit.");
    }
};

// Gives one use back (the order could not be created).
const releaseCoupon = async (coupon, userId) => {

    try {

        await undoUserUse(coupon._id, userId);

        await Coupon.updateOne(
            { _id: coupon._id, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } }
        );

    } catch (error) {
        console.error("Coupon release failed:", error);
    }
};

module.exports = {
    CouponError,
    getCouponBase,
    calculateDiscount,
    validateCoupon,
    resolveCouponForLines,
    redeemCoupon,
    releaseCoupon
};
