const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  isListed: {
    type: Boolean,
    default: true
  },
  categoryOffer: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
