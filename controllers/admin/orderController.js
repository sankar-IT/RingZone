const Order=require('../../models/orderSchema')
const Brand=require('../../models/brandSchema')
const Product=require('../../models/productsSchema')
const Category = require('../../models/categorySchema');
const Wallet=require('../../models/walletSchema');


const ordersList = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name') 
      .populate('orderedItems.product', 'brand') 
      .sort({ createdOn: -1 }); 

    res.render('orders-list', { orders });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(500).send('Internal Server Error');
  }
};


const updateOrders=async(req,res)=>{
  try {
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
      .populate('user')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    res.render('update-orders', { order }); 
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).send('Internal Server Error');
  }
}
const updateOrdersStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findById(orderId).populate('orderedItems.product');
    if (!order) {
      return res.status(404).send('Order not found');
    }

    const hasReturnedItems = order.orderedItems.some(item =>
      ['Returned', 'Cancelled', 'Return Approved', 'Return Rejected'].includes(item.status)
    );
    if (hasReturnedItems && ['Shipped', 'Delivered'].includes(status)) {
      return res.status(400).json({
        message: 'Cannot set order to Shipped/Delivered when it has returned/cancelled items'
      });
    }
    const allItemsReturnedOrCancelled = order.orderedItems.every(item =>
      ['Returned', 'Cancelled', 'Return Approved', 'Return Rejected'].includes(item.status)
    );

    if (allItemsReturnedOrCancelled) {
      order.status = 'Cancelled';
      await order.save();
      return res.redirect('/admin/orders-list');
    }
    const validStatusTransitions = {
      'Pending': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Shipped', 'Cancelled'],
      'Shipped': ['Delivered', 'Cancelled'],
      'Delivered': ['Return Requested', 'Completed'],
    };

    if (validStatusTransitions[order.status] &&
        !validStatusTransitions[order.status].includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${order.status} to ${status}`
      });
    }
    order.status = status;
    order.orderedItems.forEach(item => {
      if (!['Returned', 'Cancelled', 'Return Approved', 'Return Rejected'].includes(item.status)) {
        item.status = status;
      }
    });

    await order.save();

    res.redirect('/admin/orders-list');
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).send('Internal Server Error');
  }
};


const approveReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.body;
    if (!orderId || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Item ID are required'
      });
    }

   
    const order = await Order.findOne({
      _id: orderId,
      "orderedItems._id": itemId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order/item not found'
      });
    }

    
    
    
    const item = order.orderedItems.find(item => item._id.equals(itemId));
    console.log(item);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    
    if (['Return Approved', 'Return Rejected', 'Cancelled', 'Returned'].includes(item.status)) {
      return res.status(400).json({
        success: false,
        message: `Item is already in ${item.status} status and cannot be modified`
      });
    }

    if (item.status !== 'Return Requested') {
      return res.status(400).json({
        success: false,
        message: 'Item is not in Return Requested status'
      });
    }

    
    const allItemTotal = order.orderedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const couponDiscount = order.coupon && order.coupon.discountAmount ? order.coupon.discountAmount : 0;
    const itemValue = item.price * item.quantity;
    const couponShare = couponDiscount && allItemTotal > 0 ? (itemValue / allItemTotal) * couponDiscount : 0;
    const refundAmount = Math.floor(itemValue - couponShare);

    
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        "orderedItems._id": itemId,
        "orderedItems.status": "Return Requested"
      },
      {
        $set: {
          status: 'Returned',
          "orderedItems.$.status": "Returned",
          "orderedItems.$.returnProcessedDate": new Date()
        }
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(400).json({
        success: false,
        message: 'Item is not in Return Requested status'
      });
    }

  
    let wallet = await Wallet.findOne({ user: order.user });
    if (!wallet) wallet = await Wallet.create({ user: order.user, balance: 0, transactions: [] });

    wallet.balance +=refundAmount;
    wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
     description: `Refund for returned item in Order ORD${( order._id).toString().substring(0,8).toUpperCase()}`,
      date: new Date()
    });
    await wallet.save();

   
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
      message: 'Return approved and refund credited to wallet',
      refundAmount,
      walletBalance: wallet.balance,
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error approving return:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing return approval',
      error: error.message
    });
  }
};

const rejectReturn = async (req, res) => {
  try {
    const { orderId, itemId, adminReason } = req.body;

    if (!orderId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Order ID and Item ID are required'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      "orderedItems._id": itemId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order/item not found'
      });
    }

    const item = order.orderedItems.find(item => item._id.equals(itemId));

    if (['Return Approved', 'Return Rejected', 'Cancelled'].includes(item.status)) {
      return res.status(400).json({
        success: false,
        message: `Item is already in ${item.status} status and cannot be modified`
      });
    }

    if (item.status !== 'Return Requested') {
      return res.status(400).json({
        success: false,
        message: 'Item is not in Return Requested status'
      });
    }

  
    const updatedOrder = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        "orderedItems._id": itemId 
      },
      { 
        $set: { 
          "orderedItems.$.status": "Return Rejected",
          "orderedItems.$.returnProcessedDate": new Date(),
          "orderedItems.$.adminRejectReason": adminReason || 'No reason provided'
        } 
      },
      { new: true }
    );

    return res.status(200).json({ 
      success: true,
      message: 'Return rejected successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error rejecting return:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error while processing return rejection',
      error: error.message
    });
  }
};


module.exports={
  ordersList,
  updateOrders,
  updateOrdersStatus,
  approveReturn,
  rejectReturn
};