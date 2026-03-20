# Price Alert Testing Guide

## Your Current Scenario

**Product Details:**
- Current Price: ₹21,000
- Your Alert Target: ₹32,000

**Result:** ✅ You WILL get notified because ₹21,000 ≤ ₹32,000

## How the System Works

### Alert Logic
The system sends notifications when:
```
Current Price ≤ Target Price
```

In your case:
- ₹21,000 (current) ≤ ₹32,000 (target) ✓
- Alert will trigger!

### When You'll Get Notified

**Automatic (Cron Job):**
- Runs daily at 9:30 AM
- Records all product prices
- Checks all active alerts
- Sends email notifications (when email service is configured)

**Manual Testing (Right Now):**
You can trigger the check immediately without waiting for 9:30 AM!

## Testing Methods

### Method 1: Manual Trigger (Recommended for Testing)

Visit this URL in your browser while logged in:
```
http://localhost:YOUR_PORT/api/manual-check-alerts
```

This will:
1. Record current prices for all products
2. Check all active alerts
3. Log notifications to console
4. Return JSON response

**Expected Console Output:**
```
Checking price alerts...
Price alert triggered for user [YOUR_USER_ID]
Product: [PRODUCT_NAME]
Target: ₹32000, Current: ₹21000
Price alert check completed. 1 notifications sent.
```

### Method 2: Wait for Cron Job

The cron job runs automatically at 9:30 AM every day.

**Server logs will show:**
```
Running daily price recording...
Checking price alerts...
Price alert triggered for user [YOUR_USER_ID]
Product: [PRODUCT_NAME]
Target: ₹32000, Current: ₹21000
Daily price recording completed
```

### Method 3: Check Database Directly

**Before notification:**
```javascript
db.pricealerts.find({ userId: YOUR_USER_ID })
```
Result: `notified: false`

**After notification:**
```javascript
db.pricealerts.find({ userId: YOUR_USER_ID })
```
Result: `notified: true`

## Understanding the Alert Status

### When Setting Alert

If current price already meets target, you'll see:
```
🎉 Great News!
Your alert has been set successfully!
The current price (₹21,000) is already at or below your target price!
You will receive an email notification at the next scheduled check (9:30 AM daily).
```

### Alert States

1. **Active & Not Notified** (`isActive: true, notified: false`)
   - Alert is waiting to be triggered
   - Will be checked at next cron run

2. **Active & Notified** (`isActive: true, notified: true`)
   - Alert was triggered
   - Email sent (or logged if email not configured)
   - Won't trigger again unless you update the alert

3. **Inactive** (`isActive: false`)
   - Alert is disabled
   - Won't be checked

## Email Notification Status

### Current Implementation
- ✅ Alert detection works
- ✅ Console logging works
- ✅ Database updates work
- ⏳ Email sending is TODO (not yet implemented)

### What Happens Now
When alert triggers:
1. Console logs the notification details
2. Database marks alert as `notified: true`
3. Email would be sent here (when configured)

### To Implement Email
Edit `helpers/priceHistoryTracker.js` line 95:
```javascript
// TODO: Implement email notification
// await sendPriceAlertEmail(alert.email, product, variant, currentPrice, alert.targetPrice);
```

You need to:
1. Install email service (nodemailer, SendGrid, etc.)
2. Configure SMTP settings
3. Create email template
4. Uncomment and implement the function

## Testing Checklist

- [ ] Set alert with target price above current price
- [ ] Check database for alert record
- [ ] Visit `/api/manual-check-alerts` to trigger check
- [ ] Check server console for notification logs
- [ ] Verify database shows `notified: true`
- [ ] Confirm alert won't trigger again (already notified)
- [ ] Update alert to reset `notified` to `false`
- [ ] Trigger check again to see it notify again

## Common Scenarios

### Scenario 1: Price Already Below Target (Your Case)
- Current: ₹21,000
- Target: ₹32,000
- Result: ✅ Notified immediately at next check

### Scenario 2: Price Above Target
- Current: ₹50,000
- Target: ₹32,000
- Result: ⏳ Wait until price drops to ₹32,000 or below

### Scenario 3: Price Drops to Exact Target
- Current: ₹32,000
- Target: ₹32,000
- Result: ✅ Notified (≤ includes equal)

### Scenario 4: Price Drops Below Target
- Current: ₹30,000
- Target: ₹32,000
- Result: ✅ Notified

## Troubleshooting

### Alert Not Triggering

**Check 1: Is alert active?**
```javascript
db.pricealerts.find({ productId: "YOUR_PRODUCT_ID" })
```
Verify: `isActive: true, notified: false`

**Check 2: Is cron job running?**
Check server logs for:
```
Price alert cron job scheduled - will run every hour
Price history recording scheduled - will run daily at 9:30 AM
```

**Check 3: Is price condition met?**
```javascript
currentPrice <= targetPrice
```

**Check 4: Manual trigger**
Visit: `/api/manual-check-alerts`

### Database Issues

**Reset alert to trigger again:**
```javascript
db.pricealerts.updateOne(
  { _id: ObjectId("YOUR_ALERT_ID") },
  { $set: { notified: false } }
)
```

**Check all alerts:**
```javascript
db.pricealerts.find().pretty()
```

**Check price history:**
```javascript
db.pricehistories.find({ productId: ObjectId("YOUR_PRODUCT_ID") }).sort({ date: -1 }).limit(10)
```

## Next Steps

1. **Test Now:**
   - Visit `/api/manual-check-alerts`
   - Check console logs
   - Verify database update

2. **Configure Email:**
   - Choose email service
   - Add credentials to `.env`
   - Implement email function
   - Test email delivery

3. **Monitor:**
   - Check logs at 9:30 AM daily
   - Verify alerts are triggering
   - Monitor database growth

4. **Optimize:**
   - Add email templates
   - Implement retry logic
   - Add user notification preferences
   - Create alert management dashboard

## Important Notes

- ⏰ Cron runs at 9:30 AM daily (configurable in `server.js`)
- 📧 Email service needs to be configured separately
- 🔄 Alerts only trigger once (until updated)
- 💾 Price history is recorded daily
- 🧹 Old history (180+ days) is cleaned weekly
- ✅ Manual trigger available for testing anytime
