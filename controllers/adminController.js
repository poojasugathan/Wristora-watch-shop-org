const bcrypt = require("bcrypt");

const User = require("../models/userModel");

const Category = require("../models/categoryModel");

const Product = require("../models/productModel");

const cloudinary = require("../config/cloudinary");


// =====================================================
// SHARED HELPER
// =====================================================

const escapeRegex = (text) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const loadAdminLogin = (req, res) => {



    if (
        req.session &&
        req.session.admin &&
        req.session.admin.id &&
        req.session.admin.role === "admin"
    ) {

        return res.redirect("/admin/dashboard");

    }


    let error = null;


    if (req.query.error === "server") {

        error =
            "Something went wrong. Please try again.";

    }


    return res.render("admin/adminLogin", {

        title: "Admin Login",

        error,

        formData: {
            email: ""
        }

    });

};


const adminLogin = async (req, res) => {

    try {


        const email = req.body.email
            ? req.body.email.trim().toLowerCase()
            : "";

        const password = req.body.password
            ? req.body.password
            : "";


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



        const admin = await User.findOne({

            email,

            role: "admin"

        });


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



            req.session.admin = {

                id:
                    admin._id.toString(),

                email:
                    admin.email,

                role:
                    admin.role

            };



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


const adminLogout = (req, res) => {


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



        res.clearCookie("connect.sid");


        return res.redirect(
            "/admin/login"
        );

    });

};




const loadDashboard = async (req, res) => {

    try {

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


        const salesProgress = {

            percentage: 65.55,

            increase: 10,

            target: "₹80K",

            revenue: "₹56K",

            today: "₹38K"

        };


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


const loadUsers = async (req, res) => {

    try {

        const search = req.query.search
            ? req.query.search.trim()
            : "";



            const sortOption = req.query.sort || "created_desc";

             let sort = {
                createdAt: -1
               };

            if (sortOption === "name_desc") {
            sort = {
              firstName: -1,
             lastName: -1
               };
             }

        let page = parseInt(req.query.page, 10);

        if (
            isNaN(page) ||
            page < 1
        ) {
            page = 1;
        }

        const usersPerPage = 10;

        const query = {
            role: "user"
        };

        if (search) {

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

        const totalUsers =
            await User.countDocuments(query);

        const totalPages =
            Math.ceil(
                totalUsers / usersPerPage
            );

        if (
            totalPages > 0 &&
            page > totalPages
        ) {

            page = totalPages;

        }

        const skip =
            (page - 1) * usersPerPage;



        const users = await User.find(query)
            .select("-password")
            .sort(sort)
            .skip(skip)
            .limit(usersPerPage)
            .lean();


        const totalCustomers = totalUsers;

        const sevenDaysAgo = new Date();

        sevenDaysAgo.setDate(
            sevenDaysAgo.getDate() - 7
        );



        const newCustomers =
            users.filter(
                user =>
                    user.createdAt &&
                    new Date(user.createdAt) >= sevenDaysAgo
            ).length;

        return res.render(
            "admin/users",
            {

                title: "Customers",

                users,

                totalCustomers,

                newCustomers,

                search,

                sort: sortOption,

                currentPage: page,

                totalPages,

                usersPerPage

            }
        );


    } catch (error) {

        console.error(
            "Admin user management error:",
            error
        );



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


const loadUserDetails = async (req, res) => {

    try {

        const userId = req.params.id;


        const user = await User.findOne({
            _id: userId,
            role: "user"
        })
            .select("-password -googleId")
            .lean();

        if (!user) {

            return res.status(404).send(
                "Customer not found."
            );

        }


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


const blockUser = async (req, res) => {

    try {

        const userId = req.params.id;

        const user = await User.findOne({
            _id: userId,
            role: "user"
        });


        if (!user) {

            return res.status(404).send(
                "Customer not found."
            );

        }

        user.isBlocked = !user.isBlocked;

        await user.save();


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
// CATEGORY MANAGEMENT (PHASE 34)
// =====================================================


const loadCategories = async (req, res) => {

    try {

        const search = req.query.search
            ? req.query.search.trim()
            : "";

        let page = parseInt(req.query.page, 10);

        if (
            isNaN(page) ||
            page < 1
        ) {
            page = 1;
        }

        const categoriesPerPage = 10;

        const query = {
            isDeleted: false
        };

        if (search) {

            const escapedSearch =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

            query.name = {
                $regex: escapedSearch,
                $options: "i"
            };

        }

        const totalCategories =
            await Category.countDocuments(query);

        const totalPages =
            Math.ceil(
                totalCategories / categoriesPerPage
            );

        if (
            totalPages > 0 &&
            page > totalPages
        ) {

            page = totalPages;

        }

        const skip =
            (page - 1) * categoriesPerPage;

        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(categoriesPerPage)
            .lean();

        return res.render(
            "admin/categories",
            {

                title: "Categories",

                categories,

                search,

                currentPage: page,

                totalPages,

                totalCategories,

                error: null,

                success: null

            }
        );

    } catch (error) {

        console.error(
            "Admin category listing error:",
            error
        );

        return res.status(500).render(
            "admin/categories",
            {

                title: "Categories",

                categories: [],

                search:
                    req.query.search
                        ? req.query.search.trim()
                        : "",

                currentPage: 1,

                totalPages: 0,

                totalCategories: 0,

                error:
                    "Unable to load categories right now. Please try again.",

                success: null

            }
        );

    }

};


const loadAddCategory = (req, res) => {

    return res.render(
        "admin/addCategory",
        {

            title: "Add Category",

            error: null,

            formData: {
                name: "",
                description: "",
                isListed: true
            }

        }
    );

};


const addCategory = async (req, res) => {

    try {

        const name = req.body.name
            ? req.body.name.trim()
            : "";

        const description = req.body.description
            ? req.body.description.trim()
            : "";

        const isListed =
            req.body.isListed === "on";


        if (!name) {

            return res.status(400).render(
                "admin/addCategory",
                {

                    title: "Add Category",

                    error:
                        "Please enter a category name.",

                    formData: {
                        name,
                        description,
                        isListed
                    }

                }
            );

        }


        const existingCategory =
            await Category.findOne({

                name: {
                    $regex:
                        `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                    $options: "i"
                },

                isDeleted: false

            });


        if (existingCategory) {

            return res.status(400).render(
                "admin/addCategory",
                {

                    title: "Add Category",

                    error:
                        "A category with this name already exists.",

                    formData: {
                        name,
                        description,
                        isListed
                    }

                }
            );

        }


        await Category.create({

            name,

            description,

            isListed

        });


        return res.redirect(
            "/admin/categories"
        );


    } catch (error) {

        console.error(
            "Add category error:",
            error
        );

        return res.status(500).render(
            "admin/addCategory",
            {

                title: "Add Category",

                error:
                    "Something went wrong. Please try again.",

                formData: {

                    name:
                        req.body.name || "",

                    description:
                        req.body.description || "",

                    isListed:
                        req.body.isListed === "on"

                }

            }
        );

    }

};


const loadEditCategory = async (req, res) => {

    try {

        const categoryId = req.params.id;

        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        }).lean();

        if (!category) {

            return res.status(404).send(
                "Category not found."
            );

        }

        return res.render(
            "admin/editCategory",
            {

                title: "Edit Category",

                category,

                error: null

            }
        );

    } catch (error) {

        console.error(
            "Load edit category error:",
            error
        );

        return res.status(500).send(
            "Unable to load category. Please try again."
        );

    }

};


const editCategory = async (req, res) => {

    try {

        const categoryId = req.params.id;

        const name = req.body.name
            ? req.body.name.trim()
            : "";

        const description = req.body.description
            ? req.body.description.trim()
            : "";

        const isListed =
            req.body.isListed === "on";


        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {

            return res.status(404).send(
                "Category not found."
            );

        }


        if (!name) {

            return res.status(400).render(
                "admin/editCategory",
                {

                    title: "Edit Category",

                    category: {
                        _id: categoryId,
                        name,
                        description,
                        isListed
                    },

                    error:
                        "Please enter a category name."

                }
            );

        }


        const duplicateCategory =
            await Category.findOne({

                _id: { $ne: categoryId },

                name: {
                    $regex:
                        `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                    $options: "i"
                },

                isDeleted: false

            });


        if (duplicateCategory) {

            return res.status(400).render(
                "admin/editCategory",
                {

                    title: "Edit Category",

                    category: {
                        _id: categoryId,
                        name,
                        description,
                        isListed
                    },

                    error:
                        "A category with this name already exists."

                }
            );

        }


        category.name = name;

        category.description = description;

        category.isListed = isListed;

        await category.save();


        return res.redirect(
            "/admin/categories"
        );


    } catch (error) {

        console.error(
            "Edit category error:",
            error
        );

        return res.status(500).send(
            "Unable to update category. Please try again."
        );

    }

};


const deleteCategory = async (req, res) => {

    try {

        const categoryId = req.params.id;

        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {

            return res.status(404).send(
                "Category not found."
            );

        }

        category.isDeleted = true;

        await category.save();


        return res.redirect(
            "/admin/categories"
        );


    } catch (error) {

        console.error(
            "Delete category error:",
            error
        );

        return res.status(500).send(
            "Unable to delete category. Please try again."
        );

    }

};




// =====================================================
// PRODUCT MANAGEMENT (PHASE 35)
// =====================================================


const loadProducts = async (req, res) => {

    try {

        const search = req.query.search
            ? req.query.search.trim()
            : "";

        let page = parseInt(req.query.page, 10);

        if (
            isNaN(page) ||
            page < 1
        ) {
            page = 1;
        }

        const productsPerPage = 10;

        const query = {
            isDeleted: false
        };

        if (search) {

            const escapedSearch = escapeRegex(search);

            query.productName = {
                $regex: escapedSearch,
                $options: "i"
            };

        }

        const totalProducts =
            await Product.countDocuments(query);

        const totalPages =
            Math.ceil(
                totalProducts / productsPerPage
            );

        if (
            totalPages > 0 &&
            page > totalPages
        ) {

            page = totalPages;

        }

        const skip =
            (page - 1) * productsPerPage;

        const products = await Product.find(query)
            .populate("category", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(productsPerPage)
            .lean();

        return res.render(
            "admin/products",
            {

                title: "Products",

                products,

                search,

                currentPage: page,

                totalPages,

                totalProducts,

                error: null,

                success: null

            }
        );

    } catch (error) {

        console.error(
            "Admin product listing error:",
            error
        );

        return res.status(500).render(
            "admin/products",
            {

                title: "Products",

                products: [],

                search:
                    req.query.search
                        ? req.query.search.trim()
                        : "",

                currentPage: 1,

                totalPages: 0,

                totalProducts: 0,

                error:
                    "Unable to load products right now. Please try again.",

                success: null

            }
        );

    }

};


const loadAddProduct = async (req, res) => {

    try {

        const categories = await Category.find({
            isDeleted: false,
            isListed: true
        })
            .sort({ name: 1 })
            .lean();

        return res.render(
            "admin/addProduct",
            {

                title: "Add Product",

                currentPage: "addProduct",

                categories,

                error: null,

                formData: {
                    productName: "",
                    description: "",
                    brand: "",
                    category: "",
                    price: "",
                    discount: "",
                    stock: "",
                    isListed: true
                }

            }
        );

    } catch (error) {

        console.error(
            "Load add product error:",
            error
        );

        return res.status(500).send(
            "Unable to load add product page. Please try again."
        );

    }

};


const addProduct = async (req, res) => {

    // Uploaded files (if any) from productUploadMiddleware.
    // Kept outside the try block so the catch/validation
    // sections below can clean them up from Cloudinary
    // if something goes wrong after upload.
    const uploadedFiles = req.files || [];


    const cleanupUploadedImages = async () => {

        for (const file of uploadedFiles) {

            try {

                await cloudinary.uploader.destroy(
                    file.filename
                );

            } catch (cleanupError) {

                console.error(
                    "Cloudinary cleanup error:",
                    cleanupError
                );

            }

        }

    };


    try {

        const productName = req.body.productName
            ? req.body.productName.trim()
            : "";

        const description = req.body.description
            ? req.body.description.trim()
            : "";

        const brand = req.body.brand
            ? req.body.brand.trim()
            : "";

        const categoryId = req.body.category
            ? req.body.category.trim()
            : "";

        const price = parseFloat(req.body.price);

        const discount =
            req.body.discount && req.body.discount.trim() !== ""
                ? parseFloat(req.body.discount)
                : 0;

        const stock = parseInt(req.body.stock, 10);

        const isListed =
            req.body.isListed === "on";


        const categories = await Category.find({
            isDeleted: false,
            isListed: true
        })
            .sort({ name: 1 })
            .lean();


        const renderWithError = (message) => {

            return res.status(400).render(
                "admin/addProduct",
                {

                    title: "Add Product",

                    categories,

                    currentPage: "addProduct",

                    error: message,

                    formData: {
                        productName,
                        description,
                        brand,
                        category: categoryId,
                        price: req.body.price || "",
                        discount: req.body.discount || "",
                        stock: req.body.stock || "",
                        isListed
                    }

                }
            );

        };


        // ---------------------------------------------
        // BASIC FIELD VALIDATION
        // ---------------------------------------------

        if (!productName) {

            await cleanupUploadedImages();

            return renderWithError(
                "Please enter a product name."
            );

        }

        if (!description) {

            await cleanupUploadedImages();

            return renderWithError(
                "Please enter a product description."
            );

        }

        if (!categoryId) {

            await cleanupUploadedImages();

            return renderWithError(
                "Please select a category."
            );

        }


        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {

            await cleanupUploadedImages();

            return renderWithError(
                "The selected category is invalid."
            );

        }


        if (
            isNaN(price) ||
            price <= 0
        ) {

            await cleanupUploadedImages();

            return renderWithError(
                "Please enter a valid price greater than 0."
            );

        }


        if (
            isNaN(discount) ||
            discount < 0 ||
            discount > 100
        ) {

            await cleanupUploadedImages();

            return renderWithError(
                "Discount must be a number between 0 and 100."
            );

        }


        if (
            isNaN(stock) ||
            stock < 0
        ) {

            await cleanupUploadedImages();

            return renderWithError(
                "Please enter a valid stock quantity (0 or more)."
            );

        }


        // ---------------------------------------------
        // IMAGE VALIDATION (minimum 3 required by the
        // Product model)
        // ---------------------------------------------

        if (uploadedFiles.length < 3) {

            await cleanupUploadedImages();

            return renderWithError(
                "Please upload at least 3 product images."
            );

        }


        // ---------------------------------------------
        // SELLING PRICE — calculated on the backend only.
        // We never trust a selling price sent from the form.
        // ---------------------------------------------

        const sellingPrice =
            Math.round(
                (price - (price * discount) / 100) * 100
            ) / 100;


        const images = uploadedFiles.map((file) => ({
            url: file.path,
            publicId: file.filename
        }));


        await Product.create({

            productName,

            description,

            brand,

            category: category._id,

            price,

            discount,

            sellingPrice,

            stock,

            images,

            isListed

        });


        return res.redirect(
            "/admin/products"
        );


    } catch (error) {

        console.error(
            "Add product error:",
            error
        );

        await cleanupUploadedImages();

        return res.status(500).send(
            "Unable to add product. Please try again."
        );

    }

};


const toggleProductListing = async (req, res) => {

    try {

        const productId = req.params.id;

        const product = await Product.findOne({
            _id: productId,
            isDeleted: false
        });

        if (!product) {

            return res.status(404).send(
                "Product not found."
            );

        }

        product.isListed = !product.isListed;

        await product.save();


        return res.redirect(
            "/admin/products"
        );


    } catch (error) {

        console.error(
            "Toggle product listing error:",
            error
        );

        return res.status(500).send(
            "Unable to update product status. Please try again."
        );

    }

};

const loadEditProduct = async (req, res) => {

    try {

        const productId = req.params.id;

        const product = await Product.findOne({
            _id: productId,
            isDeleted: false
        }).lean();

        if (!product) {

            return res.status(404).send(
                "Product not found."
            );

        }

        const categories = await Category.find({
            isDeleted: false,
            isListed: true
        })
            .sort({ name: 1 })
            .lean();

        return res.render(
            "admin/editProduct",
            {

                title: "Edit Product",

                currentPage: "products",

                categories,

                product,

                error: null,

                formData: {
                    productName: product.productName,
                    description: product.description,
                    brand: product.brand || "",
                    category: String(product.category),
                    price: product.price,
                    discount: product.discount,
                    stock: product.stock,
                    isListed: product.isListed
                }

            }
        );

    } catch (error) {

        console.error(
            "Load edit product error:",
            error
        );

        return res.status(500).send(
            "Unable to load edit product page. Please try again."
        );

    }

};


const editProduct = async (req, res) => {

    try {

        const productId = req.params.id;

        const product = await Product.findOne({
            _id: productId,
            isDeleted: false
        });

        if (!product) {

            return res.status(404).send(
                "Product not found."
            );

        }


        const productName = req.body.productName
            ? req.body.productName.trim()
            : "";

        const description = req.body.description
            ? req.body.description.trim()
            : "";

        const brand = req.body.brand
            ? req.body.brand.trim()
            : "";

        const categoryId = req.body.category
            ? req.body.category.trim()
            : "";

        const price = parseFloat(req.body.price);

        const discount =
            req.body.discount && req.body.discount.trim() !== ""
                ? parseFloat(req.body.discount)
                : 0;

        const stock = parseInt(req.body.stock, 10);

        const isListed =
            req.body.isListed === "on";


        const categories = await Category.find({
            isDeleted: false,
            isListed: true
        })
            .sort({ name: 1 })
            .lean();


        const renderWithError = (message) => {

            return res.status(400).render(
                "admin/editProduct",
                {

                    title: "Edit Product",

                    currentPage: "products",

                    categories,

                    product,

                    error: message,

                    formData: {
                        productName,
                        description,
                        brand,
                        category: categoryId,
                        price: req.body.price || "",
                        discount: req.body.discount || "",
                        stock: req.body.stock || "",
                        isListed
                    }

                }
            );

        };


        if (!productName) {

            return renderWithError(
                "Please enter a product name."
            );

        }

        if (!description) {

            return renderWithError(
                "Please enter a product description."
            );

        }

        if (!categoryId) {

            return renderWithError(
                "Please select a category."
            );

        }


        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {

            return renderWithError(
                "The selected category is invalid."
            );

        }


        if (
            isNaN(price) ||
            price <= 0
        ) {

            return renderWithError(
                "Please enter a valid price greater than 0."
            );

        }


        if (
            isNaN(discount) ||
            discount < 0 ||
            discount > 100
        ) {

            return renderWithError(
                "Discount must be a number between 0 and 100."
            );

        }


        if (
            isNaN(stock) ||
            stock < 0
        ) {

            return renderWithError(
                "Please enter a valid stock quantity (0 or more)."
            );

        }


        // Selling price is always recalculated on the backend,
        // never trusted from the form.

        const sellingPrice =
            Math.round(
                (price - (price * discount) / 100) * 100
            ) / 100;


        product.productName = productName;

        product.description = description;

        product.brand = brand;

        product.category = category._id;

        product.price = price;

        product.discount = discount;

        product.sellingPrice = sellingPrice;

        product.stock = stock;

        product.isListed = isListed;


        await product.save();


        return res.redirect(
            "/admin/products"
        );


    } catch (error) {

        console.error(
            "Edit product error:",
            error
        );

        return res.status(500).send(
            "Unable to update product. Please try again."
        );

    }

};


const deleteProduct = async (req, res) => {

    try {

        const productId = req.params.id;

        const product = await Product.findOne({
            _id: productId,
            isDeleted: false
        });

        if (!product) {

            return res.status(404).send(
                "Product not found."
            );

        }

        product.isDeleted = true;

        await product.save();


        return res.redirect(
            "/admin/products"
        );


    } catch (error) {

        console.error(
            "Delete product error:",
            error
        );

        return res.status(500).send(
            "Unable to delete product. Please try again."
        );

    }

};


module.exports = {

    loadAdminLogin,

    adminLogin,

    adminLogout,

    loadDashboard,

    loadUsers,

    loadUserDetails,

     blockUser,

    loadCategories,

    loadAddCategory,

    addCategory,

    loadEditCategory,

    editCategory,

    deleteCategory,

    loadProducts,

    loadAddProduct,

    addProduct,

    toggleProductListing,

    loadEditProduct,

    editProduct,

    deleteProduct

};