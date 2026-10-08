const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const adminSessionConfig = session({
    name: "admin.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions"
    }),

    cookie: {
        httpOnly: true,

        // Browsers will not send this cookie on requests started by
        // OTHER websites (POST forms/fetch). This blocks CSRF attacks
        // while normal links and Google login keep working.
        sameSite: "lax",

        secure: false,
        path: "/admin",
        maxAge: 1000 * 60 * 60 * 24
    }
});

module.exports = adminSessionConfig;