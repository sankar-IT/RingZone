const User=require('../../models/userSchema')
const Order=require('../../models/orderSchema');
const Product=require('../../models/productsSchema')
const mongoose=require('mongoose');
const bcrypt=require('bcrypt');


const pageerror=async(req,res)=>{
  res.render('admin-error')
}

const loadLogin= (req,res)=>{
  if(req.session.admin){
    return res.redirect('/admin/dashboard');
  }
  res.render('adminLogin',{message:null})
}


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);

      if (passwordMatch) {
        req.session.admin = true;
        req.session.adminUser = admin;  

        return res.redirect('/admin/dashboard');
      } else {
        return res.render('adminLogin', { message: 'Incorrect password' });
      }
    } else {
      return res.render('adminLogin', { message: 'Admin not found' });
    }

  } catch (error) {
    return res.redirect('/pageerror');
  }
};


const loadDashboard = async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');

  try {
    res.locals.admin = req.session.admin;
    const userCount = await User.countDocuments({isAdmin:false});
     const orders = await Order.find().populate('user').populate('orderedItems.product').sort({ createdOn: -1 });
     const totalAmount=orders.reduce((sum , order)=>sum + Number(order.finalAmount || 0),0);

    const totalsales = await Order.countDocuments(); 
    const productCount = await Product.countDocuments();
    const productSales = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      { $unwind: '$productData' },
      {
        $group: {
          _id: '$productData.productName',
          totalSold: { $sum: '$orderedItems.quantity' }
        }
      },
      {
        $project: { _id: 0, productName: '$_id', totalSold: 1 }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    const categorySales = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.category',
          totalSales: { $sum: '$orderedItems.quantity' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      { $unwind: '$categoryDetails' },
      {
        $project: {
          _id: 0,
          categoryId: '$_id',
          categoryName: '$categoryDetails.name',
          totalSales: 1
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 }
    ]);

    const brandSales = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.brand',
          totalSales: { $sum: '$orderedItems.quantity' }
        }
      },
      {
        $lookup: {
          from: 'brands',
          localField: '_id',
          foreignField: '_id',
          as: 'brandDetails'
        }
      },
      { $unwind: '$brandDetails' },
      {
        $project: {
          _id: 0,
          brandId: '$_id',
          brandName: '$brandDetails.brandName',
          totalSales: 1
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 }
    ]);

    res.render('dashboard', { productSales, categorySales, brandSales,userCount,totalAmount,totalsales,productCount });
  } catch (error) {
    console.error(error);
    res.redirect('/pageerror');
  }
};

const logout = async (req, res) => {
  try {
     req.session.admin = false;
        req.session.adminUser = null;
    res.redirect('/admin/login');
  } catch (error) {
    res.redirect('/pageerror');
  }
};


module.exports={
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout
}