const User = require('../../models/userSchema');
const Address=require('../../models/addressSchema');
const Order=require('../../models/orderSchema');
const Cart=require('../../models/cartSchema')
const Product=require('../../models/productsSchema');
const Wishlist = require('../../models/wishlistSchema');
const razorpay=require('../../config/razorpay')
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs'); 
require('dotenv').config();
const session = require('express-session');
const { default: mongoose } = require('mongoose');
const productsSchema = require('../../models/productsSchema');
const Coupon = require('../../models/couponSchema');
const razorpayInstance = require('../../config/razorpay');
const crypto = require('crypto')


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
      return res.status(400).json({success: false, message: 'out of stoc k product'})
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

 
const postCartToCheckout = async (req, res) => {
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

    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      return res.status(404).json({ success: false, message: 'Address is empty' });
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


const getCheckoutPage = async (req, res) => {
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



const cartNewAddresses=async(req,res)=>{
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
    console.log(error);
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



const postCheckoutToPayment = async (req, res) => {
  try {

    const userId = req.session.user?._id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const cartCount=cart?.items?.length || 0
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
     const razorpayKey = process.env.RAZORPAY_KEY_ID;

    return res.render('cart-payment', {
      addressData,
      cart,
      orderSummary: {
        subtotal,
        discount,
        shipment,
        grandTotal
      },
      appliedCoupon: req.session.appliedCoupon || null,
        razorpayKey,   
        cartCount 
    });

  } catch (error) {
    res.redirect('/checkout');
  }
};

const getCartPayment = async (req, res) => {
  try {
    if (req.session.user) {
      const userId = req.session.user?._id;
      const cart = await Cart.findOne({ user: userId });
      
      const addressDoc = await Address.findOne({ userId });
  
      

      const { shipment, addressId, couponCode, discount } = req.body;
      
      console.log(req.body);
      
      
      if(!addressId){
        return res.status(404).json({ success: false, message: 'address is required' });
      }
      
      req.session.selectedShipment = shipment;
      req.session.selectedAddress = addressId;
      req.session.appliedCoupon = {
        code: couponCode || null,
        discount : Number(discount)
      };

      console.log(req.session.appliedCoupon)
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

const postPaymentToOrder = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart is empty' });
    }


    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      return res.status(404).json({ success: false, message: 'Address is empty' });
    }

    const shippingAddressId = req.session.selectedAddress;
    if (!shippingAddressId) {
      return res.status(400).json({ success: false, message: 'Shipping address not selected' });
    }

    const shippingAddress = addressDoc.addresses.find(
      addr => addr._id.toString() === shippingAddressId.toString()
    );
    if (!shippingAddress) {
      return res.status(404).json({ success: false, message: 'Selected address not found' });
    }


    const couponData = req.session.appliedCoupon || {};
    const discount = Number(couponData.discount) || 0;
    const couponCode = (couponData.code && typeof couponData.code === 'string') 
      ? couponData.code 
      : null;

    
    const cartItemIds = cart.items.map(item => item.product);
    const dbProducts = await Product.find({ _id: { $in: cartItemIds } });

    let activeItems = [];
    let totalPrice = 0;

    for (const dbProduct of dbProducts) {
      const cartProducts = cart.items.filter(itm => itm.product.equals(dbProduct._id));
      for (const cartProduct of cartProducts) {
        if (!dbProduct.isBlocked) {
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
          const itemPrice = matchedVariant.discountPrice || matchedVariant.regularPrice;
          const itemTotal = itemPrice * cartProduct.quantity;
          totalPrice += itemTotal;
          if(totalPrice>=1000){
     return res.status(400).json({ success: false, message: 'Cash on Delivery is not available for orders above ₹1000. Please choose a different payment method.' });
          }
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
        } else {
          return res.status(400).json({ success: false, message: 'Product unavailable' });
        }
      }
    }

    if (activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'All products are unavailable' });
    }

   
    const shippingCharge = totalPrice >= 10000 ? 0 : 100;

    const finalAmount = totalPrice - discount + shippingCharge;

    const newOrder = await Order.create({
      user: userId,
      orderedItems: activeItems,
      totalPrice,
      discount: discount,
      finalAmount,
      shipping: shippingCharge,
      paymentMethod: 'cod',
      paymentStatus: 'Confirmed',
      status:'Confirmed',
      address: {
        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        place: shippingAddress.place || 'place',
        state: shippingAddress.state,
        pincode: shippingAddress.pinCode
      },
      cartCount: cart.items.length,
      couponApplied: !!couponCode,
      coupon: {
        couponCode: couponCode,
        discountAmount: discount
      },
      status: 'Confirmed'
    });

if (couponCode) {
  const maxUsageCount = couponData.maxUsageCount || Infinity; 
  await Coupon.updateOne(
    {
      couponCode,
      usageCount: { $lt: maxUsageCount },
      usersUsed: { $ne: userId }
    },
    {
      $inc: { usageCount: 1 },
      $addToSet: { usersUsed: userId }
    }
  );
}

    
    for (const item of activeItems) {
      await Product.updateOne(
        { 
          _id: item.product,
          'variants.color': item.variant.color,
          'variants.storage': item.variant.storage
        },
        { $inc: { 'variants.$.quantity': -item.quantity } }
      );
    }

    await Cart.deleteOne({ user: userId });
    delete req.session.selectedShipment;
    delete req.session.selectedAddress;
    delete req.session.appliedCoupon;

    res.status(200).json({ 
      success: true, 
      message: 'Order placed successfully', 
      redirectUrl: '/order-placed',
      orderId: newOrder._id
    });

  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Server Error',
      error: error.message 
    });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart is empty' });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      return res.status(404).json({ success: false, message: 'No saved addresses found' });
    }

    const shippingAddressId = req.session.selectedAddress;
    const shippingAddress = addressDoc.addresses.find(
      addr => addr._id.toString() === shippingAddressId
    );

    if (!shippingAddress) {
      return res.status(404).json({ success: false, message: 'Selected address not found' });
    }

    const cartItemIds = cart.items.map(item => item.product);
    const dbProducts = await Product.find({ _id: { $in: cartItemIds } });

    let activeItems = [];

    for (const dbProduct of dbProducts) {
      const cartProducts = cart.items.filter(itm => itm.product.equals(dbProduct._id));

      for (const cartProduct of cartProducts) {
        if (dbProduct.isBlocked) {
          return res.status(400).json({ success: false, message: 'Product is blocked or unavailable' });
        }

        const matchedVariant = dbProduct.variants.find(
          v => v.color === cartProduct.variant.color && v.storage === cartProduct.variant.storage
        );

        if (!matchedVariant) {
          return res.status(400).json({ success: false, message: 'Product variant not found' });
        }

        if (matchedVariant.quantity < cartProduct.quantity) {
          return res.status(400).json({ success: false, message: 'Insufficient stock for a variant' });
        }

        activeItems.push({
          product: dbProduct._id,
          quantity: cartProduct.quantity,
          price: matchedVariant.discountPrice,
          variant: {
            color: matchedVariant.color,
            storage: matchedVariant.storage,
            selectedImage: matchedVariant.selectedImage
          }
        });
      }
    }

    if (activeItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid products in cart' });
    }

    const totalPrice = activeItems.reduce((total, itm) => total + itm.price * itm.quantity, 0);
    const shippingCharge = totalPrice >= 10000 ? 0 : 100;
    const couponData = req.session.appliedCoupon || {};
    const finalAmount = totalPrice - (couponData.discount || 0) + shippingCharge;

    // Create order in DB
    const ord = await Order.create({
      user: userId,
      orderedItems: activeItems,
      totalPrice,
      discount: couponData.discount || 0,
      finalAmount,
      shipping: shippingCharge,
      paymentMethod: 'online',
      paymentStatus: 'Pending',
      status: 'Pending',
      address: {
        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        place: shippingAddress.place || 'place',
        state: shippingAddress.state,
        pincode: shippingAddress.pinCode
      },
      couponApplied: !!couponData.code,
      coupon: {
        couponCode: typeof couponData.code === 'string' ? couponData.code : null,
        discountAmount: couponData.discount || 0
      }
    });

    // Clear session/cart
    await Cart.deleteOne({ user: userId });
    delete req.session.selectedShipment;
    delete req.session.selectedAddress;
    delete req.session.appliedCoupon;

    // Prepare Razorpay options
    const options = {
      amount: Math.round(finalAmount * 100), // Convert to paise
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now()
    };

    console.log("🔧 Razorpay Order Options:", options);

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(options);
    } catch (err) {
      console.error('❌ Razorpay API Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error creating Razorpay order',
        details: err.error || err.message || err
      });
    }

    if (!razorpayOrder || !razorpayOrder.id) {
      return res.status(500).json({
        success: false,
        message: 'Invalid Razorpay response'
      });
    }

    // Respond with both Razorpay and internal order info
    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      dbOrderId: ord._id,
      amount: razorpayOrder.amount,
      keyId: process.env.RAZORPAY_ID_KEY,
      currency: razorpayOrder.currency,
      customer: req.session.user
    });

  } catch (error) {
    console.error("🔥 Razorpay order creation error:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message || error
    });
  }
};


const verifyRazorPayOrder = async (req, res) => {
  try {


    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'User not logged in',
        redirectUrl: '/login'
      });
    }

    const userId = req.session.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      await Order.findByIdAndUpdate(order_id, {
        status: 'Failed',
        paymentStatus: 'Failed',
        failureReason: 'Missing payment verification fields'
      });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        redirectUrl: `/payment-failure/${order_id}`
      });
    }

   
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Order.findByIdAndUpdate(order_id, {
        status: 'Failed',
        paymentStatus: 'Failed',
        failureReason: 'Invalid payment signature',
        $push: {
          statusHistory: {
            status: 'Failed',
            changedAt: new Date(),
            changedBy: 'system'
          }
        }
      });
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
        redirectUrl: `/payment-failure/${order_id}`
      });
    }

    
    const order = await Order.findOne({ _id: order_id, user: userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        redirectUrl: '/payment-failure'
      });
    }

   
    if (order.status !== 'Pending') {
      const redirectUrl = order.status === 'Confirmed' 
        ? `/order/${order._id}`
        : `/payment-failure/${order._id}`;
      
      return res.status(400).json({
        success: false,
        message: `Order already ${order.status.toLowerCase()}`,
        redirectUrl
      });
    }

    
    await Promise.all(order.orderedItems.map(item =>
      Product.updateOne(
        { 
          _id: item.product, 
          'variants.color': item.variant.color, 
          'variants.storage': item.variant.storage 
        },
        { $inc: { 'variants.$.quantity': -item.quantity } }
      )
    ));
    


   const  updatedOrder = await Order.findOneAndUpdate(
      { _id: order_id, user: userId },
      {
        $set: {
          status: 'Confirmed',
          paymentStatus: 'Paid',
          paymentDate: new Date(),
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        },
        $push: {
          statusHistory: {
            status: 'Confirmed',
            changedAt: new Date(),
            changedBy: 'system'
          }
        }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      orderId: updatedOrder._id,
      redirectUrl: `/payment-success/${updatedOrder._id}`
    });

  } catch (err) {
    console.error("Payment verification error:", err);
    
    if (req.body.order_id) {
      await Order.findByIdAndUpdate(
        req.body.order_id,
        {
          status: 'Failed',
          paymentStatus: 'Failed',
          failureReason: err.message,
          $push: {
            statusHistory: {
              status: 'Failed',
              changedAt: new Date(),
              changedBy: 'system'
            }
          }
        }
      );
    }
    
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      redirectUrl: req.body.order_id 
        ? `/payment-failure/${req.body.order_id}`
        : '/payment-failure'
    });
  }
};

const paymentSuccessPage = async (req,res) => {
  try{
    const orderId = req.params.orderId;
    const order = await Order.findOne({_id: orderId , user: req.session.user?._id});
    if(!order){
      throw new Error('order not found')
    }
    res.render('payment-success',{order})
  }catch(err){
  }
}

const paymentFailurePage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ 
      _id: orderId, 
      user: req.session.user?._id 
    });

    if (!order) throw new Error('Order not found');


    if (order.status === 'Pending') {
      await Order.findByIdAndUpdate(orderId, {
        status: 'Failed',
        paymentStatus: 'Failed',
        failureReason: 'Payment failed or was cancelled'
      });
      order.status = 'Failed'; 
    }

    res.render('payment-failure', { order });
  } catch (error) {
    console.error('Payment failure error:', error);
    res.render('payment-failure', { order: null });
  }
}

const retryRazorpayOrder = async (req, res) => {
  try {
    const { dbOrderId } = req.body;

  
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const userId = req.session.user._id;


    const existingOrder = await Order.findOne({ _id: dbOrderId, user: userId });

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (existingOrder.paymentStatus === 'Paid') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }

    const options = {
      amount: parseInt(existingOrder.finalAmount) * 100, 
      currency: 'INR',
      receipt: 'retry_order_' + Date.now()
    };

    const razorpayOrder = await razorpay.orders.create(options);

 
    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      dbOrderId: existingOrder._id,
      amount: razorpayOrder.amount,
      keyId: process.env.RAZORPAY_ID_KEY,
      currency: razorpayOrder.currency,
      customer: req.session.user
    });

  } catch (err) {
    console.error('Retry Razorpay order failed:', err);
    res.status(500).json({ success: false, message: 'Retry payment failed' });
  }
};


const orderPlaced=async(req,res)=>{
  try {
    res.render('order-placed')
  } catch (error) {
    
  }
}

module.exports = {
  addToCart,
  getCartPage,
  updateCartQuantity,
  deleteCartItem,
  postCartToCheckout,
  getCheckoutPage,
  cartNewAddresses,
  postCheckoutToPayment,
  getCartPayment,
  postPaymentToOrder,
  orderPlaced,
  applyCoupon,
  removeCoupon,
  createRazorpayOrder,
  paymentSuccessPage,
  verifyRazorPayOrder,
  paymentFailurePage,
  retryRazorpayOrder
};

