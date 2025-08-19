const express=require('express')
const router=express.Router();
const adminController=require('../controllers/admin/adminController')
const customerController=require('../controllers/admin/customerController')
const categoryController=require('../controllers/admin/categoryController')
const brandController=require('../controllers/admin/brandController')
const productController=require('../controllers/admin/productController');
const orderController=require('../controllers/admin/orderController');
const couponController=require('../controllers/admin/couponController');
const salesController=require('../controllers/admin/salesController');
const {userAuth,adminAuth}=require('../middleware/auth');
const multer=require('multer');
const storage=require('../helpers/multer');
const upload = require('../helpers/multer');
const Order = require('../models/orderSchema');


//login Mangement
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout)


//customer management
router.get('/users',adminAuth,customerController.customerInfo);
router.get('/blockCustomer',adminAuth,customerController.customerBlocked)
router.get('/unblockCustomer',adminAuth,customerController.customerUnBlocked)


//category Management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.post('/addCategoryOffer',adminAuth,categoryController.addCategoryOffer)
router.post('/removeCategoryOffer',adminAuth,categoryController.removeCategoryOffer);
router.get('/listcategory',adminAuth,categoryController.getListCategory);
router.get('/unlistcategory',adminAuth,categoryController.getUnlistCategory);
router.get('/editcategory',adminAuth,categoryController.getEditCategory);
router.post('/editCategory/:id',adminAuth,categoryController.editCategory);



//brand Management
router.get('/brands',adminAuth,brandController.getBrandPage);
router.post('/addBrand',adminAuth,storage.uploadCategory.single('image'),brandController.addBrand);
router.get('/blockBrand',adminAuth,brandController.blockBrand)
router.get('/unBlockBrand',adminAuth,brandController.unBlockBrand)




//Product Management
router.get('/product-add',adminAuth,productController.getProductPage);
router.post('/addProduct', storage.uploadProduct.any(), productController.addProduct);
router.get('/productlist',adminAuth,productController.addProductList);
router.post('/product-toggle/:id',adminAuth,productController.productBlock);
router.get('/product-edit/:id',adminAuth,productController.editProduct);
router.post('/product-edit/:id',adminAuth,storage.uploadProductEdit,productController.updateProduct)
router.post('/addProductOffer/:productId', adminAuth, productController.addProductOffer);
router.post('/removeProductOffer/:productId', adminAuth, productController.removeProductOffer);


//sale management
router.get('/sales-report',adminAuth,salesController.loadSalesPage)




//order management
router.get('/orders-list',adminAuth,orderController.ordersList);
router.get('/update-orders/:orderId',adminAuth,orderController.updateOrders);
router.post('/update-order/:orderId',adminAuth,orderController.updateOrdersStatus);
router.post('/update-order-item/:orderId/:itemIdx', adminAuth, orderController.updateItemStatus);
router.post('/approve-return', adminAuth,orderController.approveReturn);
router.post('/reject-return', adminAuth,orderController.rejectReturn);




//coupon management
router.get('/coupon-page', adminAuth, couponController.loadCouponPage);
router.post('/add-coupons', adminAuth, couponController.addCoupons);
router.post('/update-coupon', adminAuth, couponController.updateCoupon);
router.get('/delete-coupon', adminAuth, couponController.deleteCoupon);
router.post('/toggle-coupon-status', adminAuth, couponController.toggleCouponStatus);


module.exports=router;