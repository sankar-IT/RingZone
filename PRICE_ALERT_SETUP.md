# Price Alert & History Feature Setup

## Overview
This feature allows users to set price alerts for products and view historical price trends over the last 90 days.

## Features
- Interactive price history graph showing 90-day price trends
- Set custom target prices for notifications
- Quick discount options (10%, 20%, 30% off)
- Email notifications when target price is reached
- Back-in-stock notifications
- Beautiful modal UI matching the design specifications

## Database Schemas

### PriceAlert Schema
Stores user price alert preferences:
- `userId`: Reference to User
- `productId`: Reference to Product
- `variantColor`: Product variant color
- `variantStorage`: Product variant storage
- `targetPrice`: User's target price
- `email`: Notification email
- `notifyBackInStock`: Boolean for stock notifications
- `isActive`: Alert status
- `notified`: Whether user has been notified

### PriceHistory Schema
Tracks daily price changes:
- `productId`: Reference to Product
- `variantColor`: Product variant color
- `variantStorage`: Product variant storage
- `price`: Current selling price
- `regularPrice`: Original price
- `date`: Record date

## Setup Instructions

### 1. Install Dependencies
The feature uses Chart.js for graphs (already included via CDN in wishlist.ejs).

### 2. Set Up Cron Job for Daily Price Tracking

Add to your `server.js` or create a separate cron service:

```javascript
const cron = require('node-cron');
const { recordDailyPrices, cleanupOldPriceHistory } = require('./helpers/priceHistoryTracker');

// Record prices daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily price recording...');
  await recordDailyPrices();
});

// Cleanup old records weekly (Sunday at 3 AM)
cron.schedule('0 3 * * 0', async () => {
  console.log('Cleaning up old price history...');
  await cleanupOldPriceHistory();
});
```

Install node-cron if not already installed:
```bash
npm install node-cron
```

### 3. Manual Price Recording (Optional)
To manually record current prices:

```javascript
const { recordDailyPrices } = require('./helpers/priceHistoryTracker');
recordDailyPrices();
```

### 4. Email Notifications (TODO)
Implement email service in `helpers/priceHistoryTracker.js`:
- Configure your email service (SendGrid, Nodemailer, etc.)
- Uncomment and implement `sendPriceAlertEmail()` function

## API Endpoints

### GET `/api/price-history/:productId`
Fetch price history for a product variant.

Query Parameters:
- `color`: Variant color
- `storage`: Variant storage

Response:
```json
{
  "success": true,
  "priceHistory": [
    { "date": "2024-01-01", "price": 24990 },
    { "date": "2024-01-02", "price": 24500 }
  ]
}
```

### POST `/api/set-price-alert`
Create or update a price alert.

Body:
```json
{
  "productId": "...",
  "variantColor": "Black",
  "variantStorage": "128GB",
  "targetPrice": 22990,
  "email": "user@example.com",
  "notifyBackInStock": true
}
```

## Usage

### For Users
1. Go to Wishlist page
2. Click the bell icon on any product
3. View the price history graph
4. Set a target price or use quick discount options
5. Enter email and preferences
6. Click "Set Price Alert"

### For Developers
- Price history is automatically recorded daily
- Alerts are checked during daily price recording
- Mock data is generated if no history exists (for testing)
- Graph shows last 90 days of price data

## Testing

1. Add products to wishlist
2. Click bell icon to open price alert modal
3. View the price graph (will show mock data initially)
4. Set a price alert
5. Check database for PriceAlert record

## Future Enhancements
- SMS notifications
- Price drop percentage alerts
- Multiple price alerts per product
- Alert history for users
- Price prediction using ML
- Browser push notifications

## Troubleshooting

### Graph not showing
- Check browser console for errors
- Ensure Chart.js CDN is loading
- Verify price history API response

### Alerts not triggering
- Ensure cron job is running
- Check server logs for errors
- Verify PriceAlert records in database

### No price history
- Run `recordDailyPrices()` manually to create initial data
- Wait 24 hours for first automated recording
- Mock data will be shown until real history exists
