const mongoose = require('mongoose')
const path = require('path')
const imgBasePath = 'uploads/itemImages'
const imgDirectFolder = 'itemImages'

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: true
    },
    image: {
        type: String,
        required: true 
    }
})

itemSchema.virtual("imagePath").get(function() {
    if (this.image != null) {
        return path.join(imgDirectFolder, this.image)
    }
})

module.exports = mongoose.model('Item', itemSchema)
module.exports.imgBasePath = imgBasePath