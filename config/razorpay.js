// =====================================================
// RAZORPAY CONFIGURATION (PHASE 54)
//
// Reads the keys from .env and creates the Razorpay client
// only when it is first needed.
//
// RAZORPAY_KEY_ID      -> public, safe to send to the browser
// RAZORPAY_KEY_SECRET  -> private, must NEVER leave the server
// =====================================================

const Razorpay = require("razorpay");
const crypto = require("crypto");

let client = null;

const isConfigured = () =>
    Boolean(
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET
    );

const getRazorpayClient = () => {

    if (!isConfigured()) {
        throw new Error("Razorpay keys are not set in .env");
    }

    if (!client) {
        client = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    return client;
};

// Only the PUBLIC key id is ever given to the browser.
const getPublicKeyId = () => process.env.RAZORPAY_KEY_ID;

// Phase 56 (wallet top-up): checks that a payment really came from Razorpay.
// Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with our secret
// key. Only someone who knows the secret can produce a matching signature.
const verifySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret || typeof razorpaySignature !== "string") {
        return false;
    }

    const expected = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(razorpaySignature.toLowerCase());

    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
    isConfigured,
    getRazorpayClient,
    getPublicKeyId,
    verifySignature
};
