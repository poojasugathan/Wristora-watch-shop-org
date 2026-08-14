const crypto = require("crypto");
const bcrypt = require("bcrypt");

const OTP = require("../models/otpModel");

// =====================================================
// OTP SETTINGS
// =====================================================

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;


// =====================================================
// GENERATE 6 DIGIT OTP
// =====================================================

const generateOtp = () => {

    return crypto
        .randomInt(100000, 1000000)
        .toString();

};


// =====================================================
// CREATE AND STORE OTP
// =====================================================

const createOtp = async (email, purpose) => {

    email = email.toLowerCase();

    // Check whether a recently generated OTP exists
    const existingOtp = await OTP.findOne({
        email,
        purpose
    }).sort({ createdAt: -1 });


    if (existingOtp) {

        const secondsSinceCreation =
            (Date.now() - existingOtp.createdAt.getTime()) / 1000;


        if (
            secondsSinceCreation <
            RESEND_COOLDOWN_SECONDS
        ) {

            const remainingSeconds =
                Math.ceil(
                    RESEND_COOLDOWN_SECONDS -
                    secondsSinceCreation
                );


            return {
                success: false,
                cooldown: true,
                remainingSeconds
            };

        }


        // Remove old OTP before creating a new one
        await OTP.deleteMany({
            email,
            purpose
        });

    }


    // Generate new OTP
    const otp = generateOtp();
    console.log("otp:",otp)


    // Hash OTP before storing
    const otpHash = await bcrypt.hash(
        otp,
        10
    );


    const expiresAt = new Date(
        Date.now() +
        OTP_EXPIRY_MINUTES * 60 * 1000
    );


    await OTP.create({

        email,

        otpHash,

        purpose,

        expiresAt,

        attempts: 0

    });


    return {

        success: true,

        otp,

        expiresAt

    };

};


// =====================================================
// VERIFY OTP
// =====================================================

const verifyOtp = async (email, enteredOtp, purpose) => {

    email = email.toLowerCase();


    // Find latest OTP
    const otpRecord = await OTP.findOne({
        email,
        purpose
    }).sort({
        createdAt: -1
    });


    // No OTP found
    if (!otpRecord) {

        return {
            success: false,
            reason: "expired"
        };

    }


    // Check expiry
    if (
        new Date() >
        otpRecord.expiresAt
    ) {

        await OTP.deleteOne({
            _id: otpRecord._id
        });


        return {
            success: false,
            reason: "expired"
        };

    }


    // Check maximum attempts
    if (
        otpRecord.attempts >= MAX_ATTEMPTS
    ) {

        await OTP.deleteOne({
            _id: otpRecord._id
        });


        return {
            success: false,
            reason: "max_attempts"
        };

    }


    // Compare entered OTP with stored hash
    const isMatch = await bcrypt.compare(
        enteredOtp,
        otpRecord.otpHash
    );


    // Invalid OTP
    if (!isMatch) {

        otpRecord.attempts += 1;

        await otpRecord.save();


        const attemptsRemaining =
            MAX_ATTEMPTS -
            otpRecord.attempts;


        if (attemptsRemaining <= 0) {

            await OTP.deleteOne({
                _id: otpRecord._id
            });


            return {
                success: false,
                reason: "max_attempts"
            };

        }


        return {

            success: false,

            reason: "invalid",

            attemptsRemaining

        };

    }


    // OTP is valid
    await OTP.deleteOne({
        _id: otpRecord._id
    });


    return {
        success: true
    };

};


// =====================================================
// DELETE OTP
// =====================================================

const deleteOtp = async (email, purpose) => {

    await OTP.deleteMany({
        email: email.toLowerCase(),
        purpose
    });

};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    generateOtp,

    createOtp,

    verifyOtp,

    deleteOtp,

    OTP_EXPIRY_MINUTES,

    RESEND_COOLDOWN_SECONDS,

    MAX_ATTEMPTS

};