const mongoose = require("mongoose");

const Cart = require("../models/cartModel");
const Product = require("../models/productModel");

const AVAILABILITY_FILTER = {
    isDeleted: false,
    isListed: true,
    isBlocked: false
};


// =====================================================
// VIEW CART (PHASE 43)
// =====================================================

const loadCart = async (req, res) => {

    try {

        const userId = req.session.user.id;

        // populate() replaces the stored product ObjectId with
        // the actual current Product document, so we always see
        // live price/stock/availability — never stale data.
        const cart = await Cart.findOne({ user: userId })
            .populate("items.product")
            .lean();

        // A user who has never added anything simply has no
        // Cart document yet — that's not an error, just an
        // empty cart.
        const rawItems = cart ? cart.items : [];

        // Only keep items whose product still exists AND is
        // still available under the Phase 42 rules. A product
        // that was deleted/blocked/unlisted after being added
        // is silently excluded here rather than crashing or
        // showing broken data — see explanation above.
                const availableItems = rawItems.filter((item) => {

            const product = item.product;

            if (!product) {
                // Product was hard-deleted or the reference is
                // otherwise broken — treat as unavailable.
                return false;
            }

            return (
                product.isDeleted === false &&
                product.isListed === true &&
                product.isBlocked === false
            );

        });

        // Build display-ready rows with a calculated subtotal
        // per item. This is done here, in the backend, using
        // the real sellingPrice — never trusting a price that
        // might come from the browser.
        const cartItems = availableItems.map((item) => {

            const subtotal =
                item.product.sellingPrice * item.quantity;

            return {
                productId: item.product._id,
                productName: item.product.productName,
                brand: item.product.brand,
                image:
                    item.product.images && item.product.images.length > 0
                        ? item.product.images[0].url
                        : "",
                sellingPrice: item.product.sellingPrice,
                quantity: item.quantity,
                subtotal
            };

        });

        const cartTotal = cartItems.reduce(
            (sum, item) => sum + item.subtotal,
            0
        );

        return res.render(
            "user/cart",
            {

                title: "Your Cart",

                cartItems,

                cartTotal,

                error: null

            }
        );

    } catch (error) {

        console.error(
            "Load cart error:",
            error
        );

        return res.status(500).render(
            "user/cart",
            {

                title: "Your Cart",

                cartItems: [],

                cartTotal: 0,

                error:
                    "Unable to load your cart right now. Please try again."

            }
        );

    }

};


// =====================================================
// ADD TO CART (PHASE 43)
// Called via fetch() from productDetails.js, so this
// responds with JSON, not a page render.
// =====================================================

const addToCart = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const productId = req.body.productId;


        // ---------------------------------------------
        // VALIDATE ID FORMAT — same guard as Phase 42's
        // product details route. Never let a malformed id
        // reach a Mongoose query.
        // ---------------------------------------------

        if (
            !productId ||
            !mongoose.Types.ObjectId.isValid(productId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid product."

            });

        }


        // ---------------------------------------------
        // RE-VALIDATE AVAILABILITY — never trust that the
        // button was enabled. Fetch the product fresh, right
        // now, from the database.
        // ---------------------------------------------

        const product = await Product.findOne({
            _id: productId,
            ...AVAILABILITY_FILTER
        });

        if (!product) {

            return res.status(404).json({

                success: false,

                message:
                    "This product is no longer available."

            });

        }


        // ---------------------------------------------
        // OUT OF STOCK — Phase 43 only needs to block the
        // initial add. Full quantity-vs-stock validation is
        // Phase 44.
        // ---------------------------------------------

        if (product.stock <= 0) {

            return res.status(400).json({

                success: false,

                message:
                    "This product is out of stock."

            });

        }


        // ---------------------------------------------
        // FIND OR CREATE THE USER'S CART
        // ---------------------------------------------

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {

            cart = new Cart({
                user: userId,
                items: []
            });

        }


        // ---------------------------------------------
        // ALREADY IN CART? → increment quantity.
        // NEW? → add a new item at quantity 1.
        // (No stock-vs-quantity ceiling yet — Phase 44.)
        // ---------------------------------------------

        const existingItem = cart.items.find(
            (item) => item.product.toString() === productId
        );

        if (existingItem) {

            existingItem.quantity += 1;

        } else {

            cart.items.push({
                product: productId,
                quantity: 1
            });

        }


        await cart.save();


        return res.status(200).json({

            success: true,

            message:
                "Product added to cart successfully."

        });


    } catch (error) {

        console.error(
            "Add to cart error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to add this product to your cart. Please try again."

        });

    }

};


// =====================================================
// REMOVE FROM CART (PHASE 43)
// A normal form POST from the cart page — redirects
// back, consistent with how admin actions work.
// =====================================================

const removeFromCart = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const productId = req.params.productId;


        if (!mongoose.Types.ObjectId.isValid(productId)) {

            return res.redirect("/cart");

        }


        // Scoping the query to { user: userId } is what
        // guarantees a user can only ever modify their own
        // cart — there is no way to target someone else's
        // cart document through this query, regardless of
        // what productId is sent.
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

        console.error(
            "Remove from cart error:",
            error
        );

        return res.redirect("/cart");

    }

};



// =====================================================
// CART ITEM COUNT (PHASE 43)
// Used by the navbar badge — always computed fresh from
// the database, never cached, so it can't go stale.
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

    removeFromCart,

    getCartItemCount

};