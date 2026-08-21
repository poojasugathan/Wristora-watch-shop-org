const bcrypt = require("bcrypt");

const User = require("../models/userModel");

const OTP = require("../models/otpModel");

const {
    createOtp,
    verifyOtp,
    deleteOtp
} = require("../services/otpService");

const {
    sendOtpEmail
} = require("../services/emailService");



const loadSignup = (req, res) => {

    res.render("user/signup", {

        title: "Signup",

        errors: [],

        formData: {}

    });

};

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


        const normalizedEmail =
            email.toLowerCase().trim();


        const existingUser =
            await User.findOne({
                email: normalizedEmail
            });


        if (existingUser) {

            return res.status(400).render(
                "user/signup",
                {

                    title: "Signup",

                    errors: [
                        {
                            msg:
                                "An account with this email already exists"
                        }
                    ],

                    formData: req.body

                }
            );

        }

        const hashedPassword = await bcrypt.hash( password,10 );
              
        req.session.signupData = {

            firstName,

            lastName,

            email: normalizedEmail,

            phone,

            password: hashedPassword,

            referralCode:
                referralCode || ""

        };

        const otpResult = await createOtp( normalizedEmail, "signup" );
        
        if (!otpResult.success) {

            delete req.session.signupData;


            return res.status(429).render(
                "user/signup",
                {

                    title: "Signup",

                    errors: [
                        {
                            msg:
                                `Please wait ${otpResult.remainingSeconds} seconds before requesting another OTP.`
                        }
                    ],

                    formData: req.body

                }
            );

        }
        try {

            await sendOtpEmail(
                normalizedEmail,
                otpResult.otp
            );

        } catch (emailError) {

            console.error(
                "OTP email sending error:",
                emailError
            );


            delete req.session.signupData;


            await deleteOtp(
                normalizedEmail,
                "signup"
            );


            return res.status(500).render(
                "user/signup",
                {

                    title: "Signup",

                    errors: [
                        {
                            msg:
                                "Unable to send OTP. Please check your email and try again."
                        }
                    ],

                    formData: req.body

                }
            );

        }


        req.session.save((sessionError) => {

            if (sessionError) {

                console.error(
                    "Session save error:",
                    sessionError
                );


                return res.status(500).render(
                    "user/signup",
                    {

                        title: "Signup",

                        errors: [
                            {
                                msg:
                                    "Something went wrong. Please try again."
                            }
                        ],

                        formData: req.body

                    }
                );

            }


            return res.redirect("/auth/otp");

        });


    } catch (error) {

        console.error(
            "Signup error:",
            error
        );


        return res.status(500).render(
            "user/signup",
            {

                title: "Signup",

                errors: [
                    {
                        msg:
                            "Something went wrong. Please try again."
                    }
                ],

                formData: req.body

            }
        );

    }

};

const loadOtp = (req, res) => {

    if (
        !req.session.signupData ||
        !req.session.signupData.email
    ) {

        return res.redirect(
            "/auth/signup"
        );

    }


    res.render("user/otp", {

        title: "Verify OTP",

        email:
            req.session.signupData.email

    });

};

const verifyOtpController = async (req, res) => {

    try {

        if (
            !req.session.signupData ||
            !req.session.signupData.email
        ) {

            return res.status(401).json({

                success: false,

                reason: "session_expired",

                message:
                    "Your signup session has expired. Please sign up again."

            });

        }


        const { otp } = req.body;

        if (
            !otp ||
            !/^\d{6}$/.test(otp)
        ) {

            return res.status(400).json({

                success: false,

                reason: "invalid_format",

                message:
                    "Please enter the complete 6-digit OTP."

            });

        }


        const email =
            req.session.signupData.email;


        const result =
            await verifyOtp(
                email,
                otp,
                "signup"
            );

        if (!result.success) {

            if (
                result.reason === "expired"
            ) {

                return res.status(400).json({

                    success: false,

                    reason: "expired",

                    message:
                        "OTP has expired. Please request a new OTP."

                });

            }


            if (
                result.reason === "max_attempts"
            ) {

                return res.status(400).json({

                    success: false,

                    reason: "max_attempts",

                    message:
                        "Too many incorrect attempts. Please request a new OTP."

                });

            }


            return res.status(400).json({

                success: false,

                reason: "invalid",

                message:
                    "Invalid OTP.",

                attemptsRemaining:
                    result.attemptsRemaining

            });

        }

        const signupData =
            req.session.signupData;


        const existingUser =
            await User.findOne({
                email: signupData.email
            });


        if (existingUser) {

            delete req.session.signupData;


            return res.status(400).json({

                success: false,

                reason: "duplicate",

                message:
                    "An account with this email already exists."

            });

        }

        const user = new User({

            firstName:
                signupData.firstName,

            lastName:
                signupData.lastName,

            email:
                signupData.email,

            phone:
                signupData.phone,

            password:
                signupData.password,

            referralCode:
                signupData.referralCode || "",

            isVerified: true

        });


        await user.save();

delete req.session.signupData;

req.session.regenerate((sessionError) => {

    if (sessionError) {

        console.error(
            "Signup session regeneration error:",
            sessionError
        );

        return res.status(500).json({

            success: false,

            reason: "server_error",

            message:
                "Account created, but something went wrong while creating your session. Please login."

        });

    }

    req.session.user = {

        id:
            user._id.toString(),

        email:
            user.email,

        role:
            user.role

    };

    req.session.save((saveError) => {

        if (saveError) {

            console.error(
                "Signup session save error:",
                saveError
            );

            return res.status(500).json({

                success: false,

                reason: "server_error",

                message:
                    "Account created, but something went wrong while creating your session. Please login."

            });

        }

        return res.json({

            success: true,

            message:
                "Email verified successfully. Your account has been created."

        });

    });

});


    } catch (error) {

        console.error(
            "OTP verification error:",
            error
        );


        return res.status(500).json({

            success: false,

            reason: "server_error",

            message:
                "Something went wrong. Please try again."

        });

    }

};


const resendOtp = async (req, res) => {

    try {

        if (
            !req.session.signupData ||
            !req.session.signupData.email
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Signup session expired. Please sign up again."

            });

        }


        const email =
            req.session.signupData.email;

        const otpResult =
            await createOtp(
                email,
                "signup"
            );


        if (!otpResult.success) {

            return res.status(429).json({

                success: false,

                message:
                    `Please wait ${otpResult.remainingSeconds} seconds before requesting another OTP.`,

                remainingSeconds:
                    otpResult.remainingSeconds

            });

        }


        try {

            await sendOtpEmail(
                email,
                otpResult.otp
            );

        } catch (emailError) {

            console.error(
                "Resend OTP email error:",
                emailError
            );


            await deleteOtp(
                email,
                "signup"
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to send OTP. Please try again."

            });

        }


        return res.json({

            success: true,

            message:
                "New OTP sent successfully",

            remainingSeconds:
                30

        });


    } catch (error) {

        console.error(
            "Resend OTP error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to send OTP. Please try again."

        });

    }

};

const loadLogin = (req, res) => {

    let error = null;
    let success = null;

    if (req.query.error === "google") {

        error = "Google login failed. Please try again.";

    } else if (req.query.error === "blocked") {

        error = "Your account has been blocked. Please contact support.";

    } else if (req.query.error === "server") {

        error = "Something went wrong. Please try again.";

    }

    // Password reset success
    if (req.query.reset === "success") {

        success = "Password updated successfully. Please login with your new password.";

    }

    res.render("user/login", {

        title: "Login",

        error: error,

        success: success,

        formData: {
            email: ""
        }

    });

};


const login = async (req, res) => {

    try {

        const email = req.body.email
            ? req.body.email.trim().toLowerCase()
            : "";


        const password = req.body.password
            ? req.body.password
            : "";

        if (!email) {

            return res.status(400).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Please enter your email.",

                    formData: {
                        email
                    }

                }
            );

        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {

            return res.status(400).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Please enter a valid email address.",

                    formData: {
                        email
                    }

                }
            );

        }


        if (!password) {

            return res.status(400).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Please enter your password.",

                    formData: {
                        email
                    }

                }
            );

        }

        const user = await User.findOne({
            email: email
        });

        if (!user) {

            return res.status(401).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Invalid email or password.",

                    formData: {
                        email
                    }

                }
            );

        }

        if (user.isBlocked === true) {

            return res.status(403).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Your account has been blocked. Please contact support.",

                    formData: {
                        email
                    }

                }
            );

        }

        if (!user.password) {

            return res.status(401).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Invalid email or password.",

                    formData: {
                        email
                    }

                }
            );

        }


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res.status(401).render(
                "user/login",
                {

                    title: "Login",

                    error:
                        "Invalid email or password.",

                    formData: {
                        email
                    }

                }
            );

        }

        req.session.regenerate((sessionError) => {

            if (sessionError) {

                console.error(
                    "Session regeneration error:",
                    sessionError
                );


                return res.status(500).render(
                    "user/login",
                    {

                        title: "Login",

                        error:
                            "Something went wrong. Please try again.",

                        formData: {
                            email
                        }

                    }
                );

            }


            req.session.user = {

                id:
                    user._id.toString(),

                email:
                    user.email,

                role:
                    user.role

            };

            req.session.save((saveError) => {

                if (saveError) {

                    console.error(
                        "Session save error:",
                        saveError
                    );


                    return res.status(500).render(
                        "user/login",
                        {

                            title: "Login",

                            error:
                                "Something went wrong. Please try again.",

                            formData: {
                                email
                            }

                        }
                    );

                }

                return res.redirect("/");

            });

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res.status(500).render(
            "user/login",
            {

                title: "Login",

                error:
                    "Something went wrong. Please try again.",

                formData: {
                    email:
                        req.body.email || ""
                }

            }
        );

    }

};


const logout = (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return res.status(500).send(
                "Unable to logout. Please try again."
            );
        }

        // Clear session cookie
        res.clearCookie("connect.sid");

        // Redirect to login page
        return res.redirect("/auth/login");
    });
};


const googleCallback = (req, res) => {

    try {

       
        if (!req.user) {

            return res.redirect(
                "/auth/login?error=google"
            );

        }


        const user = req.user;


        if (user.isBlocked === true) {

            return res.redirect(
                "/auth/login?error=blocked"
            );

        }


        req.session.regenerate((sessionError) => {

            if (sessionError) {

                console.error(
                    "Google session regeneration error:",
                    sessionError
                );


                return res.redirect(
                    "/auth/login?error=server"
                );

            }


            req.session.user = {

                id:
                    user._id.toString(),

                email:
                    user.email,

                role:
                    user.role

            };


            req.session.save((saveError) => {

                if (saveError) {

                    console.error(
                        "Google session save error:",
                        saveError
                    );


                    return res.redirect(
                        "/auth/login?error=server"
                    );

                }


                return res.redirect("/");

            });

        });


    } catch (error) {

        console.error(
            "Google callback error:",
            error
        );


        return res.redirect(
            "/auth/login?error=server"
        );

    }

};


const loadForgotPassword = (req, res) => {

    res.render("user/forgotPassword", {
        title: "Forgot Password",
        error: null,
        formData: {
            email: ""
        }
    });

};

const forgotPassword = async (req, res) => {

    try {

        const email = req.body.email
            ? req.body.email.trim().toLowerCase()
            : "";



        if (!email) {

            return res.status(400).render(
                "user/forgotPassword",
                {
                    title: "Forgot Password",

                    error: "Please enter your email address.",

                    formData: {
                        email
                    }
                }
            );

        }


        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

            return res.status(400).render(
                "user/forgotPassword",
                {
                    title: "Forgot Password",

                    error: "Please enter a valid email address.",

                    formData: {
                        email
                    }
                }
            );

        }

        const user = await User.findOne({
            email
        });


        if (!user) {

            return res.status(400).render(
                "user/forgotPassword",
                {
                    title: "Forgot Password",

                    error: "No account found with this email address.",

                    formData: {
                        email
                    }
                }
            );

        }


        if (user.isBlocked === true) {

            return res.status(403).render(
                "user/forgotPassword",
                {
                    title: "Forgot Password",

                    error:
                        "Your account has been blocked. Please contact support.",

                    formData: {
                        email
                    }
                }
            );

        }


        req.session.forgotPasswordEmail = email;



        const otpResult = await createOtp(
            email,
            "forgot-password"
        );


        if (!otpResult.success) {

            delete req.session.forgotPasswordEmail;

            return res.status(429).render(
                "user/forgotPassword",
                {
                    title: "Forgot Password",

                    error:
                        `Please wait ${otpResult.remainingSeconds} seconds before requesting another OTP.`,

                    formData: {
                        email
                    }
                }
            );

        }


        try {

            await sendOtpEmail(
                email,
                otpResult.otp
            );

        } catch (emailError) {

            console.error(
                "Forgot password OTP email error:",
                emailError
            );


            delete req.session.forgotPasswordEmail;


            await deleteOtp(
                email,
                "forgot-password"
            );


            return res.status(500).render(
                "user/forgotPassword",
                {
                    title: "Forgot Password",

                    error:
                        "Unable to send OTP. Please try again.",

                    formData: {
                        email
                    }
                }
            );

        }

        req.session.save((sessionError) => {

            if (sessionError) {

                console.error(
                    "Forgot password session error:",
                    sessionError
                );

                return res.status(500).render(
                    "user/forgotPassword",
                    {
                        title: "Forgot Password",

                        error:
                            "Something went wrong. Please try again.",

                        formData: {
                            email
                        }
                    }
                );

            }


            return res.redirect(
                "/auth/forgot-password/otp"
            );

        });


    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );


        return res.status(500).render(
            "user/forgotPassword",
            {
                title: "Forgot Password",

                error:
                    "Something went wrong. Please try again.",

                formData: {
                    email: req.body.email || ""
                }
            }
        );

    }

};



const loadForgotPasswordOtp = (req, res) => {

    if (!req.session.forgotPasswordEmail) {

        return res.redirect(
            "/auth/forgot-password"
        );

    }


    const email =
        req.session.forgotPasswordEmail;


    // Mask email

    const [name, domain] =
        email.split("@");


    const maskedEmail =
        name.length > 2
            ? name.substring(0, 2) +
              "****@" +
              domain
            : "****@" + domain;


    res.render(
    "user/forgotPasswordOtp",
    {
        title: "Verify OTP",

        pageCss: "forgot-password-otp",

        email: maskedEmail
    }
);

};


const verifyForgotPasswordOtp = async (req, res) => {

    try {

        if (!req.session.forgotPasswordEmail) {

            return res.status(401).json({

                success: false,

                reason: "session_expired",

                message:
                    "Your session has expired. Please try again."

            });

        }


        const { otp } = req.body;



        if (!otp || !/^\d{6}$/.test(otp)) {

            return res.status(400).json({

                success: false,

                reason: "invalid_format",

                message:
                    "Please enter the complete 6-digit OTP."

            });

        }


        const email =
            req.session.forgotPasswordEmail;



        const result = await verifyOtp(
            email,
            otp,
            "forgot-password"
        );


        if (!result.success) {

            if (result.reason === "expired") {

                return res.status(400).json({

                    success: false,

                    reason: "expired",

                    message:
                        "OTP has expired. Please request a new OTP."

                });

            }


            if (result.reason === "max_attempts") {

                return res.status(400).json({

                    success: false,

                    reason: "max_attempts",

                    message:
                        "Too many incorrect attempts. Please request a new OTP."

                });

            }


            return res.status(400).json({

                success: false,

                reason: "invalid",

                message:
                    "Invalid OTP.",

                attemptsRemaining:
                    result.attemptsRemaining

            });

        }


        req.session.passwordResetVerified = true;


        await deleteOtp(
            email,
            "forgot-password"
        );


        req.session.save((sessionError) => {

            if (sessionError) {

                console.error(
                    "Password reset session error:",
                    sessionError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Something went wrong. Please try again."

                });

            }


            return res.json({

                success: true,

                message:
                    "OTP verified successfully."

            });

        });


    } catch (error) {

        console.error(
            "Forgot password OTP verification error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Something went wrong. Please try again."

        });

    }

};


const resendForgotPasswordOtp = async (req, res) => {

    try {

        if (!req.session.forgotPasswordEmail) {

            return res.status(401).json({

                success: false,

                message:
                    "Your session has expired. Please try again."

            });

        }


        const email =
            req.session.forgotPasswordEmail;


        const otpResult = await createOtp(
            email,
            "forgot-password"
        );


        if (!otpResult.success) {

            return res.status(429).json({

                success: false,

                message:
                    `Please wait ${otpResult.remainingSeconds} seconds before requesting another OTP.`,

                remainingSeconds:
                    otpResult.remainingSeconds

            });

        }


        try {

            await sendOtpEmail(
                email,
                otpResult.otp
            );

        } catch (emailError) {

            console.error(
                "Resend forgot password OTP error:",
                emailError
            );


            await deleteOtp(
                email,
                "forgot-password"
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to send OTP. Please try again."

            });

        }


        return res.json({

            success: true,

            message:
                "New OTP sent successfully.",

            remainingSeconds: 60

        });


    } catch (error) {

        console.error(
            "Resend forgot password OTP error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to send OTP. Please try again."

        });

    }

};


const loadResetPassword = (req, res) => {

    if (
        !req.session.forgotPasswordEmail ||
        !req.session.passwordResetVerified
    ) {

        return res.redirect(
            "/auth/forgot-password"
        );

    }


   res.render("user/resetPassword", {

    title: "Reset Password",

    pageCss: "reset-password",

    error: null

});

};



const resetPassword = async (req, res) => {

    try {

       

        if (
            !req.session.forgotPasswordEmail ||
            !req.session.passwordResetVerified
        ) {

            return res.redirect(
                "/auth/forgot-password"
            );

        }


        const {
            password,
            confirmPassword
        } = req.body;



        if (!password) {

            return res.status(400).render(
                "user/resetPassword",
                {
                    title: "Reset Password",

                    error:
                        "Please enter a new password."
                }
            );

        }


        if (password.length < 8) {

            return res.status(400).render(
                "user/resetPassword",
                {
                    title: "Reset Password",

                    error:
                        "Password must contain at least 8 characters."
                }
            );

        }


        if (
            !/[A-Za-z]/.test(password) ||
            !/\d/.test(password) ||
            !/[^A-Za-z0-9]/.test(password)
        ) {

            return res.status(400).render(
                "user/resetPassword",
                {
                    title: "Reset Password",

                    error:
                        "Password must contain alphabets, numbers, and special characters."
                }
            );

        }


        if (password !== confirmPassword) {

            return res.status(400).render(
                "user/resetPassword",
                {
                    title: "Reset Password",

                    error:
                        "Passwords do not match."
                }
            );

        }


        const email =
            req.session.forgotPasswordEmail;


        const user = await User.findOne({
            email
        });


        if (!user) {

            delete req.session.forgotPasswordEmail;

            delete req.session.passwordResetVerified;


            return res.redirect(
                "/auth/forgot-password"
            );

        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        user.password =
            hashedPassword;


        user.isVerified = true;


        await user.save();



        delete req.session.forgotPasswordEmail;

        delete req.session.passwordResetVerified;



        return res.redirect(
            "/auth/login?reset=success"
        );


    } catch (error) {

        console.error(
            "Reset password error:",
            error
        );


        return res.status(500).render(
            "user/resetPassword",
            {
                title: "Reset Password",

                error:
                    "Something went wrong. Please try again."
            }
        );

    }

};



module.exports = {

    loadSignup,
    signup,
    googleCallback,

    loadOtp,
    verifyOtpController,
    resendOtp,

    loadLogin,
    login,
    logout,

    loadForgotPassword,
    forgotPassword,

    loadForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resendForgotPasswordOtp,

    loadResetPassword,
    resetPassword

};