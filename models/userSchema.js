const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    firstname: {
    type: String,
    required: true,
    trim:true
  },
  lastname: {
    type: String,
    trim:true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null
  },
  dob: { type:  String },
  profileImage: { type: String },
  googleId: {
    type: String,
    unique: true,
    sparse: true  
  },
  password: {
    type: String,
    required: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,   
    ref: 'Cart'
  }],
  wallet: {
    type: Number,
    default: 0
  },
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: 'Wishlist'
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'    
  }],
  createdOn: {        
    type: Date,
    default: Date.now
  },
  referralCode: {
    type: String
  },
  redeemed: {
    type: Boolean,
    default: false   
  },
  usedReferralCode: {
  type: String,
  default: null
},

  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category'
    },
    brand: {
      type: String
    },
    searchOn: {      
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
