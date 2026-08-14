const mongoose = require("mongoose");


// =====================================================
// ADDRESS SCHEMA
// =====================================================

const addressSchema = new mongoose.Schema(
    {

        // =================================================
        // USER
        // =================================================

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },


        // =================================================
        // NAME
        // =================================================

        firstName: {
            type: String,
            required: true,
            trim: true
        },

        lastName: {
            type: String,
            required: true,
            trim: true
        },


        // =================================================
        // ADDRESS
        // =================================================

        pinCode: {
            type: String,
            required: true,
            trim: true
        },

        addressLine1: {
            type: String,
            required: true,
            trim: true
        },

        addressLine2: {
            type: String,
            default: "",
            trim: true
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        state: {
            type: String,
            required: true,
            trim: true
        },

        country: {
            type: String,
            required: true,
            trim: true,
            default: "India"
        },


        // =================================================
        // CONTACT
        // =================================================

        phone: {
            type: String,
            required: true,
            trim: true
        },


        // =================================================
        // ADDRESS LABEL
        // Example: Home / Work
        // =================================================

        addressName: {
            type: String,
            default: "",
            trim: true
        },


        // =================================================
        // DEFAULT ADDRESS
        // =================================================

        isDefault: {
            type: Boolean,
            default: false
        }

    },

    {
        timestamps: true
    }
);


module.exports = mongoose.model(
    "Address",
    addressSchema
);