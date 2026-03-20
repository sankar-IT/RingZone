require('dotenv').config();
const mongoose = require('mongoose');

async function debugAlert() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('DB connected\n');

  const PriceAlert = require('./models/priceAlertSchema');
  const Product = require('./models/productsSchema');
  const { sendPriceAlertEmail } = require('./helpers/emailService');

  // Step 1: Check alerts in DB
  const alerts = await PriceAlert.find({ isActive: true });
  console.log(`Found ${alerts.length} active alert(s):\n`);
  alerts.forEach(a => {
    console.log(`  Alert ID: ${a._id}`);
    console.log(`  Product: ${a.productId}`);
    console.log(`  Color: "${a.variantColor}", Storage: "${a.variantStorage}"`);
    console.log(`  Target Price: ₹${a.targetPrice}`);
    console.log(`  Email: ${a.email}`);
    console.log(`  notified: ${a.notified}`);
    console.log('');
  });

  if (alerts.length === 0) {
    console.log('❌ No active alerts found. Set an alert from the wishlist page first.');
    process.exit(0);
  }

  const alert = alerts[0];

  // Step 2: Check product and variant
  const product = await Product.findById(alert.productId);
  if (!product) {
    console.log('❌ Product not found for alert:', alert.productId);
    process.exit(1);
  }

  console.log(`Product: ${product.productName}`);
  console.log(`Variants in DB:`);
  product.variants.forEach((v, i) => {
    console.log(`  [${i}] color="${v.color}" storage="${v.storage}" regularPrice=${v.regularPrice} discountPrice=${v.discountPrice}`);
  });

  const variant = product.variants.find(v =>
    v.color === alert.variantColor && v.storage === alert.variantStorage
  );

  if (!variant) {
    console.log(`\n❌ Variant NOT FOUND matching color="${alert.variantColor}" storage="${alert.variantStorage}"`);
    console.log('   This is likely the problem — variant color/storage mismatch between alert and product.');
    process.exit(1);
  }

  const currentPrice = variant.discountPrice || variant.regularPrice;
  console.log(`\nMatched variant: color="${variant.color}" storage="${variant.storage}"`);
  console.log(`Current price: ₹${currentPrice}`);
  console.log(`Target price:  ₹${alert.targetPrice}`);
  console.log(`Price meets target? ${currentPrice <= alert.targetPrice ? '✅ YES' : '❌ NO (price is higher than target)'}`);

  // Step 3: Try sending email directly
  console.log(`\nAttempting to send email to ${alert.email}...`);
  const result = await sendPriceAlertEmail(alert.email, product, variant, currentPrice, alert.targetPrice);
  console.log(`Email result: ${result ? '✅ Sent!' : '❌ Failed'}`);

  process.exit(0);
}

debugAlert().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
