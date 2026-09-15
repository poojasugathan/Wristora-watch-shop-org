const express = require("express");
const path = require("path");
const env=require("dotenv").config();


const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const sessionConfig = require("./config/session");
const adminSessionConfig = require("./config/adminSession");
const noCache = require("./middlewares/noCacheMiddleware");
const authRoutes = require("./routes/authRoutes");
const passport = require("./config/passport");
const profileRoutes = require("./routes/profileRoutes");
const addressRoutes = require("./routes/addressRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const checkoutRoutes= require("./routes/checkoutRoutes");
const attachHeaderData = require("./middlewares/headerDataMiddleware");
const attachCartCount = require("./middlewares/cartCountMiddleware");
const attachWishlistCount = require("./middlewares/wishlistCountMiddleware");


const app = express();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// =====================================================
// SESSION DISPATCH
//
// /admin requests get their own session (their own cookie,
// "admin.sid"). Every other request gets the regular user
// session ("connect.sid"). This keeps the two identities on
// completely separate cookies, so they can never overwrite
// each other in the same browser.
// =====================================================

app.use((req, res, next) => {

    if (req.path.startsWith("/admin")) {
        return adminSessionConfig(req, res, next);
    }

    return sessionConfig(req, res, next);

});


app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use(noCache); 


app.use(express.static(path.join(__dirname, "public")));


app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use(attachHeaderData);
app.use(attachCartCount);
app.use(attachWishlistCount);

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/addresses", addressRoutes);
app.use("/admin", adminRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/checkout", checkoutRoutes);

app.get("/", (req, res) => {
    res.render("user/home", {
        title: "Wristora"
    });
});


app.use((req, res) => {
    res.status(404).send("Page not found");
});


app.listen(process.env.PORT,()=>{
    console.log("server running")
})


module.exports=app