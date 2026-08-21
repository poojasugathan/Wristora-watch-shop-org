const crypto = require("crypto");
const bcrypt = require("bcrypt");

const OTP = require("../models/otpModel");

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;



const generateOtp = () => {

    return crypto
        .randomInt(100000, 1000000)
        .toString();

};



const createOtp = async (email, purpose) => {

    email = email.toLowerCase();

    
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


        
        await OTP.deleteMany({
            email,
            purpose
        });

    }


    
    const otp = generateOtp();
    console.log("otp:",otp)


   
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



const verifyOtp = async (email, enteredOtp, purpose) => {

    email = email.toLowerCase();


    
    const otpRecord = await OTP.findOne({
        email,
        purpose
    }).sort({
        createdAt: -1
    });


    
    if (!otpRecord) {

        return {
            success: false,
            reason: "expired"
        };

    }


    
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


    
    const isMatch = await bcrypt.compare(
        enteredOtp,
        otpRecord.otpHash
    );


    
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


   
    await OTP.deleteOne({
        _id: otpRecord._id
    });


    return {
        success: true
    };

};




const deleteOtp = async (email, purpose) => {

    await OTP.deleteMany({
        email: email.toLowerCase(),
        purpose
    });

};



module.exports = {

    generateOtp,

    createOtp,

    verifyOtp,

    deleteOtp,

    OTP_EXPIRY_MINUTES,

    RESEND_COOLDOWN_SECONDS,

    MAX_ATTEMPTS

};