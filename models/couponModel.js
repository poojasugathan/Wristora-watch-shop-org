const mongoose = require("mongoose");

const { COUPON_DISCOUNT_TYPE } = require("../config/couponConstants");

const couponSchema = new mongoose.Schema(
    {
        // Always stored in UPPERCASE, e.g. "WELCOME10".
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },

        description: { type: String, default: "", trim: true },

        discountType: {
            type: String,
            enum: Object.values(COUPON_DISCOUNT_TYPE),
            required: true
        },

        // PERCENT -> 10 means 10% off.   FIXED -> 500 means Rs. 500 off.
        discountValue: { type: Number, required: true, min: 0 },

        // The cart (after product/category offers) must be at least this much.
        minimumPurchase: { type: Number, default: 0, min: 0 },

        // Only for PERCENT coupons. 0 means "no cap".
        maximumDiscount: { type: Number, default: 0, min: 0 },

        startDate: { type: Date, required: true },
        expiryDate: { type: Date, required: true },

        // 0 means unlimited.
        usageLimit: { type: Number, default: 0, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },

        // How many times ONE user may use this coupon.
        perUserLimit: { type: Number, default: 1, min: 1 },

        // Who used it, and how many times.
        usedBy: {
            type: [
                {
                    user: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                        required: true
                    },
                    count: { type: Number, default: 0, min: 0 }
                }
            ],
            default: []
        },

        isActive: { type: Boolean, default: true },

        // Soft delete: the coupon disappears from the admin list,
        // but old orders that used it stay correct.
        isDeleted: { type: Boolean, default: false }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Coupon", couponSchema);
