# 🏠 Real Estate Aggregator for Sofia, Bulgaria

Automatic real estate aggregator with AI validation, reality checks, and monitoring for Sofia, Bulgaria. Collects listings from 5+ major agencies automatically.

## ✨ Key Features

- 🔄 **Automatic Aggregation** - Monitors 5+ real estate agencies
- 🤖 **AI Validation** - Quality checks with Google Gemini & OpenAI (optional)
- ✅ **Reality Check** - Validates prices against Sofia market data (2024-2025)
- 📊 **Smart Filtering** - Price, area, location, property type
- 💾 **Database Storage** - PostgreSQL with full history
- 🌐 **Web Interface** - Beautiful UI for browsing listings
- 📈 **Analytics** - Market trends, statistics, insights
- 🆓 **Works Without AI** - Local validation always available

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Initialize database
npm run db:init

# 3. Setup aggregator (auto-configures 5 agencies)
npm run auto:setup

# 4. Start automatic monitoring
npm run auto:start
```

**Done!** The system now automatically collects new listings every 15 minutes.

## 🏢 Configured Agencies

1. ✅ **UES.bg** - Unique Estates
2. ✅ **Luximmo.bg** - Luximmo Finest Estates
3. ✅ **BulgarianProperties.com** - Bulgarian Properties
4. ✅ **Yavlena.com** - Yavlena (Явлена)
5. ✅ **Address.bg** - АДРЕС Real Estate

+ Easily add any other agency automatically!

## 📋 Available Commands

### Automatic Monitoring

```bash
# Start continuous monitoring (every 15 min)
npm run auto:start

# Single run (for testing)
npm run auto:once

# Check status
npm run auto:status

# Configure filters
npm run auto:config -- --min-price 500 --max-price 2000
```

### Agency Management

```bash
# List all agencies
npm run aggregator:list

# Add new agency automatically (with AI validation)
npm run aggregator:analyze https://new-agency.bg --name "Agency" --ai --save

# Enable/disable agency
npm run aggregator toggle agency_id

# View statistics
npm run aggregator:stats
```

### Manual Search (Legacy)

```bash
npm run rent -- [options]
```

**Filter options:**
- `--city <city>` - sofia, plovdiv, varna, burgas, all (default: all)
- `--type <type>` - apartament, kashta, ofis, studio, staya, all (default: all)
- `--price-min <price>` - minimum price in EUR
- `--price-max <price>` - maximum price in EUR
- `--area-min <area>` - minimum area in sqm
- `--area-max <area>` - maximum area in sqm
- `--rooms <count>` - number of rooms (1,2,3,4,5+)
- `--furnished` - furnished properties only
- `--debug` - show debug info
- `--output <file>` - output filename

## 🤖 AI Validation & Reality Check

### Reality Check Features

The system validates all listings against **Sofia market data (2024-2025)**:

✅ **6 Validation Categories:**
1. **Price Range** - Validates against market by rooms/area
2. **Price per sqm** - Checks €5-25/m² range (typical €8-15)
3. **Area Size** - Validates 25-250 m² range
4. **Rooms to Area** - Checks proper room/area proportions
5. **Neighborhood** - Validates against 40+ Sofia districts
6. **Data Completeness** - Checks required fields

### Works WITHOUT AI!

```bash
# Local validation (always works, FREE, <10ms)
npm run aggregator:analyze https://site.bg --name "Site" --save

# With AI enhancement (optional, requires API key)
npm run aggregator:analyze https://site.bg --name "Site" --ai --save
```

### Setup AI (Optional)

```bash
# 1. Get FREE API key from Google Gemini
# https://makersuite.google.com/app/apikey

# 2. Create .env file
cp .env.example .env

# 3. Add your key
echo "AI_PROVIDER=gemini" >> .env
echo "GEMINI_API_KEY=your_key_here" >> .env
```

**AI validates:**
- ✅ Selector quality
- ✅ Data correctness
- ✅ Price realism for Sofia
- ✅ Information completeness

## 📊 Usage Examples

### Monitor Budget Apartments

```bash
npm run auto:config -- --min-price 400 --max-price 800 --enable
npm run auto:config -- --interval "*/5 * * * *"
npm run auto:start
```

### Monitor Premium Segment

```bash
npm run auto:config -- --min-price 2000 --max-price 5000
npm run auto:start
```

### Add New Agency

```bash
npm run aggregator:analyze https://new-agency.bg \
  --name "New Agency" \
  --ai \
  --save
```

## 📁 Output Structure

Results are saved to:
- `output/rentals/` - rental search results
- `output/sales/` - sales search results
- `output/analysis/` - site analysis results

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Automatic Monitoring                │
│         (every 15 min by default)           │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐    ┌────────▼────────┐
│   Agencies   │    │   PostgreSQL    │
│              │    │    Database     │
│ • UES.bg     │───▶│                 │
│ • Luximmo    │    │ • Listings      │
│ • Yavlena    │    │ • History       │
│ • Address    │    │ • Statistics    │
│ • ...        │    │                 │
└──────────────┘    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Web Interface  │
                    │  + API          │
                    │  Port: 3000     │
                    └─────────────────┘
```

### Key Components

- **AgencyAnalyzer** - Auto-detects site structure and selectors
- **RealityCheckService** - Validates data against Sofia market (2024-2025)
- **AIValidationService** - Optional AI enhancement (Gemini/OpenAI)
- **Configuration System** - Flexible settings per agency
- **Parser Engine** - Pagination and filtering support
- **CLI Interface** - Convenient commands

## 📈 Extracted Data

- Listing title
- Price (EUR/BGN/USD)
- Location (city, district, address)
- Area and number of rooms
- Property type
- Contact information
- Images
- Detailed listing links

## 🔧 Development

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Test specific component
npm run test:reality-check

# Development mode
npm run dev

# Test analyzer
npm run analyze https://ues.bg --save
```

## 🧪 Testing

The project includes comprehensive test suites:

- **RealityCheckService** - Tests for all 6 validation categories
- **AIValidationService** - AI integration tests (with mocks)
- **AgencyAnalyzer** - Site analysis tests
- **ApiParser** - Parser functionality tests

Run all tests:
```bash
npm test
```

## 📚 Documentation

- **[README_RU.md](./README_RU.md)** - Russian documentation (Русская документация)
- **[SETUP.md](./SETUP.md)** - Detailed setup guide
- **[AGGREGATOR_GUIDE.md](./AGGREGATOR_GUIDE.md)** - Complete aggregator guide
- **[AI_VALIDATION_GUIDE.md](./AI_VALIDATION_GUIDE.md)** - AI validation guide 🤖
- **[REALITY_CHECK_IMPROVEMENTS.md](./REALITY_CHECK_IMPROVEMENTS.md)** - Reality Check analysis
- **[MONITORING_SETUP.md](./MONITORING_SETUP.md)** - Notifications setup

## 📝 API for Programmatic Use

```typescript
import { AgencyAnalyzer } from './src/analyzer/AgencyAnalyzer';
import { AIValidationService } from './src/ai/AIValidationService';

// Analyze agency site with AI validation
const analyzer = new AgencyAnalyzer({ useAI: true });
const result = await analyzer.analyzeAgencySite(
  'https://example.com',
  'Example Agency',
  { maxPages: 3 }
);

// Perform reality check
const aiService = new AIValidationService('gemini', 'your-api-key');
const realityCheck = await aiService.realityCheck({
  price: 1200,
  area: 80,
  rooms: 2,
  location: 'Lozenets, Sofia'
});

console.log(`Reality Score: ${realityCheck.score}/100`);
```

## 🛠️ Technologies

- **TypeScript** - Main language
- **Playwright** - Browser automation
- **PostgreSQL** - Database
- **Express** - Web server
- **Node-cron** - Task scheduler
- **Cheerio** - HTML parsing
- **Jest** - Testing framework
- **Google Gemini API** - AI validation (optional)
- **OpenAI GPT API** - AI validation (optional)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT

---

**Happy apartment hunting in Sofia! 🏠✨**