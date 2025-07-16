const Order=require('../../models/orderSchema')
const Brand=require('../../models/brandSchema')
const Product=require('../../models/productsSchema')
const Category = require('../../models/categorySchema');
const Coupon = require('../../models/couponSchema');

const loadCouponPage = async (req, res) => {
  try {
    const coupons = await Coupon.find({}); 
    res.render('coupons', { coupons });   
  } catch (error) {
    console.error('Error loading coupon page:', error);
    res.status(500).send('Internal Server Error');
  }
};

const addCoupons = async (req, res) => {
  try {
    const {
      couponCode,
      discountPercent,
      maxDiscountAmount,
      minimumOrderAmount,
      maxUsageCount,
      userType,
      expiryDate,
      active,
      usageCount,
      instruction
    } = req.body;
 
    const existing = await Coupon.findOne({ couponCode });
    if (existing) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    if (discountPercent > 90) {
      return res.status(400).json({ error: 'Discount percentage must be 90% or less' });
    }

    const newCoupon = new Coupon({
      couponCode,
      discountPercent,
      maxDiscountAmount,
      minimumOrderAmount,
      maxUsageCount,
      userType,
      expiryDate,
      instruction,
      active: active === 'on',
      usageCount: usageCount || 0
    });
    await newCoupon.save();

    res.status(200).json({ message: 'Coupon added successfully' });
  } catch (error) {
    console.error('Error adding coupon:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const {
      couponId,
      couponCode,
      discountPercent,
      maxDiscountAmount,
      minimumOrderAmount,
      maxUsageCount,
      userType,
      expiryDate,
      instruction,
      active
    } = req.body;
    console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%')
    console.log(req.body)

    await Coupon.findByIdAndUpdate(couponId, {
      couponCode,
      discountPercent,
      maxDiscountAmount,
      minimumOrderAmount,
      maxUsageCount,
      userType,
      expiryDate,
      instruction,
      active: active === 'on'
    });

    res.status(200).json({ message: 'Coupon updated successfully' });
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).redirect('/pageerror');
    }

    await Coupon.deleteOne({ _id: id });
    res.redirect('/admin/coupon-page');
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).redirect('/pageerror');
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId, active } = req.body;
    
    await Coupon.findByIdAndUpdate(couponId, { active });
    res.status(200).json({ message: 'Coupon status updated' });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  loadCouponPage,
  addCoupons,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus
};