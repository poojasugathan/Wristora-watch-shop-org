const { body } = require("express-validator");

const signupValidator = [
    body("firstName")
        .trim()
        .notEmpty()
        .withMessage("First name is required")
        .isAlpha()
        .withMessage("First name must contain only letters")
        .isLength({ min: 2, max: 15 })
        .withMessage("First name must be between 2 and 30 characters"),

    body("lastName")
        .trim()
        .notEmpty()
        .withMessage("Last name is required")
        .isAlpha()
        .withMessage("Last name must contain only letters")
        .isLength({ min: 1, max: 15 })
        .withMessage("Last name must be between 1 and 30 characters"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Enter a valid email address")
        .normalizeEmail(),

    body("phone")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Enter a valid 10-digit phone number"),

    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters")
        .matches(/[A-Z]/)
        .withMessage("Password must contain at least one uppercase letter")
        .matches(/[a-z]/)
        .withMessage("Password must contain at least one lowercase letter")
        .matches(/[0-9]/)
        .withMessage("Password must contain at least one number")
        .matches(/[!@#$%^&*]/)
        .withMessage("Password must contain at least one special character"),

    body("confirmPassword")
        .notEmpty()
        .withMessage("Please confirm your password")
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error("Passwords do not match");
            }

            return true;
        }),

    body("termsAccepted")
        .equals("true")
        .withMessage("You must accept the Terms of Use and Privacy Policy"),

    body("referralCode")
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 15 })
        .withMessage("Invalid referral code"),    
];

module.exports = {
    signupValidator
};