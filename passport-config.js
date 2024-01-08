const { authenticate } = require('passport')

const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')


function initialize(passport, getUserByEmail, getUserById) {
    const User = require('./models/user');

    const authenticateUser = async (email, password, done) => {
        try {
            const user = await User.findOne({ email: email });

            if (!user) {
                return done(null, false, { message: 'Nie istnieje użytkownik o podanym adresie email' });
            }

            if (await bcrypt.compare(password, user.password)) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Nieprawidłowe hasło' });
            }
        } catch (e) {
            return done(e);
        }
    };

    passport.use(new LocalStrategy({ usernameField: 'email' }, 
    authenticateUser))
    passport.serializeUser((user, done) => done(null,user._id))
    passport.deserializeUser((_id, done) => {
        return done(null, getUserById(_id))
    })
}

module.exports = initialize