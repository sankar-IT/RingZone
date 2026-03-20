# Testing Price Alert Feature

## Quick Test Steps

### 1. Start the Server
```bash
npm start
```

### 2. Add Products to Wishlist
1. Login to your account
2. Browse products
3. Add 2-3 products to your wishlist
4. Go to `/wishlist` page

### 3. Test Price Alert Modal
1. Click the bell icon (🔔) on any wishlist product
2. Verify the modal opens with:
   - Product image and name
   - Current price
   - Price history graph (will show mock data initially)
   - Target price input field
   - Quick discount buttons (10%, 20%, 30%)
   - Email input (pre-filled if logged in)
   - "Notify when back in stock" checkbox

### 4. Set a Price Alert
1. Enter a target price (or click a discount button)
2. Verify email is filled
3. Click "Set Price Alert"
4. Should see success message
5. Check MongoDB for new record in `pricealerts` collection

### 5. Test Price History API
Open browser console and run:
```javascript
fetch('/api/price-history/YOUR_PRODUCT_ID?color=Black&storage=128GB')
  .then(r => r.json())
  .then(console.log)
```

### 6. Manually Record Prices (Optional)
In Node.js console or create a test route:
```javascript
const { recordDailyPrices } = require('./helpers/priceHistoryTracker');
recordDailyPrices();
```

### 7. Check Cron Jobs
Server should log on startup:
```
Price alert cron job scheduled - will run every hour
Price history recording scheduled - will run daily at 2 AM
Price history cleanup scheduled - will run weekly on Sunday at 3 AM
```

## Database Verification

### Check Price Alerts
```javascript
db.pricealerts.find().pretty()
```

Expected structure:
```json
{
  "_id": ObjectId("..."),
  "userId": ObjectId("..."),
  "productId": ObjectId("..."),
  "variantColor": "Black",
  "variantStorage": "128GB",
  "targetPrice": 22990,
  "email": "user@example.com",
  "notifyBackInStock": true,
  "isActive": true,
  "notified": false,
  "createdAt": ISODate("...")
}
```

### Check Price History
```javascript
db.pricehistories.find().pretty()
```

Expected structure:
```json
{
  "_id": ObjectId("..."),
  "productId": ObjectId("..."),
  "variantColor": "Black",
  "variantStorage": "128GB",
  "price": 24990,
  "regularPrice": 29990,
  "date": ISODate("...")
}
```

## Common Issues & Solutions

### Modal not opening
- Check browser console for JavaScript errors
- Verify Chart.js CDN is loading
- Check if onclick handler is properly attached

### Graph not displaying
- Verify Chart.js is loaded (check Network tab)
- Check API response in Network tab
- Look for console errors

### Price alert not saving
- Check if user is logged in (userAuth middleware)
- Verify MongoDB connection
- Check server logs for errors
- Verify request payload in Network tab

### No price history data
- Run `recordDailyPrices()` manually first time
- Or wait for mock data to be generated automatically
- Check if products have variants with prices

## Manual Testing Checklist

- [ ] Modal opens when clicking bell icon
- [ ] Product image displays correctly
- [ ] Current price shows correctly
- [ ] Price graph renders (even with mock data)
- [ ] Target price input accepts numbers
- [ ] Quick discount buttons calculate correctly
- [ ] Email field is pre-filled for logged-in users
- [ ] "Set Price Alert" button works
- [ ] Success message appears
- [ ] Modal closes after setting alert
- [ ] Can close modal with X button
- [ ] Can close modal by clicking overlay
- [ ] Responsive design works on mobile
- [ ] Multiple alerts can be set for different products
- [ ] Database records are created correctly

## Next Steps After Testing

1. Implement email notification service
2. Test cron jobs by changing schedule to run every minute
3. Add more price history data for realistic graphs
4. Test alert triggering when prices drop
5. Add user dashboard to view all active alerts
6. Implement alert management (edit/delete alerts)

## Performance Testing

### Load Test
1. Add 50+ products to wishlist
2. Open price alert modals for multiple products
3. Verify no performance degradation
4. Check memory usage

### Database Performance
1. Insert 1000+ price history records
2. Query price history for a product
3. Verify query performance (<100ms)
4. Check if indexes are being used

## Production Checklist

- [ ] Environment variables configured
- [ ] Email service integrated
- [ ] Cron jobs tested in production
- [ ] Database indexes created
- [ ] Error logging implemented
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all endpoints
- [ ] XSS protection on user inputs
- [ ] CSRF protection enabled
- [ ] Backup strategy for price data
