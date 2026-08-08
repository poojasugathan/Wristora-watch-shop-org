const express = require("express");
const path = require("path");
const env=require("dotenv").config();
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const sessionConfig = require("./config/session");
const authRoutes = require("./routes/authRoutes");

const app = express();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionConfig);

app.use(express.static(path.join(__dirname, "public")));


app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use("/auth", authRoutes);


app.get("/", (req, res) => {
    res.send("Wristora server is running");
});


app.use((req, res) => {
    res.status(404).send("Page not found");
});


app.listen(process.env.PORT,()=>{
    console.log("server running")
})


module.exports=app