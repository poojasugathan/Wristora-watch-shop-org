

const mongoose = require("mongoose");
const crypto = require("crypto");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const Address = require("../models/addressModel");
const Order = require("../models/orderModel");

const {
    AVAILABILITY_FILTER,
    MAX_QUANTITY_PER_PRODUCT
} = require("../controllers/cartController");

const {
    PAYMENT_METHOD,
    TAX_RATE_PERCENT,
    SHIPPING_CHARGE
} = require("../config/orderConstants");

class CheckoutError extends Error {
    constructor(message, type) {
        super(message);
        this.name = "CheckoutError";
        this.type = type;
    }
}

const round2 = (n) => Math.round(n * 100) / 100;


const ORDER_ID_PATTERN = /^WR-\d{8}-[A-Z2-9]{5}$/;
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateOrderId = () => {

    const now = new Date();

    const date =
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");

    let suffix = "";

    for (let i = 0; i < 5; i++) {
        suffix += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
    }

    return `WR-${date}-${suffix}`;
};


const evaluateCartItems = async (cartItems) => {

    const lines = [];
    const problems = [];

    if (!cartItems || cartItems.length === 0) {
        return { lines, problems };
    }

    const productIds = cartItems.map((item) => item.product);

    const products = await Product.find({
        _id: { $in: productIds }
    }).lean();

    const productMap = new Map(
        products.map((p) => [p._id.toString(), p])
    );

    for (const item of cartItems) {

        const product = productMap.get(item.product.toString());

        if (!product) {
            problems.push("A product in your cart no longer exists.");
            continue;
        }

        const name = product.productName;

        const isAvailable =
            product.isDeleted === false &&
            product.isListed === true &&
            product.isBlocked === false;

        if (!isAvailable) {
            problems.push(`${name} is no longer available.`);
            continue;
        }

        const quantity = item.quantity;

        if (!Number.isInteger(quantity) || quantity < 1) {
            problems.push(`Invalid quantity for ${name}.`);
            continue;
        }

        if (quantity > MAX_QUANTITY_PER_PRODUCT) {
            problems.push(
                `Maximum ${MAX_QUANTITY_PER_PRODUCT} per order for ${name}.`
            );
            continue;
        }

        if (product.stock <= 0) {
            problems.push(`${name} is out of stock.`);
            continue;
        }

        if (quantity > product.stock) {
            problems.push(`Only ${product.stock} of ${name} left in stock.`);
            continue;
        }

        const unitPrice = product.sellingPrice;
        const itemTotal = round2(unitPrice * quantity);
        const discountAmount = Math.max(
            0,
            round2(product.price * quantity - itemTotal)
        );

        lines.push({
            productId: product._id,
            productName: name,
            brand: product.brand || "",
            productImage:
                product.images && product.images.length > 0
                    ? product.images[0].url
                    : "",
            quantity,
            mrp: product.price,
            discountPercent: product.discount || 0,
            unitPrice,
            discountAmount,
            itemTotal
        });
    }

    return { lines, problems };
};


const calculatePricing = (lines) => {

    const subtotal = round2(
        lines.reduce((sum, l) => sum + l.itemTotal + l.discountAmount, 0)
    );

    const discountTotal = round2(
        lines.reduce((sum, l) => sum + l.discountAmount, 0)
    );

    const afterDiscount = round2(subtotal - discountTotal);

    const tax = round2((afterDiscount * TAX_RATE_PERCENT) / 100);

    const shipping = SHIPPING_CHARGE;

    const finalTotal = round2(afterDiscount + tax + shipping);

    return { subtotal, discountTotal, tax, shipping, finalTotal };
};


const createOrderWithUniqueId = async (data) => {

    for (let attempt = 0; attempt < 5; attempt++) {

        try {
            return await Order.create({
                ...data,
                orderId: generateOrderId()
            });
        } catch (error) {

            const isDuplicateOrderId =
                error &&
                error.code === 11000 &&
                error.keyPattern &&
                error.keyPattern.orderId;

            if (!isDuplicateOrderId) {
                throw error;
            }
        }
    }

    throw new Error("Could not generate a unique order ID.");
};


const placeOrder = async (userId, { addressId, paymentMethod }) => {

    if (paymentMethod !== PAYMENT_METHOD.COD) {
        throw new CheckoutError(
            "Please choose Cash on Delivery to continue.",
            "payment"
        );
    }

    if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
        throw new CheckoutError(
            "Please select a delivery address.",
            "address"
        );
    }

    const address = await Address.findOne({
        _id: addressId,
        userId
    }).lean();

    if (!address) {
        throw new CheckoutError(
            "The selected address was not found. Please choose another.",
            "address"
        );
    }

    const claimedCart = await Cart.findOneAndUpdate(
        { user: userId, "items.0": { $exists: true } },
        { $set: { items: [] } }
    ).lean();

    if (!claimedCart) {
        throw new CheckoutError("Your cart is empty.", "empty");
    }

    const claimedItems = claimedCart.items;
    const reducedLines = [];

    try {

        const { lines, problems } = await evaluateCartItems(claimedItems);

        if (problems.length > 0) {
            throw new CheckoutError(problems[0], "items");
        }

        for (const line of lines) {

            const result = await Product.updateOne(
                {
                    _id: line.productId,
                    ...AVAILABILITY_FILTER,
                    stock: { $gte: line.quantity }
                },
                { $inc: { stock: -line.quantity } }
            );

            if (result.modifiedCount !== 1) {
                throw new CheckoutError(
                    `${line.productName} just went out of stock. Please review your cart.`,
                    "items"
                );
            }

            reducedLines.push(line);
        }

        const pricing = calculatePricing(lines);

        const order = await createOrderWithUniqueId({
            user: userId,

            items: lines.map((l) => ({
                product: l.productId,
                productName: l.productName,
                brand: l.brand,
                productImage: l.productImage,
                quantity: l.quantity,
                mrp: l.mrp,
                discountPercent: l.discountPercent,
                unitPrice: l.unitPrice,
                discountAmount: l.discountAmount,
                itemTotal: l.itemTotal
            })),

            subtotal: pricing.subtotal,
            discountTotal: pricing.discountTotal,
            tax: pricing.tax,
            shipping: pricing.shipping,
            finalTotal: pricing.finalTotal,

            addressSnapshot: {
                addressName: address.addressName || "",
                firstName: address.firstName,
                lastName: address.lastName,
                phone: address.phone,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2 || "",
                city: address.city,
                state: address.state,
                pinCode: address.pinCode,
                country: address.country
            },

            paymentMethod: PAYMENT_METHOD.COD
        });

        return order;

    } catch (error) {

        
        for (const line of reducedLines) {
            try {
                await Product.updateOne(
                    { _id: line.productId },
                    { $inc: { stock: line.quantity } }
                );
            } catch (rollbackError) {
                console.error("Stock rollback failed:", rollbackError);
            }
        }

        try {
            await Cart.updateOne(
                { user: userId },
                { $set: { items: claimedItems } }
            );
        } catch (rollbackError) {
            console.error("Cart restore failed:", rollbackError);
        }

        throw error;
    }
};


module.exports = {
    CheckoutError,
    ORDER_ID_PATTERN,
    evaluateCartItems,
    calculatePricing,
    placeOrder
};