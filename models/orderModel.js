const mongoose = require("mongoose");

const {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_STATUS,
    PAYMENT_METHOD,
    PAYMENT_STATUS
} = require("../config/orderConstants");



const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        productName: { type: String, required: true },
        brand: { type: String, default: "" },
        productImage: { type: String, default: "" },

        quantity: { type: Number, required: true, min: 1 },

        
        mrp: { type: Number, required: true, min: 0 },

        discountPercent: { type: Number, default: 0, min: 0 },

        unitPrice: { type: Number, required: true, min: 0 },

       
        discountAmount: { type: Number, default: 0, min: 0 },

        
        itemTotal: { type: Number, required: true, min: 0 },

        
        itemStatus: {
            type: String,
            enum: Object.values(ITEM_STATUS),
            default: ITEM_STATUS.ACTIVE
        },

        cancellationReason: { type: String, default: "", trim: true }
    }
);


const addressSnapshotSchema = new mongoose.Schema(
    {
        addressName: { type: String, default: "" },
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String, default: "" },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pinCode: { type: String, required: true },
        country: { type: String, required: true }
    },
    { _id: false }
);


const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        items: {
            type: [orderItemSchema],
            validate: {
                validator: (items) => items.length > 0,
                message: "An order must contain at least one item."
            }
        },

        subtotal: { type: Number, required: true, min: 0 },
        discountTotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        shipping: { type: Number, default: 0, min: 0 },
        finalTotal: { type: Number, required: true, min: 0 },

        addressSnapshot: {
            type: addressSnapshotSchema,
            required: true
        },

        paymentMethod: {
            type: String,
            enum: Object.values(PAYMENT_METHOD),
            default: PAYMENT_METHOD.COD
        },

        paymentStatus: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.PENDING
        },

        orderStatus: {
            type: String,
            enum: Object.values(ORDER_STATUS),
            default: ORDER_STATUS.PENDING,
            index: true
        },

       
        cancellationReason: { type: String, default: "", trim: true },

      
        returnStatus: {
            type: String,
            enum: Object.values(RETURN_STATUS),
            default: RETURN_STATUS.NONE
        },
        returnReason: { type: String, default: "", trim: true },
        returnRequestedAt: { type: Date, default: null }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);