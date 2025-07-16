const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  color: { type: String, required: true },
  storage: { type: String, required: true },
  images: [{ type: String }],
  regularPrice: { type: Number, required: true },
  discountPrice: { type: Number },
  quantity: { type: Number, required: true }
});

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  images: [{ type: String }],
  variants: [variantSchema],
  isBlocked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Product", productSchema);

