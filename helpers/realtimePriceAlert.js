const PriceAlert = require('../models/priceAlertSchema');
const Product = require('../models/productsSchema');
const { sendPriceAlertEmail } = require('./emailService');
const cron = require('node-cron');

// Per-alert cron jobs keyed by alert._id string
const alertCronJobs = {};

/**
 * Called when admin updates product price.
 * Updates actualPrice on each alert, then checks if targetPrice >= actualPrice.
 * If yes → send email immediately, save triggered time, schedule daily cron for that user.
 */
async function checkAndTriggerAlerts(productId, variantColor, variantStorage, newPrice) {
  try {
    const alerts = await PriceAlert.find({
      productId,
      variantColor: variantColor || '',
      variantStorage: variantStorage || '',
      isActive: true
    }).populate('productId');

    if (alerts.length === 0) return;

    for (const alert of alerts) {
      // Always update finalPrice to reflect the latest product discountPrice
      alert.finalPrice = newPrice;
      await alert.save();

      // Check: if user's target price >= current final price → alert condition met
      if (alert.targetPrice >= newPrice) {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        console.log(`\n🔔 Alert triggered for ${alert.email}`);
        console.log(`   targetPrice ₹${alert.targetPrice} >= finalPrice ₹${newPrice} ✅`);
        console.log(`   Time: ${hour}:${String(minute).padStart(2, '0')}`);

        const product = alert.productId;
        const variant = product.variants.find(v =>
          v.color === variantColor && v.storage === variantStorage
        );

        if (!variant) continue;

        const emailSent = await sendPriceAlertEmail(
          alert.email, product, variant, newPrice, alert.targetPrice
        );

        if (emailSent) {
          console.log(`   ✅ Email sent to ${alert.email}`);

          // Save triggered time for this specific user's alert
          alert.triggeredHour = hour;
          alert.triggeredMinute = minute;
          alert.lastTriggeredAt = now;
          alert.notified = true;
          await alert.save();

          // Schedule daily cron for this specific user at their triggered time
          scheduleAlertCron(alert);
        }
      }
    }
  } catch (error) {
    console.error('Error in checkAndTriggerAlerts:', error);
  }
}

/**
 * Schedule a daily cron for a specific alert using its own triggered time.
 * Each alert gets its own cron job keyed by alert._id — no sharing between users.
 */
function scheduleAlertCron(alert) {
  const alertId = alert._id.toString();

  // Cancel existing cron for this alert if any
  if (alertCronJobs[alertId]) {
    alertCronJobs[alertId].stop();
    delete alertCronJobs[alertId];
  }

  const { triggeredHour, triggeredMinute } = alert;
  const cronExpression = `${triggeredMinute} ${triggeredHour} * * *`;

  console.log(`⏰ Daily cron for ${alert.email} at ${triggeredHour}:${String(triggeredMinute).padStart(2,'0')} (alertId: ${alertId})`);

  const task = cron.schedule(cronExpression, async () => {
    try {
      const freshAlert = await PriceAlert.findById(alertId).populate('productId');
      if (!freshAlert || !freshAlert.isActive) {
        if (alertCronJobs[alertId]) {
          alertCronJobs[alertId].stop();
          delete alertCronJobs[alertId];
        }
        return;
      }

      // Check if product is still in user's wishlist — if not, stop cron and deactivate alert
      const Wishlist = require('../models/wishlistSchema');
      const wishlist = await Wishlist.findOne({ userId: freshAlert.userId });
      const stillInWishlist = wishlist?.products?.some(p =>
        p.productId.toString() === freshAlert.productId._id.toString() &&
        p.variant?.color === freshAlert.variantColor &&
        p.variant?.storage === freshAlert.variantStorage
      );

      if (!stillInWishlist) {
        console.log(`🗑 Product removed from wishlist for ${freshAlert.email} — stopping cron and deactivating alert.`);
        freshAlert.isActive = false;
        await freshAlert.save();
        if (alertCronJobs[alertId]) {
          alertCronJobs[alertId].stop();
          delete alertCronJobs[alertId];
        }
        return;
      }

      // Check current finalPrice vs targetPrice
      if (freshAlert.targetPrice >= freshAlert.finalPrice) {
        const freshProduct = freshAlert.productId;
        const freshVariant = freshProduct.variants.find(v =>
          v.color === freshAlert.variantColor && v.storage === freshAlert.variantStorage
        );
        if (!freshVariant) return;

        const currentPrice = freshVariant.discountPrice || freshVariant.regularPrice;

        console.log(`📧 Daily cron: ${freshAlert.email} — finalPrice ₹${freshAlert.finalPrice}, targetPrice ₹${freshAlert.targetPrice}`);
        const emailSent = await sendPriceAlertEmail(
          freshAlert.email, freshProduct, freshVariant, currentPrice, freshAlert.targetPrice
        );
        if (emailSent) {
          freshAlert.lastTriggeredAt = new Date();
          await freshAlert.save();
          console.log(`✅ Daily email sent to ${freshAlert.email}`);
        }
      }
    } catch (err) {
      console.error('Error in daily alert cron:', err);
    }
  });

  alertCronJobs[alertId] = task;
}

/**
 * On server restart, restore individual cron jobs for all notified alerts.
 */
async function restoreScheduledAlerts() {
  try {
    console.log('\n🔄 Restoring per-user alert cron jobs...');
    const alerts = await PriceAlert.find({
      isActive: true,
      notified: true,
      triggeredHour: { $ne: null },
      triggeredMinute: { $ne: null }
    });

    for (const alert of alerts) {
      scheduleAlertCron(alert);
    }

    console.log(`✅ Restored ${alerts.length} alert cron job(s).\n`);
  } catch (error) {
    console.error('Error restoring alert crons:', error);
  }
}

/**
 * Called when admin updates a product — checks all variants.
 */
async function checkAlertsForProduct(productId) {
  try {
    const product = await Product.findById(productId);
    if (!product) return;

    console.log(`\n🔍 Checking alerts for: ${product.productName}`);
    for (const variant of product.variants) {
      const currentPrice = variant.discountPrice || variant.regularPrice;
      await checkAndTriggerAlerts(productId, variant.color, variant.storage, currentPrice);
    }
  } catch (error) {
    console.error('Error in checkAlertsForProduct:', error);
  }
}

module.exports = {
  checkAndTriggerAlerts,
  checkAlertsForProduct,
  restoreScheduledAlerts
};
