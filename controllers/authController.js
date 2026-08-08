const bcrypt = require("bcrypt");

const User = require("../models/userModel");


// =====================================================
// LOAD SIGNUP PAGE
// =====================================================

const loadSignup = (req, res) => {
    res.render("user/signup", {
        title: "Signup",
        errors: [],
        formData: {}
    });
};


// =====================================================
// SIGNUP
// =====================================================

const signup = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            password,
            referralCode
        } = req.body;

        // Check duplicate email
        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(400).render("user/signup", {
                title: "Signup",
                errors: [
                    {
                        msg: "An account with this email already exists"
                    }
                ],
                formData: req.body
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            referralCode: referralCode || "",
            isVerified: true
        });

        await user.save();

        return res.redirect("/auth/login");

    } catch (error) {
        console.error("Signup error:", error);

        return res.status(500).render("user/signup", {
            title: "Signup",
            errors: [
                {
                    msg: "Something went wrong. Please try again."
                }
            ],
            formData: req.body
        });
    }
};


module.exports = {
    loadSignup,
    signup
};