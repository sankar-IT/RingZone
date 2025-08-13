
const Address=require('../../models/addressSchema');
const Order=require('../../models/orderSchema');
const Cart=require('../../models/cartSchema')
const Product=require('../../models/productsSchema');
const razorpay=require('../../config/razorpay');
require('dotenv').config();
const Coupon = require('../../models/couponSchema');
const crypto = require('crypto');



const confirmOrder = async (req, res) => {
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

const OrderConfirmation=async(req,res)=>{
  try {
    res.render('order-placed')
  } catch (error) {
    
  }
}


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


    await Cart.deleteOne({ user: userId });
    delete req.session.selectedShipment;
    delete req.session.selectedAddress;
    delete req.session.appliedCoupon;

    const options = {
      amount: Math.round(finalAmount * 100), 
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now()
    };



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

module.exports = {
  confirmOrder,
  OrderConfirmation,
  createRazorpayOrder,
  verifyRazorPayOrder,
  paymentSuccessPage,
  paymentFailurePage,
  retryRazorpayOrder
};
