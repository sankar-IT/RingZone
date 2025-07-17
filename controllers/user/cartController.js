const User = require('../../models/userSchema');
const Address=require('../../models/addressSchema');
const Order=require('../../models/orderSchema');
const Cart=require('../../models/cartSchema')
const Product=require('../../models/productsSchema');
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
      v._id.toString() == variantId
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

      const variantMatch = product.variants.find(variant => variant._id == variantId);

      if(variantMatch.quantity  < cart.items[itemIndex].quantity + parseInt(quantity) ) {
        return res.status(400).json({message: 'out of stock', success: false})
      }

      if(cart.items[itemIndex].quantity + parseInt(quantity) > 3){
        return res.status(400).json({success: false , message: 'max cart quantity exceeds' })
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

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      cartCount: cart.items?.length
    });

  } catch (error) {

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


    if (req.session.user) {


      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });
      const addressDoc = await Address.findOne({ userId });

      if (!cart || cart.items.length <= 0) {
        return res.status(404).json({ success: false, message: 'Cart is empty' });
      }

      if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
        return res.status(404).json({ success: false, message: 'Address is empty' });
      }


      res.locals.cartCount = cart.items.length;
      return res.status(200).json({ success: true, redirectUrl: '/checkout' });
    } else {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }
  } catch (error) {
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

    if (coupon.usersUsed.includes(userId)) {
      return res.json({ success: false, message: 'Coupon already used' });
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

    // Save coupon usage
    // coupon.usersUsed.push(userId);
    // coupon.usageCount += 1;
    // await coupon.save();

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

// POST /remove-coupon
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
    if (!cart) return res.redirect('/user-cart');

    let subtotal = 0;
    let discount = req.session.appliedCoupon?.discount || 0;
    console.log(discount);
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
        razorpayKey 
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

        return res.status(200).json({ success: true, redirectUrl: '/load-payment' });
      });
    }
  } catch (error) {
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

    const addressDoc = await Address.findOne({ userId: userId });
    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      return res.status(404).json({ success: false, message: 'Address is empty' });
    }
    
    const shippingCharge = parseInt(req.session.selectedShipment) || 0;
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

    // Get coupon data safely
    const couponData = req.session.appliedCoupon || {};
    const discount = Number(couponData.discount) || 0;
    const couponCode = (couponData.code && typeof couponData.code === 'string') 
      ? couponData.code 
      : null;

    // Validate cart items and calculate totals
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
            return res.status(400).json({ 
              success: false, 
              message: 'Product variant not found' 
            });
          }

          if (matchedVariant.quantity < cartProduct.quantity) {
            return res.status(400).json({ 
              success: false, 
              message: 'Product out of stock' 
            });
          }

          const itemPrice = matchedVariant.discountPrice || matchedVariant.regularPrice;
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
        } else {
          return res.status(400).json({ 
            success: false, 
            message: 'Product unavailable' 
          });
        }
      }
    }

    if (activeItems.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'All products are unavailable' 
      });
    }

    const finalAmount = totalPrice - discount + shippingCharge;

    // Create the order
    const newOrder = await Order.create({
      user: userId,
      orderedItems: activeItems,
      totalPrice,
      discount: discount,
      finalAmount,
      shipping: shippingCharge,
      paymentMethod: 'cod',
      paymentStatus: 'Processing',
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
      status: 'Processing'
    });

    // Update product quantities
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

const createRazorpayOrder=async(req,res)=>{
try {


  if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart is empty' });
    }

    const addressDoc = await Address.findOne({ userId: userId });
    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      return res.status(404).json({ success: false, message: 'Address is empty' });
    }
    
    const shippingCharge = parseInt(req.session.selectedShipment);
    const shippingAddressId = req.session.selectedAddress;


    
    
    const shippingAddress = addressDoc.addresses.find(
      addr => addr._id.toString() == shippingAddressId
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
        if (!dbProduct.isBlocked) {
          const matchedVariant = dbProduct.variants.find(
            v => v.color === cartProduct.variant.color && v.storage === cartProduct.variant.storage
          );

          if (!matchedVariant) {
            return res.status(400).json({ message: 'Product variant not found', success: false });
          }

          if (matchedVariant.quantity < cartProduct.quantity) {
            return res.status(400).json({ message: 'Product out of stock', success: false });
          }

          activeItems.push({
            product: dbProduct._id,
            quantity: cartProduct.quantity,
            price: matchedVariant.discountPrice,
            variant: {
              color: matchedVariant.color,
              storage: matchedVariant.storage,
              selectedImage: matchedVariant.selectedImage,
            }
          });

        } else {
          return res.status(400).json({ success: false, message: 'Product unavailable' });
        }
      }
    }

    if (activeItems.length == 0) {
      return res.status(400).json({ message: 'All products are unavailable' });
    }

    const totalPrice = activeItems.reduce((total, itm) => {
      return total + itm.price * itm.quantity;
    }, 0);

    
    const couponData = req.session.appliedCoupon;

    console.log(req.session.appliedCoupon);
    

    const finalAmount = totalPrice - (couponData.discount || 0) + shippingCharge;

    await Order.create({
      user: userId,
      orderedItems: activeItems,
      totalPrice,
      discount: couponData.discount,
      finalAmount,
      shipping: shippingCharge,
      paymentMethod: 'online',
      paymentStatus: 'Pending',
      address: {
        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        place: shippingAddress.place || 'place',
        state: shippingAddress.state,
        pincode: shippingAddress.pinCode
      },
      cartCount: res.locals.cartCount,
      couponApplied: !!couponData.code,
      coupon: 
        {
            couponCode: (couponData.code && typeof couponData.code === 'string') 
      ? couponData.code 
      : null,
            discountAmount: couponData.discount || 0
          }
      
        
    });

    await Cart.deleteOne({ user: userId });
    delete req.session.selectedShipment;
    delete req.session.selectedAddress;
    delete req.session.appliedCoupon;

    const options = {
      amount: parseInt(finalAmount) * 100, 
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_ID_KEY,
      currency: order.currency,
      customer: req.session.user
    });

} catch (error) {
   console.log(error);
    res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
}
}



const verifyRazorPayOrder = async (req, res) => {
  try {
    // Validate user session
    if (!req.session.user) {
      console.log('Payment verification failed: User not logged in');
      return res.status(401).json({ 
        success: false, 
        message: 'User not logged in',
        redirectUrl: '/login' 
      });
    }

    const userId = req.session.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('Payment verification failed: Missing Razorpay fields');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing payment verification fields' 
      });
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.log('Payment verification failed: Invalid signature');
      return res.status(400).json({ 
        success: false, 
        message: "Invalid signature",
        redirectUrl: '/payment-failed?reason=invalid_signature' 
      });
    }

    let order;
    
    // Try to find order by provided order_id first
    if (order_id) {
      order = await Order.findOne({
        _id: order_id,
        user: userId
      }).populate('orderedItems.product'); // Ensure items are populated if they're references

      if (!order) {
        console.log(`Order not found for ID: ${order_id}`);
        return res.status(404).json({ 
          success: false, 
          message: "Order not found.",
          redirectUrl: '/payment-failed?reason=order_not_found' 
        });
      }
    } else {
      // Fallback to finding latest pending order
      order = await Order.findOne({ 
        user: userId, 
        paymentStatus: 'Pending' 
      }).sort({ createdAt: -1 }).populate('orderedItems.product');

      if (!order) {
        console.log('No pending order found for user:', userId);
        return res.status(404).json({ 
          success: false, 
          message: "No pending order found.",
          redirectUrl: '/payment-failed?reason=no_pending_order' 
        });
      }
    }

    // Validate order items
    if (!order.orderedItems || !Array.isArray(order.orderedItems)) {
      console.log('Invalid items data in order:', order._id);
      return res.status(400).json({ 
        success: false, 
        message: "Invalid order items data",
        redirectUrl: '/payment-failed?reason=invalid_order_data' 
      });
    }

    // Validate order status
    if (order.paymentStatus !== 'Pending') {
      console.log(`Order ${order._id} already processed with status: ${order.paymentStatus}`);
      return res.status(400).json({ 
        success: false, 
        message: "Order already processed",
        redirectUrl: `/order/${order._id}` 
      });
    }

    // Update order with payment details
    order.paymentStatus = 'Paid';
    order.status = 'Processing';
    order.paymentDate = new Date();
    order.razorpayOrderId = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;

    await order.save();

    console.log(`Payment verified successfully for order: ${order._id}`);
    return res.status(200).json({ 
      success: true, 
      message: "Payment verified successfully",
      orderId: order._id,
      redirectUrl: `/payment-success/${order._id}`,
      orderDetails: {
        amount: order.totalAmount,
        items: Array.isArray(order.items) ? order.items.length : 0
      }
    });

  } catch (err) {
    console.error("Error in verifyRazorPayOrder:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Payment verification failed",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      redirectUrl: '/payment-failed?reason=server_error' 
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
  verifyRazorPayOrder
};

