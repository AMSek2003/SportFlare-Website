if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const imageTypes = ['image/jpeg', 'image/png', 'image/gif']
const User = require('./models/user')
const Item = require('./models/item')
const uploadPath = Item.imgBasePath
const upload = multer({
    dest: uploadPath,
    fileFilter: (req, file, callback) => {
        callback(null, imageTypes.includes(file.mimetype))
    },
    filename: function(req, file, callback) {
        callback(null, Date.now() + path.extname(file.originalname));
      }
})

const initializePassport = require('./passport-config')
initializePassport(
    passport,
    async (email) => await User.findOne({ email: email }),
    async (_id) => await User.findById(_id)
)

app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.static('views'))
app.use(express.static('uploads'))
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
    let searchOptions = {}
    if (req.query.searchinp != null && req.query.searchinp != '') {
        searchOptions["$or"] = [
            { name: new RegExp(req.query.searchinp, 'i') },
            { description: new RegExp(req.query.searchinp, 'i') }
        ]
    }
    const isAdmin = await checkAdmin(req)
    const items = await Item.find({})
    res.render('main', { 
        isLoggedIn: checkLogged(req), 
        isAdmin, 
        items:items,
        searchOptions: req.query
     })
});

app.post("/logowanie", checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/logowanie',
    failureFlash: true
}));

app.get("/logowanie", checkNotAuthenticated, (req, res) => {
    res.render('login')
});

app.post("/rejestracja", async (req, res) => {
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
            res.redirect('/logowanie')
        }).catch(err => {
            res.render('rejestracja', {
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
    let searchOptions = {}
    if (req.query.searchinp != null && req.query.searchinp != '') {
        searchOptions["$or"] = [
            { name: new RegExp(req.query.searchinp, 'i') },
            { description: new RegExp(req.query.searchinp, 'i') }
        ]
    }
    const isAdmin = await checkAdmin(req);
    const items = await Item.find(searchOptions)
    res.render('shop', { 
        isLoggedIn: checkLogged(req), 
        isAdmin, 
        items:items,
        searchOptions: req.query
    })
})

app.get("/koszyk", checkAuthenticated, async (req, res) => {
    let searchOptions = {}
    if (req.query.searchinp != null && req.query.searchinp != '') {
        searchOptions["$or"] = [
            { name: new RegExp(req.query.searchinp, 'i') },
            { description: new RegExp(req.query.searchinp, 'i') }
        ]
    }
    const isAdmin = await checkAdmin(req);
    const thisUser = await req.user
    const thisId = thisUser._id
    const user = await User.find({_id: thisId})
    const usersCart = user[0].cart
    const items = await Item.find({})
    const filteredItems = items.filter(item => usersCart.some(cartItem => cartItem.id === item.id))
    res.render('cart', { 
        isLoggedIn: checkLogged(req), 
        isAdmin, 
        cart: usersCart,
        items: filteredItems,
        searchOptions: req.query
     })
})

app.get("/admin", async (req, res) => {
    let searchOptions = {}
    if (req.query.searchinp != null && req.query.searchinp != '') {
        searchOptions["$or"] = [
            { name: new RegExp(req.query.searchinp, 'i') },
            { description: new RegExp(req.query.searchinp, 'i') }
        ]
    }
    const isAdmin = await checkAdmin(req);
    const items = await Item.find({})
    const users = await User.find({})

    if (isAdmin) {
        res.render('management', {
            isLoggedIn: checkLogged(req), 
            isAdmin,
            items: items,
            users: users,
            searchOptions: req.query
        })
    } else {
        res.redirect('/')
    }
})

app.post("/admin", upload.single('image'), async (req, res) => {
    try {
        const fileName = req.file != null ? req.file.filename : null
        const item = new Item({
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            image: fileName
        })

        item.save().then(newItem => {
            res.redirect('/')
        }).catch(async err => {
            const items = await Item.find({})
            res.render('management', {
                isLoggedIn: checkLogged(req),
                isAdmin: true,
                items: items,
                errorMessage: 'Błąd przy dodawaniu nowego produktu'
            })
        })
    } catch {
        if (item.image != null){
            removeImage(item.image)
        }
        res.redirect('/admin')
    }
})

app.delete('/logout', (req, res) => {
    req.logOut((err) => {
        if (err) {
            return next(err)
        }
        res.redirect('/')
    })
})

app.get("/edit/:id", async (req, res) => {
    let searchOptions = {}
    if (req.query.searchinp != null && req.query.searchinp != '') {
        searchOptions["$or"] = [
            { name: new RegExp(req.query.searchinp, 'i') },
            { description: new RegExp(req.query.searchinp, 'i') }
        ]
    }
    const isAdmin = await checkAdmin(req);
    const itemList = await Item.find({_id: req.params.id})
    const item = itemList[0]

    if (isAdmin) {
        res.render('edit_product', {
            isLoggedIn: checkLogged(req), 
            isAdmin,
            item: item,
            searchOptions: req.query
        })
    } else {
        res.redirect('/')
    }
})

app.put("/edit/:id", upload.single('image'), async (req, res) => {
    try {
        const fileName = req.file != null ? req.file.filename : null
        const item = await Item.findById(req.params.id)

        if (req.body.name != item.name){
            item.name = req.body.name
        }

        if (req.body.description != item.description){
            item.description = req.body.description
        }

        if (req.body.price != item.price){
            item.price = req.body.price
        }

        if (fileName != null) {
            if (item.image != null){
                removeImage(item.image)
            }
            item.image = fileName
        }

        await item.save()
        res.redirect(`/:${item.id}`)

    } catch {
        if (fileName != null){
            removeImage(fileName)
        }
        res.redirect(`/:${item.id}`)
    }
})

app.get('/:id', async (req,res) => {
    let searchOptions = {}
    if (req.query.searchinp != null && req.query.searchinp != '') {
        searchOptions["$or"] = [
            { name: new RegExp(req.query.searchinp, 'i') },
            { description: new RegExp(req.query.searchinp, 'i') }
        ]
    }
    const isAdmin = await checkAdmin(req)

    try {
        const item = await Item.findById(req.params.id)
        res.render('product', {
        isLoggedIn: checkLogged(req), 
        isAdmin, 
        searchOptions: req.query,
        item: item
        })
    } catch {
        res.redirect('/sklep')
    }
})

app.delete('/:id', async (req,res) => { 
    let item
    try {
        item = await Item.findById(req.params.id)
        item_image = item.image
        item_id = item.id
        const result = await Item.deleteOne({ _id: req.params.id });
        if (result.deletedCount === 1) {
            await removeFromAllCarts(item_id)
            if (item_image != null){
                removeImage(item_image)
            }
            res.redirect('/admin');
        }
    } catch {
        if (item == null) {
            res.redirect('/')
        } else {
            res.redirect(`/${item.id}`)
        }
    }
})

app.put('/:id', async (req, res) => {
    try {
        const itemId = req.params.id
        const thisUser = await req.user
        const thisId = thisUser._id
        const userList = await User.find({_id: thisId})
        const user = userList[0]
        const cart = user.cart

        let item = cart.find(item => item.id === itemId)

        if (item) {
            let itemIndex = cart.findIndex(item => item.id === itemId)
            cart[itemIndex].amount += 1
        } else {
            let newItem = { id: itemId, amount: 1 }
            cart.push(newItem)
        }
        user.cart = cart
        await user.save()
        res.redirect('/koszyk')
    } catch(err) {
        console.error(err)
        res.redirect('/sklep')
    }
})

app.put('/:id/remove', async (req, res) => {
    try {
        const itemId = req.params.id
        const thisUser = await req.user
        const thisId = thisUser._id
        const userList = await User.find({_id: thisId})
        const user = userList[0]
        const cart = user.cart

        let item = cart.find(item => item.id === itemId)

        if (item) {
            let itemIndex = cart.findIndex(item => item.id === itemId)
            const newCart = cart.filter((value, index) => index !== itemIndex)
            user.cart = newCart
            await user.save()
            res.redirect('/koszyk')
        } else {
            res.redirect('/koszyk')
        }
    } catch(err) {
        console.error(err)
        res.redirect('/')
    }
})

async function checkAdmin(req) {
    try {
        if (req.isAuthenticated()) {
            const thisUser = await req.user
            const thisId = thisUser._id
            const user = await User.find({_id: thisId})
            return user[0].role === 'admin'
        }
        
        return false
    } catch (error) {
        console.error(error)
        return false
    }
}

function checkLogged(req) {
    return req.isAuthenticated()
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

function removeImage(fileName){
    fs.unlink(path.join(uploadPath, fileName), err => {
        if (err) console.err(err)
    })
}

async function removeFromAllCarts(id) {
    try {
        const users = await User.find({ 'cart.id': id })
        users.forEach(async user => {
            let cart = user.cart
            let itemIndex = cart.findIndex(item => item.id === id)
            let newCart = cart.filter((value, index) => index !== itemIndex)
            user.cart = newCart
            await user.save()
        })
    } catch(err) {
        console.log(err)
    }
}

app.listen(process.env.PORT || 3000)