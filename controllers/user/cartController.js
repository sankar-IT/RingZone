const User = require('../../models/userSchema');
const Address=require('../../models/addressSchema');
const Cart=require('../../models/cartSchema')
const Product=require('../../models/productsSchema');
const Wishlist = require('../../models/wishlistSchema');
const productsSchema = require('../../models/productsSchema');
const Coupon = require('../../models/couponSchema');
const Wallet=require('../../models/walletSchema');

const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    const userId = req.session.user._id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productVariant = product.variants.find(v =>
      v._id.toString() === variantId
    );

    if (!productVariant || productVariant.quantity < 1) {
      return res.status(400).json({ error: 'Variant unavailable' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item =>
      item.product.equals(productId) &&
      item.variant.color === productVariant.color &&
      item.variant.storage === productVariant.storage
    );

    if (itemIndex >= 0) {
      const variantMatch = product.variants.find(v => v._id == variantId);

      if (variantMatch.quantity < cart.items[itemIndex].quantity + parseInt(quantity)) {
        return res.status(400).json({ message: 'Out of stock', success: false });
      }

      if (cart.items[itemIndex].quantity + parseInt(quantity) > 3) {
        return res.status(400).json({ success: false, message: 'Max cart quantity exceeds' });
      }

      cart.items[itemIndex].quantity += parseInt(quantity);
    } else {
      cart.items.push({
        product: productId,
        variant: {
          color: productVariant.color,
          storage: productVariant.storage,
          selectedImage: productVariant.images[0]
        },
        quantity,
        price: productVariant.regularPrice,
        discountPrice: productVariant.discountPrice
      });
    }

    await cart.save();

   
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: productId } } }
    );

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      cartCount: cart.items?.length
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};


const getCartPage=async(req,res)=>{
  try {
    if(req.session.user){

      const userId=req.session.user._id;

      const cartProducts= await Cart.findOne({user:userId}).populate('items.product')

        res.locals.cartCount = cartProducts?.items?.length || 0;
        res.render('user-cart',{cartProducts , user:req.session.user, cartCount: res.locals.cartCount})
      
      
    }else{
    res.redirect('/login')
    }
  } catch (error) {
 
    
   res.redirect('/pageNotFound')
  }
}

const updateCartQuantity = async (req, res) => {
  try {
    const { productId, color, storage, quantity } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ user: userId });
  


    if (!cart) return res.status(404).json({success: false , error: 'Cart not found' });

    const itemIndex = cart.items.findIndex(item =>
      item.product.equals(productId) &&
      item.variant.color === color &&
      item.variant.storage === storage
    );

    if (itemIndex === -1) {
      return res.status(404).json({success: false , error: 'Cart item not found' });
    }

    const dbProduct = await Product.findById(productId);
    const matchedVariant = dbProduct.variants.find( variant => variant.color == color  && variant.storage == storage);

    if(matchedVariant.quantity < quantity){
      return res.status(400).json({success: false, message: 'out of stock product'})
    }

    cart.items[itemIndex].quantity = quantity;

    await cart.save();

    const item = cart.items[itemIndex];
    const itemTotal = (item.discountPrice || item.price) * item.quantity;

    res.json({ success: true, itemTotal });

  } catch (error) {
   
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const deleteCartItem=async(req,res)=>{
  try {
    const{productId,color,storage}=req.body;
  
    const userId=req.session.user?._id;

    const cart=await Cart.findOne({user : userId})
    if(!cart) return res.status(400).json({success:false,error:'Cart not found'})

    const itemIndex = cart.items.findIndex(item =>
      item.product.equals(productId) &&
      item.variant.color === color &&
      item.variant.storage === storage
    );
    if (itemIndex === -1) {
      return res.status(404).json({success: false , error: 'Cart item not found' });
    }

   

    cart.items.splice(itemIndex,1)
    await cart.save();

    res.json({success:true})

  } catch (error) {
    console.error('Delete Cart Item Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
  }

 
const processCheckout = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    const addressDoc = await Address.findOne({ userId });

    if (!cart || cart.items.length <= 0) {
      return res.status(404).json({ success: false, message: 'Cart is empty' });
    }

    const cartItemIds = cart.items.map(item => item.product);
    const dbProducts = await Product.find({ _id: { $in: cartItemIds } });

    let activeItems = [];
    let totalPrice = 0;

    for (const dbProduct of dbProducts) {
      const cartProducts = cart.items.filter(itm => itm.product.equals(dbProduct._id));

      for (const cartProduct of cartProducts) {
        if (dbProduct.isBlocked) {
          return res.status(400).json({ success: false, message: 'Product unavailable' });
        }

        const matchedVariant = dbProduct.variants.find(
          v => v.color === cartProduct.variant.color &&
               v.storage === cartProduct.variant.storage
        );

        if (!matchedVariant) {
          return res.status(400).json({ success: false, message: 'Product variant not found' });
        }

        if (matchedVariant.quantity < cartProduct.quantity) {
          return res.status(400).json({ success: false, message: 'Product out of stock' });
        }

        const currentDiscountPrice = matchedVariant.discountPrice;
        const cartDiscountPrice = cartProduct.discountPrice;

        if (Number(currentDiscountPrice) !== Number(cartDiscountPrice)) {
          return res.status(400).json({
            success: false,
            message: `Price for '${dbProduct.productName}' has been updated. Please review your cart.`,
          });
        }

        const itemPrice = currentDiscountPrice || matchedVariant.regularPrice;
        const itemTotal = itemPrice * cartProduct.quantity;
        totalPrice += itemTotal;

        activeItems.push({
          product: dbProduct._id,
          quantity: cartProduct.quantity,
          price: itemPrice,
          variant: {
            color: matchedVariant.color,
            storage: matchedVariant.storage,
            selectedImage: matchedVariant.images[0]
          }
        });
      }
    }

    res.locals.cartCount = cart.items.length;
    return res.status(200).json({ success: true, redirectUrl: '/checkout' });

  } catch (error) {
    console.error('Checkout Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


const renderCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) return res.redirect('/login');

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      req.session.checkoutError = 'Your cart is empty.';
      return res.redirect('/user-cart');
    }

    let subtotal = 0;
    let discount = 0;
    let shipment = 0;
  

    if (req.session.appliedCoupon) {
      discount = req.session.appliedCoupon.discount;
    }

    const productIds = cart.items.map(item => item.product);
    const dbProducts = await productsSchema.find({ _id: { $in: productIds } }).lean();

    subtotal = cart.items.reduce((total, product) => {
      const dbProduct = dbProducts.find(prod => prod._id.toString() == product.product._id.toString());
      if (dbProduct) {
        const matchedVariant = dbProduct?.variants.find(v =>
          v.color == product.variant.color && v.storage == product.variant.storage
        );
        if (matchedVariant) {
          total += matchedVariant.discountPrice * product.quantity;
        }
      }
      return total;
    }, 0);

    shipment = subtotal < 10000 ? 100 : 0;
    const grandTotal = subtotal - discount + shipment;

    const addressData = await Address.findOne({ userId });
    const couponData = await Coupon.find({ active: true });
    const cartCount = cart?.items?.length || 0;
    return res.render('cart-checkout', {
      addressData,
      cart,
      selectedAddress: req.session.selectedAddress || null,
      couponData,
      orderSummary: {
        subtotal,
        discount,
        shipment,
        grandTotal
      },
      appliedCoupon: req.session.appliedCoupon || null,
      cartCount
    });

  } catch (error) {
 
    res.redirect('/user-cart');
  }
};



const addCheckoutAddress = async(req,res)=>{
  try {
    const userId=req.session.user?._id
    const {firstName,lastName,phone,address,pinCode,city,state,addressType}=req.body;
    const newAddress={
      firstName,
      lastName,
      phone,
      address,
      pinCode,
      city,
      state,
      addressType,
      isDefault:false
    }

    const addressDoc=await Address.findOne({userId})
    if(addressDoc)
    {
      addressDoc.addresses.push(newAddress)
      await addressDoc.save();
      return res.status(200).json({success:true,redirectUrl:'/checkout'})
    }else{

      const address = await Address.create({
        userId: req.session.user._id
      })

      address.addresses.push(newAddress);

      await address.save();

      return res.status(200).json({success: true, message: 'successfilly'})

    }
    
  } catch (error) {
    return res.status(200).json({sucesss:false,message:error.message})
  }
}



const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const { couponCode } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Login required to apply coupon.' });
    }
 
     const formattedCouponCode = couponCode.trim().toUpperCase();
    const coupon = await Coupon.findOne({ couponCode: couponCode.trim().toUpperCase(), active: true });

    if (!coupon) {
      return res.json({ success: false, message: 'Invalid or inactive coupon.' });
    }

    const today = new Date();
    if (coupon.expiryDate < today) {
      return res.json({ success: false, message: 'This coupon has expired.' });
    }

    if (coupon.usageCount >= coupon.maxUsageCount) {
      return res.json({ success: false, message: 'Coupon usage limit reached.' });
    }

if (req.session.appliedCoupon) {
  return res.json({ success: false, message: 'Coupon already applied.' });
}
    const user = await User.findById(userId);
    if (coupon.userType !== 'All' && user.userType !== coupon.userType) {
      return res.json({ success: false, message: 'You are not eligible for this coupon.' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: 'Cart is empty.' });
    }

    const productIds = cart.items.map(item => item.product);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();

    const subtotal = cart.items.reduce((total, product) => {
      const dbProduct = dbProducts.find(prod => prod._id.toString() == product.product._id.toString());
      if (dbProduct) {
        const matchedVariant = dbProduct.variants.find(v =>
          v.color == product.variant.color && v.storage == product.variant.storage
        );
        if (matchedVariant) {
          total += matchedVariant.discountPrice * product.quantity;
        }
      }
      return total;
    }, 0);

    if (subtotal < coupon.minimumOrderAmount) {
      return res.json({
        success: false,
        message: `Minimum order amount ₹${coupon.minimumOrderAmount} required for this coupon.`
      });
    }

    let discount = Math.floor((coupon.discountPercent / 100) * subtotal);
    if (discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }

    const shipment = subtotal < 10000 ? 100 : 0;
    const grandTotal = subtotal - discount + shipment;

    req.session.appliedCoupon = {
      code: coupon.couponCode.toString(),
      discount,
      discountPercent: coupon.discountPercent
    };

    return res.json({
      success: true,
      discount,
      grandTotal,
      subtotal,
      shipment
    });

  } catch (err) {

    
    return res.status(500).json({ success: false, message: 'Server error. Try again later.' });
  }
};


const removeCoupon = async (req, res) => {
  try {
    req.session.appliedCoupon = null;
    delete req.session.appliedCoupon; 

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const productIds = cart.items.map(item => item.product._id || item.product);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();

    const subtotal = cart.items.reduce((total, item) => {
      const dbProduct = dbProducts.find(prod => prod._id.toString() === item.product._id.toString());
      if (dbProduct) {
        const matchedVariant = dbProduct.variants.find(v =>
          v.color == item.variant.color && v.storage == item.variant.storage
        );
        if (matchedVariant) {
          total += matchedVariant.discountPrice * item.quantity;
        }
      }
      return total;
    }, 0);

    const shipment = subtotal < 10000 ? 100 : 0;
    const grandTotal = subtotal + shipment;

    return res.status(200).json({ success: true, grandTotal });

  } catch (error) {
   
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};



const renderPaymentPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const cartCount = cart?.items?.length || 0;
    if (!cart) return res.redirect('/user-cart');

    let subtotal = 0;
    let discount = req.session.appliedCoupon?.discount || 0;
    let shipment = 0;

    const productIds = cart.items.map(item => item.product);
    const dbProducts = await productsSchema.find({ _id: { $in: productIds } }).lean();

    subtotal = cart.items.reduce((total, product) => {
      const dbProduct = dbProducts.find(prod => prod._id.toString() == product.product._id.toString());
      if (dbProduct) {
        const matchedVariant = dbProduct?.variants.find(v =>
          v.color == product.variant.color && v.storage == product.variant.storage
        );
        if (matchedVariant) {
          total += matchedVariant.discountPrice * product.quantity;
        }
      }
      return total;
    }, 0);

    shipment = subtotal < 10000 ? 100 : 0;
    const grandTotal = subtotal - discount + shipment;

    const addressData = await Address.findOne({ userId });

   const wallet = await Wallet.findOne({ user: userId });
const walletBalance = wallet?.balance || 0;


    const razorpayKey = process.env.RAZORPAY_KEY_ID;

    return res.render('cart-payment', {
      addressData,
      cart,
      orderSummary: { subtotal, discount, shipment, grandTotal },
      appliedCoupon: req.session.appliedCoupon || null,
      razorpayKey,
      cartCount,
      walletBalance  
    });

  } catch (error) {
    res.redirect('/checkout');
  }
};

const checkWalletBalance = async (req,res) => {
  try{

    const wallet = await Wallet.findOne({ user: req.session.user._id });
    let balance = wallet.balance || 0;
    if(!wallet){
      return res.status(200).json({balance: balance})
    }else{
      return res.status(200).json({balance: balance})
    }
  
  }catch(err){
    res.status(500).json({balance: 0})
  }

}


const proceedToPayment = async (req, res) => {
  try {
    if (req.session.user) {
      const userId = req.session.user?._id;
      const cart = await Cart.findOne({ user: userId });
      
      const addressDoc = await Address.findOne({ userId });
  
      

      const { shipment, addressId, couponCode, discount } = req.body;
      
      
      
      if(!addressId){
        return res.status(404).json({ success: false, message: 'address is required' });
      }
      
      req.session.selectedShipment = shipment;
      req.session.selectedAddress = addressId;

      if (!cart || cart.items.length <= 0) {
        return res.status(404).json({ success: false, message: 'cart is empty' });
      }
      if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
        return res.status(404).json({ success: false, message: 'Address is Empty' });
      }
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, message: 'Session error' });
        }

        return res.status(200).json({ success: true, redirectUrl: '/load-payment'});
      });
    }
    
  } catch (error) {
    console.log(error)
    res.status(404).json({ success: false, message: error.message });
  }
};


module.exports = {
  addToCart,
  getCartPage,
  updateCartQuantity,
  deleteCartItem,
  processCheckout,
  renderCheckoutPage,
  addCheckoutAddress,
  applyCoupon,
  removeCoupon,
  renderPaymentPage,
  proceedToPayment,
  checkWalletBalance
};

