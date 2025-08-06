const User = require('../../models/userSchema');
const Address=require('../../models/addressSchema');
const Order=require('../../models/orderSchema');
const Cart=require('../../models/cartSchema')
const Wallet=require('../../models/walletSchema');
const Product=require('../../models/productsSchema')
const Wishlist=require('../../models/wishlistSchema')
const PDFDocument = require('pdfkit');
const { addTable } = require('pdfkit-table');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs'); 
require('dotenv').config();
const session = require('express-session');
const { default: mongoose } = require('mongoose');

function generateOtp() {
  const digits = '1234567890';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}
const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      }
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: 'RingoZne Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">RingoZne Password Reset</h2>
          <p>Your OTP code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};


const securePassword = async (password) => {
  return await bcrypt.hash(password, 10);
};


const forgetpasspage = async (req, res) => {
  try {
    res.render('forget-password');
  } catch (error) {
    console.error(error);
    res.redirect('/error');
  }
};

const forgetEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('forget-password', { 
        message: 'Email not found' 
      });
    }

    const otp = generateOtp();
    req.session.otp = otp;
    req.session.email = email;
    req.session.otpExpires = Date.now() + 600000; 
    
    const emailSent = await sendVerificationEmail(email, otp);
    
    if (emailSent) {
      res.render('forgetPass-otp', { email });
    } else {
      res.render('forget-password', { 
        message: 'Failed to send OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error(error);
    res.redirect('/error');
  }
};

const verifyForgetPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const { email, otp: sessionOtp, otpExpires } = req.session;

    if (!sessionOtp || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session expired. Please try again.' 
      });
    }

    if (Date.now() > otpExpires) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Please request a new one.' 
      });
    }

    if (otp === sessionOtp) {
      req.session.otpVerified = true;
      return res.json({ 
        success: true, 
        redirectUrl: '/reset-password' 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

const getResetPassPage = async (req, res) => {
  try {
    if (!req.session.otpVerified || !req.session.email) {
      return res.redirect('/forget-password');
    }
    res.render('reset-password', { email: req.session.email });
  } catch (error) {
    console.error(error);
    res.redirect('/error');
  }
};

const postNewPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { email, otpVerified } = req.session;

    if (!otpVerified || !email) {
      return res.redirect('/forget-password');
    }

    if (password !== confirmPassword) {
      return res.render('reset-password', { 
        email,
        message: 'Passwords do not match' 
      });
    }

    const hashedPassword = await securePassword(password);
    await User.updateOne({ email }, { password: hashedPassword });

    req.session.destroy();
    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.redirect('/error');
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session;
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session expired' 
      });
    }

    const otp = generateOtp();
    req.session.otp = otp;
    req.session.otpExpires = Date.now() + 600000; // 10 minutes

    const emailSent = await sendVerificationEmail(email, otp);
    
    if (emailSent) {
      res.json({ success: true });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to resend OTP' 
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};


const userProfile=async(req,res)=>{
  try {
    const userId=req.session.user._id;
    const userData=await User.findById(userId);
     const cart = await Cart.findOne({ user: userId });
    if (cart) {
      res.locals.cartCount = cart.items?.length || 0;
    } else {
      res.locals.cartCount = 0;
    }
    const addressData=await Address.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      const ordersCount = await Order.countDocuments({ user: userId});
     const addressCount = addressData ? addressData.addresses.length : 0;
    res.render('user-profile',{user: userData, userAddress:addressData,ordersCount, addressCount, cartCount: res.locals.cartCount})
  } catch (err) {
  
    
    res.json(err)
  }
}


const userAddress = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.user;

    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    if (user.isBlocked) {
      req.session.destroy();
      return res.redirect('/login?message=Your account has been blocked');
    }

    req.session.user = {
      _id: user._id,
      firstname: user.firstname,
      email: user.email,
      profileImage: user.profileImage
    };

    const perPage = 4;
    const page = parseInt(req.query.page) || 1;

    const cart = await Cart.findOne({ user: userId });
    res.locals.cartCount = cart ? cart.items?.length || 0 : 0;

    const addressDoc = await Address.findOne({ userId });

    if (!addressDoc || !addressDoc.addresses || addressDoc.addresses.length === 0) {
      return res.render('user-address', {
        addressData: { addresses: [] },
        cartCount: res.locals.cartCount,
        currentPage: 1,
        totalPages: 1,
        user
      });
    }

    const totalAddresses = addressDoc.addresses.length;
    const totalPages = Math.ceil(totalAddresses / perPage);

    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalAddresses);
    const paginatedAddresses = addressDoc.addresses.slice(startIndex, endIndex);

    res.render('user-address', {
      addressData: { addresses: paginatedAddresses },
      currentPage: page,
      totalPages,
      user
    });

  } catch (error) {
    console.error('Error in userAddress:', error);
    res.redirect('/pageNotFound');
  }
};



const addAddress = async (req, res) => {
  try {
    const userId=req.session.user._id;
    const success = req.session.addressSuccess;
    req.session.addressSuccess = null; 
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      res.locals.cartCount = cart.items?.length || 0;
    } else {
      res.locals.cartCount = 0;
    }
    res.render('add-address', { addressSuccess: success, cartCount: res.locals.cartCount });
  } catch (error) {
    res.render('pageNotFound');
  }
};

const addressAdd = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      address,
      pinCode,
      city,
      state,
      country,
      addressType,
      isDefault
    } = req.body;

    const userId = req.session.user?._id || req.session.user;
    if (!userId) return res.status(401).send("User not logged in");

    const newAddress = {
      firstName,
      lastName,
      phone,
      address,
      pinCode,
      city,
      state,
      country,
      addressType,
      isDefault
    };

    let addressDoc = await Address.findOne({ userId });

    if (!addressDoc) {
      addressDoc = new Address({
        userId,
        addresses: [newAddress]
      });
    } else {
      if (isDefault && addressDoc.addresses?.length > 0) {
        addressDoc.addresses.forEach(addr => addr.isDefault = false);
      }
      addressDoc.addresses.push(newAddress);
    }

    await addressDoc.save();

    req.session.addressSuccess = true;  
    res.redirect('/add-address');      
  } catch (error) {
    console.error("Error saving address:", error);
    res.status(500).send("Something went wrong");
  }
};



const editProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
      const cart = await Cart.findOne({ user: userId });
    if (cart) {
      res.locals.cartCount = cart.items?.length || 0;
    } else {
      res.locals.cartCount = 0;
    }
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }
    
    res.render('edit-profile', { 
      user: user,
      profileImage: user.profileImage || '/images/default-profile.png', cartCount: res.locals.cartCount
    });
  } catch (error) {
    console.error('Error in editProfile:', error);
    res.redirect('/pageNotFound');
  }
};




const addressDlt = async (req, res) => {
  try {
    const { addressId } = req.body; 
    const userId = req.session.user?._id || req.session.user;

    if (!addressId || !userId) {
      return res.status(400).redirect('/pageerror');
    }

    const addressDoc = await Address.findOne({ userId });

    if (!addressDoc) {
      return res.status(404).redirect('/pageerror');
    }

    
    addressDoc.addresses = addressDoc.addresses.filter(
      addr => addr._id.toString() !== addressId
    );

   
    if (addressDoc.addresses.length > 0 && 
        !addressDoc.addresses.some(addr => addr.isDefault)) {
      addressDoc.addresses[0].isDefault = true;
    }

    await addressDoc.save();
    res.redirect('/user-address'); 

  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).redirect('/pageerror');
  }
}
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressIndex = parseInt(req.params.index);
    
   
    const userAddress = await Address.findOne({ userId });
    
   
    if (!userAddress || addressIndex < 0 || addressIndex >= userAddress.addresses.length) {
    
      return res.redirect('/user-address');
    }
    
   
    userAddress.addresses.forEach(addr => {
      addr.isDefault = false;
    });
    userAddress.addresses[addressIndex].isDefault = true; 
    await userAddress.save();
  
    res.redirect('/user-address');
  } catch (error) {
    console.error('Error setting default address:', error);

    res.redirect('/user-address');
  }
};

const editAddress = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const addressIndex = req.params.index;



    
    
    const addressDoc = await Address.findOne({ userId });
    
    if (!addressDoc || !addressDoc.addresses || !addressDoc.addresses[addressIndex]) {
      return res.redirect('/user-address');
    }
    
    const address = addressDoc.addresses[addressIndex];
    
    res.render('edit-address', { 
      address: address, 
      addressIndex: addressIndex,
      user: req.session.user
    });
    
  } catch (error) {
   
    res.redirect('/pageNotFound');
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressIndex = parseInt(req.params.index);
    const {
      firstName,
      lastName,
      phone,
      address,
      pinCode,
      city,
      state,
      addressType,
      isDefault
    } = req.body;

    
    const addressDoc = await Address.findOne({ userId });

    if (!addressDoc || addressIndex < 0 || addressIndex >= addressDoc.addresses.length) {
      return res.redirect('/user-address');
    }

    
    addressDoc.addresses[addressIndex] = {
      firstName,
      lastName,
      phone,
      address,
      pinCode,
      city,
      state,
      addressType,
      isDefault: isDefault === 'true',
      updatedAt: Date.now()
    };

    if (isDefault === 'true') {
      addressDoc.addresses.forEach((addr, index) => {
        if (index !== addressIndex) addr.isDefault = false;
      });
    }

    await addressDoc.save();

    res.redirect('/user-address');
  } catch (error) {
    console.error('Error updating address:', error);
    res.redirect('/user-address');
  }
};



const updateProfile = async (req, res) => {
  try {
    
    const userId = req.session.user._id;
    const { fname, lname, dob } = req.body;
    
    const updateData = {
      firstname: fname,
      lastname: lname,
      dob: dob ? new Date(dob) : null
    };
    
    if (req.file) {
      updateData.profileImage = '/uploads/profile/' + req.file.filename;
      
      const user = await User.findById(userId);
      if (user.profileImage && !user.profileImage.includes('default-profile')) {
        const oldImagePath = path.join(__dirname, '../public', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

    }
    
    await User.findByIdAndUpdate(userId, updateData);
    
    
    res.redirect('/edit-profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    
    res.redirect('/edit-profile');
  }
};


const loadChangePassword = async (req, res) => {
  try {
    res.render('user-change-password', { 
      title: 'Change Password',
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error loading password change page:', error);
    res.status(500).render('pageNotFound');
  }
};


const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user?._id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect current password' });

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};



const userChangeEmail = async (req, res) => {
  const { newEmail, verificationCode } = req.body;


  

  if (!req.session.emailVerification || 
      req.session.emailVerification.code !== verificationCode ||
      req.session.emailVerification.newEmail !== newEmail) {
    return res.status(400).json({ success: false, error: 'Invalid verification code' });
  }

  await User.findByIdAndUpdate(req.session.user._id, { email: newEmail });


  
  delete req.session.emailVerification;

  res.status(200).json({ success: true });
};

const userSendEmail = async (req, res) => {
  const { newEmail, currentPassword } = req.body;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const user = await User.findById(req.session.user?._id);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

  
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const emailExists = await User.findOne({ 
      email: { $regex: new RegExp(`^${newEmail}$`, 'i') } 
    });

    if (emailExists) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    if (req.session.emailVerification) {
      delete req.session.emailVerification;
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.emailVerification = {
      code: verificationCode,
      newEmail: newEmail,
      expiresAt: Date.now() + 15 * 60 * 1000 
    };

    console.log(verificationCode)
   
    await sendVerificationEmails(newEmail, verificationCode);
    console.log(verificationCode);

    return res.status(200).json({ 
      success: true,
      tempCode: verificationCode 
    });

  } catch (error) {
   
    res.status(500).json({ error: 'Failed to process email change' });
  }
};

async function sendVerificationEmails(email, code) {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.NODEMAILER_EMAIL,  
      pass: process.env.NODEMAILER_PASSWORD 
    },
    pool: true, 
    maxConnections: 1
  });

  await transporter.sendMail({
    from: `"Your App" <${process.env.NODEMAILER_EMAIL}>`, 
    to: email,
    subject: 'Email Change Verification',
    html: `
      <h2>Email Verification</h2>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `
  });
}



const addCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { productId, variant, quantity = 1 } = req.body;
    const userId = req.user._id;

    
    const product = await Product.findById(productId).session(session);
    if (!product || product.isBlocked) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Product unavailable' });
    }

    const productVariant = product.variants.find(v => 
      v.color === variant.color && 
      v.storage === variant.storage
    );

    if (!productVariant || productVariant.quantity < 1) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Variant unavailable' });
    }


    let cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    
    const existingItemIndex = cart.items.findIndex(item =>
      item.product.equals(productId) &&
      item.variant.color === variant.color &&
      item.variant.storage === variant.storage
    );

    if (existingItemIndex >= 0) {
     
      cart.items[existingItemIndex].quantity += quantity;
    } else {
     
      cart.items.push({
        product: productId,
        variant: {
          color: variant.color,
          storage: variant.storage,
          selectedImage: variant.selectedImage || productVariant.images[0]
        },
        quantity,
        price: productVariant.regularPrice,
        discountPrice: productVariant.discountPrice
      });
    }

   
    await cart.save({ session });
    await session.commitTransaction();

  
    const updatedCart = await Cart.findById(cart._id)
      .populate('product', 'productName images')
      .session(session);

    res.json({
      success: true,
      cartCount: updatedCart.totalItems,
      subTotal: updatedCart.subTotal,
      cart: updatedCart
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  } finally {
    session.endSession();
  }
};

const viewOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 5; 

    const user = await User.findById(userId);
    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / limit);
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      res.locals.cartCount = cart.items?.length || 0;
    } else {
      res.locals.cartCount = 0;
    }
    const orders = await Order.find({ user: userId })
      .populate('orderedItems.product')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
      

    res.render('view-orders', { 
      user, 
      orders,
      currentPage: page,
      totalPages,
       cartCount: res.locals.cartCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Internal server error');
  }
};

const orderDetails = async (req, res) => {

  try {
    const userId = req.session.user._id;
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
      .populate('user')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }
    
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      res.locals.cartCount = cart.items?.length || 0;
    } else {
      res.locals.cartCount = 0;
    }

    res.render('orders-details', { order, cartCount: res.locals.cartCount }); 
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).send('Internal Server Error');
  }
};

const orderCancel=async(req,res)=>{
  try {
   const orderId = req.params.orderId
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    order.status = 'Cancelled';
    await order.save();

    res.json({ success: true, message: 'Order status updated to cancelled' });
    
  } catch (error) {

    res.status(500).json({ success: false, message: 'Server error' });
  }
}


const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId).populate('coupon');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.orderedItems.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in order' });

    if (item.status === 'Cancelled')
      return res.status(400).json({ success: false, message: 'Item is already cancelled' });

    if (!['Pending', 'Processing', 'Confirmed'].includes(order.status))
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });

    item.status = 'Cancelled';
    const allActiveItems = order.orderedItems.filter(i => i.status !== 'Cancelled');
    const originalAllItems = order.orderedItems; 
    
    if(order.orderedItems.every(itm => itm.status == 'Cancelled')){
      order.status = 'Cancelled'
    }
    await order.save();
    
    const totalItemsPrice = originalAllItems.reduce(
      (sum, itm) => sum + itm.price * itm.quantity, 0);

    const itemPrice = item.price * item.quantity;

    let refundAmount = itemPrice;
    let couponDiscount = 0;
    if (order.coupon && order.coupon.discountAmount > 0) {
      const totalCoupon = order.coupon.discountAmount;
      const itemShare = (itemPrice / totalItemsPrice) * totalCoupon;
      refundAmount = Math.floor(itemPrice - itemShare);
      
    }
    let wallet = await Wallet.findOne({ user: order.user });
    if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, transactions: [] });

    wallet.balance += refundAmount;
    wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
      description: `Refund for cancelled item in Order  ORD${( order._id).toString().substring(0,8).toUpperCase()} `
    });
    await wallet.save();
    await order.save();

  await Product.updateOne(
  {
    _id: item.product,
    'variants.color': item.variant.color,
    'variants.storage': item.variant.storage
  },
  {
    $inc: { 'variants.$.quantity': item.quantity }
  }
);
    return res.status(200).json({
      success: true,
      message: 'Item cancelled and net amount credited to wallet',
      itemStatus: item.status,
      refundAmount,
      walletBalance: wallet.balance,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('address'); 

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    doc.pipe(res);
    doc
      .fontSize(24)
      .fillColor('#ff7f50')
      .text(' RingZone', { align: 'center' })
      .moveDown(0.3);

    doc
      .fontSize(18)
      .fillColor('#000')
      .text('INVOICE', { align: 'center' })
      .moveDown();

    doc
      .fontSize(12)
      .fillColor('#000')
      .font('Helvetica')
      .text(`Order ID: ${order.orderId}`)
      .text(`Order Date: ${order.createdOn.toLocaleString()}`)
      .text(`Status: ${order.status}`)
      .moveDown();

    const addr = order.address; 
    if (addr) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Shipping Address:', { underline: true })
        .font('Helvetica')
        .text(`Name: ${addr.name}`)
        .text(`Phone: ${addr.phone}`)
        .text(`Address: ${addr.address}, ${addr.state}`)
        .moveDown();
    }

    const tableTop = doc.y;
    const itemX = 50;
    const columns = {
      sn: itemX,
      product: itemX + 40,
      variant: itemX + 200,
      quantity: itemX + 300,
      price: itemX + 370,
      total: itemX + 450
    };

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('S/N', columns.sn, tableTop)
      .text('Product', columns.product, tableTop)
      .text('Variant', columns.variant, tableTop)
      .text('Qty', columns.quantity, tableTop)
      .text('Price', columns.price, tableTop)
      .text('Total', columns.total, tableTop);

    doc.moveDown(0.5).font('Helvetica');

    const invoiceItems = order.orderedItems.filter(
      item => ['Delivered', 'Confirmed'].includes(item.status)
    );

    let y = doc.y;
    invoiceItems.forEach((item, index) => {
      const totalItemPrice = item.quantity * item.price;
      doc
        .text(index + 1, columns.sn, y)
        .text(item.product.productName, columns.product, y, { width: 150 })
        .text(`${item.variant.color}, ${item.variant.storage}`, columns.variant, y)
        .text(item.quantity, columns.quantity, y)
        .text(`₹${item.price}`, columns.price, y)
        .text(`₹${totalItemPrice}`, columns.total, y);
      y += 20;
    });

    doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();

    const labelX = 400;
    const valueX = 520;
    const lineHeight = 20;
    let summaryY = y + 30;

    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Subtotal:', labelX, summaryY);
    doc.text(`₹${order.totalPrice}`, valueX, summaryY, { align: 'right' });

    summaryY += lineHeight;
    doc.text('Shipping:', labelX, summaryY);
    doc.text(`₹${order.shipping}`, valueX, summaryY, { align: 'right' });

    summaryY += lineHeight;
    doc.text('Coupon Discount:', labelX, summaryY);
    doc.text(`₹${order.discount || 0}`, valueX, summaryY, { align: 'right' });

    summaryY += lineHeight + 5;
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('Total Amount Paid:', labelX, summaryY);
    doc.text(`₹${order.finalAmount}`, valueX, summaryY, { align: 'right' });
    doc
      .moveDown(2)
      .fontSize(10)
      .fillColor('gray')
      .text('Thank you for shopping with us!', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate invoice');
  }
};



const returnOrder=async(req,res)=>{
  try {
     const { orderId, itemId, reason } = req.body;
    
    await Order.updateOne(
      { _id: orderId, "orderedItems._id": itemId },
      { 
        $set: { 
          "orderedItems.$.status": "Return Requested",
          "orderedItems.$.returnReason": reason,
          "orderedItems.$.returnRequestDate": new Date()
        }
      }
    );
    
    res.json({ success: true });
  } catch (error) {
     res.status(500).json({ success: false, message: error.message });
  }
}

const userWallet = async (req, res) => {
  const userId = req.session.user._id;

  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
  }

  res.render('wallet', { user: req.session.user, wallet });
};

const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const options = { amount: amount * 100, currency: 'INR', receipt: 'wallet_' + Date.now() };
    const order = await razorpay.orders.create(options);

    res.json({ success: true, orderId: order.id, keyId: process.env.RAZORPAY_ID_KEY, amount: order.amount });
  } catch (error) {
    res.json({ success: false, message: 'Failed to create order' });
  }
};

const verifyWalletPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const userId = req.session.user._id;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false, message: 'Invalid signature' });
    }

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) wallet = await Wallet.create({ user: userId });

    wallet.balance += parseFloat(amount);
    wallet.transactions.push({ type: 'credit', amount, description: 'Wallet top-up' });
    await wallet.save();

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: 'Error verifying payment' });
  }
};

const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId, action } = req.body;

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    if (action === 'add') {
      const exists = wishlist.products.some(p => p.productId.toString() === productId);
      if (!exists) {
        wishlist.products.push({ productId });
      }
    } else {
      wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
    }

    await wishlist.save();

    res.status(200).json({
      message: 'Wishlist updated',
      count: wishlist.products.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const loadWishListPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
     const cart = await Cart.findOne({ user: userId });
     const cartCount=cart?.items?.length || 0
    const wishlist = await Wishlist.findOne({ userId }).populate('products.productId');

    res.render('wishlist', { cartCount,  wishlistItems: wishlist?.products || [] });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading wishlist');
  }
};


module.exports = {
  forgetpasspage,
  forgetEmailValid,
  verifyForgetPassOtp,
  getResetPassPage,
  postNewPassword,
  resendOtp,
  userProfile,
  userAddress,
  addAddress,
  addressAdd,
  editProfile,
  addressDlt,
  setDefaultAddress,
  editAddress,
  updateProfile,
  updateAddress,
  loadChangePassword,
  changePassword,
  userChangeEmail,
 userSendEmail,
 addCart,
 viewOrders,
 orderDetails,
 orderCancel,
 cancelItem,
 downloadInvoice,
 returnOrder,
 userWallet,
 createWalletOrder,
 verifyWalletPayment,
 toggleWishlist,
 loadWishListPage
};