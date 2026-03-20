const Product = require('../models/productsSchema');
const PriceHistory = require('../models/priceHistorySchema');
const PriceAlert = require('../models/priceAlertSchema');
const { sendPriceAlertEmail } = require('./emailService');


async function recordDailyPrices() {
  try {
    console.log('Starting daily price recording...');
    
    const products = await Product.find({ isBlocked: false });
    let recordCount = 0;

    for (const product of products) {
      for (const variant of product.variants) {
        const currentPrice = variant.discountPrice || variant.regularPrice;
        
        // Check if we already have a record for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingRecord = await PriceHistory.findOne({
          productId: product._id,
          variantColor: variant.color,
          variantStorage: variant.storage,
          date: { $gte: today }
        });

        if (!existingRecord) {
          await PriceHistory.create({
            productId: product._id,
            variantColor: variant.color,
            variantStorage: variant.storage,
            price: currentPrice,
            regularPrice: variant.regularPrice
          });
          recordCount++;
        }
      }
    }

    console.log(`Price recording completed. ${recordCount} records created.`);
    
    // Check and trigger price alerts
    await checkPriceAlerts();
    
  } catch (error) {
    console.error('Error recording daily prices:', error);
  }
}

/**
 * Checks active price alerts and triggers notifications
 */
async function checkPriceAlerts() {
  try {
    console.log('Checking price alerts...');
    
    const activeAlerts = await PriceAlert.find({ 
      isActive: true, 
      notified: false 
    }).populate('productId');

    let notificationCount = 0;

    for (const alert of activeAlerts) {
      if (!alert.productId) continue;

      const product = alert.productId;
      const variant = product.variants.find(v => 
        v.color === alert.variantColor && v.storage === alert.variantStorage
      );

      if (!variant) continue;

      const currentPrice = variant.discountPrice || variant.regularPrice;

      // Check if current price is at or below target price
      if (currentPrice <= alert.targetPrice) {
        console.log(`\n🔔 Price alert triggered for user ${alert.userId}`);
        console.log(`📦 Product: ${product.productName}`);
        console.log(`🎯 Target: ₹${alert.targetPrice}, Current: ₹${currentPrice}`);
        console.log(`📧 Sending email to: ${alert.email}`);
        
        // Send notification email
        const emailSent = await sendPriceAlertEmail(
          alert.email, 
          product, 
          variant, 
          currentPrice, 
          alert.targetPrice
        );
        
        if (emailSent) {
          console.log(`✅ Email sent successfully!\n`);
        } else {
          console.log(`❌ Failed to send email\n`);
        }
        
        // Mark alert as notified
        alert.notified = true;
        await alert.save();
        
        notificationCount++;
      }
    }

    console.log(`\n📊 Price alert check completed. ${notificationCount} notification(s) sent.\n`);
    
  } catch (error) {
    console.error('Error checking price alerts:', error);
  }
}

/**
 * Cleans up old price history records (older than 180 days)
 */
async function cleanupOldPriceHistory() {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

    const result = await PriceHistory.deleteMany({
      date: { $lt: sixMonthsAgo }
    });

    console.log(`Cleaned up ${result.deletedCount} old price history records.`);
  } catch (error) {
    console.error('Error cleaning up price history:', error);
  }
}

module.exports = {
  recordDailyPrices,
  checkPriceAlerts,
  cleanupOldPriceHistory
};
