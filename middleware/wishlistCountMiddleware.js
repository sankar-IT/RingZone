
const Wishlist = require('../models/wishlistSchema');

const wishlistCountMiddleware = async (req, res, next) => {
  try {
    let count = 0;
    const userId = req.session.user?._id;

    if (userId) {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist && wishlist.products) {
        count = wishlist.products.length;
      }
    }

    res.locals.wishlistLength = count;
    next();
  } catch (err) {
    console.error('Error in wishlistCountMiddleware:', err);
    res.locals.wishlistLength = 0;
    next();
  }
};

module.exports = wishlistCountMiddleware;
