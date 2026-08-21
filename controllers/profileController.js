const bcrypt = require("bcrypt");

const User = require("../models/userModel");

const cloudinary = require("../config/cloudinary");

const {
    createOtp,
    verifyOtp,
    deleteOtp,
    RESEND_COOLDOWN_SECONDS
} = require("../services/otpService");

const {
    sendOtpEmail
} = require("../services/emailService");

const loadProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const user = await User.findById(userId)
            .select("-password -googleId")
            .lean();

        if (!user) {
            return res.redirect("/auth/login");
        }

        const memberSince = user.createdAt
            ? new Date(user.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
              }).toUpperCase()
            : "";

        const profileUpdated = req.query.updated === "1";

        res.render("user/profile", {
            title: "My Profile",
            user,
            memberSince,
            profileUpdated,
            errorMessage: null
        });

    } catch (error) {
        console.error("Profile loading error:", error);

        return res.status(500).render("user/profile", {
            title: "My Profile",
            user: null,
            memberSince: "",
            profileUpdated: false,
            errorMessage: "Unable to load your profile. Please try again."
        });
    }
};




const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const user = await User.findById(userId)
            .select("-password -googleId")
            .lean();

        if (!user) {
            return res.redirect("/auth/login");
        }



        const imageUpdated =
            req.query.imageUpdated === "1";

        const imageDeleted =
            req.query.imageDeleted === "1";

        const imageError =
            req.query.imageError === "1";

        const imageDeleteError =
            req.query.imageDeleteError === "1";


        
        return res.render("user/editProfile", {

            title: "Edit Profile",

            user,

            errorMessage: null,

            successMessage: null,

            imageUpdated,

            imageDeleted,

            imageError,

            imageDeleteError

        });

    } catch (error) {

        console.error(
            "Edit profile loading error:",
            error
        );

        return res.status(500).render(
            "user/editProfile",
            {
                title: "Edit Profile",

                user: null,

                errorMessage:
                    "Unable to load your profile. Please try again.",

                successMessage: null,

                imageUpdated: false,

                imageDeleted: false,

                imageError: false,

                imageDeleteError: false
            }
        );
    }
};




const updateProfile = async (req, res) => {

    try {

        const userId = req.session.user.id;

        let {
            firstName,
            lastName,
            phone
        } = req.body;


        firstName = firstName
            ? firstName.trim()
            : "";

        lastName = lastName
            ? lastName.trim()
            : "";

        phone = phone
            ? phone.trim()
            : "";


        

        const nameRegex =
            /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

        const phoneRegex =
            /^\+?[0-9\s-]{7,15}$/;


       

        if (!firstName) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Edit Profile",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "First name is required.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        if (
            firstName.length < 2 ||
            firstName.length > 15
        ) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Edit Profile",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "First name must be between 2 and 15 characters.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        if (!nameRegex.test(firstName)) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Edit Profile",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "First name contains invalid characters.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        if (!lastName) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Edit Profile",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "Last name is required.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        if (
            lastName.length < 2 ||
            lastName.length > 30
        ) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "Last name must be between 2 and 30 characters.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        if (!nameRegex.test(lastName)) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "Last name contains invalid characters.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


       

        if (
            phone &&
            !phoneRegex.test(phone)
        ) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Edit Profile",

                    user: {
                        firstName,
                        lastName,
                        phone
                    },

                    errorMessage:
                        "Please enter a valid phone number.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/auth/login");
        }


        user.firstName = firstName;
        user.lastName = lastName;
        user.phone = phone;

        await user.save();


        
        return res.redirect("/profile?updated=1");


    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        return res.status(500).render(
            "user/editProfile",
            {
                title: "Edit Profile",

                user: {
                    firstName:
                        req.body.firstName || "",

                    lastName:
                        req.body.lastName || "",

                    phone:
                        req.body.phone || ""
                },

                errorMessage:
                    "Unable to update your profile. Please try again.",

                successMessage: null,

                imageUpdated: false,
                imageDeleted: false,
                imageError: false,
                imageDeleteError: false
            }
        );
    }
};



const updateEmail = async (req, res) => {

    try {

        const userId = req.session.user.id;


        
        let newEmail = req.body.email
            ? req.body.email.trim().toLowerCase()
            : "";



        if (!newEmail) {

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user: await User.findById(userId)
                        .select("-password -googleId")
                        .lean(),

                    errorMessage:
                        "Email is required.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        // =================================================
        // EMAIL FORMAT
        // =================================================

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (!emailRegex.test(newEmail)) {

            const user =
                await User.findById(userId)
                    .select("-password -googleId")
                    .lean();

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user,

                    errorMessage:
                        "Please enter a valid email address.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }

        const user =
            await User.findById(userId);


        if (!user) {

            return res.redirect("/auth/login");

        }

        if (
            user.email.toLowerCase() === newEmail
        ) {

            const profileUser =
                await User.findById(userId)
                    .select("-password -googleId")
                    .lean();

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user: profileUser,

                    errorMessage:
                        "This is already your current email address.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }


        const existingUser =
            await User.findOne({
                email: newEmail
            });


        if (existingUser) {

            const profileUser =
                await User.findById(userId)
                    .select("-password -googleId")
                    .lean();

            return res.status(400).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user: profileUser,

                    errorMessage:
                        "An account with this email already exists.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );
        }



        const otpResult =
            await createOtp(
                newEmail,
                "email-change"
            );


        if (!otpResult.success) {

            if (otpResult.cooldown) {

                const profileUser =
                    await User.findById(userId)
                        .select("-password -googleId")
                        .lean();

                return res.status(429).render(
                    "user/editProfile",
                    {
                        title: "Account Settings",

                        user: profileUser,

                        errorMessage:
                            `Please wait ${otpResult.remainingSeconds} seconds before requesting another OTP.`,

                        successMessage: null,

                        imageUpdated: false,
                        imageDeleted: false,
                        imageError: false,
                        imageDeleteError: false
                    }
                );

            }

        }


        try {

            await sendOtpEmail(
                newEmail,
                otpResult.otp
            );

        } catch (emailError) {

            console.error(
                "Email change OTP sending error:",
                emailError
            );


            // Delete OTP if email could not be sent
            await deleteOtp(
                newEmail,
                "email-change"
            );


            const profileUser =
                await User.findById(userId)
                    .select("-password -googleId")
                    .lean();


            return res.status(500).render(
                "user/editProfile",
                {
                    title: "Account Settings",

                    user: profileUser,

                    errorMessage:
                        "Unable to send the verification code. Please try again.",

                    successMessage: null,

                    imageUpdated: false,
                    imageDeleted: false,
                    imageError: false,
                    imageDeleteError: false
                }
            );

        }


        

        req.session.emailChange = { 

            newEmail,

            createdAt: Date.now()

        };



        req.session.save((sessionError) => {

            if (sessionError) {

                console.error(
                    "Email change session save error:",
                    sessionError
                );

                return res.status(500).render(
                    "user/editProfile",
                    {
                        title: "Account Settings",

                        user: user
                            .toObject(),

                        errorMessage:
                            "Unable to start email verification. Please try again.",

                        successMessage: null,

                        imageUpdated: false,
                        imageDeleted: false,
                        imageError: false,
                        imageDeleteError: false
                    }
                );
            }


           

            return res.redirect(
                "/profile/change-email/otp"
            );

        });

    } catch (error) {

        console.error(
            "Email change request error:",
            error
        );


        return res.status(500).render(
            "user/editProfile",
            {
                title: "Account Settings",

                user: null,

                errorMessage:
                    "Unable to start email change. Please try again.",

                successMessage: null,

                imageUpdated: false,
                imageDeleted: false,
                imageError: false,
                imageDeleteError: false
            }
        );

    }
};

const loadEmailChangeOtp = async (req, res) => {

    try {

       

        if (
            !req.session.emailChange ||
            !req.session.emailChange.newEmail
        ) {

            return res.redirect(
                "/profile/edit"
            );

        }


        const newEmail =
            req.session.emailChange.newEmail;


        

        return res.render(
            "user/emailChangeOtp",
            {
                title: "Verify New Email",
                email: newEmail
            }
        );

    } catch (error) {

        console.error(
            "Email change OTP page error:",
            error
        );

        return res.redirect(
            "/profile/edit"
        );

    }
};


const verifyEmailChangeOtp = async (req, res) => {

    try {

        
        if (
            !req.session ||
            !req.session.user ||
            !req.session.user.id
        ) {

            return res.status(401).json({
                success: false,
                reason: "session_expired",
                message:
                    "Your session has expired. Please login again."
            });

        }



        if (
            !req.session.emailChange ||
            !req.session.emailChange.newEmail
        ) {

            return res.status(400).json({
                success: false,
                reason: "session_expired",
                message:
                    "Your email change session has expired. Please try again."
            });

        }



        const otp =
            req.body.otp
                ? req.body.otp.trim()
                : "";



        if (!/^\d{6}$/.test(otp)) {

            return res.status(400).json({
                success: false,
                reason: "invalid",
                message:
                    "Please enter a valid 6-digit OTP."
            });

        }


        const newEmail =
            req.session.emailChange.newEmail;


        
        const otpResult =
            await verifyOtp(
                newEmail,
                otp,
                "email-change"
            );


        

        if (!otpResult.success) {

            return res.status(400).json({

                success: false,

                reason:
                    otpResult.reason,

                attemptsRemaining:
                    otpResult.attemptsRemaining || null,

                message:
                    otpResult.reason === "expired"
                        ? "Your OTP has expired. Please request a new OTP."
                        : otpResult.reason === "max_attempts"
                            ? "Maximum OTP attempts reached. Please request a new OTP."
                            : "Invalid OTP."

            });

        }


      
        const existingUser =
            await User.findOne({
                email: newEmail,
                _id: {
                    $ne: req.session.user.id
                }
            });


        if (existingUser) {

           
            delete req.session.emailChange;


            return res.status(400).json({
                success: false,
                reason: "duplicate",
                message:
                    "An account with this email already exists."
            });

        }


       

        const user =
            await User.findById(
                req.session.user.id
            );


        if (!user) {

            delete req.session.emailChange;


            return res.status(404).json({
                success: false,
                reason: "user_not_found",
                message:
                    "Your account could not be found. Please login again."
            });

        }



        user.email = newEmail;


        try {

            await user.save();

        } catch (databaseError) {

            console.error(
                "Email change database update error:",
                databaseError
            );


            return res.status(500).json({
                success: false,
                reason: "database_error",
                message:
                    "Unable to update your email. Please try again."
            });

        }



        req.session.user.email =
            user.email;


       
        delete req.session.emailChange;


       
        req.session.save((sessionError) => {

            if (sessionError) {

                console.error(
                    "Email change session save error:",
                    sessionError
                );

                return res.status(500).json({
                    success: false,
                    reason: "session_error",
                    message:
                        "Email was updated, but the session could not be saved. Please login again."
                });

            }


            

            return res.json({

                success: true,

                message:
                    "Email address updated successfully."

            });

        });

    } catch (error) {

        console.error(
            "Email change OTP verification error:",
            error
        );


        return res.status(500).json({
            success: false,
            reason: "server_error",
            message:
                "Unable to verify the OTP. Please try again."
        });

    }
};



const resendEmailChangeOtp = async (req, res) => {

    try {

       

        if (
            !req.session ||
            !req.session.user ||
            !req.session.user.id
        ) {

            return res.status(401).json({
                success: false,
                reason: "session_expired",
                message:
                    "Your session has expired. Please login again."
            });

        }



        if (
            !req.session.emailChange ||
            !req.session.emailChange.newEmail
        ) {

            return res.status(400).json({
                success: false,
                reason: "session_expired",
                message:
                    "Your email change session has expired. Please start again."
            });

        }


        const newEmail =
            req.session.emailChange.newEmail;


        

        const otpResult =
            await createOtp(
                newEmail,
                "email-change"
            );


       
        if (!otpResult.success) {

            if (otpResult.cooldown) {

                return res.status(429).json({

                    success: false,

                    reason: "cooldown",

                    remainingSeconds:
                        otpResult.remainingSeconds,

                    message:
                        `Please wait ${otpResult.remainingSeconds} seconds before requesting another OTP.`

                });

            }

        }


        try {

            await sendOtpEmail(
                newEmail,
                otpResult.otp
            );

        } catch (emailError) {

            console.error(
                "Email change resend error:",
                emailError
            );


            await deleteOtp(
                newEmail,
                "email-change"
            );


            return res.status(500).json({

                success: false,

                reason: "email_error",

                message:
                    "Unable to send OTP. Please try again later."

            });

        }


       

        return res.json({

            success: true,

            message:
                "A new OTP has been sent to your email.",

            remainingSeconds:
                RESEND_COOLDOWN_SECONDS

        });

    } catch (error) {

        console.error(
            "Email change resend OTP error:",
            error
        );


        return res.status(500).json({

            success: false,

            reason: "server_error",

            message:
                "Unable to resend OTP. Please try again later."

        });

    }
};


const uploadProfileImage = async (req, res) => {

    let newPublicId = null;

    try {

        const userId = req.session.user.id;


        if (!req.file) {

            return res.redirect(
                "/profile/edit?imageError=1"
            );

        }

        const user =
            await User.findById(userId);


        if (!user) {

           
            if (req.file.public_id) {

                try {

                    await cloudinary.uploader.destroy(
                        req.file.public_id
                    );

                } catch (deleteError) {

                    console.error(
                        "Cloudinary cleanup error:",
                        deleteError
                    );

                }

            }

            return res.redirect(
                "/auth/login"
            );

        }



        const newUrl = req.file.path;

        newPublicId =
            req.file.filename ||
            req.file.public_id;


        if (!newUrl || !newPublicId) {

            return res.redirect(
                "/profile/edit?imageError=1"
            );

        }


        const oldPublicId =
            user.profileImage
                ? user.profileImage.publicId
                : "";


       
        user.profileImage = {
            url: newUrl,
            publicId: newPublicId
        };


        try {

            await user.save();

        } catch (databaseError) {

            console.error(
                "Profile image database update error:",
                databaseError
            );


            
            try {

                await cloudinary.uploader.destroy(
                    newPublicId
                );

            } catch (cleanupError) {

                console.error(
                    "New Cloudinary image cleanup error:",
                    cleanupError
                );

            }

            return res.redirect(
                "/profile/edit?imageError=1"
            );
        }


        if (
            oldPublicId &&
            oldPublicId !== newPublicId
        ) {

            try {

                await cloudinary.uploader.destroy(
                    oldPublicId
                );

            } catch (deleteError) {

                console.error(
                    "Old Cloudinary image deletion error:",
                    deleteError
                );

            }
        }



        return res.redirect(
            "/profile/edit?imageUpdated=1"
        );


    } catch (error) {

        console.error(
            "Profile image upload error:",
            error
        );


        if (newPublicId) {

            try {

                await cloudinary.uploader.destroy(
                    newPublicId
                );

            } catch (cleanupError) {

                console.error(
                    "Cloudinary cleanup error:",
                    cleanupError
                );

            }

        }


        return res.redirect(
            "/profile/edit?imageError=1"
        );
    }
};



const deleteProfileImage = async (req, res) => {

    try {

        const userId = req.session.user.id;


        const user =
            await User.findById(userId);


        if (!user) {

            return res.redirect(
                "/auth/login"
            );

        }


        const publicId =
            user.profileImage
                ? user.profileImage.publicId
                : "";



        if (publicId) {

            try {

                await cloudinary.uploader.destroy(
                    publicId
                );

            } catch (cloudinaryError) {

                console.error(
                    "Cloudinary profile image deletion error:",
                    cloudinaryError
                );

                return res.redirect(
                    "/profile/edit?imageDeleteError=1"
                );
            }
        }



        user.profileImage = {
            url: "",
            publicId: ""
        };

        await user.save();



        return res.redirect(
            "/profile/edit?imageDeleted=1"
        );


    } catch (error) {

        console.error(
            "Profile image delete error:",
            error
        );

        return res.redirect(
            "/profile/edit?imageDeleteError=1"
        );
    }
};

const loadChangePassword = async (req, res) => {

    try {

        const userId = req.session.user.id;


        const user = await User.findById(userId)
            .select("-password -googleId")
            .lean();


        if (!user) {

            return res.redirect("/auth/login");

        }



        const passwordUpdated =
            req.query.updated === "1";


      

        return res.render(
            "user/changePassword",
            {
                title: "Change Password",

                user,

                successMessage:
                    passwordUpdated
                        ? "Password updated successfully."
                        : null,

                errorMessage: null
            }
        );

    } catch (error) {

        console.error(
            "Change password page loading error:",
            error
        );


        return res.status(500).render(
            "user/changePassword",
            {
                title: "Change Password",

                user: null,

                successMessage: null,

                errorMessage:
                    "Unable to load the change password page. Please try again."
            }
        );

    }
};




const changePassword = async (req, res) => {

    try {


        if (
            !req.session ||
            !req.session.user ||
            !req.session.user.id
        ) {

            return res.redirect("/auth/login");

        }


        const userId =
            req.session.user.id;


        
        const currentPassword =
            req.body.currentPassword
                ? req.body.currentPassword
                : "";

        const newPassword =
            req.body.newPassword
                ? req.body.newPassword
                : "";

        const confirmPassword =
            req.body.confirmPassword
                ? req.body.confirmPassword
                : "";


       
        const user =
            await User.findById(userId);


        if (!user) {

            return res.redirect("/auth/login");

        }


       

        if (!currentPassword) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "Please enter your current password."
                }
            );

        }



        if (!user.password) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "This account does not have a password. Please use the appropriate password setup option."
                }
            );

        }



        const passwordMatch =
            await bcrypt.compare(
                currentPassword,
                user.password
            );


        if (!passwordMatch) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "Current password is incorrect."
                }
            );

        }



        if (!newPassword) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "Please enter a new password."
                }
            );

        }

        const passwordRegex =
            /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;


        if (!passwordRegex.test(newPassword)) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "Password must contain at least 8 characters, including letters, numbers, and a special character."
                }
            );

        }


        if (!confirmPassword) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "Please confirm your new password."
                }
            );

        }


       

        if (newPassword !== confirmPassword) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "Passwords do not match."
                }
            );

        }



        const samePassword =
            await bcrypt.compare(
                newPassword,
                user.password
            );


        if (samePassword) {

            return res.status(400).render(
                "user/changePassword",
                {
                    title: "Change Password",

                    user: user,

                    successMessage: null,

                    errorMessage:
                        "New password must be different from your current password."
                }
            );

        }



        const hashedPassword =
            await bcrypt.hash(
                newPassword,
                10
            );


       
        user.password =
            hashedPassword;


        await user.save();


        return res.redirect(
            "/profile/change-password?updated=1"
        );

    } catch (error) {

        console.error(
            "Change password error:",
            error
        );


        return res.status(500).render(
            "user/changePassword",
            {
                title: "Change Password",

                user: null,

                successMessage: null,

                errorMessage:
                    "Unable to update your password. Please try again."
            }
        );

    }
};


module.exports = {

    loadProfile,

    loadEditProfile,

    updateProfile,

    updateEmail,

    loadEmailChangeOtp,

    verifyEmailChangeOtp,

    resendEmailChangeOtp,

    uploadProfileImage,

    deleteProfileImage,

    loadChangePassword,

    changePassword

};