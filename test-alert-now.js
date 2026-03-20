// Quick test script to check price alerts
require('dotenv').config();
const mongoose = require('mongoose');
const { recordDailyPrices } = require('./helpers/priceHistoryTracker');

async function testAlerts() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    console.log('\n=== Testing Price Alerts ===\n');
    await recordDailyPrices();
    
    console.log('\n=== Test Complete ===\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testAlerts();
