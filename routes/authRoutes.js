const express = require("express");

const router = express.Router();

const {
    loadSignup,
    signup
} = require("../controllers/authController");

const {
    signupValidator
} = require("../validators/authValidator");

const validate = require("../middlewares/validationMiddleware");


// Signup page
router.get("/signup", loadSignup);

// Signup form
router.post(
    "/signup",
    signupValidator,
    validate,
    signup
);


module.exports = router;