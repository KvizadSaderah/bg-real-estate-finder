import { chromium, Browser, Page } from 'playwright';
import { ParserSite, FieldMapping } from '../config/ParserConfig';
import { AIValidationService, createAIServiceFromEnv, PropertyData, ValidationResult, RealityCheckResult } from '../ai/AIValidationService';

export interface AnalysisResult {
  success: boolean;
  siteId: string;
  siteName: string;
  baseUrl: string;
  searchUrls: string[];
  aiValidation?: {
    enabled: boolean;
    selectorQuality: ValidationResult;
    dataQuality: ValidationResult[];
    realityChecks: RealityCheckResult[];
    overallScore: number;
  };
  detectedSelectors: {
    propertyLinks?: string;
    nextPageButton?: string;
    title?: FieldMapping;
    price?: FieldMapping;
    area?: FieldMapping;
    rooms?: FieldMapping;
    city?: FieldMapping;
    quarter?: FieldMapping;
    description?: FieldMapping;
    images?: FieldMapping;
    phone?: FieldMapping;
  };
  recommendations: string[];
  warnings: string[];
  sampleData?: {
    listingsFound: number;
    exampleListings: any[];
  };
}

export class AgencyAnalyzer {
  private browser: Browser | null = null;
  private aiService: AIValidationService | null = null;
  private useAI: boolean = false;

  constructor(options: { useAI?: boolean } = {}) {
    this.useAI = options.useAI ?? false;
    if (this.useAI) {
      this.aiService = createAIServiceFromEnv();
      if (this.aiService) {
        console.log('  🤖 AI validation enabled');
      } else {
        console.log('  ⚠️  AI validation requested but no API key found');
        this.useAI = false;
      }
    }
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Analyze a real estate agency website to detect structure and selectors
   */
  async analyzeAgencySite(
    url: string,
    siteName: string,
    options: {
      searchForRentals?: boolean;
      city?: string;
    } = {}
  ): Promise<AnalysisResult> {
    await this.initialize();

    const result: AnalysisResult = {
      success: false,
      siteId: this.generateSiteId(siteName, url),
      siteName,
      baseUrl: new URL(url).origin,
      searchUrls: [],
      detectedSelectors: {},
      recommendations: [],
      warnings: []
    };

    try {
      const page = await this.browser!.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      console.log(`🔍 Analyzing ${siteName}...`);
      console.log(`📍 URL: ${url}`);

      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for dynamic content

      // Detect if site uses API or server-side rendering
      const apiCalls = await this.detectApiCalls(page);
      if (apiCalls.length > 0) {
        result.recommendations.push(`Site uses API: ${apiCalls.join(', ')}`);
        console.log(`  📡 API detected: ${apiCalls.length} endpoints`);
      }

      // Detect property listing structure
      const listingDetection = await this.detectListingStructure(page);
      result.detectedSelectors = listingDetection.selectors;
      result.sampleData = listingDetection.sampleData;

      // Find search URLs for rentals in Sofia
      if (options.searchForRentals) {
        const searchUrls = await this.findRentalSearchUrls(page, options.city || 'sofia');
        result.searchUrls = searchUrls;
      }

      // Detect pagination
      const paginationInfo = await this.detectPagination(page);
      if (paginationInfo.nextButton) {
        result.detectedSelectors.nextPageButton = paginationInfo.nextButton;
      }
      if (paginationInfo.type) {
        result.recommendations.push(`Pagination type: ${paginationInfo.type}`);
      }

      // Visit a sample property to detect detail page selectors
      if (listingDetection.sampleUrls && listingDetection.sampleUrls.length > 0) {
        console.log(`  🏠 Analyzing sample property page...`);
        const detailSelectors = await this.analyzePropertyDetailPage(
          listingDetection.sampleUrls[0]
        );
        result.detectedSelectors = { ...result.detectedSelectors, ...detailSelectors };
      }

      result.success = true;
      console.log(`✅ Analysis complete for ${siteName}`);

      await page.close();

      // AI-powered validation if enabled
      if (this.useAI && this.aiService && result.success) {
        console.log(`  🤖 Running AI validation...`);
        result.aiValidation = await this.performAIValidation(result, url);
      }
    } catch (error) {
      result.success = false;
      result.warnings.push(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`❌ Analysis failed for ${siteName}:`, error);
    }

    return result;
  }

  /**
   * Perform comprehensive AI validation
   */
  private async performAIValidation(
    result: AnalysisResult,
    siteUrl: string
  ): Promise<AnalysisResult['aiValidation']> {
    if (!this.aiService) {
      return undefined;
    }

    const dataQualityResults: ValidationResult[] = [];
    const realityCheckResults: RealityCheckResult[] = [];

    try {
      // Validate selector quality
      console.log(`    🔍 Validating selector quality...`);
      const selectorQuality = await this.aiService.validateSelectors(
        result.detectedSelectors,
        result.sampleData?.exampleListings || [],
        siteUrl
      );

      // Validate sample data quality
      if (result.sampleData?.exampleListings) {
        console.log(`    🔍 Validating extracted data quality...`);
        for (const listing of result.sampleData.exampleListings.slice(0, 3)) {
          const dataValidation = await this.aiService.validatePropertyData(
            this.convertToPropertyData(listing),
            siteUrl
          );
          dataQualityResults.push(dataValidation);

          // Reality check
          const realityCheck = await this.aiService.realityCheck(
            this.convertToPropertyData(listing)
          );
          realityCheckResults.push(realityCheck);
        }
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        selectorQuality,
        dataQualityResults,
        realityCheckResults
      );

      console.log(`    ✅ AI Validation Score: ${overallScore}/100`);
      if (selectorQuality.confidence < 70) {
        console.log(`    ⚠️  Low selector confidence: ${selectorQuality.confidence}%`);
      }

      const failedChecks = realityCheckResults.filter(r => !r.passed);
      if (failedChecks.length > 0) {
        console.log(`    ⚠️  ${failedChecks.length} reality check(s) failed`);
      }

      return {
        enabled: true,
        selectorQuality,
        dataQuality: dataQualityResults,
        realityChecks: realityCheckResults,
        overallScore
      };
    } catch (error) {
      console.error(`    ❌ AI validation error:`, error);
      return {
        enabled: true,
        selectorQuality: {
          isValid: true,
          confidence: 50,
          issues: ['AI validation failed'],
          suggestions: [],
          reasoning: `Error: ${error}`
        },
        dataQuality: [],
        realityChecks: [],
        overallScore: 50
      };
    }
  }

  /**
   * Convert listing data to PropertyData format
   */
  private convertToPropertyData(listing: any): PropertyData {
    return {
      title: listing.title,
      price: this.extractNumber(listing.price),
      area: this.extractNumber(listing.area),
      city: listing.location || listing.city,
      description: listing.description
    };
  }

  /**
   * Extract number from string
   */
  private extractNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const match = value.match(/\d+/);
      return match ? parseInt(match[0]) : undefined;
    }
    return undefined;
  }

  /**
   * Calculate overall AI validation score
   */
  private calculateOverallScore(
    selectorQuality: ValidationResult,
    dataQuality: ValidationResult[],
    realityChecks: RealityCheckResult[]
  ): number {
    let totalScore = 0;
    let weights = 0;

    // Selector quality: 40% weight
    totalScore += selectorQuality.confidence * 0.4;
    weights += 0.4;

    // Data quality: 30% weight
    if (dataQuality.length > 0) {
      const avgDataQuality = dataQuality.reduce((sum, v) => sum + v.confidence, 0) / dataQuality.length;
      totalScore += avgDataQuality * 0.3;
      weights += 0.3;
    }

    // Reality checks: 30% weight
    if (realityChecks.length > 0) {
      const avgRealityScore = realityChecks.reduce((sum, r) => sum + r.score, 0) / realityChecks.length;
      totalScore += avgRealityScore * 0.3;
      weights += 0.3;
    }

    return Math.round(totalScore / weights);
  }

  /**
   * Detect API calls made by the page
   */
  private async detectApiCalls(page: Page): Promise<string[]> {
    const apiUrls: Set<string> = new Set();

    // Listen to network requests
    page.on('response', response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (
        contentType.includes('application/json') &&
        (url.includes('/api/') || url.includes('/search') || url.includes('/offer'))
      ) {
        apiUrls.add(url);
      }
    });

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(2000);

    return Array.from(apiUrls);
  }

  /**
   * Detect property listing structure on the page
   */
  private async detectListingStructure(page: Page): Promise<{
    selectors: any;
    sampleData?: any;
    sampleUrls?: string[];
  }> {
    const result: any = {
      selectors: {},
      sampleUrls: []
    };

    try {
      // Common patterns for property listings
      const listingPatterns = [
        '.property', '.listing', '.offer', '.estate-item', '.property-card',
        '[class*="property"]', '[class*="listing"]', '[class*="offer"]',
        '[data-property]', '[data-listing]', 'article', '.card'
      ];

      // Try to find property containers
      let propertySelector = '';
      let maxCount = 0;

      for (const pattern of listingPatterns) {
        const count = await page.locator(pattern).count();
        if (count > maxCount && count >= 3) { // At least 3 listings
          maxCount = count;
          propertySelector = pattern;
        }
      }

      if (propertySelector) {
        console.log(`  📋 Found ${maxCount} listings with selector: ${propertySelector}`);

        // Find links to property pages
        const linkPatterns = ['a', 'a[href*="details"]', 'a[href*="property"]', 'a[href*="offer"]'];
        for (const linkPattern of linkPatterns) {
          const fullSelector = `${propertySelector} ${linkPattern}`;
          const links = await page.locator(fullSelector).evaluateAll((elements: any[]) => {
            return elements
              .map(el => el.href)
              .filter((href: string) => href && !href.includes('#') && !href.includes('javascript:'));
          });

          if (links.length > 0) {
            result.selectors.propertyLinks = fullSelector;
            result.sampleUrls = links.slice(0, 3); // First 3 URLs for testing
            console.log(`  🔗 Found ${links.length} property links`);
            break;
          }
        }

        // Try to extract sample data from first few listings
        const sampleListings = await page.locator(propertySelector).first().evaluate((el: any) => {
          const getText = (selector: string) => {
            const elem = el.querySelector(selector);
            return elem ? elem.textContent?.trim() : null;
          };

          return {
            title: getText('h1, h2, h3, .title, [class*="title"]'),
            price: getText('[class*="price"], .price'),
            area: getText('[class*="area"], .area'),
            location: getText('[class*="location"], .location, [class*="city"]')
          };
        });

        result.sampleData = {
          listingsFound: maxCount,
          exampleListings: [sampleListings]
        };
      } else {
        console.log(`  ⚠️ Could not detect property listing structure`);
      }

    } catch (error) {
      console.error(`  ❌ Error detecting listing structure:`, error);
    }

    return result;
  }

  /**
   * Analyze property detail page to detect selectors
   */
  private async analyzePropertyDetailPage(url: string): Promise<any> {
    const selectors: any = {};

    try {
      const page = await this.browser!.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      console.log(`  📄 Analyzing detail page: ${url}`);

      // Detect title
      const titleSelectors = ['h1', '.property-title', '[class*="title"]', '.title'];
      for (const sel of titleSelectors) {
        const text = await page.locator(sel).first().textContent().catch(() => null);
        if (text && text.trim().length > 10) {
          selectors.title = {
            selector: sel,
            attribute: 'text',
            required: true
          };
          console.log(`    ✓ Title: ${sel}`);
          break;
        }
      }

      // Detect price
      const priceSelectors = [
        '.price', '[class*="price"]', '.property-price',
        '[data-price]', '.cost', '[class*="cost"]'
      ];
      for (const sel of priceSelectors) {
        const text = await page.locator(sel).first().textContent().catch(() => null);
        if (text && /\d+/.test(text)) {
          selectors.price = {
            selector: sel,
            attribute: 'text',
            transform: 'currency',
            regex: '\\d+',
            required: true
          };
          console.log(`    ✓ Price: ${sel}`);
          break;
        }
      }

      // Detect area
      const areaSelectors = [
        '[class*="area"]', '.area', '[class*="size"]',
        '[data-area]', 'span:has-text("кв.м")', 'span:has-text("m²")'
      ];
      for (const sel of areaSelectors) {
        const text = await page.locator(sel).first().textContent().catch(() => null);
        if (text && /\d+/.test(text)) {
          selectors.area = {
            selector: sel,
            attribute: 'text',
            transform: 'area',
            regex: '\\d+(\\.\\d+)?'
          };
          console.log(`    ✓ Area: ${sel}`);
          break;
        }
      }

      // Detect city/location
      const locationSelectors = [
        '.city', '[class*="city"]', '.location', '[class*="location"]',
        '[class*="address"]', '.address'
      ];
      for (const sel of locationSelectors) {
        const text = await page.locator(sel).first().textContent().catch(() => null);
        if (text && text.trim().length > 2) {
          selectors.city = {
            selector: sel,
            attribute: 'text',
            required: true
          };
          console.log(`    ✓ City: ${sel}`);
          break;
        }
      }

      // Detect description
      const descSelectors = [
        '.description', '[class*="description"]', '.property-details',
        '[class*="details"]', 'article', '.content'
      ];
      for (const sel of descSelectors) {
        const text = await page.locator(sel).first().textContent().catch(() => null);
        if (text && text.trim().length > 50) {
          selectors.description = {
            selector: sel,
            attribute: 'text'
          };
          console.log(`    ✓ Description: ${sel}`);
          break;
        }
      }

      // Detect images
      const imageSelectors = [
        '.gallery img', '.property-images img', '[class*="gallery"] img',
        '.slider img', '[class*="photo"] img', 'img[src*="property"]'
      ];
      for (const sel of imageSelectors) {
        const count = await page.locator(sel).count();
        if (count > 0) {
          selectors.images = {
            selector: sel,
            attribute: 'src'
          };
          console.log(`    ✓ Images (${count}): ${sel}`);
          break;
        }
      }

      await page.close();
    } catch (error) {
      console.error(`  ❌ Error analyzing detail page:`, error);
    }

    return selectors;
  }

  /**
   * Detect pagination type and selectors
   */
  private async detectPagination(page: Page): Promise<{
    type?: string;
    nextButton?: string;
  }> {
    const result: any = {};

    try {
      // Check for "next page" button
      const nextButtonSelectors = [
        'a:has-text("Next")', 'a:has-text("Следваща")',
        '.next-page', '[class*="next"]', '.pagination a:last-child',
        'button:has-text("Next")', 'button:has-text("Следваща")'
      ];

      for (const sel of nextButtonSelectors) {
        const exists = await page.locator(sel).count();
        if (exists > 0) {
          result.nextButton = sel;
          result.type = 'button';
          console.log(`  📄 Pagination (button): ${sel}`);
          break;
        }
      }

      // Check for infinite scroll
      if (!result.nextButton) {
        const hasInfiniteScroll = await page.evaluate(() => {
          return document.body.scrollHeight > window.innerHeight * 2;
        });

        if (hasInfiniteScroll) {
          result.type = 'infinite_scroll';
          console.log(`  📄 Pagination: infinite scroll detected`);
        }
      }

    } catch (error) {
      console.error(`  ❌ Error detecting pagination:`, error);
    }

    return result;
  }

  /**
   * Find search URLs for rentals in specified city
   */
  private async findRentalSearchUrls(page: Page, city: string): Promise<string[]> {
    const urls: string[] = [];

    try {
      // Try to find rental links in navigation
      const rentalKeywords = ['наем', 'rent', 'rental', 'под наем', 'апартамент'];
      const cityKeywords = [city, city.toLowerCase(), city.toUpperCase()];

      // Look for links containing rental keywords
      const links = await page.locator('a').evaluateAll((elements: any[]) => {
        return elements
          .map(el => ({
            href: el.href,
            text: el.textContent?.toLowerCase() || ''
          }))
          .filter(link =>
            link.href &&
            !link.href.includes('#') &&
            !link.href.includes('javascript:')
          );
      });

      for (const link of links) {
        const matchesRental = rentalKeywords.some(kw =>
          link.text.includes(kw) || link.href.toLowerCase().includes(kw)
        );
        const matchesCity = cityKeywords.some(kw =>
          link.href.toLowerCase().includes(kw.toLowerCase())
        );

        if (matchesRental && (matchesCity || urls.length === 0)) {
          if (!urls.includes(link.href)) {
            urls.push(link.href);
          }
        }
      }

      if (urls.length > 0) {
        console.log(`  🔍 Found ${urls.length} rental search URLs`);
      }

    } catch (error) {
      console.error(`  ❌ Error finding rental URLs:`, error);
    }

    return urls;
  }

  /**
   * Generate a site ID from name and URL
   */
  private generateSiteId(name: string, url: string): string {
    const domain = new URL(url).hostname
      .replace('www.', '')
      .replace(/\./g, '_');
    return domain;
  }

  /**
   * Convert analysis result to ParserSite configuration
   */
  analysisToConfig(analysis: AnalysisResult, maxPages: number = 5): ParserSite {
    return {
      id: analysis.siteId,
      name: analysis.siteName,
      baseUrl: analysis.baseUrl,
      searchUrls: analysis.searchUrls.length > 0 ? analysis.searchUrls : [analysis.baseUrl],
      enabled: analysis.success,
      maxPages,
      selectors: {
        propertyLinks: analysis.detectedSelectors.propertyLinks || 'a[href*="property"]',
        nextPageButton: analysis.detectedSelectors.nextPageButton,
        title: analysis.detectedSelectors.title || {
          selector: 'h1',
          attribute: 'text',
          required: true
        },
        price: analysis.detectedSelectors.price || {
          selector: '[class*="price"]',
          attribute: 'text',
          transform: 'currency',
          regex: '\\d+',
          required: true
        },
        area: analysis.detectedSelectors.area,
        rooms: analysis.detectedSelectors.rooms,
        city: analysis.detectedSelectors.city || {
          selector: '[class*="city"], [class*="location"]',
          attribute: 'text',
          required: true
        },
        quarter: analysis.detectedSelectors.quarter,
        address: undefined,
        description: analysis.detectedSelectors.description,
        propertyType: undefined,
        images: analysis.detectedSelectors.images,
        phone: analysis.detectedSelectors.phone,
        email: undefined,
        agency: {
          selector: '.agency-name, .broker-name',
          attribute: 'text'
        },
        features: undefined
      },
      waitTimes: {
        betweenPages: 3000,
        betweenProperties: 1500
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      headers: {
        'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8'
      }
    };
  }
}
