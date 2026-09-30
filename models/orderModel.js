const mongoose = require("mongoose");

const {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_STATUS,
    PAYMENT_METHOD,
    PAYMENT_STATUS
} = require("../config/orderConstants");


// One product line inside an order. Everything a customer
// paid for is COPIED here at purchase time, so later price
// changes / product edits never change an old order.
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

        // price per unit BEFORE discount (product.price)
        mrp: { type: Number, required: true, min: 0 },

        // discount percent that applied at purchase time
        discountPercent: { type: Number, default: 0, min: 0 },

        // price per unit the customer actually pays
        // (product.sellingPrice at purchase time)
        unitPrice: { type: Number, required: true, min: 0 },

        // total discount on this line = (mrp * qty) - itemTotal
        discountAmount: { type: Number, default: 0, min: 0 },

        // unitPrice * quantity
        itemTotal: { type: Number, required: true, min: 0 },

        // used by item-level cancellation (Phase 51)
        itemStatus: {
            type: String,
            enum: Object.values(ITEM_STATUS),
            default: ITEM_STATUS.ACTIVE
        },

        cancellationReason: { type: String, default: "", trim: true }
    }
);


// Copy of the delivery address taken at order time, so
// editing/deleting the saved address later cannot change
// where an old order was delivered.
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
        // Human-readable unique ID, e.g. WR-20260929-K7M2Q
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

        // subtotal - discountTotal + tax + shipping = finalTotal
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

        // Phase 51: set when the WHOLE order gets cancelled
        // (single-item reasons live on each item).
        cancellationReason: { type: String, default: "", trim: true },

        // Phase 51: return request (only for Delivered orders)
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