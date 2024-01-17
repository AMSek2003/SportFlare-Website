const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    items: [
        {
            id: { type: String, required: true },
            amount: { type: Number, required: true }
        }
    ]
})

module.exports = mongoose.model('Order', orderSchema)