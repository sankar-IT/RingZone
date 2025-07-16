const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    color: { type: String, required: true },
    storage: { type: String, required: true },
    selectedImage: { type: String } 
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number
  }
}, { _id: false });

const cartSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d' 
  }
}, { timestamps: true });


cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});


cartSchema.virtual('subTotal').get(function() {
  return this.items.reduce((total, item) => {
    return total + ((item.discountPrice || item.price) * item.quantity);
  }, 0);
});

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;