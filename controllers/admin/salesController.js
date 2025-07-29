const Order = require("../../models/orderSchema")


const loadSalesPage=async(req,res)=>{
  try {
  const orders = await Order.find().populate('user').populate('orderedItems.product').sort({ createdOn: -1 }); 

  const totalAmount=orders.reduce((sum , order)=>sum + Number(order.finalAmount || 0),0);
  const totalSales = await Order.countDocuments(); 
    const totalDelivered = await Order.countDocuments({ 'orderedItems.status': 'Delivered' });
    const totalReturns = await Order.countDocuments({ 'orderedItems.status': 'Returned'  });
    const totalCancelled = await Order.countDocuments({ 'orderedItems.status': 'Cancelled' });
  const totalDiscount=orders.reduce((sum,order)=>sum +order.discount,0 )
    res.render('sales-report',{orders,totalAmount,totalDiscount,totalSales,
      totalDelivered,
      totalReturns,
      totalCancelled})
  } catch (error) {
    res.render('notpagefound')
  }
}


module.exports={
  loadSalesPage
}