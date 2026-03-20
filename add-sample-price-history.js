
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/productsSchema');
const PriceHistory = require('./models/priceHistorySchema');

async function addSamplePriceHistory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database\n');
    
   
    const products = await Product.find({ isBlocked: false }).limit(5);
    
    console.log(`Adding price history for ${products.length} products...\n`);
    
    for (const product of products) {
      console.log(`Product: ${product.productName}`);
      
      for (const variant of product.variants) {
        const basePrice = variant.discountPrice || variant.regularPrice;
        console.log(`  Variant: ${variant.color} ${variant.storage} - Base Price: ₹${basePrice}`);
        
        
        const records = [];
        const today = new Date();
        
        for (let i = 90; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          date.setHours(2, 0, 0, 0);
          
          
          let priceVariation = 0;
          
          if (i > 70) {
           
            priceVariation = Math.random() * 0.15 + 0.05; 
          } else if (i > 50) {
          
            priceVariation = (70 - i) * 0.005; 
          } else if (i > 30) {
            
            priceVariation = -0.05 + Math.random() * 0.03; 
          } else if (i > 15) {
            
            priceVariation = -0.02 + (30 - i) * 0.003; 
          } else if (i > 7) {
            
            priceVariation = -0.10 - Math.random() * 0.05; 
          } else {
        
            priceVariation = Math.random() * 0.05 - 0.02; 
          }
          
          const price = Math.round(basePrice * (1 + priceVariation));
          
          records.push({
            productId: product._id,
            variantColor: variant.color,
            variantStorage: variant.storage,
            price: price,
            regularPrice: variant.regularPrice,
            date: date
          });
        }
        
        
        await PriceHistory.deleteMany({
          productId: product._id,
          variantColor: variant.color,
          variantStorage: variant.storage
        });
        
      
        await PriceHistory.insertMany(records);
        console.log(`    ✅ Added ${records.length} price records`);
      }
      console.log('');
    }
    
    console.log('✅ Sample price history added successfully!');
    console.log('\nNow open the wishlist and click the bell icon to see the price graph with variations!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addSamplePriceHistory();
