const mongoose = require("mongoose");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");

const AVAILABILITY_FILTER = {
    isDeleted: false,
    isListed: true,
    isBlocked: false
};

// =====================================================
// PHASE 44 — MAXIMUM QUANTITY PER PRODUCT
//
// The project had no maximum defined anywhere before this
// phase. 5 is the agreed limit. The ACTUAL ceiling for any
// product is whichever is smaller: this constant, or the
// product's current stock. That smaller number is called
// the "effective max" everywhere below.
// =====================================================

const MAX_QUANTITY_PER_PRODUCT = 5;


// =====================================================
// SHARED HELPER — BUILD CART SUMMARY (PHASE 44)
//
// Every place that needs "what does this user's cart look
// like right now" (the cart page, increase, decrease, and
// now Phase 46 checkout) goes through this ONE function.
// That way there is only one definition of availability /
// stock / totals logic instead of several copies that
// could drift apart.
//
// It does NOT use populate(). Populate would silently turn
// a deleted product's reference into `null` and we would
// lose the original product id — and we need that id so we
// can still show "this product is no longer available"
// instead of just making the row disappear.
// =====================================================

const buildCartSummary = async (userId) => {

    const cart = await Cart.findOne({ user: userId }).lean();

    const rawItems = cart ? cart.items : [];

    if (rawItems.length === 0) {
        return {
            cartItems: [],
            cartTotal: 0,
            cartCount: 0
        };
    }

    const productIds = rawItems.map((item) => item.product);

    const products = await Product.find({
        _id: { $in: productIds }
    }).lean();

    const productMap = new Map(
        products.map((product) => [product._id.toString(), product])
    );

    const cartItems = rawItems.map((item) => {

        const productIdStr = item.product.toString();

        const product = productMap.get(productIdStr);

        if (!product) {

            return {
                itemId: item._id,
                productId: productIdStr,
                productName: null,
                isMissing: true,
                isAvailable: false,
                isOutOfStock: true,
                quantity: item.quantity,
                subtotal: 0,
                stock: 0,
                effectiveMax: 0,
                atMax: true,
                exceedsStock: false
            };

        }

        const isAvailable =
            product.isDeleted === false &&
            product.isListed === true &&
            product.isBlocked === false;

        const isOutOfStock = product.stock <= 0;

        const effectiveMax = Math.min(
            MAX_QUANTITY_PER_PRODUCT,
            product.stock
        );

        const subtotal = product.sellingPrice * item.quantity;

        return {
            itemId: item._id,
            productId: productIdStr,
            productName: product.productName,
            brand: product.brand,
            image:
                product.images && product.images.length > 0
                    ? product.images[0].url
                    : "",
            sellingPrice: product.sellingPrice,
            quantity: item.quantity,
            subtotal,
            stock: product.stock,
            effectiveMax,
            isMissing: false,
            isAvailable,
            isOutOfStock,
            exceedsStock: item.quantity > product.stock,
            atMax: item.quantity >= effectiveMax
        };

    });

    const cartTotal = cartItems.reduce((sum, item) => {

        if (item.isMissing || !item.isAvailable) {
            return sum;
        }

        return sum + item.subtotal;

    }, 0);

    const cartCount = rawItems.reduce(
        (total, item) => total + item.quantity,
        0
    );

    return { cartItems, cartTotal, cartCount };

};


// =====================================================
// PHASE 45 — REUSABLE "ADD TO CART" LOGIC
// (unchanged)
// =====================================================

const attemptAddToCart = async (userId, productId) => {

    if (
        !productId ||
        !mongoose.Types.ObjectId.isValid(productId)
    ) {

        return {
            success: false,
            statusCode: 400,
            message: "Invalid product."
        };

    }

    const product = await Product.findOne({
        _id: productId,
        ...AVAILABILITY_FILTER
    });

    if (!product) {

        return {
            success: false,
            statusCode: 404,
            message: "This product is no longer available."
        };

    }

    if (product.stock <= 0) {

        return {
            success: false,
            statusCode: 400,
            message: "This product is out of stock."
        };

    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {

        cart = new Cart({
            user: userId,
            items: []
        });

    }

    const existingItem = cart.items.find(
        (item) => item.product.toString() === productId
    );

    if (existingItem) {

        const effectiveMax = Math.min(
            MAX_QUANTITY_PER_PRODUCT,
            product.stock
        );

        if (existingItem.quantity + 1 > effectiveMax) {

            const message =
                product.stock < MAX_QUANTITY_PER_PRODUCT
                    ? `Only ${product.stock} item(s) available.`
                    : `Maximum quantity per product is ${MAX_QUANTITY_PER_PRODUCT}.`;

            return {
                success: false,
                statusCode: 400,
                message
            };

        }

        existingItem.quantity += 1;

    } else {

        cart.items.push({
            product: productId,
            quantity: 1
        });

    }

    await cart.save();

    return {
        success: true,
        statusCode: 200,
        message: "Product added to cart successfully."
    };

};


// =====================================================
// PHASE 46 — MAP A "WHY CHECKOUT WAS BLOCKED" QUERY FLAG
// TO A FRIENDLY MESSAGE FOR THE CART PAGE.
//
// checkoutController redirects back here with
// ?checkoutError=empty / invalid / server. This turns that
// into text a user can actually read. It never exposes any
// internal detail — just a plain sentence.
// =====================================================

const CHECKOUT_ERROR_MESSAGES = {
    empty: "Your cart is empty. Add a product before checking out.",
    invalid:
        "Some items in your cart need attention before you can check out. Please review the items below.",
    server:
        "We couldn't start checkout right now. Please try again."
};


// =====================================================
// VIEW CART (PHASE 43, rebuilt on the Phase 44 helper,
// now also surfaces Phase 46 checkout-block messages)
// =====================================================

const loadCart = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const { cartItems, cartTotal } = await buildCartSummary(userId);

        const checkoutFlag = req.query.checkoutError;

        const checkoutMessage =
            checkoutFlag && CHECKOUT_ERROR_MESSAGES[checkoutFlag]
                ? CHECKOUT_ERROR_MESSAGES[checkoutFlag]
                : null;

        return res.render(
            "user/cart",
            {
                title: "Your Cart",
                cartItems,
                cartTotal,
                maxQuantity: MAX_QUANTITY_PER_PRODUCT,
                error: null,
                checkoutMessage
            }
        );

    } catch (error) {

        console.error("Load cart error:", error);

        return res.status(500).render(
            "user/cart",
            {
                title: "Your Cart",
                cartItems: [],
                cartTotal: 0,
                maxQuantity: MAX_QUANTITY_PER_PRODUCT,
                error: "Unable to load your cart right now. Please try again.",
                checkoutMessage: null
            }
        );

    }

};


// =====================================================
// ADD TO CART (PHASE 43, tightened for PHASE 44,
// now just a thin wrapper around attemptAddToCart — PHASE 45)
// =====================================================

const addToCart = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.body.productId;

        const result = await attemptAddToCart(userId, productId);

        return res.status(result.statusCode).json({
            success: result.success,
            message: result.message
        });

    } catch (error) {

        console.error("Add to cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add this product to your cart. Please try again."
        });

    }

};


// =====================================================
// INCREASE QUANTITY (PHASE 44 — unchanged)
// =====================================================

const increaseQuantity = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.body.productId;

        if (
            !productId ||
            !mongoose.Types.ObjectId.isValid(productId)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid product."
            });

        }

        const cart = await Cart.findOne({ user: userId });

        if (!cart) {

            return res.status(404).json({
                success: false,
                message: "Cart not found."
            });

        }

        const item = cart.items.find(
            (i) => i.product.toString() === productId
        );

        if (!item) {

            return res.status(404).json({
                success: false,
                message: "This item is not in your cart."
            });

        }

        const product = await Product.findOne({
            _id: productId,
            ...AVAILABILITY_FILTER
        });

        if (!product) {

            return res.status(400).json({
                success: false,
                message: "This product is no longer available."
            });

        }

        if (product.stock <= 0) {

            return res.status(400).json({
                success: false,
                message: "This product is out of stock."
            });

        }

        const effectiveMax = Math.min(
            MAX_QUANTITY_PER_PRODUCT,
            product.stock
        );

        const requestedQuantity = item.quantity + 1;

        if (requestedQuantity > effectiveMax) {

            const message =
                product.stock < MAX_QUANTITY_PER_PRODUCT
                    ? `Only ${product.stock} item(s) available.`
                    : `Maximum quantity per product is ${MAX_QUANTITY_PER_PRODUCT}.`;

            return res.status(400).json({
                success: false,
                message,
                quantity: item.quantity,
                stock: product.stock,
                effectiveMax
            });

        }

        item.quantity = requestedQuantity;

        await cart.save();

        const summary = await buildCartSummary(userId);

        const updatedItem = summary.cartItems.find(
            (i) => i.productId === productId
        );

        return res.status(200).json({
            success: true,
            quantity: updatedItem.quantity,
            subtotal: updatedItem.subtotal,
            cartTotal: summary.cartTotal,
            cartCount: summary.cartCount,
            atMax: updatedItem.atMax,
            stock: updatedItem.stock
        });

    } catch (error) {

        console.error("Increase quantity error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update quantity. Please try again."
        });

    }

};


// =====================================================
// DECREASE QUANTITY (PHASE 44 — unchanged)
// =====================================================

const decreaseQuantity = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.body.productId;

        if (
            !productId ||
            !mongoose.Types.ObjectId.isValid(productId)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid product."
            });

        }

        const cart = await Cart.findOne({ user: userId });

        if (!cart) {

            return res.status(404).json({
                success: false,
                message: "Cart not found."
            });

        }

        const item = cart.items.find(
            (i) => i.product.toString() === productId
        );

        if (!item) {

            return res.status(404).json({
                success: false,
                message: "This item is not in your cart."
            });

        }

        if (item.quantity <= 1) {

            return res.status(400).json({
                success: false,
                message: "Minimum quantity is 1. Use remove to delete this item.",
                quantity: item.quantity
            });

        }

        item.quantity -= 1;

        await cart.save();

        const summary = await buildCartSummary(userId);

        const updatedItem = summary.cartItems.find(
            (i) => i.productId === productId
        );

        return res.status(200).json({
            success: true,
            quantity: updatedItem.quantity,
            subtotal: updatedItem.subtotal,
            cartTotal: summary.cartTotal,
            cartCount: summary.cartCount,
            atMax: updatedItem.atMax,
            stock: updatedItem.stock
        });

    } catch (error) {

        console.error("Decrease quantity error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update quantity. Please try again."
        });

    }

};


// =====================================================
// REMOVE FROM CART (PHASE 43 — unchanged)
// =====================================================

const removeFromCart = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.redirect("/cart");
        }

        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.redirect("/cart");
        }

        cart.items = cart.items.filter(
            (item) => item.product.toString() !== productId
        );

        await cart.save();

        return res.redirect("/cart");

    } catch (error) {

        console.error("Remove from cart error:", error);
        return res.redirect("/cart");

    }

};


// =====================================================
// CART ITEM COUNT (PHASE 43 — unchanged, used by navbar)
// =====================================================

const getCartItemCount = async (userId) => {

    if (!userId) {
        return 0;
    }

    const cart = await Cart.findOne({ user: userId }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
        return 0;
    }

    return cart.items.reduce(
        (total, item) => total + item.quantity,
        0
    );

};

module.exports = {
    loadCart,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    getCartItemCount,
    attemptAddToCart,     // PHASE 45 — exported for wishlistController
    buildCartSummary,     // PHASE 46 — exported for checkoutController
    AVAILABILITY_FILTER,  // PHASE 46 — exported in case checkoutController needs it directly
    MAX_QUANTITY_PER_PRODUCT
};