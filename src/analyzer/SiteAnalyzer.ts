import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { AnalysisResult, SelectorCandidate, APIEndpoint, SiteConfig } from '../types';

export class SiteAnalyzer {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
  }

  async analyzeSite(url: string): Promise<AnalysisResult> {
    if (!this.browser) {
      await this.init();
    }

    const page = await this.browser!.newPage();
    const apiEndpoints: APIEndpoint[] = [];

    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'] || '';
      const responseUrl = response.url();
      
      if (contentType.includes('application/json') && response.status() === 200) {
        try {
          const data = await response.json();
          console.log(`🔍 JSON API found: ${responseUrl}`);
          
          if (this.looksLikeListingsData(data)) {
            apiEndpoints.push({
              url: responseUrl,
              method: response.request().method(),
              responseType: 'json',
              isListings: true
            });
            console.log(`✅ Listings API detected!`);
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Scroll to trigger potential lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);

      const content = await page.content();
      const analysis = await this.analyzeHTML(content, url);
      
      // Check if it's SPA by looking for common SPA patterns
      const siteType = await this.detectSiteType(page);
      
      const result: AnalysisResult = {
        siteType,
        hasListings: analysis.hasListings || false,
        potentialSelectors: analysis.potentialSelectors || {
          containers: [],
          cards: [],
          titles: [],
          prices: []
        },
        pagination: analysis.pagination || { type: 'none', selectors: [] },
        apiEndpoints,
        suggestedConfig: this.generateSuggestedConfig(url, analysis, siteType)
      };

      await page.close();
      return result;

    } catch (error) {
      await page.close();
      throw new Error(`Failed to analyze site: ${error}`);
    }
  }

  private async analyzeHTML(html: string, baseUrl: string): Promise<Partial<AnalysisResult>> {
    const $ = cheerio.load(html);
    
    // Find potential listing containers
    const containerCandidates = this.findContainerCandidates($);
    const cardCandidates = this.findCardCandidates($);
    const titleCandidates = this.findTitleCandidates($);
    const priceCandidates = this.findPriceCandidates($);
    
    // Analyze pagination
    const pagination = this.analyzePagination($);
    
    return {
      hasListings: containerCandidates.length > 0 || cardCandidates.length > 0,
      potentialSelectors: {
        containers: containerCandidates,
        cards: cardCandidates,
        titles: titleCandidates,
        prices: priceCandidates
      },
      pagination
    };
  }

  private findContainerCandidates($: cheerio.CheerioAPI): SelectorCandidate[] {
    const candidates: SelectorCandidate[] = [];
    
    // Common container patterns for real estate sites
    const containerPatterns = [
      '.properties', '.listings', '.results', '.items',
      '.property-list', '.listing-grid', '.search-results',
      '[class*="property"]', '[class*="listing"]', '[class*="result"]',
      '[class*="grid"]', '[class*="container"]'
    ];

    containerPatterns.forEach(pattern => {
      const elements = $(pattern);
      if (elements.length > 0) {
        elements.each((_, element) => {
          const children = $(element).children();
          if (children.length >= 3 && children.length <= 50) {
            candidates.push({
              selector: pattern,
              confidence: this.calculateContainerConfidence($, element),
              count: children.length,
              sample: $(element).html()?.slice(0, 200)
            });
          }
        });
      }
    });

    return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private findCardCandidates($: cheerio.CheerioAPI): SelectorCandidate[] {
    const candidates: SelectorCandidate[] = [];
    
    const cardPatterns = [
      '.property', '.listing', '.item', '.card', '.offer',
      '.property-card', '.listing-item', '.property-item',
      '[class*="property"]', '[class*="listing"]', '[class*="card"]',
      '[class*="item"]', '[class*="offer"]'
    ];

    cardPatterns.forEach(pattern => {
      const elements = $(pattern);
      if (elements.length >= 3 && elements.length <= 100) {
        const confidence = this.calculateCardConfidence($, elements);
        if (confidence > 0.3) {
          candidates.push({
            selector: pattern,
            confidence,
            count: elements.length,
            sample: elements.first().html()?.slice(0, 300)
          });
        }
      }
    });

    return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private findTitleCandidates($: cheerio.CheerioAPI): SelectorCandidate[] {
    const candidates: SelectorCandidate[] = [];
    
    const titlePatterns = [
      'h1', 'h2', 'h3', '.title', '.name', '.heading',
      '.property-title', '.listing-title',
      '[class*="title"]', '[class*="name"]', '[class*="heading"]'
    ];

    titlePatterns.forEach(pattern => {
      const elements = $(pattern);
      const validTitles = elements.filter((_, el) => {
        const text = $(el).text().trim();
        return text.length > 10 && text.length < 200;
      });

      if (validTitles.length > 0) {
        candidates.push({
          selector: pattern,
          confidence: Math.min(validTitles.length / 20, 1),
          count: validTitles.length,
          sample: $(validTitles[0]).text().slice(0, 100)
        });
      }
    });

    return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private findPriceCandidates($: cheerio.CheerioAPI): SelectorCandidate[] {
    const candidates: SelectorCandidate[] = [];
    
    const pricePatterns = [
      '.price', '.cost', '.amount',
      '.property-price', '.listing-price',
      '[class*="price"]', '[class*="cost"]', '[class*="amount"]'
    ];

    pricePatterns.forEach(pattern => {
      const elements = $(pattern);
      const validPrices = elements.filter((_, el) => {
        const text = $(el).text();
        return /[€$₽\d,.\s]+/.test(text) && /\d/.test(text);
      });

      if (validPrices.length > 0) {
        candidates.push({
          selector: pattern,
          confidence: Math.min(validPrices.length / 20, 1),
          count: validPrices.length,
          sample: $(validPrices[0]).text().trim()
        });
      }
    });

    return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private analyzePagination($: cheerio.CheerioAPI): { type: string; selectors: string[] } {
    const selectors: string[] = [];
    let type = 'none';

    // Check for "Load More" button
    const loadMoreSelectors = ['.load-more', '.show-more', '[class*="load"]', '[class*="more"]'];
    for (const selector of loadMoreSelectors) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        type = 'load_more';
      }
    }

    // Check for pagination
    const paginationSelectors = ['.pagination', '.pages', '.page-numbers', '[class*="page"]'];
    for (const selector of paginationSelectors) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        type = 'page_numbers';
      }
    }

    // Check for next button
    const nextSelectors = ['.next', '.arrow-next', '[class*="next"]'];
    for (const selector of nextSelectors) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        if (type === 'none') type = 'next_button';
      }
    }

    return { type, selectors };
  }

  private async detectSiteType(page: Page): Promise<'spa' | 'static' | 'hybrid'> {
    const hasReactVue = await page.evaluate(() => {
      return !!(window as any).React || !!(window as any).Vue || 
             document.querySelector('[data-reactroot]') ||
             document.querySelector('[data-v-]') ||
             document.querySelector('.vue-component');
    });

    const hasAngular = await page.evaluate(() => {
      return !!(window as any).ng || document.querySelector('[ng-app]') ||
             document.querySelector('[data-ng-app]');
    });

    const hasLazyLoading = await page.evaluate(() => {
      return document.querySelector('[data-src]') || 
             document.querySelector('.lazy') ||
             document.querySelector('[loading="lazy"]');
    });

    if (hasReactVue || hasAngular) {
      return 'spa';
    } else if (hasLazyLoading) {
      return 'hybrid';
    } else {
      return 'static';
    }
  }

  private calculateContainerConfidence($: cheerio.CheerioAPI, element: any): number {
    let confidence = 0;
    const $el = $(element);
    
    // More children = higher confidence (but not too many)
    const childCount = $el.children().length;
    confidence += Math.min(childCount / 20, 0.5);
    
    // Check for real estate related classes/text
    const html = $el.html() || '';
    const realEstateKeywords = ['property', 'listing', 'apartment', 'house', 'price', 'room', 'sqm'];
    const matchCount = realEstateKeywords.filter(keyword => 
      html.toLowerCase().includes(keyword)
    ).length;
    confidence += matchCount * 0.1;
    
    return Math.min(confidence, 1);
  }

  private calculateCardConfidence($: cheerio.CheerioAPI, elements: any): number {
    let confidence = 0;
    
    // Check first few elements for common real estate patterns
    const sampleSize = Math.min(3, elements.length);
    let hasPrice = 0;
    let hasLocation = 0;
    let hasArea = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const $el = $(elements[i]);
      const text = $el.text().toLowerCase();
      
      if (/[€$₽]\s*\d+|price|цена/.test(text)) hasPrice++;
      if (/location|address|район|град|city/.test(text)) hasLocation++;
      if (/\d+\s*(кв\.?м|m²|sqm|sq)/.test(text)) hasArea++;
    }
    
    confidence += (hasPrice / sampleSize) * 0.4;
    confidence += (hasLocation / sampleSize) * 0.3;
    confidence += (hasArea / sampleSize) * 0.3;
    
    return confidence;
  }

  private looksLikeListingsData(data: any): boolean {
    if (!data) return false;
    
    // Check if it's an array or has array property
    const arrayToCheck = Array.isArray(data) ? data : 
                        (data.items || data.results || data.listings || data.properties);
    
    if (!Array.isArray(arrayToCheck) || arrayToCheck.length === 0) return false;
    
    // Check first item for property-like structure
    const firstItem = arrayToCheck[0];
    if (typeof firstItem !== 'object') return false;
    
    const keys = Object.keys(firstItem).map(k => k.toLowerCase());
    const realEstateKeys = ['price', 'title', 'location', 'area', 'rooms', 'address', 'type'];
    const matchCount = realEstateKeys.filter(key => 
      keys.some(k => k.includes(key))
    ).length;
    
    return matchCount >= 2;
  }

  private generateSuggestedConfig(url: string, analysis: Partial<AnalysisResult>, siteType: string): Partial<SiteConfig> {
    const bestContainer = analysis.potentialSelectors?.containers[0];
    const bestCard = analysis.potentialSelectors?.cards[0];
    const bestTitle = analysis.potentialSelectors?.titles[0];
    const bestPrice = analysis.potentialSelectors?.prices[0];
    
    return {
      baseUrl: new URL(url).origin,
      type: siteType as any,
      selectors: {
        listingContainer: bestContainer?.selector || '.properties',
        listingCard: bestCard?.selector || '.property',
        title: bestTitle?.selector || 'h2',
        price: bestPrice?.selector || '.price',
        location: '.location',
        link: 'a',
        image: 'img'
      },
      pagination: {
        type: (analysis.pagination?.type as any) || 'none',
        selector: analysis.pagination?.selectors[0]
      },
      rateLimit: {
        requestsPerMinute: 30,
        delayBetweenPages: 2000
      }
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}