const mongoose = require("mongoose");

const priceAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  targetPrice: {
    type: Number,
    required: true
  },
  finalPrice: {
    type: Number,
    default: null
  },
  email: {
    type: String,
    required: true
  },
  notifyBackInStock: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notified: {
    type: Boolean,
    default: false
  },
  // Time when price first dropped to target (HH:MM format)
  triggeredHour: {
    type: Number,
    default: null
  },
  triggeredMinute: {
    type: Number,
    default: null
  },
  lastTriggeredAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("PriceAlert", priceAlertSchema);
