
const Order = require('../models/orderSchema');

const injectCartCount = async (req, res, next) => {
  try {
    let cartCount = 0;
    
    if (req.session.user?._id) {
      const activeCart = await Order.findOne({ 
        userId: req.session.user._id,
        status: 'Proccessing' 
      });
      
     
      cartCount = activeCart?.orderedItems?.reduce(
        (total, item) => total + item.quantity, 
        0
      ) || 0;
    }

  
    res.locals.cartCount = cartCount;
    next();
  } catch (error) {
    console.error('Cart middleware error:', error);
    res.locals.cartCount = 0;
    next();
  }
};

module.exports = injectCartCount;