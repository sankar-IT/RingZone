const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => 'RIZO-' + uuidv4().split('-')[0].toUpperCase(),
    unique: true
  },
  shipping: {
    type: Number
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 
             'Return Requested', 'Return Approved', 'Return Rejected', 'Returned'],
      default: 'Pending'
    },
    variant: {
      color: { type: String },
      storage: { type: String },
      selectedImage: { type: String }
    },
    returnReason: { type: String },
    returnRequestDate: { type: Date }
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    name: { type: String, required: true },
    phone: { type: Number, required: true },
    address: { type: String, required: true },
    place: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
   },
   coupon: {
     couponCode: { type: String },
     discountAmount: { type: Number }
   },
   paymentMethod: {
     type: String,
     required: true,
     enum: ['cod', 'online']
   },
   paymentStatus: {
     type: String,
     required: true,
     enum: ['Paid', 'Pending'],
     default: 'Pending'
   },
  invoiceDate: {
    type: Date,
    default: new Date()
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Processing'
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;