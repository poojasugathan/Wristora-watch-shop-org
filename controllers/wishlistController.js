const mongoose = require("mongoose");

const Wishlist = require("../models/wishlistModel");
const Product = require("../models/productModel");

const {
    attemptAddToCart,
    getCartItemCount,
    AVAILABILITY_FILTER
} = require("./cartController");


// -----------------------------------------------------
// Small helper: is this a valid MongoDB id string?
// -----------------------------------------------------
const isValidId = (id) =>
    Boolean(id) && mongoose.Types.ObjectId.isValid(id);


// -----------------------------------------------------
// PHASE 49 — used by productController so product cards
// and the details page know which hearts should be filled.
// Returns an array of product id strings ([] if logged out).
// -----------------------------------------------------
const getWishlistProductIds = async (userId) => {

    if (!userId) {
        return [];
    }

    const wishlist = await Wishlist.findOne({ user: userId }).lean();

    if (!wishlist || !wishlist.items) {
        return [];
    }

    return wishlist.items.map((item) => item.product.toString());

};


const buildWishlistSummary = async (userId) => {

    const wishlist = await Wishlist.findOne({ user: userId }).lean();

   const rawItems = wishlist ? [...wishlist.items].reverse() : [];

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


// -----------------------------------------------------
// PHASE 49 — core "add" logic, shared by /add and /toggle.
//
// Duplicate prevention is done INSIDE MongoDB in a single
// atomic update: the item is only pushed if the product
// is not already in the list. So two fast clicks (or two
// browser tabs) can never create a duplicate.
// -----------------------------------------------------
const attemptAddToWishlist = async (userId, productId) => {

    if (!isValidId(productId)) {

        return {
            success: false,
            statusCode: 400,
            message: "Invalid product."
        };

    }

    const product = await Product.findOne({
        _id: productId,
        ...AVAILABILITY_FILTER
    }).lean();

    if (!product) {

        return {
            success: false,
            statusCode: 404,
            message: "This product is no longer available."
        };

    }

    try {

        const result = await Wishlist.updateOne(
            {
                user: userId,
                "items.product": { $ne: productId }
            },
            {
                $push: { items: { product: productId } }
            },
            { upsert: true }
        );

        const wasAdded =
            result.modifiedCount > 0 || result.upsertedCount > 0;

        return {
            success: true,
            statusCode: 200,
            alreadyExisted: !wasAdded,
            message: wasAdded
                ? "Added to your wishlist."
                : "This product is already in your wishlist."
        };

    } catch (error) {

        // E11000 = "duplicate key". It happens when the filter
        // above did not match (product already in the list) and
        // MongoDB then tried to create a second wishlist document
        // for the same user. It simply means "already there".
        if (error && error.code === 11000) {

            return {
                success: true,
                statusCode: 200,
                alreadyExisted: true,
                message: "This product is already in your wishlist."
            };

        }

        throw error;

    }

};


const removeProductFromWishlist = async (userId, productId) => {

    await Wishlist.updateOne(
        { user: userId },
        { $pull: { items: { product: productId } } }
    );

};


const addToWishlist = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.body.productId;

        const result = await attemptAddToWishlist(userId, productId);

        if (!result.success) {

            return res.status(result.statusCode).json({
                success: false,
                message: result.message
            });

        }

        const wishlistCount = (await getWishlistProductIds(userId)).length;

        return res.status(200).json({
            success: true,
            inWishlist: true,
            message: result.message,
            wishlistCount
        });

    } catch (error) {

        console.error("Add to wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add this product to your wishlist. Please try again."
        });

    }

};


// -----------------------------------------------------
// PHASE 49 — heart button: add if missing, remove if present.
//
// Adding needs the product to be available (listed, not
// blocked, not deleted). Removing does NOT — a user must
// always be able to clear an unavailable product out.
// -----------------------------------------------------
const toggleWishlist = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.body.productId;

        if (!isValidId(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product."
            });

        }

        const currentIds = await getWishlistProductIds(userId);

        const isInWishlist = currentIds.includes(productId);

        if (isInWishlist) {

            await removeProductFromWishlist(userId, productId);

            const wishlistCount = (await getWishlistProductIds(userId)).length;

            return res.status(200).json({
                success: true,
                inWishlist: false,
                message: "Removed from your wishlist.",
                wishlistCount
            });

        }

        const result = await attemptAddToWishlist(userId, productId);

        if (!result.success) {

            return res.status(result.statusCode).json({
                success: false,
                message: result.message
            });

        }

        const wishlistCount = (await getWishlistProductIds(userId)).length;

        return res.status(200).json({
            success: true,
            inWishlist: true,
            message: result.message,
            wishlistCount
        });

    } catch (error) {

        console.error("Toggle wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update your wishlist. Please try again."
        });

    }

};


const removeFromWishlist = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.params.productId;

        if (!isValidId(productId)) {
            return res.redirect("/wishlist");
        }

        await removeProductFromWishlist(userId, productId);

        return res.redirect("/wishlist");

    } catch (error) {

        console.error("Remove from wishlist error:", error);
        return res.redirect("/wishlist");

    }

};


// -----------------------------------------------------
// Wishlist -> Cart
//
// Order of events (this order is the whole point):
//   1. Check the item really is in THIS user's wishlist.
//   2. Try to add it to the cart (full stock/availability
//      validation lives in cartController.attemptAddToCart).
//   3. ONLY if step 2 succeeded, remove it from the wishlist.
// If step 2 fails we return early and the wishlist is untouched.
// -----------------------------------------------------
const addWishlistItemToCart = async (req, res) => {

    try {

        const userId = req.session.user.id;
        const productId = req.body.productId;

        if (!isValidId(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product."
            });

        }

        const currentIds = await getWishlistProductIds(userId);

        if (!currentIds.includes(productId)) {

            return res.status(404).json({
                success: false,
                message: "This item is not in your wishlist."
            });

        }

        const cartResult = await attemptAddToCart(userId, productId);

        if (!cartResult.success) {

            return res.status(cartResult.statusCode).json({
                success: false,
                message: cartResult.message
            });

        }

        await removeProductFromWishlist(userId, productId);

        const wishlistCount = (await getWishlistProductIds(userId)).length;
        const cartCount = await getCartItemCount(userId);

        return res.status(200).json({
            success: true,
            message: "Moved to your cart.",
            wishlistCount,
            cartCount
        });

    } catch (error) {

        console.error("Add wishlist item to cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to move this item to your cart. Please try again."
        });

    }

};


const getWishlistItemCount = async (userId) => {

    const ids = await getWishlistProductIds(userId);

    return ids.length;

};

module.exports = {
    loadWishlist,
    addToWishlist,
    toggleWishlist,
    removeFromWishlist,
    addWishlistItemToCart,
    getWishlistItemCount,
    getWishlistProductIds
};