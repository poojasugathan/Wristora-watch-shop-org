const Address = require("../models/addressModel");


// =====================================================
// LOAD ADDRESSES PAGE
// =====================================================

const loadAddresses = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const addresses = await Address.find({
            userId
        })
        .sort({
            isDefault: -1,
            createdAt: -1
        })
        .lean();


        const added =
            req.query.added === "1";

        const updated =
            req.query.updated === "1";

        const deleted =
            req.query.deleted === "1";

        const defaultUpdated =
            req.query.default === "1";


        let errorMessage = null;


        if (req.query.deleteError === "1") {

            errorMessage =
                "Unable to delete the address. Please try again.";

        }


        if (req.query.defaultError === "1") {

            errorMessage =
                "Unable to update the default address. Please try again.";

        }


        return res.render(
            "user/addresses",
            {
                title: "My Addresses",

                user: req.session.user,

                addresses,

                added,

                updated,

                deleted,

                defaultUpdated,

                errorMessage,

                successMessage: null
            }
        );


    } catch (error) {

        console.error(
            "Load addresses error:",
            error
        );


        return res.status(500).render(
            "user/addresses",
            {
                title: "My Addresses",

                user: req.session.user,

                addresses: [],

                added: false,

                updated: false,

                deleted: false,

                defaultUpdated: false,

                errorMessage:
                    "Unable to load your addresses. Please try again.",

                successMessage: null
            }
        );

    }

};


// =====================================================
// LOAD ADD ADDRESS PAGE
// =====================================================

const loadAddAddress = async (req, res) => {

    try {

        return res.render(
            "user/addAddress",
            {
                title: "Add New Address",

                user: req.session.user,

                formData: {

                    firstName: "",

                    lastName: "",

                    pinCode: "",

                    addressLine1: "",

                    addressLine2: "",

                    city: "",

                    state: "Kerala",

                    country: "India",

                    phone: "",

                    addressName: "",

                    isDefault: false

                },

                errorMessage: null,

                successMessage: null
            }
        );


    } catch (error) {

        console.error(
            "Load add address page error:",
            error
        );


        return res.status(500).send(
            "Unable to load add address page."
        );

    }

};


// =====================================================
// ADD NEW ADDRESS
// =====================================================

const addAddress = async (req, res) => {
console.log("========== ADD ADDRESS CONTROLLER HIT ==========");
    console.log("BODY:", req.body);
    

    try {

        const userId =
            req.session.user.id;


        // =================================================
        // GET FORM VALUES
        // =================================================

        let {

            firstName,

            lastName,

            pinCode,

            addressLine1,

            addressLine2,

            city,

            state,

            country,

            phone,

            addressName,

            isDefault

        } = req.body;


        // =================================================
        // TRIM VALUES
        // =================================================

        firstName =
            firstName
                ? firstName.trim()
                : "";


        lastName =
            lastName
                ? lastName.trim()
                : "";


        pinCode =
            pinCode
                ? pinCode.trim()
                : "";


        addressLine1 =
            addressLine1
                ? addressLine1.trim()
                : "";


        addressLine2 =
            addressLine2
                ? addressLine2.trim()
                : "";


        city =
            city
                ? city.trim()
                : "";


        state =
            state
                ? state.trim()
                : "Kerala";


        country =
            country
                ? country.trim()
                : "India";


        phone =
            phone
                ? phone.trim()
                : "";


        addressName =
            addressName
                ? addressName.trim()
                : "";


        // =================================================
        // FORM DATA
        // =================================================

        const formData = {

            firstName,

            lastName,

            pinCode,

            addressLine1,

            addressLine2,

            city,

            state,

            country,

            phone,

            addressName,

            isDefault:
                isDefault === "true" ||
                isDefault === "on"

        };


        // =================================================
        // REGEX
        // =================================================

        const nameRegex =
            /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;


        const pinCodeRegex =
            /^\d{6}$/;


        const phoneRegex =
            /^\+?[0-9\s-]{7,15}$/;


        // =================================================
        // FIRST NAME
        // =================================================

        if (!firstName) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "First name is required.",

                    successMessage: null
                }
            );

        }


        if (
            firstName.length < 2 ||
            firstName.length > 30
        ) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "First name must be between 2 and 30 characters.",

                    successMessage: null
                }
            );

        }


        if (!nameRegex.test(firstName)) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "First name contains invalid characters.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // LAST NAME
        // =================================================

        if (!lastName) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Last name is required.",

                    successMessage: null
                }
            );

        }


        if (
            lastName.length < 2 ||
            lastName.length > 30
        ) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Last name must be between 2 and 30 characters.",

                    successMessage: null
                }
            );

        }


        if (!nameRegex.test(lastName)) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Last name contains invalid characters.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // PIN CODE
        // =================================================

        if (!pinCode) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "PIN code is required.",

                    successMessage: null
                }
            );

        }


        if (!pinCodeRegex.test(pinCode)) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Please enter a valid 6-digit PIN code.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // ADDRESS LINE 1
        // =================================================

        if (!addressLine1) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Address Line 1 is required.",

                    successMessage: null
                }
            );

        }


        if (
            addressLine1.length < 5 ||
            addressLine1.length > 150
        ) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Address Line 1 must be between 5 and 150 characters.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // CITY
        // =================================================

        if (!city) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "City is required.",

                    successMessage: null
                }
            );

        }


        if (
            city.length < 2 ||
            city.length > 50
        ) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Please enter a valid city.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // STATE
        // =================================================

        if (!state) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "State is required.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // PHONE
        // =================================================

        if (!phone) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Phone number is required.",

                    successMessage: null
                }
            );

        }


        if (!phoneRegex.test(phone)) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Please enter a valid phone number.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // ADDRESS NAME
        // =================================================

        if (addressName.length > 30) {

            return res.status(400).render(
                "user/addAddress",
                {
                    title: "Add New Address",

                    user: req.session.user,

                    formData,

                    errorMessage:
                        "Address name cannot exceed 30 characters.",

                    successMessage: null
                }
            );

        }


        // =================================================
        // CHECK EXISTING ADDRESS
        // =================================================

        const existingAddress =
            await Address.findOne({
                userId
            });


        // =================================================
        // FIRST ADDRESS = DEFAULT
        // =================================================

        if (!existingAddress) {

            formData.isDefault = true;

        }


        // =================================================
        // REMOVE OLD DEFAULT
        // =================================================

        if (
            formData.isDefault &&
            existingAddress
        ) {

            await Address.updateMany(
                {
                    userId,

                    isDefault: true
                },
                {
                    $set: {
                        isDefault: false
                    }
                }
            );

        }


        // =================================================
        // CREATE ADDRESS
        // =================================================
        console.log("ABOUT TO CREATE ADDRESS");

        await Address.create({

            userId,

            firstName,

            lastName,

            pinCode,

            addressLine1,

            addressLine2,

            city,

            state,

            country,

            phone,

            addressName,

            isDefault:
                formData.isDefault

        });
        console.log("ADDRESS CREATED SUCCESSFULLY");


        // =================================================
        // SUCCESS
        // =================================================

        return res.redirect(
            "/addresses?added=1"
        );


    } catch (error) {

        console.error(
            "Add address error:",
            error
        );


        return res.status(500).render(
            "user/addAddress",
            {
                title: "Add New Address",

                user: req.session.user,

                formData: {

                    firstName:
                        req.body.firstName || "",

                    lastName:
                        req.body.lastName || "",

                    pinCode:
                        req.body.pinCode || "",

                    addressLine1:
                        req.body.addressLine1 || "",

                    addressLine2:
                        req.body.addressLine2 || "",

                    city:
                        req.body.city || "",

                    state:
                        req.body.state || "Kerala",

                    country:
                        req.body.country || "India",

                    phone:
                        req.body.phone || "",

                    addressName:
                        req.body.addressName || "",

                    isDefault:
                        req.body.isDefault === "true" ||
                        req.body.isDefault === "on"

                },

                errorMessage:
                    "Unable to save your address. Please try again.",

                successMessage: null
            }
        );

    }

};


// =====================================================
// DELETE ADDRESS
// =====================================================

const deleteAddress = async (req, res) => {

    try {

        const userId =
            req.session.user.id;

        const addressId =
            req.params.id;


        const address =
            await Address.findOne({
                _id: addressId,
                userId
            });


        if (!address) {

            return res.redirect(
                "/addresses"
            );

        }


        const wasDefault =
            address.isDefault;


        await Address.deleteOne({
            _id: addressId,
            userId
        });


        // =================================================
        // ASSIGN NEW DEFAULT
        // =================================================

        if (wasDefault) {

            const nextAddress =
                await Address.findOne({
                    userId
                })
                .sort({
                    createdAt: -1
                });


            if (nextAddress) {

                nextAddress.isDefault = true;

                await nextAddress.save();

            }

        }


        return res.redirect(
            "/addresses?deleted=1"
        );


    } catch (error) {

        console.error(
            "Delete address error:",
            error
        );


        return res.redirect(
            "/addresses?deleteError=1"
        );

    }

};


// =====================================================
// SET DEFAULT ADDRESS
// =====================================================

const setDefaultAddress = async (req, res) => {

    try {

        const userId =
            req.session.user.id;

        const addressId =
            req.params.id;


        // =================================================
        // CHECK OWNERSHIP
        // =================================================

        const address =
            await Address.findOne({
                _id: addressId,
                userId
            });


        if (!address) {

            return res.redirect(
                "/addresses"
            );

        }


        // =================================================
        // REMOVE OLD DEFAULT
        // =================================================

        await Address.updateMany(
            {
                userId,

                isDefault: true
            },
            {
                $set: {
                    isDefault: false
                }
            }
        );


        // =================================================
        // SET NEW DEFAULT
        // =================================================

        address.isDefault = true;

        await address.save();


        return res.redirect(
            "/addresses?default=1"
        );


    } catch (error) {

        console.error(
            "Set default address error:",
            error
        );


        return res.redirect(
            "/addresses?defaultError=1"
        );

    }

};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    loadAddresses,

    loadAddAddress,

    addAddress,

    deleteAddress,

    setDefaultAddress

};