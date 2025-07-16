const express=require('express')
const router=express.Router();
const adminController=require('../controllers/admin/adminController')
const customerController=require('../controllers/admin/customerController')
const categoryController=require('../controllers/admin/categoryController')
const brandController=require('../controllers/admin/brandController')
const productController=require('../controllers/admin/productController');
const orderController=require('../controllers/admin/orderController');
const couponController=require('../controllers/admin/couponController');
const {userAuth,adminAuth}=require('../middleware/auth');
const multer=require('multer');
const storage=require('../helpers/multer');
const upload = require('../helpers/multer');
const Order = require('../models/orderSchema');



router.get('/pageerror',adminController.pageerror);
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
router.get('/deleteBrand',adminAuth,brandController.deleteBrand)

//Product Management
router.get('/product-add',adminAuth,productController.getProductPage);
router.post('/addProduct', storage.uploadProduct.any(), productController.addProduct);
router.get('/productlist',adminAuth,productController.addProductList);
router.post('/product-toggle/:id',adminAuth,productController.productBlock);
router.get('/product-edit/:id',adminAuth,productController.editProduct);
router.post('/product-edit/:id',adminAuth,storage.uploadProductEdit,productController.updateProduct)

//order management

router.get('/orders-list',adminAuth,orderController.ordersList);
router.get('/update-orders/:orderId',adminAuth,orderController.updateOrders);
router.post('/update-order/:orderId',adminAuth,orderController.updateOrdersStatus);
router.post('/approve-return', adminAuth,orderController.approveReturn);
router.post('/reject-return', adminAuth,orderController.rejectReturn);



//coupon management


router.get('/coupon-page', adminAuth, couponController.loadCouponPage);
router.post('/add-coupons', adminAuth, couponController.addCoupons);
router.post('/update-coupon', adminAuth, couponController.updateCoupon);
router.get('/delete-coupon', adminAuth, couponController.deleteCoupon);
router.post('/toggle-coupon-status', adminAuth, couponController.toggleCouponStatus);










router.patch('/update-order/:orderId', async (req, res) => {
  try {

    const order = await Order.findById(req.params.orderId);

    order.status = req.body.status

    const orderItems = order.orderedItems.map((itm)=> {
      itm.status = req.body.status
    });


    await order.save();


    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order status updated', order });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/update-order-item/:orderId/:itemIdx', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const idx = parseInt(req.params.itemIdx, 10);
    if (isNaN(idx) || idx < 0 || idx >= order.orderedItems.length)
      return res.status(400).json({ message: 'Invalid item index' });

    order.orderedItems[idx].status = req.body.status;
    await order.save();
    res.json({ message: 'Item status updated', order });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});





module.exports=router;