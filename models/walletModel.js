const mongoose = require("mongoose");

// =====================================================
// WALLET (PHASE 56)
// One wallet per user. The balance is only ever changed
// by walletService.js, using atomic MongoDB updates.
// =====================================================

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        balance: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Wallet", walletSchema);
