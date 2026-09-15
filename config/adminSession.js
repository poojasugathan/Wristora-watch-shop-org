// =====================================================
// ADMIN SESSION CONFIG
//
// Identical shape to the regular user session config, but
// with its OWN cookie name ("admin.sid" instead of
// "connect.sid") and its cookie scoped to path "/admin".
//
// Why this exists: previously, admin login and user login
// both wrote to the same "connect.sid" cookie. Since
// cookies are shared across all tabs in the same browser
// (not tab-scoped), logging in as admin in one tab silently
// overwrote the session the user tab was relying on, and
// vice versa. Giving admin its own cookie name means the
// two identities can never collide, even in the same
// browser at the same time.
//
// Same MongoStore/collection is reused — that's fine, the
// store just holds more documents, one per session id,
// regardless of which cookie name they're tied to.
// =====================================================

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
        secure: false,
        path: "/admin",
        maxAge: 1000 * 60 * 60 * 24
    }
});

module.exports = adminSessionConfig;