
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        otpHash: {
            type: String,
            required: true
        },

        purpose: {
            type: String,
            enum: [
                "signup",
                "forgot-password",
                "email-change"
            ],
            required: true
        },

        expiresAt: {
            type: Date,
            required: true,
            index: true
        },

        attempts: {
            type: Number,
            default: 0
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);

// Automatically remove expired OTP documents
otpSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model("OTP", otpSchema);