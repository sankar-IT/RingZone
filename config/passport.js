const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const env = require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    passReqToCallback: true 
},
async (req, accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return done(null, user);
        }

        const existingUser = await User.findOne({ email: profile.emails[0].value });
        
        if (existingUser) {
           
            if (!existingUser.googleId) {
               
                existingUser.googleId = profile.id;
                existingUser.firstname = existingUser.firstname || profile.displayName;
                await existingUser.save();
                return done(null, existingUser);
            }
            
            const error = new Error('Email already registered');
            error.email = profile.emails[0].value;
            return done(error, null);
        }

        
        user = new User({
            firstname: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            isVerified: true 
        });

        await user.save();
        return done(null, user);
        
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => done(null, user))
        .catch(err => done(err, null));
});

module.exports = passport;