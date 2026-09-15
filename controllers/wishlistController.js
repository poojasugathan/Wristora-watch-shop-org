const mongoose = require("mongoose");

const Wishlist = require("../models/wishlistModel");
const Product = require("../models/productModel");

const { attemptAddToCart } = require("./cartController");

const AVAILABILITY_FILTER = {
    isDeleted: false,
    isListed: true,
    isBlocked: false
};


// =====================================================
// SHARED HELPER — BUILD WISHLIST SUMMARY (PHASE 45)
//
// Same reasoning as buildCartSummary in cartController:
// one place that reads the real, current Product data for
// every item, instead of trusting whatever was true when
// the item was added.
// =====================================================

const buildWishlistSummary = async (userId) => {

    const wishlist = await Wishlist.findOne({ user: userId }).lean();

    const rawItems = wishlist ? wishlist.items : [];

    if (rawItems.length === 0) {
        return { wishlistItems: [], wishlistCount: 0 };
    }

    const productIds = rawItems.map((item) => item.product);

    const products = await Product.find({
        _id: { $in: productIds }
    }).lean();

    const productMap = new Map(
        products.map((product) => [product._id.toString(), product])
    );

    const wishlistItems = rawItems.map((item) => {

        const productIdStr = item.product.toString();
        const product = productMap.get(productIdStr);

        if (!product) {

            return {
                itemId: item._id,
                productId: productIdStr,
                productName: null,
                isMissing: true,
                isAvailable: false,
                isOutOfStock: true
            };

        }

        const isAvailable =
            product.isDeleted === false &&
            product.isListed === true &&
            product.isBlocked === false;

        const isOutOfStock = product.stock <= 0;

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
            isMissing: false,
            isAvailable,
            isOutOfStock
        };

    });

    return {
        wishlistItems,
        wishlistCount: wishlistItems.length
    };

};


// =====================================================
// VIEW WISHLIST
// =====================================================

const loadWishlist = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const { wishlistItems } = await buildWishlistSummary(userId);

        return res.render("user/wishlist", {
            title: "My Wishlist",
            wishlistItems,
            error: null
        });

    } catch (error) {

        console.error("Load wishlist error:", error);

        return res.status(500).render("user/wishlist", {
            title: "My Wishlist",
            wishlistItems: [],
            error: "Unable to load your wishlist right now. Please try again."
        });

    }

};


// =====================================================
// ADD TO WISHLIST
// =====================================================

const addToWishlist = async (req, res) => {

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

        const product = await Product.findOne({
            _id: productId,
            ...AVAILABILITY_FILTER
        });

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "This product is no longer available."
            });

        }

        let wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {

            wishlist = new Wishlist({
                user: userId,
                items: []
            });

        }

        const alreadyExists = wishlist.items.some(
            (item) => item.product.toString() === productId
        );

        if (alreadyExists) {

            return res.status(200).json({
                success: true,
                message: "This product is already in your wishlist."
            });

        }

        wishlist.items.push({ product: productId });

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: "Added to your wishlist."
        });

    } catch (error) {

        console.error("Add to wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add this product to your wishlist. Please try again."
        });

    }

};


// =====================================================
// REMOVE FROM WISHLIST (form POST + redirect, matching
// the existing cart remove-button pattern)
// =====================================================

const removeFromWishlist = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.redirect("/wishlist");
        }

        const wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            return res.redirect("/wishlist");
        }

        wishlist.items = wishlist.items.filter(
            (item) => item.product.toString() !== productId
        );

        await wishlist.save();

        return res.redirect("/wishlist");

    } catch (error) {

        console.error("Remove from wishlist error:", error);
        return res.redirect("/wishlist");

    }

};


// =====================================================
// PHASE 45 CORE — ADD WISHLIST ITEM TO CART
//
// The whole point of this phase:
//   1. Confirm this wishlist item belongs to this user.
//   2. Try to add it to the cart using the EXACT SAME
//      validation as the normal /cart/add route
//      (attemptAddToCart, imported from cartController).
//   3. Only if that succeeds, remove it from the wishlist.
//   4. If it fails for any reason, the wishlist item is
//      left completely untouched.
// =====================================================

const addWishlistItemToCart = async (req, res) => {

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

        // Ownership check: this must be an item that is
        // actually sitting in THIS user's wishlist. Without
        // this, a manipulated request could try to move an
        // arbitrary productId into the cart under the guise
        // of "wishlist integration."
        const wishlist = await Wishlist.findOne({ user: userId });

        const itemInWishlist =
            wishlist &&
            wishlist.items.some(
                (item) => item.product.toString() === productId
            );

        if (!itemInWishlist) {

            return res.status(404).json({
                success: false,
                message: "This item is not in your wishlist."
            });

        }

        // Step 1: attempt the cart addition using the exact
        // same rules as everywhere else in the app.
        const cartResult = await attemptAddToCart(userId, productId);

        // Step 2: only remove from wishlist if that succeeded.
        if (!cartResult.success) {

            return res.status(cartResult.statusCode).json({
                success: false,
                message: cartResult.message
            });

        }

        wishlist.items = wishlist.items.filter(
            (item) => item.product.toString() !== productId
        );

        await wishlist.save();

        const wishlistCount = wishlist.items.length;

        return res.status(200).json({
            success: true,
            message: "Moved to your cart.",
            wishlistCount
        });

    } catch (error) {

        console.error("Add wishlist item to cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to move this item to your cart. Please try again."
        });

    }

};


// =====================================================
// WISHLIST ITEM COUNT (used by navbar badge)
// =====================================================

const getWishlistItemCount = async (userId) => {

    if (!userId) {
        return 0;
    }

    const wishlist = await Wishlist.findOne({ user: userId }).lean();

    if (!wishlist || !wishlist.items) {
        return 0;
    }

    return wishlist.items.length;

};

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    addWishlistItemToCart,
    getWishlistItemCount
};