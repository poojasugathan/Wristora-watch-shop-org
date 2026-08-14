const express = require("express");
const path = require("path");
const env=require("dotenv").config();


const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const sessionConfig = require("./config/session");
const authRoutes = require("./routes/authRoutes");
const passport = require("./config/passport");
const profileRoutes = require("./routes/profileRoutes");

const app = express();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionConfig);

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use(passport.initialize());
app.use(passport.session());


app.use(express.static(path.join(__dirname, "public")));


app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);


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