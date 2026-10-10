const mongoose = require("mongoose");

const {
    WALLET_TX_TYPE,
    WALLET_TX_REASON,
    WALLET_TX_STATUS
} = require("../config/walletConstants");

// =====================================================
// WALLET TRANSACTION (PHASE 56)
// One row for every movement of money in or out of a wallet.
//
// referenceKey is the "duplicate guard". It is UNIQUE, so the
// database itself refuses a second row with the same key.
// Example: "REFUND:CANCEL:WR-20261009-ABCDE:0" can exist only once,
// which means that refund can never be credited twice.
// =====================================================

const walletTransactionSchema = new mongoose.Schema(
    {
        // The number the user sees, e.g. #8374034805
        transactionId: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: Object.values(WALLET_TX_TYPE),
            required: true
        },

        amount: { type: Number, required: true, min: 0.01 },

        reason: {
            type: String,
            enum: Object.values(WALLET_TX_REASON),
            required: true
        },

        description: { type: String, default: "", trim: true },

        // The related order (empty for a top-up).
        orderId: { type: String, default: "" },

        referenceKey: { type: String, unique: true, sparse: true },

        status: {
            type: String,
            enum: Object.values(WALLET_TX_STATUS),
            default: WALLET_TX_STATUS.COMPLETED
        },

        // Wallet balance right after this transaction.
        balanceAfter: { type: Number, default: null },

        // Wallet top-ups only.
        razorpayOrderId: { type: String, default: "" },
        razorpayPaymentId: { type: String, default: "" }
    },
    {
        timestamps: true
    }
);

walletTransactionSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
