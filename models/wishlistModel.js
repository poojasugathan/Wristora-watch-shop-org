const mongoose = require("mongoose");

// =====================================================
// WISHLIST MODEL (PHASE 45)
//
// Mirrors the Cart model's shape on purpose: one document
// per user (enforced by unique: true), items reference the
// real Product by ObjectId so price/availability/stock are
// always read live from Product — never duplicated here.
//
// No quantity field. A wishlist entry means "I want this
// product," not "I want N of this product."
// =====================================================

const wishlistSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);