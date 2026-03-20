const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send price alert email
async function sendPriceAlertEmail(email, product, variant, currentPrice, targetPrice) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `🎉 Price Alert: ${product.productName} is now at your target price!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .product-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .price-box {
              display: inline-block;
              background: #28a745;
              color: white;
              padding: 15px 25px;
              border-radius: 8px;
              font-size: 24px;
              font-weight: bold;
              margin: 10px 0;
            }
            .target-price {
              color: #666;
              text-decoration: line-through;
              font-size: 18px;
            }
            .button {
              display: inline-block;
              background: #007bff;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Price Alert Triggered!</h1>
              <p>Your target price has been reached</p>
            </div>
            <div class="content">
              <h2>Great News!</h2>
              <p>The product you've been watching has reached your target price:</p>
              
              <div class="product-info">
                <h3>${product.productName}</h3>
                ${variant.color ? `<p><strong>Color:</strong> ${variant.color}</p>` : ''}
                ${variant.storage ? `<p><strong>Storage:</strong> ${variant.storage}</p>` : ''}
              </div>
              
              <div style="text-align: center;">
                <p class="target-price">Your Target: ₹${targetPrice.toLocaleString('en-IN')}</p>
                <div class="price-box">
                  Current Price: ₹${currentPrice.toLocaleString('en-IN')}
                </div>
                <p style="color: #28a745; font-weight: bold; font-size: 18px;">
                  You save: ₹${(targetPrice - currentPrice).toLocaleString('en-IN')}!
                </p>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.BASE_URL}/wishlist" class="button">
                  View Product Now
                </a>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                <strong>⏰ Don't wait too long!</strong> Prices can change at any time. 
                Add this product to your cart now to lock in this great price.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated price alert from RingZone</p>
              <p>You're receiving this because you set a price alert for this product</p>
              <p>&copy; ${new Date().getFullYear()} RingZone. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}`);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

module.exports = {
  sendPriceAlertEmail
};
