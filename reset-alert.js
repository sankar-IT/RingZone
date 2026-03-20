// Reset alert to trigger again
require('dotenv').config();
const mongoose = require('mongoose');
const PriceAlert = require('./models/priceAlertSchema');

async function resetAlert() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database\n');
    
    // Reset all alerts to not notified
    const result = await PriceAlert.updateMany(
      { notified: true },
      { $set: { notified: false } }
    );
    
    console.log(`Reset ${result.modifiedCount} alert(s) to notified: false`);
    console.log('You can now trigger the alerts again!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAlert();
