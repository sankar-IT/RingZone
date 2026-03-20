// Check alerts in database
require('dotenv').config();
const mongoose = require('mongoose');
const PriceAlert = require('./models/priceAlertSchema');
const Product = require('./models/productsSchema');

async function checkAlerts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database\n');
    
    // Get all alerts
    const alerts = await PriceAlert.find().populate('productId');
    
    console.log(`Total alerts in database: ${alerts.length}\n`);
    
    for (const alert of alerts) {
      console.log('='.repeat(60));
      console.log('Alert ID:', alert._id);
      console.log('User ID:', alert.userId);
      console.log('Product:', alert.productId?.productName || 'Product not found');
      console.log('Variant:', alert.variantColor, alert.variantStorage);
      console.log('Target Price: ₹' + alert.targetPrice);
      console.log('Email:', alert.email);
      console.log('Is Active:', alert.isActive);
      console.log('Notified:', alert.notified);
      console.log('Created:', alert.createdAt);
      
      if (alert.productId) {
        const variant = alert.productId.variants.find(v => 
          v.color === alert.variantColor && v.storage === alert.variantStorage
        );
        
        if (variant) {
          const currentPrice = variant.discountPrice || variant.regularPrice;
          console.log('Current Price: ₹' + currentPrice);
          console.log('Condition Met:', currentPrice <= alert.targetPrice ? '✅ YES' : '❌ NO');
        } else {
          console.log('Variant not found in product');
        }
      }
      console.log('='.repeat(60) + '\n');
    }
    
    // Check active, non-notified alerts
    const activeAlerts = await PriceAlert.find({ 
      isActive: true, 
      notified: false 
    }).populate('productId');
    
    console.log(`\nActive alerts waiting to be triggered: ${activeAlerts.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAlerts();
