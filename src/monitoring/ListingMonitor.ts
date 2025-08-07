import { ComprehensiveApiParser } from '../parser/ComprehensiveApiParser';
import { PropertyService } from '../database/PropertyService';
import { NotificationService, PropertyNotification } from '../notifications/NotificationService';
import { db } from '../database/connection';
import * as cron from 'node-cron';

export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: string; // cron expression
  sources: {
    id: string;
    name: string;
    searchUrls: string[];
    maxPages: number;
  }[];
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    cities?: string[];
    propertyTypes?: string[];
  };
}

export interface MonitoringSession {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  sourcesChecked: number;
  newListingsFound: number;
  priceChanges: number;
  errors: string[];
}

export class ListingMonitor {
  private propertyService: PropertyService;
  private notificationService: NotificationService;
  private parser: ComprehensiveApiParser;
  private config: MonitoringConfig;
  private isRunning: boolean = false;
  private currentSession?: MonitoringSession;
  private cronJob?: cron.ScheduledTask;

  constructor(
    config: MonitoringConfig,
    notificationService: NotificationService,
    propertyService?: PropertyService
  ) {
    this.config = config;
    this.notificationService = notificationService;
    this.propertyService = propertyService || new PropertyService();
    this.parser = new ComprehensiveApiParser({} as any); // Will be configured per source
  }

  start(): void {
    if (this.cronJob) {
      console.log('📊 Monitoring service is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('📊 Monitoring service is disabled');
      return;
    }

    console.log(`📊 Starting listing monitor with schedule: ${this.config.checkInterval}`);
    
    this.cronJob = cron.schedule(this.config.checkInterval, async () => {
      if (!this.isRunning) {
        await this.runMonitoringCycle();
      } else {
        console.log('⏳ Previous monitoring cycle still running, skipping...');
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Sofia'
    });

    console.log('✅ Listing monitor started successfully');
    
    // Run initial check if configured to do so
    setTimeout(() => this.runMonitoringCycle(), 5000);
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob.destroy();
      this.cronJob = undefined;
      console.log('🛑 Listing monitor stopped');
    }
  }

  async runMonitoringCycle(): Promise<MonitoringSession> {
    if (this.isRunning) {
      throw new Error('Monitoring cycle is already running');
    }

    this.isRunning = true;
    this.currentSession = {
      id: `monitor_${Date.now()}`,
      startedAt: new Date(),
      status: 'running',
      sourcesChecked: 0,
      newListingsFound: 0,
      priceChanges: 0,
      errors: []
    };

    console.log(`🔄 Starting monitoring cycle ${this.currentSession.id}`);

    try {
      const newListings: PropertyNotification[] = [];
      const priceChanges: { property: PropertyNotification; oldPrice: number }[] = [];

      // Process each configured source
      for (const source of this.config.sources) {
        try {
          console.log(`📡 Checking source: ${source.name}`);
          
          const sourceResults = await this.checkSource(source);
          newListings.push(...sourceResults.newListings);
          priceChanges.push(...sourceResults.priceChanges);
          
          this.currentSession.sourcesChecked++;
          console.log(`✅ Source ${source.name}: ${sourceResults.newListings.length} new, ${sourceResults.priceChanges.length} price changes`);
          
        } catch (error) {
          const errorMsg = `Failed to check source ${source.name}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          this.currentSession.errors.push(errorMsg);
        }

        // Rate limiting between sources
        await this.sleep(2000);
      }

      this.currentSession.newListingsFound = newListings.length;
      this.currentSession.priceChanges = priceChanges.length;
      this.currentSession.status = 'completed';
      this.currentSession.completedAt = new Date();

      // Send notifications
      if (newListings.length > 0) {
        console.log(`📨 Sending notifications for ${newListings.length} new listings`);
        await this.notificationService.sendNewListingAlert(newListings);
      }

      for (const { property, oldPrice } of priceChanges) {
        await this.notificationService.sendPriceAlert(property, oldPrice);
      }

      // Log session results
      await this.logMonitoringSession(this.currentSession);
      
      const duration = this.currentSession.completedAt.getTime() - this.currentSession.startedAt.getTime();
      console.log(`✅ Monitoring cycle completed in ${duration}ms: ${newListings.length} new, ${priceChanges.length} price changes`);

      return this.currentSession;

    } catch (error) {
      console.error('❌ Monitoring cycle failed:', error);
      this.currentSession.status = 'failed';
      this.currentSession.completedAt = new Date();
      this.currentSession.errors.push(`Cycle failed: ${error}`);
      
      await this.logMonitoringSession(this.currentSession);
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  private async checkSource(source: MonitoringConfig['sources'][0]): Promise<{
    newListings: PropertyNotification[];
    priceChanges: { property: PropertyNotification; oldPrice: number }[];
  }> {
    const newListings: PropertyNotification[] = [];
    const priceChanges: { property: PropertyNotification; oldPrice: number }[] = [];

    // Configure parser for this source
    const config = this.getParserConfigForSource(source);
    const parser = new ComprehensiveApiParser(config);

    // Check each search URL
    for (const searchUrl of source.searchUrls) {
      try {
        console.log(`  🔍 Parsing: ${searchUrl}`);
        
        const results = await parser.parseAllListings(searchUrl, source.maxPages);
        
        if (!results.success || !results.listings) {
          console.warn(`  ⚠️ No results from ${searchUrl}`);
          continue;
        }

        console.log(`  📊 Found ${results.listings.length} listings`);

        // Process each listing
        for (const listing of results.listings) {
          try {
            // Check if this is truly a new listing
            const existingProperty = await this.propertyService.findPropertyByExternalId(
              listing.id || listing.external_id || '',
              source.id
            );

            if (!existingProperty) {
              // New listing found!
              const notification = this.convertToNotification(listing, source.id);
              if (this.matchesFilters(notification)) {
                newListings.push(notification);
                
                // Save to database
                await this.propertyService.saveProperty(listing, source.id);
              }
            } else {
              // Check for price changes
              const currentPrice = listing.pricing?.current_price;
              const existingPrice = existingProperty.current_price;
              
              if (currentPrice && existingPrice && Math.abs(currentPrice - existingPrice) > 1) {
                const notification = this.convertToNotification(listing, source.id);
                if (this.matchesFilters(notification)) {
                  priceChanges.push({ property: notification, oldPrice: existingPrice });
                  
                  // Update property in database
                  await this.propertyService.updateProperty(existingProperty.id, listing);
                }
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Error processing listing: ${error}`);
          }
        }

      } catch (error) {
        console.error(`  ❌ Error parsing ${searchUrl}:`, error);
        throw error;
      }
    }

    return { newListings, priceChanges };
  }

  private getParserConfigForSource(source: MonitoringConfig['sources'][0]) {
    // For now, return UES.bg config. In future, make this configurable
    return {
      id: source.id,
      name: source.name,
      baseUrl: 'https://ues.bg',
      type: 'spa' as const,
      selectors: {
        listingContainer: '[class*="result"], .offers-container',
        listingCard: '[class*="offer"], .offer',
        title: '[class*="title"], h3, .offer-title',
        price: '.price, [class*="price"]',
        location: '.location, [class*="location"]',
        area: '.area, [class*="area"]',
        rooms: '.rooms, [class*="rooms"]',
        link: 'a',
        image: 'img'
      },
      pagination: {
        type: 'infinite_scroll' as const,
        maxPages: source.maxPages
      },
      rateLimit: {
        requestsPerMinute: 20,
        delayBetweenPages: 3000
      }
    };
  }

  private convertToNotification(listing: any, sourceId: string): PropertyNotification {
    return {
      id: listing.id || listing.external_id || `${sourceId}_${Date.now()}`,
      title: listing.title || 'Unknown Property',
      price: listing.pricing?.current_price || 0,
      currency: listing.pricing?.currency || 'EUR',
      city: listing.location?.city || 'Unknown',
      quarter: listing.location?.quarter,
      area: listing.details?.area,
      rooms: listing.details?.rooms,
      url: listing.urls?.listing || listing.url || '',
      pricePerSqm: listing.pricing?.price_per_sqm,
      isTopOffer: listing.marketing?.is_top_offer || false,
      isVipOffer: listing.marketing?.is_vip_offer || false,
    };
  }

  private matchesFilters(property: PropertyNotification): boolean {
    if (!this.config.filters) return true;

    const { minPrice, maxPrice, cities, propertyTypes } = this.config.filters;

    // Price filters
    if (minPrice && property.price < minPrice) return false;
    if (maxPrice && property.price > maxPrice) return false;

    // City filter
    if (cities && cities.length > 0 && !cities.includes(property.city)) return false;

    // Property type filter would require additional data from listing
    
    return true;
  }

  private async logMonitoringSession(session: MonitoringSession): Promise<void> {
    try {
      const query = `
        INSERT INTO scraping_sessions (
          session_type, 
          started_at, 
          completed_at, 
          status,
          properties_new,
          errors,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await db.query(query, [
        'monitoring_cycle',
        session.startedAt,
        session.completedAt,
        session.status,
        session.newListingsFound,
        JSON.stringify(session.errors),
        JSON.stringify({
          sessionId: session.id,
          sourcesChecked: session.sourcesChecked,
          priceChanges: session.priceChanges
        })
      ]);
    } catch (error) {
      console.error('Failed to log monitoring session:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentSession(): MonitoringSession | undefined {
    return this.currentSession;
  }

  isMonitoringActive(): boolean {
    return this.isRunning;
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.cronJob && newConfig.checkInterval) {
      this.stop();
      this.start();
    }
  }
}