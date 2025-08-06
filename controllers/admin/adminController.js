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
    const { period, startDate, endDate } = req.query;
    let dateFilter = {};
    if (period === 'daily') {
      const today = new Date();
      dateFilter = { 
        createdOn: { 
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(today.setHours(23, 59, 59, 999))
        } 
      };
    } else if (period === 'weekly') {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      dateFilter = {
        createdOn: {
          $gte: startOfWeek,
          $lte: endOfWeek
        }
      };
    } else if (period === 'monthly') {
      const today = new Date();
      dateFilter = {
        createdOn: {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1),
          $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
        }
      };
    } else if (period === 'yearly') {
      const today = new Date();
      dateFilter = {
        createdOn: {
          $gte: new Date(today.getFullYear(), 0, 1),
          $lte: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999)
        }
      };
    } else if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = {
        createdOn: {
          $gte: start,
          $lte: end
        }
      };
    }
    const userCount = await User.countDocuments({ isAdmin: false, ...(period && { createdAt: dateFilter.createdOn }) });
    const orders = await Order.find(dateFilter).populate('user').populate('orderedItems.product').sort({ createdOn: -1 });
    const totalAmount = orders.reduce((sum, order) => {
      if (order.status === 'Confirmed' || order.status === 'Delivered') {
        return sum + Number(order.finalAmount || 0);
      }
      return sum;
    }, 0);

console.log("Total Confirmed/Delivered Amount:", totalAmount);

    const totalsales = orders.length;
    const productCount = await Product.countDocuments();
    const productSales = await Order.aggregate([
      { $match: dateFilter },
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
      { $match: dateFilter },
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
      { $match: dateFilter },
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

   
    let chartData = {};
    if (period === 'daily') {
     
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
      const dailyData = await Promise.all(days.map(async (day, index) => {
        const date = new Date(today);
        date.setDate(date.getDate() - today.getDay() + index);
        const start = new Date(date.setHours(0, 0, 0, 0));
        const end = new Date(date.setHours(23, 59, 59, 999));
        
        const dailyOrders = await Order.find({
          createdOn: { $gte: start, $lte: end }
        });
        
        return {
          label: day,
          value: dailyOrders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0)
        };
      }));
      
      chartData = {
        labels: dailyData.map(d => d.label),
        data: dailyData.map(d => d.value)
      };
    } else if (period === 'weekly') {
     
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
     
      const firstDayOfMonth = new Date(year, month, 1);
    
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
      let startOfWeek = new Date(firstDayOfMonth);
      startOfWeek.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
      let weekLabels = [];
      let weekRanges = [];
      let weekIndex = 1;
      while (startOfWeek <= lastDayOfMonth) {
        let endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        weekLabels.push(`Week ${weekIndex}`);
        weekRanges.push({ start: new Date(startOfWeek), end: new Date(endOfWeek) });
        startOfWeek.setDate(startOfWeek.getDate() + 7);
        weekIndex++;
      }
      const weeklyData = await Promise.all(weekRanges.map(async (range, idx) => {
       
        const start = range.start < firstDayOfMonth ? firstDayOfMonth : range.start;
        const end = range.end > lastDayOfMonth ? lastDayOfMonth : range.end;
        end.setHours(23, 59, 59, 999);
        const weeklyOrders = await Order.find({
          createdOn: { $gte: start, $lte: end }
        });
        return {
          label: weekLabels[idx],
          value: weeklyOrders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0)
        };
      }));
      chartData = {
        labels: weeklyData.map(d => d.label),
        data: weeklyData.map(d => d.value)
      };
    } else if (period === 'monthly') {
     
      const monthlyData = await Promise.all(Array.from({ length: 12 }, async (_, monthIndex) => {
        const today = new Date();
        const start = new Date(today.getFullYear(), monthIndex, 1);
        const end = new Date(today.getFullYear(), monthIndex + 1, 0, 23, 59, 59, 999);
        
        const monthlyOrders = await Order.find({
          createdOn: { $gte: start, $lte: end }
        });
        
        return {
          label: new Date(today.getFullYear(), monthIndex, 1).toLocaleString('default', { month: 'short' }),
          value: monthlyOrders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0)
        };
      }));
      
      chartData = {
        labels: monthlyData.map(d => d.label),
        data: monthlyData.map(d => d.value)
      };
    } else if (period === 'yearly') {
      
      const yearlyData = await Promise.all([4, 3, 2, 1, 0].map(async (yearOffset) => {
        const year = new Date().getFullYear() - yearOffset;
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);
        
        const yearlyOrders = await Order.find({
          createdOn: { $gte: start, $lte: end }
        });
        
        return {
          label: year.toString(),
          value: yearlyOrders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0)
        };
      }));
      
      chartData = {
        labels: yearlyData.map(d => d.label),
        data: yearlyData.map(d => d.value)
      };
    } else if (period === 'custom' && startDate && endDate) {
     
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const customData = await Promise.all(Array.from({ length: diffDays + 1 }, async (_, dayIndex) => {
        const date = new Date(start);
        date.setDate(date.getDate() + dayIndex);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const dailyOrders = await Order.find({
          createdOn: { $gte: dayStart, $lte: dayEnd }
        });
        
        return {
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: dailyOrders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0)
        };
      }));
      
      chartData = {
        labels: customData.map(d => d.label),
        data: customData.map(d => d.value)
      };
    } else {
     
      const monthlyData = await Promise.all([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(async (monthOffset) => {
        const today = new Date();
        const month = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        const start = new Date(month.getFullYear(), month.getMonth(), 1);
        const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const monthlyOrders = await Order.find({
          createdOn: { $gte: start, $lte: end }
        });
        
        return {
          label: month.toLocaleString('default', { month: 'short' }),
          value: monthlyOrders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0)
        };
      }));
      
      chartData = {
        labels: monthlyData.map(d => d.label),
        data: monthlyData.map(d => d.value)
      };
    }
const periodDisplay = req.query.period ? 
  `${req.query.period.charAt(0).toUpperCase() + req.query.period.slice(1)} Report` : 
  'Sales Report';

    res.render('dashboard', { 
      productSales, 
      categorySales, 
      brandSales,
      userCount,
      totalAmount,
      totalsales,
      productCount,
      chartData,
      periodDisplay
    });
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