const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
    {
        // The user this cart belongs to.
        // unique: true guarantees at the database level that
        // a user can never end up with two cart documents —
        // this is what "one cart per user" actually means in
        // practice, not just something the controller has to
        // remember to check.
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        // Each entry links to a real Product document by
        // reference (not a copy of its name/price/image).
        // This way, if a product's price changes or it
        // becomes unavailable later, the cart always reflects
        // the current truth instead of stale, duplicated data.
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },

                quantity: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Cart", cartSchema);