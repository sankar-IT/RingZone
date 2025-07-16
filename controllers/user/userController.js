const User = require('../../models/userSchema');
const Category=require('../../models/categorySchema')
const product=require('../../models/productsSchema')
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();
const Brand=require('../../models/brandSchema');
const { default: mongoose } = require('mongoose');
const Order=require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');

const pageNotFound=async(req,res)=>{
  try {
    res.render('page-404')
  } catch (error) {
    res.redirect('/pageNotFound')
  }
}

// Home page 
const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;

    const categories = await Category.find({ islisted: true });

    const productData = await product.find({ isBlocked: false })
                                     .sort({ createdAt: -1 })
                                     .limit(8);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');

    if (user) {
      const userData = await User.findById(user._id);
      if(userData.isBlocked){
        req.session.user = null;
        return res.redirect('/login?error=blocked')
      }

      const cart = await Cart.findOne({ user: user._id  });

      if(cart){
        res.locals.cartCount = cart.items?.length;
      }

      res.locals.user = userData;
      return res.render('home', {
        user: userData,
        products: productData
      });
    }

    return res.render('home', { products: productData });

  } catch (error) {
    console.error('Home page not found', error);
    res.status(500).send('Server error');
  }
};


// Signup page
const loadSignup = async (req, res) => {
  try {
    res.render('signup');
  } catch (error) {

    res.status(500).send('server error');
  }
};

// Generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: `"RingZone Support" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: '👋 Welcome to RingZone – Here’s Your OTP Code',
      text: `Your OTP is ${otp}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
        <div style="text-align: center; padding-bottom: 20px;">
          <h2 style="color: #4A90E2;">Welcome to RingZone!</h2>
          <p style="font-size: 16px; color: #555;">To complete your registration, please use the OTP below:</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background-color: #e6f0ff; padding: 15px 25px; border-radius: 6px; font-size: 28px; font-weight: bold; color: #333; letter-spacing: 3px;">
            ${otp}
          </div>
        </div>
        <p style="font-size: 14px; color: #777; text-align: center;">
          This OTP is valid for the next 10 minutes. Please do not share it with anyone.
        </p>
        <p style="font-size: 13px; color: #aaa; text-align: center; margin-top: 30px;">
          If you didn’t request this email, you can safely ignore it.
        </p>
      </div>
      `
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending email', error);
    return false;
  }
}

// Secure password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error('Password hash error', error);
    throw error;
  }
};

// Signup logic
const signup = async (req, res) => {
  const { email, password, confirmPassword, firstName, lastName, phone } = req.body;

  try {
    if (password !== confirmPassword) {
      return res.render('signup', { message: 'Passwords do not match' });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render('signup', { message: 'Email already exists' });
    }

    const otp = generateOtp();
    console.log("email otp", otp);

    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json('email-error');
    }

    console.log("session otp", otp);
    

    req.session.userOtp = otp;
    req.session.userData = {
      email,
      password,
      firstName,
      lastName,
      phone
    };

    res.render('verify-otp');
  } catch (error) {
    console.error('Signup error', error);
    res.redirect('/pageNotFound');
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (otp == req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const newUser = new User({
        firstname: user.firstName,
        lastname: user.lastName,
        email: user.email,
        phone: user.phone,
        password: passwordHash
      });

      await newUser.save();
      req.session.user = newUser;

     res.status(200).json({ success: true, message: 'OTP verified', redirectUrl: '/' });

    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP, Please try again' });
    }
  } catch (error) {
    console.error('Error verifying OTP', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};


const loadOtpPage = (req, res) => {
  res.render('verify-otp');
};

const resendOtp=async(req,res)=>{
  try {
    
    const{email}=req.session.userData;

    if(!email){
      return res.status(400).json({success:false,message:'email not found in session'})
    }

    const otp=generateOtp();
    req.session.userOtp = otp;

    const emailSent=await sendVerificationEmail(email,otp);

    if(emailSent){
      console.log('Resend OTP:',otp)
      res.status(200).json({success:true,message:'OTP resend Successfully'})
    } else{
      res.status(500).json({success:false,message:'failed to resend otp'})
    }

  } catch (error) {
    
console.error('Error Resending OTP',error)
res.status(500).json({success:false,message:'Internal server error'})
  }
}


const loadLogin=async(req,res)=>{
  try {
    if(!req.session.user){
      return res.render('login')
    }else{
      res.redirect('/')
    }
  } catch (error) {
    res.redirect('pageNotFound')
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render('login', { message: 'User not found' });
    }

    if (findUser.isBlocked) {
      return res.render('login', { message: 'User is blocked by Admin' }); 
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render('login', { message: 'Incorrect Password' });
    }

    req.session.user = findUser;
    res.redirect('/');

  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { message: 'Login failed. Please try again.' });
  }
};

const logout = async (req,res)=>{
  try {
    req.session.user = null;
    res.redirect('/')
  } catch (error) {
  
    res.redirect('/pageNotFound')
  }

}


const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user?._id });


    if(userData?.isBlocked){
      req.session.user = null;
      return res.redirect('/login?error=blocked')
    }
    
    const cart = await Cart.findOne({ user: user._id  });

      if(cart){
        res.locals.cartCount = cart.items?.length;
      }

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });
    const selectedCategory = req.query.category || null;
    const selectedBrand = req.query.brand || null;
    const gt = parseInt(req.query.gt) || 0;
    const lt = parseInt(req.query.lt) || null;
    const search = req.query.search || "";
    const sort = req.query.sort || "latest"; 
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const query = {
      isBlocked: false,
      variants: { $elemMatch: { quantity: { $gt: 0 } } }
    };

    if (selectedCategory) query.category = selectedCategory;
    if (selectedBrand) query.brand = selectedBrand;
    if (gt !== null && lt !== null) {
      query['variants.0.discountPrice'] = { $gte: gt, $lte: lt };
    }

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    // Sorting logic
    let sortOption = {};
    if (sort === "price_asc") sortOption = { 'variants.0.discountPrice': 1 };
    else if (sort === "price_desc") sortOption = { 'variants.0.discountPrice': -1 };
    else sortOption = { createdAt: -1 };

    const products = await product.find(query)
      .populate('brand')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render('shopping-pageList', {
      user: userData || null,
      products,
      category: categories,
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      selectedCategory,
      selectedBrand,
      gt,
      lt,
      search,
      sort
    });
  } catch (error) {
    console.error("Page load error:", error.message);
    res.redirect('/pageNotFound');
  }
};


const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const categoryId = req.query.categories;
    const brandId = req.query.brand;
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    // Build product filter query
    const query = {
      isBlocked: false,
      'variants.quantity': { $gt: 0 }
    };

    if (categoryId) {
      query.category = new mongoose.Types.ObjectId(categoryId);
    }

    if (brandId) {
      query.brand = new mongoose.Types.ObjectId(brandId);
    }

    // Get products with pagination
    const [products, totalProducts, brands, categories] = await Promise.all([
      product.find(query)
        .populate('brand')
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      product.countDocuments(query),
      Brand.find({}).lean(),
      Category.find({ isListed: true }).lean()
    ]);

    const totalPages = Math.ceil(totalProducts / limit);
    const selectedCategory = categoryId ? categories.find(c => c._id.toString() === categoryId) : null;
    const selectedBrand = brandId ? brands.find(b => b._id.toString() === brandId) : null;

    // Update user search history if logged in
    if (user) {
      await User.findByIdAndUpdate(user, {
        $push: {
          searchHistory: {
            category: categoryId || null,
            brand: brandId || null,
            search: new Date()
          }
        }
      });
    }

    res.render('shopping-pageList', {
      user: user ? await User.findById(user).lean() : null,
      products,
      category: categories,
      brand: brands,
      totalPages,
      currentPage: page,
      selectedCategory,
      selectedBrand
    });
  } catch (error) {
    console.error("Error in filterProduct:", error.message);
    res.redirect('/pageNotFound');
  }
};

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const minPrice = parseInt(req.query.gt) || 0;
    const maxPrice = parseInt(req.query.lt) || Infinity;
    const categoryId = req.query.category;
    const brandId = req.query.brand;
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      isBlocked: false,
      'variants.quantity': { $gt: 0 }
    };

    // Price filter
    query['variants.discountPrice'] = { $gt: minPrice };
    if (maxPrice !== Infinity) {
      query['variants.discountPrice'].$lt = maxPrice;
    }

    // Additional filters
    if (categoryId) {
      query.category = new mongoose.Types.ObjectId(categoryId);
    }
    if (brandId) {
      query.brand = new mongoose.Types.ObjectId(brandId);
    }

    // Get data
    const [products, totalProducts, brands, categories] = await Promise.all([
      product.find(query)
        .populate('brand')
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      product.countDocuments(query),
      Brand.find({}).lean(),
      Category.find({ isListed: true }).lean()
    ]);

    const totalPages = Math.ceil(totalProducts / limit);
    const selectedCategory = categoryId ? categories.find(c => c._id.toString() === categoryId) : null;
    const selectedBrand = brandId ? brands.find(b => b._id.toString() === brandId) : null;

    res.render('shopping-pageList', {
      user: user ? await User.findById(user).lean() : null,
      products,
      category: categories,
      brand: brands,
      totalPages,
      currentPage: page,
      selectedCategory,
      selectedBrand,
      gt: minPrice,
      lt: maxPrice !== Infinity ? maxPrice : null
    });

  } catch (error) {
    console.error("Error filtering by price:", error.message);
    res.redirect('/pageNotFound');
  }
};

const loadProductDetails = async (req, res) => {
  try {
  
    if (req.session.user) {
      const userId = req.session.user?._id;
      let userData = null;
      if (userId) {
        userData = await User.findOne({ _id: userId });
      }

      if (userData?.isBlocked) {
        req.session.user = null;
        return res.redirect('/login?error=blocked');
      }
      const cart = await Cart.findOne({ user: userData._id  });

      if(cart){
        res.locals.cartCount = cart.items?.length;
      }
      res.locals.user = userData;
    }


    // Get product details
    const productId = req.params.id;
    const productRes = await product.findById(productId)
      .populate('brand')
      .populate('category');

    if (!productRes) {
      return res.status(404).render('page-404');
    }

    if (productRes.isBlocked) {
      return res.redirect('/shopping-pageList');
    }

    // Get similar & related products
    const similarProducts = await product.find({
      _id: { $ne: productId },
      category: productRes.category,
      isBlocked: false
    }).limit(4).populate('brand');

    const relatedProducts = await product.find({
      _id: { $ne: productId },
      brand: productRes.brand._id,
      isBlocked: false
    }).limit(4).populate('brand');

    // Render the view with all required data
    res.render('Product-details', { 
      product: productRes, 
      similarProducts,
      relatedProducts,
    });

  } catch (error) {
    
    res.status(500).render('page-500'); 
  }
};

const checkProductStatus = async (req, res) => {
  try {
    // First check if ID exists
    if (!req.params.id) {

      return res.status(400).json({ error: "Product ID is required", active: false });
    }

    const product = await Product.findById(req.params.id).lean();

    
    if (!product) {
      return res.json({ active: false, message: "Product not found" });
    }
    
    if (product.isBlocked) {
      return res.json({ active: false, message: "Product is blocked" });
    }
    
    return res.json({ active: true });
  } catch (error) {
    console.error("Error checking product status:", error.message);
    return res.status(500).json({ 
      active: false,
      error: error.message 
    });
  }
};




module.exports = {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  loadOtpPage,
  resendOtp,
  loadLogin,
  pageNotFound,
  login,
  logout,
  loadShoppingPage,
  filterProduct,
  filterByPrice,
  loadProductDetails,
  checkProductStatus
};
