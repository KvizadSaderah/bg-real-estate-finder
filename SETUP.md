# 🛠️ Complete Setup Guide

Step-by-step guide for setting up the Real Estate Aggregator for Sofia, Bulgaria.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [AI Setup (Optional)](#ai-setup-optional)
6. [Running the Aggregator](#running-the-aggregator)
7. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js** (v18 or higher)
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

- **npm** (v9 or higher)
  ```bash
  npm --version  # Should be v9.0.0 or higher
  ```

- **PostgreSQL** (v14 or higher)
  ```bash
  psql --version  # Should be v14.0 or higher
  ```

### Optional (for AI validation)

- **Google Gemini API Key** (FREE) - [Get it here](https://makersuite.google.com/app/apikey)
- **OpenAI API Key** (Paid) - [Get it here](https://platform.openai.com/api-keys)

---

## 📥 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/bg-real-estate-finder.git
cd bg-real-estate-finder
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- TypeScript
- Playwright (browser automation)
- PostgreSQL client
- Express (web server)
- All other dependencies

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

---

## 🗄️ Database Setup

### Option 1: Automatic Setup (Recommended)

```bash
# This script creates database, tables, and sets up everything
npm run setup
```

### Option 2: Manual Setup

#### Step 1: Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE real_estate;

# Create user (optional)
CREATE USER realestate_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE real_estate TO realestate_user;

# Exit
\q
```

#### Step 2: Configure Database Connection

Create `.env` file in project root:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=real_estate
DB_USER=realestate_user
DB_PASSWORD=your_password

# Optional: Connection pool settings
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
```

#### Step 3: Initialize Tables

```bash
npm run db:init
```

This creates the following tables:
- `properties` - All property listings
- `agencies` - Real estate agencies
- `monitoring_logs` - Activity logs
- `statistics` - Analytics data

#### Step 4: Verify Setup

```bash
npm run db:status
```

You should see:
```
✅ Database connected
✅ Tables created
✅ Ready to use
```

---

## ⚙️ Configuration

### 1. Environment Variables

Create `.env` file (copy from example):

```bash
cp .env.example .env
nano .env
```

**Minimal Configuration:**

```bash
# Database (required)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=real_estate
DB_USER=realestate_user
DB_PASSWORD=your_password

# AI Provider (optional - system works without it!)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key_here
# OR
# AI_PROVIDER=openai
# OPENAI_API_KEY=your_openai_key_here
```

### 2. Parser Configuration

The parser configuration is stored in `config/parser-config.json`.

**Default configuration includes 5 agencies:**
- UES.bg
- Luximmo.bg
- Bulgarian Properties
- Yavlena.com
- Address.bg

To view current configuration:
```bash
npm run aggregator:list
```

### 3. Aggregator Settings

Configure the automatic aggregator:

```bash
# Set price range
npm run auto:config -- --min-price 500 --max-price 2000

# Set check interval (cron format)
npm run auto:config -- --interval "*/15 * * * *"  # Every 15 minutes

# Enable monitoring
npm run auto:config -- --enable

# View current settings
npm run auto:config -- --show
```

**Cron Interval Examples:**
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes (default)
- `*/30 * * * *` - Every 30 minutes
- `0 */2 * * *` - Every 2 hours
- `0 9-18 * * *` - Every hour from 9 AM to 6 PM

---

## 🤖 AI Setup (Optional)

The system works perfectly **WITHOUT** AI using local validation. AI is optional for enhanced validation.

### Why Use AI?

- ✅ More detailed validation feedback
- ✅ Better selector quality assessment
- ✅ Enhanced price realism checks
- ✅ Detailed suggestions for improvements

### Why NOT Use AI?

- ✅ Local validation is FREE
- ✅ Local validation is FAST (<10ms)
- ✅ No API dependencies
- ✅ No rate limits

### Setup Google Gemini (FREE, Recommended)

#### 1. Get API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

#### 2. Configure

Add to `.env`:
```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your_api_key_here
```

#### 3. Test

```bash
npm run aggregator:analyze https://ues.bg --name "UES" --ai
```

You should see:
```
🤖 AI VALIDATION RESULTS
Overall Score: 85/100
✅ High quality selectors detected
✅ Price realistic for Sofia market
```

### Setup OpenAI (Paid, Alternative)

#### 1. Get API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. Add credits to your account

#### 2. Configure

Add to `.env`:
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your_key_here
```

#### 3. Test

Same as Gemini - just use `--ai` flag:
```bash
npm run aggregator:analyze https://ues.bg --name "UES" --ai
```

---

## 🚀 Running the Aggregator

### Quick Start (Recommended)

```bash
# 1. One-time setup
npm run auto:setup

# 2. Start monitoring
npm run auto:start
```

That's it! The system will now:
- ✅ Monitor 5 agencies automatically
- ✅ Check for new listings every 15 minutes
- ✅ Validate all data with Reality Check
- ✅ Store everything in database
- ✅ Show statistics

### Manual Control

#### Single Run (Testing)

```bash
# Test all agencies once
npm run auto:once

# Test specific agency
npm run aggregator:run ues.bg
```

#### Continuous Monitoring

```bash
# Start monitoring (foreground)
npm run auto:start

# Start monitoring (background with PM2)
pm2 start npm --name "real-estate-monitor" -- run auto:start
pm2 logs real-estate-monitor
```

#### Check Status

```bash
# View status
npm run auto:status

# View statistics
npm run aggregator:stats
```

---

## 🌐 Web Interface

Start the web UI to browse listings:

```bash
npm run web
```

Then open: http://localhost:3000

**Features:**
- 🔍 Advanced search and filters
- 📈 Market analytics
- 📊 Price trends by district
- 📸 Photo galleries
- ⭐ Save favorites
- 📱 Mobile responsive

---

## 🔍 Adding New Agencies

### Automatic Detection

```bash
# Analyze agency site (without AI)
npm run aggregator:analyze https://new-agency.bg \
  --name "New Agency" \
  --save

# With AI validation (recommended)
npm run aggregator:analyze https://new-agency.bg \
  --name "New Agency" \
  --ai \
  --save
```

The analyzer will:
1. Visit the site
2. Detect listing structure
3. Find selectors for: title, price, area, location, images
4. Test pagination
5. Validate with Reality Check
6. Save configuration

### Manual Configuration

Edit `config/parser-config.json`:

```json
{
  "sites": [
    {
      "id": "new-agency",
      "name": "New Agency",
      "baseUrl": "https://new-agency.bg",
      "enabled": true,
      "searchUrls": [
        "https://new-agency.bg/rentals?city=sofia"
      ],
      "selectors": {
        "listingCard": ".property-card",
        "title": ".property-title",
        "price": ".price",
        "location": ".location",
        "area": ".area",
        "rooms": ".rooms",
        "image": "img.property-image",
        "link": "a.property-link"
      },
      "pagination": {
        "type": "click",
        "nextButton": ".next-page"
      },
      "maxPages": 5
    }
  ]
}
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Tests

```bash
# Test Reality Check
npm run test:reality-check

# Test AI Validation
npm run test:ai

# Test Analyzer
npm run test:analyzer

# Test with coverage
npm run test:coverage
```

---

## 🐛 Troubleshooting

### Database Connection Issues

**Problem:** `ECONNREFUSED` or connection timeout

**Solutions:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check connection settings in .env
cat .env | grep DB_
```

### Playwright Browser Issues

**Problem:** `browserType.launch: Executable doesn't exist`

**Solution:**
```bash
# Install browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Permission Denied

**Problem:** Cannot write to `output/` directory

**Solution:**
```bash
# Create output directories
mkdir -p output/rentals output/sales output/analysis

# Fix permissions
chmod -R 755 output/
```

### AI Validation Not Working

**Problem:** AI validation fails or skips

**Solutions:**

1. **Check API key:**
   ```bash
   # Print (don't commit!)
   cat .env | grep API_KEY
   ```

2. **Test API key:**
   ```bash
   # For Gemini
   curl -H "Content-Type: application/json" \
     "https://generativelanguage.googleapis.com/v1/models?key=YOUR_KEY"

   # Should return list of models
   ```

3. **Use local validation:**
   ```bash
   # Just remove --ai flag
   npm run aggregator:analyze https://site.bg --name "Site" --save
   ```

### No Listings Found

**Problem:** Parser returns empty results

**Solutions:**

1. **Test manually:**
   ```bash
   npm run aggregator:analyze https://site.bg --name "Site"
   # Check if selectors are detected
   ```

2. **Check site structure:**
   - Open site in browser
   - Inspect HTML elements
   - Update selectors in `config/parser-config.json`

3. **Check rate limits:**
   ```json
   {
     "rateLimit": {
       "requestsPerMinute": 30,  // Reduce if getting blocked
       "delayBetweenPages": 2000  // Increase delay
     }
   }
   ```

### Reality Check Too Strict

**Problem:** All listings fail Reality Check

**Solution:**

Check the validation scores:
```bash
npm run aggregator:run site --verbose
```

If many valid listings fail, you may need to adjust market data in:
`src/ai/RealityCheckService.ts`

**Note:** Reality Check is calibrated for Sofia, Bulgaria market (2024-2025). Prices in other cities or time periods may differ.

---

## 📞 Getting Help

If you're still having issues:

1. **Check logs:**
   ```bash
   # View recent activity
   npm run db -- logs --limit 50
   ```

2. **Check database:**
   ```bash
   npm run db:status
   ```

3. **Run diagnostics:**
   ```bash
   npm run auto:status
   npm run aggregator:stats
   ```

4. **Review documentation:**
   - [AGGREGATOR_GUIDE.md](./AGGREGATOR_GUIDE.md) - Complete guide
   - [AI_VALIDATION_GUIDE.md](./AI_VALIDATION_GUIDE.md) - AI setup
   - [REALITY_CHECK_IMPROVEMENTS.md](./REALITY_CHECK_IMPROVEMENTS.md) - Reality Check details

5. **Open an issue:**
   - Include error messages
   - Include relevant logs
   - Describe what you tried

---

## ✅ Next Steps

After setup is complete:

1. ✅ **Configure filters** for your needs
2. ✅ **Start monitoring** and let it run
3. ✅ **Check web interface** to browse listings
4. ✅ **Add more agencies** as needed
5. ✅ **Setup notifications** (see MONITORING_SETUP.md)

---

**You're all set! Happy apartment hunting! 🏠✨**
