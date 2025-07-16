const Order=require('../../models/orderSchema')
const Brand=require('../../models/brandSchema')
const Product=require('../../models/productsSchema')
const Category = require('../../models/categorySchema');


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

    // Check if any items are returned/cancelled
    const hasReturnedItems = order.orderedItems.some(item =>
      ['Returned', 'Cancelled', 'Return Approved', 'Return Rejected'].includes(item.status)
    );

    // If trying to set order to Shipped/Delivered when there are returned/cancelled items, block it
    if (hasReturnedItems && ['Shipped', 'Delivered'].includes(status)) {
      return res.status(400).json({
        message: 'Cannot set order to Shipped/Delivered when it has returned/cancelled items'
      });
    }

    // If all items are returned/cancelled, mark order as Cancelled
    const allItemsReturnedOrCancelled = order.orderedItems.every(item =>
      ['Returned', 'Cancelled', 'Return Approved', 'Return Rejected'].includes(item.status)
    );

    if (allItemsReturnedOrCancelled) {
      order.status = 'Cancelled';
      await order.save();
      return res.redirect('/admin/orders-list');
    }

    // Valid transition check
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

    // ✅ Update overall order status
    order.status = status;

    // ✅ OPTIONAL: Update only those items that are NOT Returned/Cancelled
    order.orderedItems.forEach(item => {
      if (!['Returned', 'Cancelled', 'Return Approved', 'Return Rejected'].includes(item.status)) {
        item.status = status; // Sync item with order status
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

    // Validate input
    if (!orderId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Order ID and Item ID are required'
      });
    }

    // Find the order first to check current status
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

    // Find the specific item
    const item = order.orderedItems.find(item => item._id.equals(itemId));

    // Check if item is already processed
    if (['Return Approved', 'Return Rejected', 'Cancelled'].includes(item.status)) {
      return res.status(400).json({
        success: false,
        message: `Item is already in ${item.status} status and cannot be modified`
      });
    }

    // Check if item is in correct status to approve return
    if (item.status !== 'Return Requested') {
      return res.status(400).json({
        success: false,
        message: 'Item is not in Return Requested status'
      });
    }

    // Update both order item status and inventory item status
    const [updatedOrder] = await Promise.all([
      Order.findOneAndUpdate(
        { 
          _id: orderId, 
          "orderedItems._id": itemId,
          "orderedItems.status": "Return Requested"
        },
        { 
          $set: { 
            "orderedItems.$.status": "Returned",
            "orderedItems.$.returnProcessedDate": new Date()
          } 
        },
        { new: true }
      )
    ]);

    if (!updatedOrder) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update order or item status'
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Return approved successfully',
      order: updatedOrder,
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

    // Validate input
    if (!orderId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Order ID and Item ID are required'
      });
    }

    // Find the order first to check current status
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

    // Find the specific item
    const item = order.orderedItems.find(item => item._id.equals(itemId));

    // Check if item is already processed
    if (['Return Approved', 'Return Rejected', 'Cancelled'].includes(item.status)) {
      return res.status(400).json({
        success: false,
        message: `Item is already in ${item.status} status and cannot be modified`
      });
    }

    // Check if item is in correct status to reject return
    if (item.status !== 'Return Requested') {
      return res.status(400).json({
        success: false,
        message: 'Item is not in Return Requested status'
      });
    }

    // Update both order item status and inventory item status
    const [updatedOrder, updatedItem] = await Promise.all([
      Order.findOneAndUpdate(
        { 
          _id: orderId, 
          "orderedItems._id": itemId,
          "orderedItems.status": "Return Requested"
        },
        { 
          $set: { 
            "orderedItems.$.status": "Return Rejected",
            "orderedItems.$.returnProcessedDate": new Date(),
            "orderedItems.$.adminRejectReason": adminReason || 'No reason provided'
          } 
        },
        { new: true }
      ),
      Item.findByIdAndUpdate(
        itemId,
        { $set: { status: "Return Rejected" } },
        { new: true }
      )
    ]);

    if (!updatedOrder || !updatedItem) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update order or item status'
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Return rejected successfully',
      order: updatedOrder,
      item: updatedItem
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