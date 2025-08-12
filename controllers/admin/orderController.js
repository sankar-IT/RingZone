const Order=require('../../models/orderSchema')
const Brand=require('../../models/brandSchema')
const Product=require('../../models/productsSchema')
const Category = require('../../models/categorySchema');
const Wallet=require('../../models/walletSchema');


function updateParentOrderStatus(order) {
  const itemStatuses = order.orderedItems.map(item => item.status);


  if (itemStatuses.includes('Delivered')) {
    order.status = 'Delivered';
    order.deliveredAt = new Date();
    return;
  }
  const uniqueStatuses = [...new Set(itemStatuses)];
  if (uniqueStatuses.length === 1) {
    order.status = uniqueStatuses[0];
    if (order.status === 'Delivered') {
      order.deliveredAt = new Date();
    }
    return;
  }
  order.status = 'Processing';
}

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
  const { status, cancellationReason, cancelledBy } = req.body;

  try {
    const order = await Order.findById(orderId).populate('coupon');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (status === 'Cancelled') {
      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json({ message: 'Cancellation reason is required for cancelling the order.' });
      }

      order.status = 'Cancelled';
      order.adminCancellation = {
        reason: cancellationReason,
        cancelledBy: cancelledBy || 'Admin',
        cancellationDate: new Date(),
      };

      order.orderedItems.forEach(item => {
        if (!['Cancelled', 'Return Approved', 'Return Rejected', 'Returned'].includes(item.status)) {
          item.status = 'Cancelled';
          item.cancellationReason = cancellationReason;
          item.cancelledBy = cancelledBy || 'Admin';
          item.cancellationDate = new Date();
        }
      });

      const originalAllItems = order.orderedItems;
      const totalItemsPrice = originalAllItems.reduce(
        (sum, itm) => sum + itm.price * itm.quantity, 0
      );

      let totalRefundAmount = 0;

      originalAllItems.forEach(item => {
        if (item.status === 'Cancelled') {
          const itemPrice = item.price * item.quantity;
          let refundAmount = itemPrice;

          if (order.coupon && order.coupon.discountAmount > 0) {
            const totalCoupon = order.coupon.discountAmount;
            const itemShare = (itemPrice / totalItemsPrice) * totalCoupon;
            refundAmount = Math.floor(itemPrice - itemShare);
          }
          totalRefundAmount += refundAmount;
        }
      });

      if (totalRefundAmount > 0 && order.user) {
        let wallet = await Wallet.findOne({ user: order.user });
        if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, transactions: [] });

        wallet.balance += totalRefundAmount;
        wallet.transactions.push({
          type: 'credit',
          amount: totalRefundAmount,
          description: `Refund for cancelled order ORD${order._id.toString().substring(0, 8).toUpperCase()}`
        });

        await wallet.save();
      }

    } else {
      order.status = status;
      updateParentOrderStatus(order);
    }

    await order.save();
    return res.json({ success: true });
  } catch (error) {
    console.error('Order Update Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



const updateItemStatus = async (req, res) => {
  const { orderId, itemIdx } = req.params;
  const { status, cancellationReason, cancelledBy, adminReturnRejectionReason } = req.body;

  try {
    const order = await Order.findById(orderId).populate('coupon');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const idx = parseInt(itemIdx, 10);
    if (isNaN(idx) || idx < 0 || idx >= order.orderedItems.length) {
      return res.status(400).json({ message: 'Invalid item index' });
    }

    const item = order.orderedItems[idx];

    if (status === 'Cancelled') {
      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json({ message: 'Cancellation reason is required for cancelling the item.' });
      }
      item.cancellationReason = cancellationReason;
      item.cancelledBy = cancelledBy || 'Admin';
      item.cancellationDate = new Date();
    }

    if (status === 'Return Rejected') {
      if (!adminReturnRejectionReason || adminReturnRejectionReason.trim() === '') {
        return res.status(400).json({ message: 'Return rejection reason is required.' });
      }
      item.adminReturnRejectionReason = adminReturnRejectionReason;
    }

    item.status = status;

    updateParentOrderStatus(order);

    if (status === 'Cancelled' && order.user) {
      const originalAllItems = order.orderedItems;
      const totalItemsPrice = originalAllItems.reduce(
        (sum, itm) => sum + itm.price * itm.quantity, 0
      );

      const itemPrice = item.price * item.quantity;
      let refundAmount = itemPrice;

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
        description: `Refund for cancelled item ${item.product.productName} in order ORD${order._id.toString().substring(0, 8).toUpperCase()}`
      });

      await wallet.save();
    }

    await order.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Item Update Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
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
  updateItemStatus,
  approveReturn,
  rejectReturn
};
