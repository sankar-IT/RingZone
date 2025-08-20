const express=require('express');
const router=express.Router();
const passport=require('passport');
const userController=require('../controllers/user/userController')
const profileController=require('../controllers/user/profileController');
const cartController=require('../controllers/user/cartController')
const orderController=require('../controllers/user/orderController');
const {initializeCartCount}=require('../middleware/cartMiddleware');
const { userAuth } = require('../middleware/auth');
const { uploadProfile } = require('../helpers/multer');

//middleware

router.use(initializeCartCount);


router.get('/',userController.loadHomepage);
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup);
router.get('/verify', userController.loadOtpPage);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),userController.googleCallBack)
router.get('/login',userController.loadLogin);
router.post('/login',userController.login)
router.get('/logout',userController.logout)
router.get('/page-about',userController.loadAboutpage)
router.get('/shopping-pageList',userAuth,userController.loadShoppingPage);
router.get('/products/:id', userAuth,userController.loadProductDetails);
router.get('/check-product-status/:id',userAuth, userController.checkProductStatus);


//profile management

router.get('/forget-password',profileController.forgetpasspage)
router.post('/forget-email-valid',profileController.forgetEmailValid);
router.post('/verify-passforget-otp',profileController.verifyForgetPassOtp);
router.get('/reset-password',profileController.getResetPassPage);
router.post('/resend-forget-otp',profileController.resendOtp);
router.post('/reset-password',profileController.postNewPassword);
router.get('/user-profile',userAuth,profileController.userProfile);
router.get('/edit-profile',userAuth,profileController.editProfile);
router.post('/update-profile', userAuth,uploadProfile.single('profileImage'),  profileController.updateProfile);
router.get('/user-change-password',userAuth,profileController.loadChangePassword)
router.post('/user-change-password',userAuth,profileController.changePassword)
router.post('/resend-email-verification',userAuth,profileController.userChangeEmail)
router.post('/send-email-verification',userAuth,profileController.userSendEmail)
router.get('/user-wallet',userAuth,profileController.userWallet);

router.post('/create-wallet-order', userAuth, profileController.createWalletOrder);
router.post('/verify-wallet-payment', userAuth, profileController.verifyWalletPayment);

router.get('/wishlist',userAuth,profileController.loadWishListPage)
router.post('/wishlist/toggle', userAuth,profileController.toggleWishlist);


router.get('/view-orders',userAuth,profileController.viewOrders)
router.get('/orders-details/:orderId',userAuth,profileController.orderDetails)
router.get('/order-cancel/:orderId',userAuth,profileController.orderCancel)
router.post('/cancel-item/:orderId/:itemId',userAuth,profileController.cancelItem)
router.get('/download-invoice/:orderId',userAuth,profileController.downloadInvoice)
router.post('/request-return',userAuth,profileController.returnOrder)


//address management
router.get('/user-address',userAuth,profileController.userAddress)
router.get('/add-address',userAuth,profileController.addAddress)
router.post('/add-address',userAuth,profileController.addressAdd)
router.post('/address-dlt', userAuth, profileController.addressDlt);
router.post('/set-default-address/:index', userAuth,profileController.setDefaultAddress);
router.get('/edit-address/:index',userAuth,profileController.editAddress)
router.post('/update-address/:index',userAuth,profileController.updateAddress)



//cart management
router.get('/user-cart',userAuth,cartController.getCartPage);
router.post('/user-cart',userAuth,cartController.addToCart);
router.post('/update-quantity',userAuth,cartController.updateCartQuantity)
router.post('/delete-cart-item',userAuth,cartController.deleteCartItem)
router.post('/checkout',userAuth,cartController.processCheckout)
router.get('/checkout',userAuth,cartController.renderCheckoutPage);
router.post('/add-new-address',userAuth,cartController.addCheckoutAddress)
router.post('/load-payment',userAuth,cartController.proceedToPayment)
router.get('/load-payment',userAuth,cartController.renderPaymentPage)
router.post('/apply-coupon', userAuth,cartController.applyCoupon);
router.post('/remove-coupon',userAuth,cartController.removeCoupon);
router.get('/wallet/balance', userAuth, cartController.checkWalletBalance);



//order management
router.post('/place-order',userAuth,orderController.confirmOrder)
router.post('/place-order/wallet',userAuth,orderController.placeOrderWithWallet);

router.get('/order-placed',userAuth,orderController.OrderConfirmation)
router.post('/create-razorpay-order',userAuth, orderController.createRazorpayOrder);
router.post('/verify-razorpay-payment',userAuth, orderController.verifyRazorPayOrder);
router.get('/payment-success/:orderId' ,userAuth, orderController.paymentSuccessPage );
router.get('/payment-failure/:orderId',userAuth,  orderController.paymentFailurePage);
router.post('/retry-payment', userAuth, orderController.retryRazorpayOrder);


module.exports=router;