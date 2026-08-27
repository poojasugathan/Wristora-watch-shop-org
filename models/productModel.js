const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        productName: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        highlights: {
            type: [String],
            default: []
        },

        specifications: {
            movementType: { type: String, default: "" },
            warranty: { type: String, default: "" },
            waterResistance: { type: String, default: "" },
            caseDiameter: { type: String, default: "" }
        },

        brand: {
            type: String,
            default: "",
            trim: true
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        discount: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        sellingPrice: {
            type: Number,
            required: true,
            min: 0
        },

        stock: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },

        images: {
            type: [
                {
                    url: { type: String, required: true },
                    publicId: { type: String, required: true }
                }
            ],
            validate: {
                validator: function (imgs) {
                    return imgs.length >= 3;
                },
                message: "A product must have at least 3 images."
            }
        },

        isListed: {
            type: Boolean,
            default: true
        },

        isBlocked: {
            type: Boolean,
            default: false
        },

        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);