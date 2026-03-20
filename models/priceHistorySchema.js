const mongoose = require("mongoose");

const priceHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantColor: {
    type: String,
    default: ''
  },
  variantStorage: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

priceHistorySchema.index({ productId: 1, variantColor: 1, variantStorage: 1, date: -1 });

module.exports = mongoose.model("PriceHistory", priceHistorySchema);
