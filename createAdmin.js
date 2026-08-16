const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const User = require("./models/userModel");

const createAdmin = async () => {

    try {

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");


        // =============================================
        // ADMIN DETAILS
        // =============================================

        const email = "admin@wristora.com";
        const password = "Admin@123";


        // =============================================
        // CHECK IF ADMIN ALREADY EXISTS
        // =============================================

        const existingAdmin = await User.findOne({
            email
        });


        if (existingAdmin) {

            console.log(
                "An account with this email already exists."
            );

            await mongoose.connection.close();

            return;

        }


        // =============================================
        // HASH PASSWORD
        // =============================================

        const hashedPassword =
            await bcrypt.hash(password, 10);


        // =============================================
        // CREATE ADMIN
        // =============================================

        const admin = new User({

            firstName: "Wristora",

            lastName: "Admin",

            email: email,

            password: hashedPassword,

            role: "admin",

            isBlocked: false,

            isVerified: true

        });


        await admin.save();


        console.log(
            "================================="
        );

        console.log(
            "Admin account created successfully!"
        );

        console.log(
            "Email:",
            email
        );

        console.log(
            "Password:",
            password
        );

        console.log(
            "Role:",
            admin.role
        );

        console.log(
            "================================="
        );


        await mongoose.connection.close();

    } catch (error) {

        console.error(
            "Error creating admin:",
            error
        );

        await mongoose.connection.close();

    }

};


createAdmin();