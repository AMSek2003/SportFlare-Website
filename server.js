if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const User = require('./models/user')

const initializePassport = require('./passport-config')
initializePassport(
    passport,
    async (email) => await User.findOne({ email: email }),
    async (_id) => await User.findById(_id)
)

app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.static('views'))
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
   secret: process.env.SESSION_SECRET,
   resave: false,
   saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

const mongoose = require('mongoose')
mongoose.connect(process.env.DATABASE_URL)
const db = mongoose.connection
db.on('error', error => console.error(error))
db.once('open', () => console.log('Połączono z Mongoose'))

app.get("/", async (req, res) => {
    const isAdmin = await checkAdmin(req);
    res.render('main', { isLoggedIn: checkLogged(req), isAdmin });
});

app.post("/logowanie", checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/logowanie',
    failureFlash: true
}));

app.get("/logowanie", checkNotAuthenticated, (req, res) => {
    res.render('login')
});

app.post("/rejestracja", checkNotAuthenticated, async (req, res) => { // TODO database
   try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        role: 'user',
        cart: []
    })

    user.save().then(newUser => {
        res.redirect('/logowanie');
    }).catch(err => {
        res.render('/rejestracja', {
            errorMessage: 'Błąd rejestracji użytkownika'
        });
    });

   } catch {
    res.redirect('/rejestracja')
   }
});

app.get("/rejestracja", checkNotAuthenticated, (req, res) => {
    res.render('register')
});

app.get("/sklep", async (req, res) => {
    const isAdmin = await checkAdmin(req);
    res.render('shop', { isLoggedIn: checkLogged(req), isAdmin });
});

app.get("/koszyk", checkAuthenticated, async (req, res) => {
    const isAdmin = await checkAdmin(req);
    res.render('cart', { isLoggedIn: checkLogged(req), isAdmin });
});

app.get("/admin", async (req, res) => {
    const isAdmin = await checkAdmin(req);

    if (isAdmin) {
        res.render('management', { isLoggedIn: checkLogged(req), isAdmin });
    } else {
        res.redirect('/');
    }
});

app.delete('/logout', (req, res) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

async function checkAdmin(req) {
    try {
        if (req.isAuthenticated()) {
            const thisUser = await req.user
            const thisId = thisUser._id
            const user = await User.find({_id: thisId});

            return user[0].role === 'admin';
        }
        
        return false;
    } catch (error) {
        console.error(error);
        return false;
    }
}

function checkLogged(req) {
    return req.isAuthenticated();
}


function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/logowanie')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}

app.listen(process.env.PORT || 3000)