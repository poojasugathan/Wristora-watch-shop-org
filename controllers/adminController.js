const bcrypt = require("bcrypt");

const User = require("../models/userModel");


// =====================================================
// LOAD ADMIN LOGIN PAGE
// =====================================================

const loadAdminLogin = (req, res) => {

    // =================================================
    // IF ADMIN IS ALREADY LOGGED IN
    // =================================================

    if (
        req.session &&
        req.session.admin &&
        req.session.admin.id &&
        req.session.admin.role === "admin"
    ) {

        return res.redirect("/admin/dashboard");

    }


    let error = null;


    // =================================================
    // HANDLE ERROR MESSAGES
    // =================================================

    if (req.query.error === "server") {

        error =
            "Something went wrong. Please try again.";

    }


    // =================================================
    // RENDER ADMIN LOGIN
    // =================================================

    return res.render("admin/adminLogin", {

        title: "Admin Login",

        error,

        formData: {
            email: ""
        }

    });

};


// =====================================================
// ADMIN LOGIN
// =====================================================

const adminLogin = async (req, res) => {

    try {

        // =================================================
        // GET FORM DATA
        // =================================================

        const email = req.body.email
            ? req.body.email.trim().toLowerCase()
            : "";

        const password = req.body.password
            ? req.body.password
            : "";


        // =================================================
        // EMAIL VALIDATION
        // =================================================

        if (!email) {

            return res.status(400).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "Please enter your email.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // EMAIL FORMAT VALIDATION
        // =================================================

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {

            return res.status(400).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "Please enter a valid email address.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // PASSWORD VALIDATION
        // =================================================

        if (!password) {

            return res.status(400).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "Please enter your password.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // FIND ADMIN
        // =================================================
        // IMPORTANT:
        // We search for role: "admin" here.
        // Normal users cannot authenticate through
        // the admin login even if they know their password.
        // =================================================

        const admin = await User.findOne({

            email,

            role: "admin"

        });


        // =================================================
        // INVALID ADMIN CREDENTIALS
        // =================================================

        if (!admin) {

            return res.status(401).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "Invalid admin email or password.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // BLOCKED ADMIN CHECK
        // =================================================

        if (admin.isBlocked === true) {

            return res.status(403).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "This admin account has been blocked. Please contact support.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // PASSWORD EXISTENCE CHECK
        // =================================================

        if (!admin.password) {

            return res.status(401).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "Invalid admin email or password.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // BCRYPT PASSWORD CHECK
        // =================================================

        const passwordMatch =
            await bcrypt.compare(
                password,
                admin.password
            );


        if (!passwordMatch) {

            return res.status(401).render(
                "admin/adminLogin",
                {

                    title: "Admin Login",

                    error:
                        "Invalid admin email or password.",

                    formData: {
                        email
                    }

                }
            );

        }


        // =================================================
        // REGENERATE SESSION
        // =================================================

        req.session.regenerate((sessionError) => {

            if (sessionError) {

                console.error(
                    "Admin session regeneration error:",
                    sessionError
                );

                return res.status(500).render(
                    "admin/adminLogin",
                    {

                        title: "Admin Login",

                        error:
                            "Something went wrong. Please try again.",

                        formData: {
                            email
                        }

                    }
                );

            }


            // =================================================
            // CREATE ADMIN SESSION
            // =================================================

            req.session.admin = {

                id:
                    admin._id.toString(),

                email:
                    admin.email,

                role:
                    admin.role

            };


            // =================================================
            // SAVE SESSION
            // =================================================

            req.session.save((saveError) => {

                if (saveError) {

                    console.error(
                        "Admin session save error:",
                        saveError
                    );

                    return res.status(500).render(
                        "admin/adminLogin",
                        {

                            title: "Admin Login",

                            error:
                                "Something went wrong. Please try again.",

                            formData: {
                                email
                            }

                        }
                    );

                }


                // =================================================
                // LOGIN SUCCESS
                // =================================================

                return res.redirect(
                    "/admin/dashboard"
                );

            });

        });


    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );


        return res.status(500).render(
            "admin/adminLogin",
            {

                title: "Admin Login",

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


// =====================================================
// ADMIN LOGOUT
// =====================================================

const adminLogout = (req, res) => {

    // =================================================
    // DESTROY CURRENT SESSION
    // =================================================

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Admin logout error:",
                error
            );

            return res.status(500).send(
                "Unable to logout. Please try again."
            );

        }


        // =================================================
        // CLEAR SESSION COOKIE
        // =================================================

        res.clearCookie("connect.sid");


        // =================================================
        // REDIRECT TO ADMIN LOGIN
        // =================================================

        return res.redirect(
            "/admin/login"
        );

    });

};


// =====================================================
// LOAD ADMIN DASHBOARD
// =====================================================

const loadDashboard = async (req, res) => {

    try {

        // =================================================
        // DASHBOARD DATA
        // =================================================
        // Temporary values matching the Figma design.
        // These will be connected to real database data
        // in later phases.
        // =================================================

        const dashboardData = {

            totalSales: 142805,

            salesGrowth: 12.4,

            previousSales: 126224,

            totalOrders: "2.4K",

            orderGrowth: 18.2,

            previousOrders: "1.9K",

            pendingOrders: 142,

            cancelledOrders: 32,

            cancelledGrowth: 11.2,

            totalCollections: "1.2K",

            netRevenue: "₹450K"

        };


        // =================================================
        // BEST SELLING PRODUCTS
        // =================================================

        const bestSellingProducts = [

            {
                name: "Aurelius Chronograph 42mm",
                totalOrders: 84,
                status: "Stock",
                price: "₹42,499"
            },

            {
                name: "Nautilus Silver Edition",
                totalOrders: 60,
                status: "Stock out",
                price: "₹44,850"
            },

            {
                name: "Starlight Skeleton Gold",
                totalOrders: 76,
                status: "Stock",
                price: "₹72,900"
            },

            {
                name: "Oceanic Diver Pro 300",
                totalOrders: 42,
                status: "Stock",
                price: "₹81,850"
            }

        ];


        // =================================================
        // SALES PROGRESS
        // =================================================

        const salesProgress = {

            percentage: 65.55,

            increase: 10,

            target: "₹80K",

            revenue: "₹56K",

            today: "₹38K"

        };


        // =================================================
        // RENDER DASHBOARD
        // =================================================

        return res.render(
            "admin/dashboard",
            {

                title: "Admin Dashboard",

                dashboardData,

                bestSellingProducts,

                salesProgress

            }
        );


    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );


        return res.status(500).send(
            "Unable to load admin dashboard."
        );

    }

};
// =====================================================
// LOAD ADMIN USER MANAGEMENT
// =====================================================

const loadUsers = async (req, res) => {

    try {

        // =================================================
        // GET SEARCH VALUE
        // =================================================

        const search = req.query.search
            ? req.query.search.trim()
            : "";


        // =================================================
        // GET PAGE NUMBER
        // =================================================

        let page = parseInt(req.query.page, 10);

        if (
            isNaN(page) ||
            page < 1
        ) {
            page = 1;
        }


        // =================================================
        // USERS PER PAGE
        // =================================================

        const usersPerPage = 10;


        // =================================================
        // BUILD MONGODB QUERY
        // =================================================

        const query = {
            role: "user"
        };


        // =================================================
        // BACKEND USER SEARCH
        // =================================================

        if (search) {

            // Escape special regex characters.

            const escapedSearch =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );


            query.$or = [

                {
                    firstName: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },

                {
                    lastName: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },

                {
                    email: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                },

                {
                    phone: {
                        $regex: escapedSearch,
                        $options: "i"
                    }
                }

            ];

        }


        // =================================================
        // COUNT TOTAL MATCHING USERS
        // =================================================
        // This counts users matching the search query.
        // It does NOT load all users.
        // =================================================

        const totalUsers =
            await User.countDocuments(query);


        // =================================================
        // CALCULATE TOTAL PAGES
        // =================================================

        const totalPages =
            Math.ceil(
                totalUsers / usersPerPage
            );


        // =================================================
        // HANDLE PAGE OUT OF RANGE
        // =================================================

        if (
            totalPages > 0 &&
            page > totalPages
        ) {

            page = totalPages;

        }


        // =================================================
        // CALCULATE SKIP
        // =================================================

        const skip =
            (page - 1) * usersPerPage;


        // =================================================
        // GET ONLY USERS FOR CURRENT PAGE
        // =================================================

        const users = await User.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(usersPerPage)
            .lean();


        // =================================================
        // TOTAL CUSTOMERS
        // =================================================

        const totalCustomers = totalUsers;


        // =================================================
        // NEW CUSTOMERS
        // =================================================

        const sevenDaysAgo = new Date();

        sevenDaysAgo.setDate(
            sevenDaysAgo.getDate() - 7
        );


        // =================================================
        // COUNT NEW CUSTOMERS
        // =================================================
        // We calculate this from the current page only
        // for now. Later phases can improve reporting.
        // =================================================

        const newCustomers =
            users.filter(
                user =>
                    user.createdAt &&
                    new Date(user.createdAt) >= sevenDaysAgo
            ).length;


        // =================================================
        // RENDER USER MANAGEMENT PAGE
        // =================================================

        return res.render(
            "admin/users",
            {

                title: "Customers",

                users,

                totalCustomers,

                newCustomers,

                search,

                currentPage: page,

                totalPages,

                usersPerPage

            }
        );


    } catch (error) {

        // =================================================
        // SERVER-SIDE ERROR LOG
        // =================================================

        console.error(
            "Admin user management error:",
            error
        );


        // =================================================
        // USER-FRIENDLY ERROR PAGE
        // =================================================

        return res.status(500).render(
            "admin/users",
            {

                title: "Customers",

                users: [],

                totalCustomers: 0,

                newCustomers: 0,

                search:
                    req.query.search
                        ? req.query.search.trim()
                        : "",

                currentPage: 1,

                totalPages: 0,

                usersPerPage: 10,

                error:
                    "Unable to load customers right now. Please try again."

            }
        );

    }

};
// =====================================================
// LOAD CUSTOMER DETAILS
// =====================================================

const loadUserDetails = async (req, res) => {

    try {

        const userId = req.params.id;


        // =================================================
        // FIND CUSTOMER
        // =================================================

        const user = await User.findOne({
            _id: userId,
            role: "user"
        })
            .select("-password -googleId")
            .lean();


        // =================================================
        // CUSTOMER NOT FOUND
        // =================================================

        if (!user) {

            return res.status(404).send(
                "Customer not found."
            );

        }


        // =================================================
        // FORMAT CREATED DATE
        // =================================================

        const createdDate = user.createdAt
            ? new Date(
                user.createdAt
            ).toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            )
            : "—";


        // =================================================
        // FORMAT UPDATED DATE
        // =================================================

        const updatedDate = user.updatedAt
            ? new Date(
                user.updatedAt
            ).toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            )
            : "—";


        // =================================================
        // RENDER CUSTOMER DETAILS
        // =================================================

        return res.render(
            "admin/userDetails",
            {
                title: "Customer Details",

                user,

                createdDate,

                updatedDate,

                error: null
            }
        );


    } catch (error) {

        console.error(
            "Customer details error:",
            error
        );


        return res.status(500).render(
            "admin/userDetails",
            {
                title: "Customer Details",

                user: null,

                createdDate: "—",

                updatedDate: "—",

                error:
                    "Unable to load customer details. Please try again."
            }
        );

    }

};
// =====================================================
// BLOCK / UNBLOCK CUSTOMER
// =====================================================

const blockUser = async (req, res) => {

    try {

        const userId = req.params.id;


        // =================================================
        // FIND NORMAL CUSTOMER
        // =================================================

        const user = await User.findOne({
            _id: userId,
            role: "user"
        });


        // =================================================
        // CUSTOMER NOT FOUND
        // =================================================

        if (!user) {

            return res.status(404).send(
                "Customer not found."
            );

        }


        // =================================================
        // TOGGLE BLOCK STATUS
        // =================================================

        user.isBlocked = !user.isBlocked;

        await user.save();


        // =================================================
        // REDIRECT BACK TO CUSTOMER DETAILS
        // =================================================

        return res.redirect(
            `/admin/users/${userId}`
        );


    } catch (error) {

        console.error(
            "Block / unblock customer error:",
            error
        );


        return res.status(500).send(
            "Unable to update customer status. Please try again."
        );

    }

};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    loadAdminLogin,

    adminLogin,

    adminLogout,

    loadDashboard,
    
    loadUsers,

    loadUserDetails,

     blockUser

};