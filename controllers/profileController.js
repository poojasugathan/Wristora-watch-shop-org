const User = require("../models/userModel");

const cloudinary = require("../config/cloudinary");


// =====================================================
// LOAD PROFILE PAGE
// =====================================================

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


// =====================================================
// LOAD EDIT PROFILE PAGE
// =====================================================

const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const user = await User.findById(userId)
            .select("-password -googleId")
            .lean();

        if (!user) {
            return res.redirect("/auth/login");
        }

        res.render("user/editProfile", {
            title: "Account Settings",
            user,
            errorMessage: null,
            successMessage: null
        });

    } catch (error) {
        console.error("Edit profile loading error:", error);

        return res.status(500).render("user/editProfile", {
            title: "Account Settings",
            user: null,
            errorMessage: "Unable to load your profile. Please try again.",
            successMessage: null
        });
    }
};


// =====================================================
// UPDATE PERSONAL DETAILS
// =====================================================

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;

        let {
            firstName,
            lastName,
            phone
        } = req.body;

        firstName = firstName ? firstName.trim() : "";
        lastName = lastName ? lastName.trim() : "";
        phone = phone ? phone.trim() : "";

        const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
        const phoneRegex = /^\+?[0-9\s-]{7,15}$/;


        if (!firstName) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage: "First name is required.",
                successMessage: null
            });
        }

        if (firstName.length < 2 || firstName.length > 30) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage:
                    "First name must be between 2 and 30 characters.",
                successMessage: null
            });
        }

        if (!nameRegex.test(firstName)) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage:
                    "First name contains invalid characters.",
                successMessage: null
            });
        }


        if (!lastName) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage: "Last name is required.",
                successMessage: null
            });
        }

        if (lastName.length < 2 || lastName.length > 30) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage:
                    "Last name must be between 2 and 30 characters.",
                successMessage: null
            });
        }

        if (!nameRegex.test(lastName)) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage:
                    "Last name contains invalid characters.",
                successMessage: null
            });
        }


        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { firstName, lastName, phone },
                errorMessage:
                    "Please enter a valid phone number.",
                successMessage: null
            });
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
        console.error("Profile update error:", error);

        return res.status(500).render("user/editProfile", {
            title: "Account Settings",
            user: {
                firstName: req.body.firstName || "",
                lastName: req.body.lastName || "",
                phone: req.body.phone || ""
            },
            errorMessage:
                "Unable to update your profile. Please try again.",
            successMessage: null
        });
    }
};


// =====================================================
// UPDATE EMAIL
// =====================================================

const updateEmail = async (req, res) => {
    try {
        const userId = req.session.user.id;

        let email = req.body.email
            ? req.body.email.trim().toLowerCase()
            : "";


        if (!email) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { email },
                errorMessage: "Email is required.",
                successMessage: null
            });
        }


        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user: { email },
                errorMessage: "Please enter a valid email address.",
                successMessage: null
            });
        }


        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/auth/login");
        }


        const existingUser = await User.findOne({
            email,
            _id: { $ne: userId }
        });

        if (existingUser) {
            return res.status(400).render("user/editProfile", {
                title: "Account Settings",
                user,
                errorMessage: "This email is already registered.",
                successMessage: null
            });
        }


        user.email = email;

        await user.save();


        if (req.session.user) {
            req.session.user.email = user.email;
        }


        return res.redirect("/profile/edit?emailUpdated=1");

    } catch (error) {
        console.error("Email update error:", error);

        return res.status(500).render("user/editProfile", {
            title: "Account Settings",
            user: {
                email: req.body.email || ""
            },
            errorMessage:
                "Unable to update your email. Please try again.",
            successMessage: null
        });
    }
};


// =====================================================
// UPLOAD / CHANGE PROFILE IMAGE
// =====================================================

const uploadProfileImage = async (req, res) => {

    let newPublicId = null;

    try {

        const userId = req.session.user.id;


        // =================================================
        // CHECK FILE
        // =================================================

        if (!req.file) {

            return res.redirect("/profile/edit?imageError=1");

        }


        // =================================================
        // GET USER
        // =================================================

        const user = await User.findById(userId);

        if (!user) {

            // Clean up newly uploaded Cloudinary image
            if (req.file.public_id) {

                try {
                    await cloudinary.uploader.destroy(req.file.public_id);
                } catch (deleteError) {
                    console.error(
                        "Cloudinary cleanup error:",
                        deleteError
                    );
                }

            }

            return res.redirect("/auth/login");

        }


        // =================================================
        // NEW CLOUDINARY IMAGE
        // =================================================

        const newUrl = req.file.path;

        newPublicId = req.file.filename || req.file.public_id;


        if (!newUrl || !newPublicId) {

            return res.redirect("/profile/edit?imageError=1");

        }


        // =================================================
        // SAVE NEW IMAGE TO MONGODB
        // =================================================

        const oldPublicId = user.profileImage
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


            // Remove newly uploaded image because MongoDB update failed

            try {

                await cloudinary.uploader.destroy(newPublicId);

            } catch (cleanupError) {

                console.error(
                    "New Cloudinary image cleanup error:",
                    cleanupError
                );

            }

            return res.redirect("/profile/edit?imageError=1");

        }


        // =================================================
        // DELETE OLD IMAGE
        // =================================================

        if (
            oldPublicId &&
            oldPublicId !== newPublicId
        ) {

            try {

                await cloudinary.uploader.destroy(oldPublicId);

            } catch (deleteError) {

                console.error(
                    "Old Cloudinary image deletion error:",
                    deleteError
                );

            }

        }


        // =================================================
        // SUCCESS
        // =================================================

        return res.redirect("/profile/edit?imageUpdated=1");


    } catch (error) {

        console.error(
            "Profile image upload error:",
            error
        );


        // =================================================
        // CLEAN UP NEW CLOUDINARY IMAGE
        // =================================================

        if (newPublicId) {

            try {

                await cloudinary.uploader.destroy(newPublicId);

            } catch (cleanupError) {

                console.error(
                    "Cloudinary cleanup error:",
                    cleanupError
                );

            }

        }


        return res.redirect("/profile/edit?imageError=1");

    }

};


// =====================================================
// DELETE PROFILE IMAGE
// =====================================================

const deleteProfileImage = async (req, res) => {

    try {

        const userId = req.session.user.id;


        // =================================================
        // GET USER
        // =================================================

        const user = await User.findById(userId);

        if (!user) {

            return res.redirect("/auth/login");

        }


        // =================================================
        // GET PUBLIC ID
        // =================================================

        const publicId = user.profileImage
            ? user.profileImage.publicId
            : "";


        // =================================================
        // DELETE FROM CLOUDINARY
        // =================================================

        if (publicId) {

            try {

                await cloudinary.uploader.destroy(publicId);

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


        // =================================================
        // RESET MONGODB IMAGE DATA
        // =================================================

        user.profileImage = {
            url: "",
            publicId: ""
        };

        await user.save();


        // =================================================
        // SUCCESS
        // =================================================

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


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    loadProfile,
    loadEditProfile,
    updateProfile,
    updateEmail,
    uploadProfileImage,
    deleteProfileImage
};