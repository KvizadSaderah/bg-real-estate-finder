import axios from 'axios';
import { PropertyListing, ParseResult, SiteConfig } from '../types';

export class ApiParser {
  private config: SiteConfig;
  private baseApiUrl: string;

  constructor(config: SiteConfig) {
    this.config = config;
    this.baseApiUrl = config.baseUrl;
  }

  async parseAllPages(searchUrl: string): Promise<ParseResult> {
    const startTime = Date.now();
    const listings: PropertyListing[] = [];
    const errors: string[] = [];
    let pagesProcessed = 0;
    let totalPages = 1;

    try {
      console.log(`🚀 Starting API parsing: ${searchUrl}`);
      
      // Convert search URL to API URL
      const apiUrl = this.buildApiUrl(searchUrl);
      console.log(`🔗 API URL: ${apiUrl}`);

      // First request to get total count and first page
      const firstResponse = await this.fetchPage(apiUrl, 1);
      
      if (firstResponse.success && firstResponse.data) {
        console.log(`🔍 API Response structure:`, JSON.stringify(firstResponse.data, null, 2).slice(0, 500));
        
        const { offers, total, perPage } = firstResponse.data;
        
        console.log(`📊 Found ${total || 'unknown'} total listings, ${perPage || 'unknown'} per page`);
        totalPages = Math.ceil((total || 50) / (perPage || 10));
        
        // Process first page
        const firstPageListings = this.processOffers(offers);
        listings.push(...firstPageListings);
        pagesProcessed = 1;
        
        console.log(`✅ Page 1: ${firstPageListings.length} listings`);
        
        // Fetch remaining pages
        for (let page = 2; page <= Math.min(totalPages, 10); page++) {
          try {
            console.log(`📄 Fetching page ${page}/${totalPages}...`);
            
            const response = await this.fetchPage(apiUrl, page);
            if (response.success && response.data.offers) {
              const pageListings = this.processOffers(response.data.offers);
              listings.push(...pageListings);
              pagesProcessed++;
              console.log(`✅ Page ${page}: ${pageListings.length} listings`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            errors.push(`Error fetching page ${page}: ${error}`);
            console.error(`❌ Page ${page} failed:`, error);
          }
        }
      }

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
      errors.push(`Fatal API error: ${error}`);
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

  private buildApiUrl(searchUrl: string): string {
    // Convert human URL to API URL
    // https://ues.bg/bg/bgr/imoti/pod-naem/sofia/apartament
    // to https://ues.bg/bg/bgr/imoti/pod-naem/sofia/apartament?initial=1
    
    const url = new URL(searchUrl);
    url.searchParams.set('initial', '1');
    return url.toString();
  }

  private async fetchPage(apiUrl: string, page: number): Promise<{success: boolean, data: any}> {
    try {
      const url = new URL(apiUrl);
      if (page > 1) {
        url.searchParams.set('page', page.toString());
        url.searchParams.delete('initial'); // Remove initial=1 for subsequent pages
      }

      const response = await axios.get(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': this.baseApiUrl
        },
        timeout: 30000
      });

      if (response.data && (response.data.offers || response.data.data)) {
        return {
          success: true,
          data: response.data.data || response.data
        };
      }

      return { success: false, data: null };

    } catch (error) {
      console.error(`API request failed for page ${page}:`, error);
      return { success: false, data: null };
    }
  }

  private processOffers(offers: any[]): PropertyListing[] {
    return offers.map((offer, index) => {
      const listing: PropertyListing = {
        id: `${this.config.id}_api_${Date.now()}_${index}`,
        sourceId: this.config.id,
        externalId: offer.id?.toString() || `${index}`,
        scrapedAt: new Date(),
        url: offer.url || '',
        title: offer.title || '',
        price: {
          amount: this.extractPrice(offer.price),
          currency: this.extractCurrency(offer.price),
          original: offer.price || ''
        },
        location: {
          city: offer.city || offer.location?.city || 'София',
          district: offer.district || offer.location?.district || '',
          address: offer.address || offer.location?.address || ''
        },
        details: {
          area: offer.area || offer.size,
          rooms: offer.rooms || offer.bedrooms,
          bathrooms: offer.bathrooms,
          floor: offer.floor,
          maxFloors: offer.maxFloors || offer.totalFloors,
          propertyType: this.mapPropertyType(offer.type || offer.propertyType),
          transactionType: 'rent' // Since we're searching rentals
        },
        features: offer.features || [],
        images: offer.images || [],
        description: offer.description || '',
        contact: {
          name: offer.contact?.name,
          phone: offer.contact?.phone,
          email: offer.contact?.email
        }
      };

      return listing;
    });
  }

  private extractPrice(priceString: string): number {
    if (!priceString) return 0;
    
    const numbers = priceString.match(/[\d\s,]+/g);
    if (numbers) {
      const cleanNumbers = numbers.map(match => {
        const cleanPrice = match.replace(/[\s,]/g, '');
        return parseInt(cleanPrice);
      }).filter(num => !isNaN(num) && num > 0);
      
      if (cleanNumbers.length > 0) {
        return Math.max(...cleanNumbers);
      }
    }
    
    return 0;
  }

  private extractCurrency(priceString: string): string {
    if (!priceString) return 'EUR';
    
    if (priceString.includes('€') || priceString.includes('EUR')) return 'EUR';
    if (priceString.includes('$') || priceString.includes('USD')) return 'USD';
    if (priceString.includes('лв') || priceString.includes('BGN')) return 'BGN';
    
    return 'EUR';
  }

  private mapPropertyType(type: string): PropertyListing['details']['propertyType'] {
    if (!type) return 'apartment';
    
    const typeStr = type.toLowerCase();
    if (typeStr.includes('apartment') || typeStr.includes('апартамент')) return 'apartment';
    if (typeStr.includes('house') || typeStr.includes('къща')) return 'house';
    if (typeStr.includes('office') || typeStr.includes('офис')) return 'office';
    if (typeStr.includes('commercial') || typeStr.includes('търговски')) return 'commercial';
    if (typeStr.includes('land') || typeStr.includes('земя')) return 'land';
    
    return 'apartment';
  }
}