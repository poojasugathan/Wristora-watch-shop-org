const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/userModel");


passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,

            clientSecret: process.env.GOOGLE_CLIENT_SECRET,

            callbackURL: "http://localhost:3000/auth/google/callback"
        },

        async (
            accessToken,
            refreshToken,
            profile,
            done
        ) => {

            try {

                const googleId = profile.id;

                const email =
                    profile.emails &&
                    profile.emails[0]
                        ? profile.emails[0].value
                            .toLowerCase()
                            .trim()
                        : "";

                const firstName =
                    profile.name?.givenName ||
                    "Google";

                const lastName =
                    profile.name?.familyName ||
                    "User";


                if (!email) {
                    return done(
                        null,
                        false,
                        {
                            message:
                                "Unable to get your email from Google."
                        }
                    );
                }

                let user =
                    await User.findOne({
                        googleId: googleId
                    });


                if (user) {

                  
                    if (user.isBlocked === true) {

                        return done(
                            null,
                            false,
                            {
                                message:
                                    "Your account has been blocked."
                            }
                        );
                    }


                    return done(null, user);
                }



                user =
                    await User.findOne({
                        email: email
                    });


                if (user) {

                    if (user.isBlocked === true) {

                        return done(
                            null,
                            false,
                            {
                                message:
                                    "Your account has been blocked."
                            }
                        );
                    }

                    user.googleId = googleId;

                    user.isVerified = true;

                    await user.save();


                    return done(null, user);
                }



                user = new User({

                    firstName: firstName,

                    lastName: lastName,

                    email: email,

                    phone: "",

                    password: "",

                    googleId: googleId,

                    referralCode: "",

                    isVerified: true

                });


                await user.save();


                return done(null, user);


            } catch (error) {

                console.error(
                    "Google authentication error:",
                    error
                );

                return done(error);
            }

        }
    )
);


module.exports = passport;