const mongoose = require('mongoose');
const { Schema } = mongoose;

const wishlistSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  products: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: {
      color: String,
      storage: String,
      image: String
    },
    notifyPrice: {
  type: Number,
  default: 0
},
notifyOffer: {
  type: Number,
  default: 0
},
    addedOn: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
module.exports = Wishlist;

