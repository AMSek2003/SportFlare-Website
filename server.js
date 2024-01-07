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
const path = require('path'); 

const initializePassport = require('./passport-config')
initializePassport(
    passport, 
    email => users.find(user => user.email === email),
    id => users.find(user => user.id === id)
)

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));
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

const users = [] // TODO normal database

app.get("/", (req, res) => {
    res.render('main', { isLoggedIn: checkLogged(req),  isAdmin: checkAdmin(req) })
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
    users.push({
        id: Date.now().toString(),
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        role: 'user'
    })
    res.redirect('/logowanie')
   } catch {
    res.redirect('/rejestracja')
   }
});

app.get("/rejestracja", checkNotAuthenticated, (req, res) => {
    res.render('register')
});

app.get("/sklep", (req, res) => {
    res.render('shop', { isLoggedIn: checkLogged(req),  isAdmin: checkAdmin(req) })
});

app.get("/koszyk", checkAuthenticated, (req, res) => {
    res.render('cart', { isLoggedIn: checkLogged(req),  isAdmin: checkAdmin(req) })
});

app.get("/admin", checkAuthenticatedAdmin, (req, res) => {
    res.render('management', { isLoggedIn: checkLogged(req),  isAdmin: checkAdmin(req) })
});

app.delete('/logout', (req, res) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});
function checkAdmin(req) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return true
    }

    return false
}

function checkLogged(req) {
    if (req.isAuthenticated()) {
        return true
    }

    return false
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

function checkAuthenticatedAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next()
    }

    res.redirect('/') 
}

app.listen(process.env.PORT || 3000)