const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
  couponCode: {
    type: String,
    required: true,
    unique: true 
  },
  discountPercent: {
    type: Number,
    required: true
  },
  maxDiscountAmount: {
    type: Number,
    required: true
  },
  minimumOrderAmount: {
    type: Number,
    required: true
  },
  instruction:{
    type:String,
    required:true
  },
  maxUsageCount: {
    type: Number,
    required: true
  },
  userType: {
    type: String,
    enum: ['All', 'Premium',],
    default: 'All'
  },
  expiryDate: {
    type: Date,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdOn: {
    type: Date,
    default: Date.now
  },
  usersUsed: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
