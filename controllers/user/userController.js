const User = require('../../models/userSchema');
const Category=require('../../models/categorySchema')
const product=require('../../models/productsSchema')
const Wallet = require('../../models/walletSchema');
const Wishlist=require('../../models/wishlistSchema');
const nodemailer = require('nodemailer');
const { getUniqueReferralCode } = require('../../helpers/referral');
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
    // const categories = await Category.find({ islisted: true });
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

     const wishlist = await Wishlist.findOne({ userId: user._id });
     res.locals.wishlistLength = wishlist ? wishlist.products.length : 0;
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



const loadSignup = async (req, res) => {
  try {
    res.render('signup');
  } catch (error) {

    res.status(500).send('server error');
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


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


const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error('Password hash error', error);
    throw error;
  }
};


const signup = async (req, res) => {
  const { email, password, confirmPassword, firstName, lastName, phone,referralCode } = req.body;

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
      phone,
      referralCode
    };

    res.render('verify-otp');
  } catch (error) {
    console.error('Signup error', error);
    res.redirect('/pageNotFound');
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp == req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);
      const referralCode = await getUniqueReferralCode();

      const newUser = new User({
        firstname: user.firstName,
        lastname: user.lastName,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
        referralCode,
        usedReferralCode:  user.referralCode || null, 
        redeemed: false
      });

      await newUser.save();

      await Wallet.create({
        user: newUser._id,
        balance: 0,
        transactions: []
      });

      if (user.referralCode) {
        const referrer = await User.findOne({ referralCode: user.referralCode });

        if (
          referrer &&
          !newUser.redeemed &&
          referrer._id.toString() !== newUser._id.toString()
        ) {
          const referrerWallet = await Wallet.findOne({ user: referrer._id });
          const newUserWallet = await Wallet.findOne({ user: newUser._id });

          if (referrerWallet && newUserWallet) {
           
            referrerWallet.balance += 100;
            newUserWallet.balance += 100;

            
            referrerWallet.transactions.push({
              type: 'credit',
              amount: 100,
              description: `Referral bonus from ${newUser.firstname}`
            });

            newUserWallet.transactions.push({
              type: 'credit',
              amount: 100,
              description: `Referral bonus using ${referrer.firstname}'s code`
            });

            
            await referrerWallet.save();
            await newUserWallet.save();

            
            newUser.redeemed = true;
            await newUser.save();
          }
        }
      }

      
      req.session.user = newUser;

      return res.status(200).json({
        success: true,
        message: 'OTP verified and user registered successfully',
        redirectUrl: '/'
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP, Please try again'
      });
    }

  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during OTP verification'
    });
  }
};


//googleAuth

const googleCallBack=async(req,res)=>{
  try {
     if (req.user.isBlocked) {
    return res.redirect('/login?error=blocked');
  }
  req.session.user = req.user;
  res.redirect('/');
  } catch (error) {
    
  }
}


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

    // Check if user is blocked
    if (userData?.isBlocked) {
      req.session.user = null;
      return res.redirect('/login?error=blocked');
    }

    // Cart count
    const cart = await Cart.findOne({ user: user?._id });
    if (cart) res.locals.cartCount = cart.items?.length;

    // Get only listed categories and unblocked brands
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    // Filters from query params
    const selectedCategory = req.query.category || null;
    const selectedBrand = req.query.brand || null;
    const gt = req.query.gt ? parseInt(req.query.gt) : null;
    const lt = req.query.lt ? parseInt(req.query.lt) : null;
    const search = req.query.search || "";
    const sort = req.query.sort || "latest";
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    // Prepare base query
    const query = {
      isBlocked: false,
      variants: { $elemMatch: { quantity: { $gt: 0 } } }
    };

    // Ensure category is listed
    const listedCategoryIds = categories.map(cat => cat._id);
    if (selectedCategory) {
      query.category = { $in: listedCategoryIds, $eq: selectedCategory };
    } else {
      query.category = { $in: listedCategoryIds };
    }

    // Ensure brand is not blocked
    const listedBrandIds = brands.map(br => br._id);
    if (selectedBrand) {
      query.brand = { $in: listedBrandIds, $eq: selectedBrand };
    } else {
      query.brand = { $in: listedBrandIds };
    }

    // Search filter
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    // Fetch products
    let products = await product.find(query)
      .populate('brand')
      .populate('category')
      .lean();

    // Apply offers
    products.forEach(prod => {
      const categoryOffer = prod.category?.categoryOffer || 0;
      const productOffer = prod.offer || 0;
      const finalOffer = Math.max(categoryOffer, productOffer);

      prod.variants = prod.variants.map(variant => {
        const basePrice = Number(variant.regularPrice) || 0;
        let finalPrice = basePrice;

        if (finalOffer > 0) {
          finalPrice = Math.floor(basePrice - (basePrice * finalOffer / 100));
        } else if (variant.discountPrice && variant.discountPrice < basePrice) {
          finalPrice = variant.discountPrice;
        }

        return {
          ...variant,
          finalPrice,
          appliedOffer: finalOffer
        };
      });
    });

    // Price range filter
    if (gt !== null && lt !== null) {
      products = products.filter(prod => {
        const variantPrice = prod.variants[0]?.finalPrice || 0;
        return variantPrice >= gt && variantPrice <= lt;
      });
    }

    // Sorting
    if (sort === "price_asc") {
      products.sort((a, b) => (a.variants[0]?.finalPrice || 0) - (b.variants[0]?.finalPrice || 0));
    } else if (sort === "price_desc") {
      products.sort((a, b) => (b.variants[0]?.finalPrice || 0) - (a.variants[0]?.finalPrice || 0));
    } else {
      products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Pagination
    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / limit);
    products = products.slice(skip, skip + limit);

    // Render page
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

   
    const query = {
      isBlocked: false,
      'variants.quantity': { $gt: 0 }
    };

   
    query['variants.discountPrice'] = { $gt: minPrice };
    if (maxPrice !== Infinity) {
      query['variants.discountPrice'].$lt = maxPrice;
    }

    if (categoryId) {
      query.category = new mongoose.Types.ObjectId(categoryId);
    }
    if (brandId) {
      query.brand = new mongoose.Types.ObjectId(brandId);
    }

    
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

      const cart = await Cart.findOne({ user: userData._id });
      if (cart) res.locals.cartCount = cart.items?.length;

      res.locals.user = userData;
    }

  
    const productId = req.params.id;
    let productRes = await product.findById(productId)
      .populate('brand')
      .populate('category')
      .lean();

    if (!productRes) {
      return res.status(404).render('page-404');
    }

    if (productRes.isBlocked) {
      return res.redirect('/shopping-pageList');
    }

   
    const categoryOffer = productRes.category?.categoryOffer || 0;
    const productOffer = productRes.offer || 0;
    const finalOffer = Math.max(categoryOffer, productOffer);

    productRes.variants = productRes.variants.map(variant => {
      const basePrice = Number(variant.regularPrice) || 0;
      let finalPrice = basePrice;

      if (finalOffer > 0) {
        finalPrice = Math.floor(basePrice - (basePrice * finalOffer / 100));
      } else if (variant.discountPrice && variant.discountPrice < basePrice) {
        finalPrice = variant.discountPrice;
      }

      return {
        ...variant,
        finalPrice,
        appliedOffer: finalOffer
      };
    });

   
    let similarProducts = await product.find({
      _id: { $ne: productId },
      category: productRes.category._id,
      isBlocked: false
    }).limit(4).populate('brand').populate('category').lean();

    let relatedProducts = await product.find({
      _id: { $ne: productId },
      brand: productRes.brand._id,
      isBlocked: false
    }).limit(4).populate('brand').populate('category').lean();

    
    similarProducts = similarProducts.map(prod => {
      const catOffer = prod.category?.categoryOffer || 0;
      const prodOffer = prod.offer || 0;
      const finalOffer = Math.max(catOffer, prodOffer);

      prod.variants = prod.variants.map(variant => {
        const basePrice = Number(variant.regularPrice) || 0;
        let finalPrice = basePrice;

        if (finalOffer > 0) {
          finalPrice = Math.floor(basePrice - (basePrice * finalOffer / 100));
        } else if (variant.discountPrice && variant.discountPrice < basePrice) {
          finalPrice = variant.discountPrice;
        }

        return {
          ...variant,
          finalPrice,
          appliedOffer: finalOffer
        };
      });

      return prod;
    });

   relatedProducts = relatedProducts.map(prod => {
      const catOffer = prod.category?.categoryOffer || 0;
      const prodOffer = prod.offer || 0;
      const finalOffer = Math.max(catOffer, prodOffer);

      prod.variants = prod.variants.map(variant => {
        const basePrice = Number(variant.regularPrice) || 0;
        let finalPrice = basePrice;

        if (finalOffer > 0) {
          finalPrice = Math.floor(basePrice - (basePrice * finalOffer / 100));
        } else if (variant.discountPrice && variant.discountPrice < basePrice) {
          finalPrice = variant.discountPrice;
        }

        return {
          ...variant,
          finalPrice,
          appliedOffer: finalOffer
        };
      });

      return prod;
    });

    
    res.render('Product-details', { 
      product: productRes, 
      similarProducts,
      relatedProducts,
    });

  } catch (error) {
    console.error("Product details error:", error.message);
    res.status(500).render('page-500');
  }
};

const checkProductStatus = async (req, res) => {
  try {
   
    if (!req.params.id) {

      return res.status(400).json({ error: "Product ID is required", active: false });
    }
    
    const products = await product.findById(req.params.id).lean();

    
    if (!products) {
      return res.json({ active: false, message: "Product not found" });
    }
    
    if (products.isBlocked) {
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
  googleCallBack,
  loadLogin,
  pageNotFound,
  login,
  logout,
  loadShoppingPage,
  filterProduct,
  filterByPrice,
  loadProductDetails,
  checkProductStatus,

};