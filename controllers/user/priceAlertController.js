const PriceAlert = require('../../models/priceAlertSchema');
const PriceHistory = require('../../models/priceHistorySchema');
const Product = require('../../models/productsSchema');


const getPriceHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { color = '', storage = '' } = req.query;

   
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const priceHistory = await PriceHistory.find({
      productId,
      variantColor: color,
      variantStorage: storage,
      date: { $gte: ninetyDaysAgo }
    })
    .sort({ date: 1 })
    .select('price date -_id');

    if (priceHistory.length === 0) {
      
      const product = await Product.findById(productId);
      if (product) {
        const variant = product.variants.find(v => 
          v.color === color && v.storage === storage
        );
        
        if (variant) {
          const currentPrice = variant.discountPrice || variant.regularPrice;
          
          
          const mockHistory = [];
          for (let i = 90; i >= 0; i -= 7) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            mockHistory.push({
              date: date.toISOString().split('T')[0],
              price: currentPrice
            });
          }
          
          return res.json({
            success: true,
            priceHistory: mockHistory
          });
        }
      }
      
      return res.json({
        success: false,
        message: 'No price history available'
      });
    }

    const formattedHistory = priceHistory.map(item => ({
      date: item.date.toISOString().split('T')[0],
      price: item.price
    }));

    res.json({
      success: true,
      priceHistory: formattedHistory
    });

  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch price history'
    });
  }
};


const getExistingAlert = async (req, res) => {
  try {
    const sessionUser = req.session.user;
    const userId = sessionUser?._id || sessionUser;
    const { productId } = req.params;
    const { color = '', storage = '' } = req.query;

    if (!userId) {
      return res.json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const existingAlert = await PriceAlert.findOne({
      userId,
      productId,
      variantColor: color,
      variantStorage: storage,
      isActive: true
    });

    if (existingAlert) {
      return res.json({
        success: true,
        alert: {
          targetPrice: existingAlert.targetPrice,
          email: existingAlert.email,
          notifyBackInStock: existingAlert.notifyBackInStock
        }
      });
    }

    res.json({
      success: false,
      message: 'No existing alert found'
    });

  } catch (error) {
    console.error('Error fetching existing alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch existing alert'
    });
  }
};


const setPriceAlert = async (req, res) => {
  try {
    const sessionUser = req.session.user;
    const userId = sessionUser?._id || sessionUser;
    const { productId, variantColor, variantStorage, targetPrice, notifyBackInStock } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to set price alerts'
      });
    }

    if (!targetPrice || targetPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid target price'
      });
    }

   
    const User = require('../../models/userSchema');
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    const email = user.email;

   
    const product = await Product.findById(productId);
    let currentPrice = 0;
    
    if (product) {
      const variant = product.variants.find(v => 
        v.color === (variantColor || '') && v.storage === (variantStorage || '')
      );
      if (variant) {
        currentPrice = variant.discountPrice || variant.regularPrice;
      }
    }

    
    const existingAlert = await PriceAlert.findOne({
      userId,
      productId,
      variantColor: variantColor || '',
      variantStorage: variantStorage || '',
      isActive: true
    });

    if (existingAlert) {
      existingAlert.targetPrice = targetPrice;
      existingAlert.email = email;
      existingAlert.notifyBackInStock = notifyBackInStock;
      existingAlert.finalPrice = currentPrice;
      existingAlert.notified = false;
      existingAlert.triggeredHour = null;
      existingAlert.triggeredMinute = null;
      await existingAlert.save();
    } else {
      const newAlert = new PriceAlert({
        userId,
        productId,
        variantColor: variantColor || '',
        variantStorage: variantStorage || '',
        targetPrice,
        finalPrice: currentPrice,
        email,
        notifyBackInStock
      });
      await newAlert.save();
    }

    
    const priceAlreadyMet = currentPrice > 0 && currentPrice <= targetPrice;

    res.json({
      success: true,
      message: 'Price alert set successfully',
      priceAlreadyMet: priceAlreadyMet,
      currentPrice: currentPrice
    });

  } catch (error) {
    console.error('Error setting price alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set price alert'
    });
  }
};


const recordPriceHistory = async (productId, variantColor, variantStorage, price, regularPrice) => {
  try {
    const newHistory = new PriceHistory({
      productId,
      variantColor: variantColor || '',
      variantStorage: variantStorage || '',
      price,
      regularPrice
    });
    await newHistory.save();
  } catch (error) {
    console.error('Error recording price history:', error);
  }
};


const manualCheckAlerts = async (req, res) => {
  try {
    const { recordDailyPrices } = require('../../helpers/priceHistoryTracker');
    await recordDailyPrices();
    
    res.json({
      success: true,
      message: 'Price recording and alert check completed successfully'
    });
  } catch (error) {
    console.error('Error in manual alert check:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check alerts'
    });
  }
};

module.exports = {
  getPriceHistory,
  getExistingAlert,
  setPriceAlert,
  recordPriceHistory,
  manualCheckAlerts
};
