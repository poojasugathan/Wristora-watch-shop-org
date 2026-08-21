const mongoose = require("mongoose");



const addressSchema = new mongoose.Schema(
    {

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },



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


        phone: {
            type: String,
            required: true,
            trim: true
        },



        addressName: {
            type: String,
            default: "",
            trim: true
        },


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