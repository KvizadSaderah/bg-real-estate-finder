# 🏠 Real Estate Monitoring Setup Guide

This guide will help you set up automated monitoring for new rental listings with notifications.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Configuration

First, create your monitoring configuration:

```bash
npm run monitor config
```

This creates a default config file at `config/app-config.json`.

### 3. Set Up Email Notifications (Recommended)

```bash
npm run monitor setup-email \
  --host smtp.gmail.com \
  --user your-email@gmail.com \
  --pass your-app-password \
  --from your-email@gmail.com \
  --to your-email@gmail.com
```

**For Gmail users:**
1. Enable 2-factor authentication
2. Generate an app password: https://myaccount.google.com/apppasswords
3. Use the app password instead of your regular password

### 4. Test Notifications

```bash
npm run monitor test-notifications
```

### 5. Start Monitoring

**Run once:**
```bash
npm run monitor:run
```

**Run continuously (daemon mode):**
```bash
npm run monitor:start
```

## 📋 Configuration Options

### Set Price Filters

```bash
npm run monitor set-price-filter --min 800 --max 2000
```

### Set Check Interval

```bash
# Every 5 minutes
npm run monitor set-interval "*/5 * * * *"

# Every 10 minutes (default)
npm run monitor set-interval "*/10 * * * *"

# Every hour
npm run monitor set-interval "0 * * * *"
```

### Add Custom Search URLs

```bash
npm run monitor add-source \
  --id ues_bg_custom \
  --name "UES.bg Custom Search" \
  --url "https://ues.bg/bg/find?form_action=search&property_type=for_rent&property_kind=apartament&city_id=66" \
  --pages 5
```

## 🔧 Advanced Configuration

Edit `config/app-config.json` directly for more advanced settings:

```json
{
  "monitoring": {
    "enabled": true,
    "checkInterval": "*/10 * * * *",
    "sources": [
      {
        "id": "ues_bg",
        "name": "UES.bg",
        "searchUrls": [
          "https://ues.bg/bg/find?form_action=search&property_type=for_rent&property_kind=apartament&city_id=66"
        ],
        "maxPages": 3
      }
    ],
    "filters": {
      "minPrice": 500,
      "maxPrice": 2000,
      "cities": ["Sofia", "София"],
      "propertyTypes": ["Апартамент", "Студио"]
    }
  },
  "notifications": {
    "email": {
      "enabled": true,
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUser": "your-email@gmail.com",
      "smtpPass": "your-app-password",
      "fromEmail": "your-email@gmail.com",
      "toEmail": "your-email@gmail.com"
    },
    "webhook": {
      "enabled": false,
      "url": "",
      "headers": {}
    },
    "desktop": {
      "enabled": true
    }
  }
}
```

## 📊 Monitoring Commands

### Check Status
```bash
npm run monitor:status
```

### View Configuration
```bash
npm run monitor:config
```

### Run Single Check
```bash
npm run monitor:run
```

### Start Continuous Monitoring
```bash
npm run monitor:start
```

## 🌐 Web Interface

Start the web interface to view properties and market trends:

```bash
npm run web
```

Then visit: http://localhost:3000

Features:
- ✅ Browse all properties with advanced filters
- ✅ Market trends and price analysis
- ✅ Interactive charts and statistics
- ✅ Favorites and recently viewed
- ✅ Property comparison

## 🔄 Cron Schedule Examples

```bash
# Every 5 minutes
"*/5 * * * *"

# Every 10 minutes (recommended)
"*/10 * * * *" 

# Every 15 minutes
"*/15 * * * *"

# Every hour
"0 * * * *"

# Every hour during business hours (9 AM - 6 PM)
"0 9-18 * * *"

# Every 30 minutes during business hours, weekdays only
"*/30 9-18 * * 1-5"
```

## 📧 Email Template

When new properties are found, you'll receive emails with:

- 📊 Property count and summary
- 💰 Price and price per m²
- 📍 Location details
- 🏠 Area and room information
- 🔗 Direct links to view properties
- 🏆 TOP/VIP offer badges

## 🚨 Troubleshooting

### Email Issues

**Gmail "App Password Required":**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Generate App Password
4. Use app password in configuration

**Connection Timeout:**
```bash
# Test email configuration
npm run monitor test-notifications
```

### Database Issues

```bash
# Check database connection
npm run db:status

# Initialize database
npm run db:init
```

### No Properties Found

1. Check if your filters are too restrictive
2. Verify search URLs are working
3. Check recent monitoring sessions:
   ```bash
   npm run monitor:status
   ```

## 🎯 Recommended Setup for Apartment Hunting

```bash
# 1. Set up email notifications
npm run monitor setup-email --host smtp.gmail.com --user youremail@gmail.com --pass your-app-password --from youremail@gmail.com --to youremail@gmail.com

# 2. Set reasonable price range (adjust for your budget)
npm run monitor set-price-filter --min 800 --max 1500

# 3. Set frequent checks during active hours
npm run monitor set-interval "*/5 * * * *"

# 4. Start monitoring
npm run monitor:start

# 5. Open web interface to view trends
npm run web
```

## 📈 Market Analysis

The web interface provides powerful market analysis:

- **Price Trends**: Track average prices over time
- **Property Types**: Distribution of available properties  
- **Area Analysis**: Price ranges by apartment size
- **Neighborhood Rankings**: Most active areas
- **Price Changes**: Track which properties changed prices

This helps you understand:
- ✅ Is the market getting more or less expensive?
- ✅ Which neighborhoods have the most options?
- ✅ What's the typical price for your preferred size?
- ✅ Are there any price drops you should investigate?

## 🎯 Tips for Success

1. **Start with broader filters** - You can always narrow them down
2. **Check the web interface regularly** - Market trends help you make informed decisions
3. **Set up multiple search configurations** - Different areas, property types, price ranges
4. **Monitor during business hours** - Most new listings appear 9 AM - 6 PM
5. **Act fast on good properties** - Set up instant notifications for competitive markets