import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { SiteConfig, PropertyListing, ParseResult } from '../types';

export class PropertyParser {
  private browser: Browser | null = null;
  private config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
  }

  async parseListings(startUrl?: string): Promise<ParseResult> {
    if (!this.browser) {
      await this.init();
    }

    const startTime = Date.now();
    const listings: PropertyListing[] = [];
    const errors: string[] = [];
    let pagesProcessed = 0;

    try {
      const url = startUrl || this.config.baseUrl;
      console.log(`🚀 Starting to parse: ${url}`);

      if (this.config.type === 'spa') {
        await this.parseSPA(url, listings, errors);
      } else {
        await this.parseStatic(url, listings, errors);
      }

      pagesProcessed = 1; // TODO: Implement proper pagination counting

      const timeElapsed = Date.now() - startTime;
      
      return {
        success: listings.length > 0,
        listings,
        totalFound: listings.length,
        errors,
        config: this.config,
        statistics: {
          pagesProcessed,
          timeElapsed,
          averagePerPage: listings.length / Math.max(pagesProcessed, 1)
        }
      };

    } catch (error) {
      errors.push(`Fatal error: ${error}`);
      return {
        success: false,
        listings,
        totalFound: 0,
        errors,
        config: this.config,
        statistics: {
          pagesProcessed,
          timeElapsed: Date.now() - startTime,
          averagePerPage: 0
        }
      };
    }
  }

  private async parseSPA(url: string, listings: PropertyListing[], errors: string[]): Promise<void> {
    const page = await this.browser!.newPage();
    
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      console.log(`📄 Loading SPA: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Wait for dynamic content to load
      await page.waitForTimeout(3000);
      
      // Try to find listings container
      const containerSelector = this.config.selectors.listingContainer;
      try {
        await page.waitForSelector(containerSelector, { timeout: 10000 });
      } catch {
        console.log(`⚠️  Container selector ${containerSelector} not found, trying alternatives...`);
      }

      // Handle infinite scroll or load more buttons
      if (this.config.pagination.type === 'infinite_scroll') {
        await this.handleInfiniteScroll(page);
      } else if (this.config.pagination.type === 'load_more') {
        await this.handleLoadMore(page);
      }

      // Extract listings
      const pageListings = await this.extractListingsFromPage(page);
      listings.push(...pageListings);
      
      console.log(`✅ Extracted ${pageListings.length} listings from SPA`);

    } catch (error) {
      errors.push(`SPA parsing error: ${error}`);
      console.error('SPA parsing error:', error);
    } finally {
      await page.close();
    }
  }

  private async parseStatic(url: string, listings: PropertyListing[], errors: string[]): Promise<void> {
    const page = await this.browser!.newPage();
    
    try {
      console.log(`📄 Loading static page: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });
      
      const pageListings = await this.extractListingsFromPage(page);
      listings.push(...pageListings);
      
      console.log(`✅ Extracted ${pageListings.length} listings from static page`);

    } catch (error) {
      errors.push(`Static parsing error: ${error}`);
      console.error('Static parsing error:', error);
    } finally {
      await page.close();
    }
  }

  private async handleInfiniteScroll(page: Page, maxScrolls: number = 10): Promise<void> {
    console.log('🔄 Handling infinite scroll...');
    
    for (let i = 0; i < maxScrolls; i++) {
      const beforeHeight = await page.evaluate(() => document.body.scrollHeight);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(2000);
      
      const afterHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (beforeHeight === afterHeight) {
        console.log('📜 Reached end of infinite scroll');
        break;
      }
      
      console.log(`📜 Scroll ${i + 1}/${maxScrolls} - Height: ${beforeHeight} -> ${afterHeight}`);
    }
  }

  private async handleLoadMore(page: Page): Promise<void> {
    console.log('🔄 Handling load more buttons...');
    
    const maxClicks = 10;
    for (let i = 0; i < maxClicks; i++) {
      const loadMoreSelector = this.config.pagination.selector;
      if (!loadMoreSelector) break;
      
      try {
        await page.waitForSelector(loadMoreSelector, { timeout: 5000 });
        await page.click(loadMoreSelector);
        await page.waitForTimeout(this.config.rateLimit.delayBetweenPages);
        console.log(`🔘 Clicked load more button ${i + 1}/${maxClicks}`);
      } catch {
        console.log('🏁 No more load more buttons found');
        break;
      }
    }
  }

  private async extractListingsFromPage(page: Page): Promise<PropertyListing[]> {
    return await page.evaluate((config) => {
      const listings: any[] = [];
      
      // Find listing cards
      const cardSelector = config.selectors.listingCard;
      const cards = document.querySelectorAll(cardSelector);
      
      console.log(`Found ${cards.length} cards with selector: ${cardSelector}`);
      
      cards.forEach((card, index) => {
        try {
          const listing: any = {
            id: `${config.id}_${Date.now()}_${index}`,
            sourceId: config.id,
            externalId: `${index}`,
            scrapedAt: new Date(),
            url: '',
            title: '',
            price: { amount: 0, currency: 'EUR', original: '' },
            location: { city: '', district: '', address: '' },
            details: {
              propertyType: 'apartment' as const,
              transactionType: 'rent' as const // Default to rent for rental searches
            },
            features: [],
            images: [],
            description: ''
          };

          // Extract title
          const titleElement = card.querySelector(config.selectors.title);
          if (titleElement) {
            listing.title = titleElement.textContent?.trim() || '';
          }

          // Extract price
          const priceElement = card.querySelector(config.selectors.price);
          if (priceElement) {
            const priceText = priceElement.textContent?.trim() || '';
            listing.price.original = priceText;
            
            // Extract numeric price - improved regex for Bulgarian rental prices
            const priceMatch = priceText.match(/[\d\s,]+/g);
            if (priceMatch) {
              // Find the largest number (usually the price)
              const numbers = priceMatch.map(match => {
                const cleanPrice = match.replace(/[\s,]/g, '');
                return parseInt(cleanPrice);
              }).filter(num => !isNaN(num) && num > 0);
              
              if (numbers.length > 0) {
                listing.price.amount = Math.max(...numbers);
              }
            }
            
            // Extract currency
            if (priceText.includes('€') || priceText.includes('EUR')) listing.price.currency = 'EUR';
            else if (priceText.includes('$') || priceText.includes('USD')) listing.price.currency = 'USD';
            else if (priceText.includes('лв') || priceText.includes('BGN')) listing.price.currency = 'BGN';
          }

          // Extract location - try multiple approaches
          let locationFound = false;
          
          // Try main location selector
          const locationElement = card.querySelector(config.selectors.location);
          if (locationElement) {
            const locationText = locationElement.textContent?.trim() || '';
            if (locationText) {
              listing.location.address = locationText;
              locationFound = true;
            }
          }
          
          // If no location found, try to extract from title
          if (!locationFound && listing.title) {
            const locationPattern = /(в|на)\s+(кв\.|район|ул\.)\s*([^,]+)/i;
            const locationMatch = listing.title.match(locationPattern);
            if (locationMatch) {
              listing.location.district = locationMatch[3].trim();
              locationFound = true;
            }
            
            // Also try to extract specific Sofia districts
            const sofiaDistricts = ['Лозенец', 'Симеоново', 'Оборище', 'Медицинска академия', 'Витоша'];
            for (const district of sofiaDistricts) {
              if (listing.title.includes(district)) {
                listing.location.district = district;
                listing.location.city = 'София';
                locationFound = true;
                break;
              }
            }
          }
          
          // Set default city if not found
          if (!listing.location.city) {
            listing.location.city = 'София'; // Default to Sofia for UES.bg
          }

          // Extract area
          if (config.selectors.area) {
            const areaElement = card.querySelector(config.selectors.area);
            if (areaElement) {
              const areaText = areaElement.textContent || '';
              const areaMatch = areaText.match(/(\d+(?:\.\d+)?)/);
              if (areaMatch) {
                listing.details.area = parseFloat(areaMatch[1]);
              }
            }
          }

          // Extract rooms
          if (config.selectors.rooms) {
            const roomsElement = card.querySelector(config.selectors.rooms);
            if (roomsElement) {
              const roomsText = roomsElement.textContent || '';
              const roomsMatch = roomsText.match(/(\d+)/);
              if (roomsMatch) {
                listing.details.rooms = parseInt(roomsMatch[1]);
              }
            }
          }

          // Extract link
          const linkElement = card.querySelector(config.selectors.link);
          if (linkElement && linkElement instanceof HTMLAnchorElement) {
            listing.url = linkElement.href;
          }

          // Extract image
          if (config.selectors.image) {
            const imageElement = card.querySelector(config.selectors.image);
            if (imageElement && imageElement instanceof HTMLImageElement) {
              listing.images = [imageElement.src];
            }
          }

          // Only add listing if it has essential data
          if (listing.title || listing.price.amount > 0) {
            listings.push(listing);
          }

        } catch (error) {
          console.error(`Error processing card ${index}:`, error);
        }
      });

      return listings;
    }, this.config);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}