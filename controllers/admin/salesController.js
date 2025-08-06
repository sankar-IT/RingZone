const Order = require("../../models/orderSchema")


const loadSalesPage = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user')
      .populate('orderedItems.product')
      .sort({ createdOn: -1 });

    // Calculate total sales amount only for confirmed/delivered orders
    const totalAmount = orders.reduce((sum, order) => {
      if (order.status === 'Confirmed' || order.status === 'Delivered') {
        return sum + Number(order.finalAmount || 0);
      }
      return sum;
    }, 0);

    const totalDiscount = orders.reduce((sum, order) => {
      if (order.status === 'Confirmed' || order.status === 'Delivered') {
        return sum + (order.coupon?.discountAmount || 0);
      }
      return sum;
    }, 0);
    
    const totalOrders = orders.length;
    const totalPending = orders.filter(order => order.status === 'Pending').length;
    const totalDelivered = orders.filter(order => order.status === 'Delivered').length;
    const totalCancelled = orders.filter(order => order.status === 'Cancelled').length;
    const totalConcurrency = orders.filter(order => order.paymentMethod === 'Concurrency').length;
    const totalContract = orders.filter(order => order.paymentMethod === 'Contract').length;

    res.render('sales-report', {
      orders,
      totalAmount,
      totalDiscount,
      totalOrders,
      totalPending,
      totalDelivered,
      totalCancelled,
      totalConcurrency,
      totalContract
    });
  } catch (error) {
    console.error(error);
    res.render('notpagefound');
  }
};

module.exports={
  loadSalesPage
}