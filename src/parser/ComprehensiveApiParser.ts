import axios from 'axios';
import { SiteConfig } from '../types';
import { ComprehensivePropertyListing, ComprehensiveParseResult, PropertyImage, PropertyVideo } from '../types/comprehensive';

export class ComprehensiveApiParser {
  private config: SiteConfig;
  private baseApiUrl: string;

  constructor(config: SiteConfig) {
    this.config = config;
    this.baseApiUrl = config.baseUrl;
  }

  async parseAllListings(searchUrl: string, maxPages: number = 50): Promise<ComprehensiveParseResult> {
    const startTime = Date.now();
    const listings: ComprehensivePropertyListing[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let pagesProcessed = 0;
    let totalPages = 1;
    let totalListings = 0;
    let apiCallsUsed = 0;

    try {
      console.log(`🚀 COMPREHENSIVE API PARSING STARTED`);
      console.log(`🎯 Target: ALL listings with MAXIMUM data extraction`);
      
      const apiUrl = this.buildApiUrl(searchUrl);
      console.log(`🔗 API URL: ${apiUrl}`);

      // First request to get total count
      const firstResponse = await this.fetchPage(apiUrl, 1);
      apiCallsUsed++;
      
      if (firstResponse.success && firstResponse.data) {
        const { offers, total, per_page, current_page, last_page } = firstResponse.data;
        
        totalListings = total || offers?.length || 0;
        totalPages = last_page || Math.ceil(totalListings / (per_page || 10)) || 1;
        
        console.log(`📊 DISCOVERY: ${totalListings} total listings across ${totalPages} pages`);
        console.log(`📄 Per page: ${per_page || 'unknown'}, Current: ${current_page || 1}`);
        
        if (offers && offers.length > 0) {
          // Process first page with MAXIMUM data extraction
          const firstPageListings = await this.processOffersComprehensively(offers);
          listings.push(...firstPageListings);
          pagesProcessed = 1;
          
          console.log(`✅ Page 1: ${firstPageListings.length} listings with FULL data`);
          
          // Process remaining pages up to maxPages
          const pagesToProcess = Math.min(totalPages, maxPages);
          
          for (let page = 2; page <= pagesToProcess; page++) {
            try {
              console.log(`📄 Processing page ${page}/${pagesToProcess}...`);
              
              const response = await this.fetchPage(apiUrl, page);
              apiCallsUsed++;
              
              if (response.success && response.data?.offers) {
                const pageListings = await this.processOffersComprehensively(response.data.offers);
                listings.push(...pageListings);
                pagesProcessed++;
                
                console.log(`✅ Page ${page}: ${pageListings.length} listings processed`);
                
                // Show progress
                const progress = ((page / pagesToProcess) * 100).toFixed(1);
                console.log(`📈 Progress: ${progress}% (${listings.length}/${totalListings} listings)`);
              } else {
                warnings.push(`Page ${page} returned no data`);
              }
              
              // Rate limiting to be respectful
              await new Promise(resolve => setTimeout(resolve, 1200));
              
            } catch (error) {
              errors.push(`Error fetching page ${page}: ${error}`);
              console.error(`❌ Page ${page} failed:`, error);
            }
          }
        }
      }

      const timeElapsed = Date.now() - startTime;
      const dataQualityScore = this.calculateDataQualityScore(listings);
      
      console.log(`🎉 COMPREHENSIVE EXTRACTION COMPLETED!`);
      console.log(`📊 Final Stats: ${listings.length} listings with ${dataQualityScore.toFixed(1)}% data completeness`);
      
      return {
        success: listings.length > 0,
        totalListings,
        processedListings: listings.length,
        listings,
        errors,
        warnings,
        statistics: {
          pagesProcessed,
          totalPages,
          timeElapsed,
          averagePerPage: listings.length / Math.max(pagesProcessed, 1),
          apiCallsUsed,
          dataQualityScore
        },
        metadata: {
          searchUrl,
          filters: {},
          scrapedAt: new Date(),
          apiVersion: '1.0',
          dataSource: 'ues.bg'
        }
      };

    } catch (error) {
      errors.push(`Fatal comprehensive parsing error: ${error}`);
      
      return {
        success: false,
        totalListings: 0,
        processedListings: 0,
        listings,
        errors,
        warnings,
        statistics: {
          pagesProcessed,
          totalPages,
          timeElapsed: Date.now() - startTime,
          averagePerPage: 0,
          apiCallsUsed,
          dataQualityScore: 0
        },
        metadata: {
          searchUrl,
          filters: {},
          scrapedAt: new Date(),
          apiVersion: '1.0',
          dataSource: 'ues.bg'
        }
      };
    }
  }

  private buildApiUrl(searchUrl: string): string {
    const url = new URL(searchUrl);
    url.searchParams.set('initial', '1');
    return url.toString();
  }

  private async fetchPage(apiUrl: string, page: number): Promise<{success: boolean, data: any}> {
    try {
      const url = new URL(apiUrl);
      if (page > 1) {
        url.searchParams.set('page', page.toString());
        url.searchParams.delete('initial');
      }

      const response = await axios.get(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': this.baseApiUrl,
          'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8'
        },
        timeout: 30000
      });

      return { success: true, data: response.data };

    } catch (error) {
      console.error(`API request failed for page ${page}:`, error);
      return { success: false, data: null };
    }
  }

  private async processOffersComprehensively(offers: any[]): Promise<ComprehensivePropertyListing[]> {
    return offers.map((offer, index) => {
      try {
        return this.extractMaximumData(offer, index);
      } catch (error) {
        console.error(`Error processing offer ${offer.id || index}:`, error);
        return null;
      }
    }).filter(Boolean) as ComprehensivePropertyListing[];
  }

  private extractMaximumData(offer: any, index: number): ComprehensivePropertyListing {
    const estate = offer.estate || {};
    const estateType = offer.estate_type || {};
    const estateKind = offer.estate_kind || {};
    const furniture = offer.furniture || {};

    return {
      // Базовая информация
      id: `${this.config.id}_comprehensive_${Date.now()}_${index}`,
      externalId: offer.id?.toString() || `${index}`,
      sourceId: this.config.id,
      title: offer.name || '',
      description: offer.description || '',
      url: offer.url || '',
      scrapedAt: new Date(),
      
      // Детальная ценовая информация
      pricing: {
        currentPrice: this.safeNumber(offer.price) ?? 0,
        currency: 'EUR', // UES.bg uses EUR
        pricePerSqm: this.safeNumber(offer.price_square),
        oldPrice: this.safeNumber(offer.old_price),
        specialPrice: this.safeNumber(offer.special_price),
        hasRequestPrice: Boolean(offer.has_request_price),
        hasVATIncluded: !Boolean(offer.without_vat),
        priceHistory: [] // Could be expanded with historical data
      },
      
      // Полные характеристики недвижимости
      propertyDetails: {
        // Основные характеристики
        area: this.safeNumber(estate.square) ?? 0,
        buildArea: this.safeNumber(estate.square_build),
        plotArea: this.safeNumber(estate.plot),
        
        // Комнаты и планировка
        bedrooms: this.safeNumber(offer.bedrooms),
        bathrooms: this.safeNumber(offer.bathrooms),
        rooms: this.safeNumber(offer.rooms),
        
        // Этажность
        floor: this.safeNumber(estate.floor),
        totalFloors: this.safeNumber(estate.floors),
        apartment: estate.apartment || '',
        
        // Тип и состояние
        propertyType: estateType.name || '',
        propertyKind: estateKind.name || '',
        transactionType: 'rent', // Since we're parsing rentals
        isNewBuilding: Boolean(offer.new_building),
        buildingYear: this.safeNumber(estate.building_year),
        constructionType: offer.construction_type_id?.toString(),
        
        // Удобства и особенности
        hasElevator: Boolean(offer.elevator),
        hasParkingSpace: Boolean(offer.parking_id),
        hasBasement: Boolean(offer.basement),
        basementArea: this.safeNumber(offer.basement_area),
        hasAttic: Boolean(offer.attic),
        atticArea: this.safeNumber(offer.attic_area),
        ceilingHeight: this.safeNumber(offer.ceiling_height),
        
        // Коммуникации
        heating: offer.heating_id?.toString(),
        hasWater: Boolean(offer.water),
        hasElectricity: Boolean(offer.electricity),
        
        // Мебель и состояние
        furnishingType: furniture.name || '',
        condition: offer.completion_id?.toString()
      },
      
      // Точная локация
      location: {
        // Административное деление
        country: 'България',
        region: 'София-град', // Assumption for Sofia
        municipality: 'София',
        city: 'София',
        quarter: offer.address?.split(',')[1]?.trim(),
        
        // Адрес
        street: estate.street_id?.toString(),
        streetNumber: estate.street_number || '',
        block: estate.block || '',
        entrance: estate.entrance || '',
        
        // Координаты
        coordinates: estate.latitude && estate.longitude ? {
          latitude: parseFloat(estate.latitude),
          longitude: parseFloat(estate.longitude),
          verified: Boolean(estate.geolocation_verified)
        } : undefined,
        
        // Полный адрес
        fullAddress: offer.address || ''
      },
      
      // Медиа контент
      media: {
        featuredImage: offer.featured_image || '',
        images: this.extractImages(offer),
        videos: this.extractVideos(offer),
        virtualTours: offer.virtual_tours || [],
        brochures: [],
        floorPlans: [],
        hasMedia: {
          images: Boolean(offer.has_images),
          videos: Boolean(offer.has_videos),
          virtualTours: Boolean(offer.has_virtual_tour),
          brochures: Boolean(offer.has_brochures),
          floorPlans: Boolean(offer.has_floor_plans)
        }
      },
      
      // Агентство и контакты
      agency: {
        userId: offer.user_id?.toString() || '',
        officeId: offer.office_id?.toString() || '',
        agencyId: offer.agency_id?.toString(),
        isExclusive: offer.labels?.includes('exclusive-offer') || false,
        managersEstate: Boolean(offer.managers_estates)
      },
      
      // Статус и метаданные
      status: {
        isActive: !Boolean(offer.deleted),
        isVisible: Boolean(offer.is_active !== 0),
        state: this.safeNumber(offer.state) || 0,
        completion: offer.completion_id?.toString() || '',
        isConfidential: Boolean(offer.confidential),
        isTopOffer: Boolean(offer.top_price || offer.top_imotbg),
        isVIPOffer: Boolean(offer.vip_imotbg),
        immunity: offer.immunity_end ? new Date(offer.immunity_end) : undefined
      },
      
      // Лейблы и маркетинг
      marketing: {
        labels: offer.labels || [],
        isForInvestment: Boolean(offer.for_investment),
        isSelection: Boolean(offer.selection),
        isCatalogue: Boolean(offer.catalogue),
        exportToImotBG: Boolean(offer.export_to_imotbg)
      },
      
      // Временные метки
      timestamps: {
        createdAt: new Date(offer.created_at),
        updatedAt: new Date(offer.updated_at),
        publishedAt: offer.set_visible_at ? new Date(offer.set_visible_at) : undefined,
        lastPriceChange: undefined, // Could be calculated from price history
        createdBy: offer.created_by?.toString() || '',
        updatedBy: offer.updated_by?.toString() || ''
      },
      
      // Дополнительные данные
      additional: {
        sourceDescription: offer.source_description,
        ownerType: offer.owner,
        referenceType: offer.ref_type || '',
        cadastralNumber: estate.kadastr,
        deed: offer.deed
      }
    };
  }

  private extractImages(offer: any): PropertyImage[] {
    const images: PropertyImage[] = [];
    
    if (offer.featured_image) {
      images.push({
        url: offer.featured_image,
        thumbnailUrl: offer.featured_image,
        caption: 'Featured Image',
        order: 0
      });
    }
    
    // Additional images would be extracted from offer.images if available
    
    return images;
  }

  private extractVideos(offer: any): PropertyVideo[] {
    const videos: PropertyVideo[] = [];
    
    if (offer.youtube_id) {
      videos.push({
        youtubeId: offer.youtube_id,
        url: `https://www.youtube.com/watch?v=${offer.youtube_id}`,
        title: 'Property Video'
      });
    }
    
    if (offer.videos && Array.isArray(offer.videos)) {
      offer.videos.forEach((video: any, index: number) => {
        videos.push({
          url: video.url,
          title: video.title || `Video ${index + 1}`
        });
      });
    }
    
    return videos;
  }

  private safeNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private calculateDataQualityScore(listings: ComprehensivePropertyListing[]): number {
    if (listings.length === 0) return 0;
    
    const totalFields = 50; // Approximate number of important fields
    let totalScore = 0;
    
    listings.forEach(listing => {
      let filledFields = 0;
      
      // Count filled fields
      if (listing.title) filledFields++;
      if (listing.url) filledFields++;
      if (listing.pricing.currentPrice > 0) filledFields++;
      if (listing.pricing.pricePerSqm) filledFields++;
      if (listing.propertyDetails.area > 0) filledFields++;
      if (listing.propertyDetails.bedrooms) filledFields++;
      if (listing.propertyDetails.bathrooms) filledFields++;
      if (listing.propertyDetails.floor) filledFields++;
      if (listing.location.coordinates) filledFields += 2;
      if (listing.location.fullAddress) filledFields++;
      if (listing.media.featuredImage) filledFields++;
      if (listing.propertyDetails.propertyType) filledFields++;
      // ... more field checks
      
      totalScore += (filledFields / totalFields) * 100;
    });
    
    return totalScore / listings.length;
  }
}