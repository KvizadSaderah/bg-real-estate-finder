import { db } from './connection';
import { v4 as uuidv4 } from 'uuid';
import { ComprehensivePropertyListing } from '../types/comprehensive';
import {
  PropertyRecord,
  PropertyPricingRecord,
  PropertyDetailsRecord,
  PropertyLocationRecord,
  PropertyMediaRecord,
  PropertyAgencyRecord,
  PropertyStatusRecord,
  ScrapingSessionRecord,
  PriceHistoryRecord,
  PropertyChangeRecord,
  createPropertyRecord,
  createScrapingSessionRecord
} from './models';

export class PropertyService {
  
  // ==================== PROPERTY CRUD OPERATIONS ====================
  
  async saveProperty(listing: ComprehensivePropertyListing): Promise<string> {
    return await db.transaction(async (client) => {
      
      // Check if property already exists
      const existingQuery = `
        SELECT id, updated_at FROM properties 
        WHERE external_id = $1 AND source_id = $2
      `;
      const existingResult = await client.query(existingQuery, [listing.externalId, listing.sourceId]);
      
      let propertyId: string;
      let isUpdate = false;
      
      if (existingResult.rows.length > 0) {
        // Property exists - update it
        propertyId = existingResult.rows[0].id;
        isUpdate = true;
        
        await this.updateProperty(client, propertyId, listing);
        console.log(`🔄 Updated property ${listing.externalId}`);
        
      } else {
        // New property - insert it
        propertyId = await this.insertProperty(client, listing);
        console.log(`➕ Created new property ${listing.externalId}`);
      }
      
      return propertyId;
    });
  }
  
  private async insertProperty(client: any, listing: ComprehensivePropertyListing): Promise<string> {
    const propertyId = uuidv4();
    
    // Insert main property record
    const propertyInsert = `
      INSERT INTO properties (id, external_id, source_id, title, description, url, scraped_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(propertyInsert, [
      propertyId,
      listing.externalId,
      listing.sourceId,
      listing.title,
      listing.description || null,
      listing.url,
      listing.scrapedAt
    ]);
    
    // Insert related records
    await this.insertPropertyPricing(client, propertyId, listing);
    await this.insertPropertyDetails(client, propertyId, listing);
    await this.insertPropertyLocation(client, propertyId, listing);
    await this.insertPropertyMedia(client, propertyId, listing);
    await this.insertPropertyAgency(client, propertyId, listing);
    await this.insertPropertyStatus(client, propertyId, listing);
    
    // Add initial price history
    await this.addPriceHistory(client, propertyId, {
      new_price: listing.pricing.currentPrice,
      currency: listing.pricing.currency,
      change_type: 'initial'
    });
    
    return propertyId;
  }
  
  private async updateProperty(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    // Update main property record
    const propertyUpdate = `
      UPDATE properties 
      SET title = $2, description = $3, url = $4, scraped_at = $5, updated_at = NOW()
      WHERE id = $1
    `;
    await client.query(propertyUpdate, [
      propertyId,
      listing.title,
      listing.description || null,
      listing.url,
      listing.scrapedAt
    ]);
    
    // Check for price changes before updating
    await this.checkAndUpdatePricing(client, propertyId, listing);
    
    // Update other records (replace existing)
    await this.replacePropertyDetails(client, propertyId, listing);
    await this.replacePropertyLocation(client, propertyId, listing);
    await this.replacePropertyMedia(client, propertyId, listing);
    await this.replacePropertyAgency(client, propertyId, listing);
    await this.replacePropertyStatus(client, propertyId, listing);
  }
  
  // ==================== PRICING AND CHANGE DETECTION ====================
  
  private async checkAndUpdatePricing(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    // Get current price
    const currentPriceQuery = `
      SELECT current_price, currency FROM property_pricing 
      WHERE property_id = $1
      ORDER BY created_at DESC LIMIT 1
    `;
    const currentResult = await client.query(currentPriceQuery, [propertyId]);
    
    if (currentResult.rows.length > 0) {
      const currentPrice = parseFloat(currentResult.rows[0].current_price);
      const newPrice = listing.pricing.currentPrice;
      
      if (currentPrice !== newPrice) {
        // Price changed - record it
        const changeType = newPrice > currentPrice ? 'increase' : 'decrease';
        const changeAmount = Math.abs(newPrice - currentPrice);
        const changePercentage = (changeAmount / currentPrice) * 100;
        
        await this.addPriceHistory(client, propertyId, {
          old_price: currentPrice,
          new_price: newPrice,
          currency: listing.pricing.currency,
          change_type: changeType,
          change_amount: changeAmount,
          change_percentage: parseFloat(changePercentage.toFixed(2))
        });
        
        console.log(`💰 Price change detected for ${listing.externalId}: ${currentPrice} → ${newPrice} ${listing.pricing.currency}`);
      }
    }
    
    // Update/insert pricing record
    await this.replacePropertyPricing(client, propertyId, listing);
  }
  
  private async addPriceHistory(client: any, propertyId: string, historyData: Partial<PriceHistoryRecord>): Promise<void> {
    const historyInsert = `
      INSERT INTO price_history (id, property_id, old_price, new_price, currency, change_type, change_amount, change_percentage)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await client.query(historyInsert, [
      uuidv4(),
      propertyId,
      historyData.old_price || null,
      historyData.new_price,
      historyData.currency,
      historyData.change_type,
      historyData.change_amount || null,
      historyData.change_percentage || null
    ]);
  }
  
  // ==================== INDIVIDUAL TABLE OPERATIONS ====================
  
  private async insertPropertyPricing(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    const pricingInsert = `
      INSERT INTO property_pricing (id, property_id, current_price, currency, price_per_sqm, old_price, special_price, has_request_price, has_vat_included)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await client.query(pricingInsert, [
      uuidv4(),
      propertyId,
      listing.pricing.currentPrice,
      listing.pricing.currency,
      listing.pricing.pricePerSqm || null,
      listing.pricing.oldPrice || null,
      listing.pricing.specialPrice || null,
      listing.pricing.hasRequestPrice,
      listing.pricing.hasVATIncluded
    ]);
  }
  
  private async replacePropertyPricing(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    await client.query('DELETE FROM property_pricing WHERE property_id = $1', [propertyId]);
    await this.insertPropertyPricing(client, propertyId, listing);
  }
  
  private async insertPropertyDetails(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    const details = listing.propertyDetails;
    const detailsInsert = `
      INSERT INTO property_details (
        id, property_id, area, build_area, plot_area, bedrooms, bathrooms, rooms,
        floor, total_floors, apartment, property_type, property_kind, transaction_type,
        is_new_building, building_year, construction_type, has_elevator, has_parking_space,
        has_basement, basement_area, has_attic, attic_area, ceiling_height,
        heating, has_water, has_electricity, furnishing_type, condition_rating
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
    `;
    await client.query(detailsInsert, [
      uuidv4(), propertyId, details.area, details.buildArea || null, details.plotArea || null,
      details.bedrooms || null, details.bathrooms || null, details.rooms || null,
      details.floor || null, details.totalFloors || null, details.apartment || null,
      details.propertyType, details.propertyKind, details.transactionType,
      details.isNewBuilding, details.buildingYear || null, details.constructionType || null,
      details.hasElevator, details.hasParkingSpace, details.hasBasement,
      details.basementArea || null, details.hasAttic, details.atticArea || null,
      details.ceilingHeight || null, details.heating || null, details.hasWater,
      details.hasElectricity, details.furnishingType || null, details.condition || null
    ]);
  }
  
  private async replacePropertyDetails(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    await client.query('DELETE FROM property_details WHERE property_id = $1', [propertyId]);
    await this.insertPropertyDetails(client, propertyId, listing);
  }
  
  private async insertPropertyLocation(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    const location = listing.location;
    const locationInsert = `
      INSERT INTO property_locations (
        id, property_id, country, region, municipality, city, quarter,
        street, street_number, block, entrance, latitude, longitude,
        coordinates_verified, full_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;
    await client.query(locationInsert, [
      uuidv4(), propertyId, location.country, location.region || null,
      location.municipality || null, location.city, location.quarter || null,
      location.street || null, location.streetNumber || null, location.block || null,
      location.entrance || null, location.coordinates?.latitude || null,
      location.coordinates?.longitude || null, location.coordinates?.verified || false,
      location.fullAddress
    ]);
  }
  
  private async replacePropertyLocation(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    await client.query('DELETE FROM property_locations WHERE property_id = $1', [propertyId]);
    await this.insertPropertyLocation(client, propertyId, listing);
  }
  
  private async insertPropertyMedia(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    const media = listing.media;
    
    // Insert images
    for (let i = 0; i < media.images.length; i++) {
      const image = media.images[i];
      const mediaInsert = `
        INSERT INTO property_media (id, property_id, media_type, url, thumbnail_url, caption, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(mediaInsert, [
        uuidv4(), propertyId, 'image', image.url, image.thumbnailUrl || null,
        image.caption || null, image.order || i
      ]);
    }
    
    // Insert videos
    for (let i = 0; i < media.videos.length; i++) {
      const video = media.videos[i];
      const mediaInsert = `
        INSERT INTO property_media (id, property_id, media_type, url, thumbnail_url, caption, display_order, youtube_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await client.query(mediaInsert, [
        uuidv4(), propertyId, 'video', video.url || null, video.thumbnailUrl || null,
        video.title || null, i, video.youtubeId || null
      ]);
    }
    
    // Insert virtual tours
    for (let i = 0; i < media.virtualTours.length; i++) {
      const tour = media.virtualTours[i];
      const mediaInsert = `
        INSERT INTO property_media (id, property_id, media_type, url, caption, display_order, tour_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(mediaInsert, [
        uuidv4(), propertyId, 'virtual_tour', tour.url, tour.title || null, i, tour.type
      ]);
    }
  }
  
  private async replacePropertyMedia(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    await client.query('DELETE FROM property_media WHERE property_id = $1', [propertyId]);
    await this.insertPropertyMedia(client, propertyId, listing);
  }
  
  private async insertPropertyAgency(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    const agency = listing.agency;
    const agencyInsert = `
      INSERT INTO property_agencies (id, property_id, user_id, office_id, agency_id, is_exclusive, manages_estate)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(agencyInsert, [
      uuidv4(), propertyId, agency.userId || null, agency.officeId || null,
      agency.agencyId || null, agency.isExclusive, agency.managersEstate
    ]);
  }
  
  private async replacePropertyAgency(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    await client.query('DELETE FROM property_agencies WHERE property_id = $1', [propertyId]);
    await this.insertPropertyAgency(client, propertyId, listing);
  }
  
  private async insertPropertyStatus(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    const status = listing.status;
    const marketing = listing.marketing;
    const statusInsert = `
      INSERT INTO property_status (
        id, property_id, is_active, is_visible, state, completion,
        is_confidential, is_top_offer, is_vip_offer, immunity_until,
        labels, is_for_investment, is_selection, is_catalogue, export_to_imot_bg
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;
    await client.query(statusInsert, [
      uuidv4(), propertyId, status.isActive, status.isVisible, status.state || null,
      status.completion || null, status.isConfidential, status.isTopOffer, status.isVIPOffer,
      status.immunity || null, marketing.labels || [], marketing.isForInvestment,
      marketing.isSelection, marketing.isCatalogue, marketing.exportToImotBG
    ]);
  }
  
  private async replacePropertyStatus(client: any, propertyId: string, listing: ComprehensivePropertyListing): Promise<void> {
    await client.query('DELETE FROM property_status WHERE property_id = $1', [propertyId]);
    await this.insertPropertyStatus(client, propertyId, listing);
  }
  
  // ==================== SCRAPING SESSION MANAGEMENT ====================
  
  async createScrapingSession(sessionData: Partial<ScrapingSessionRecord>): Promise<string> {
    const session = createScrapingSessionRecord(sessionData);
    
    const sessionInsert = `
      INSERT INTO scraping_sessions (
        id, session_type, search_url, filters, started_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    const result = await db.query(sessionInsert, [
      session.id, session.session_type, session.search_url,
      JSON.stringify(session.filters), session.started_at, session.status
    ]);
    
    return result.rows[0].id;
  }
  
  async updateScrapingSession(sessionId: string, updates: Partial<ScrapingSessionRecord>): Promise<void> {
    const fields = Object.keys(updates).filter(key => updates[key as keyof ScrapingSessionRecord] !== undefined);
    const values = fields.map(field => updates[field as keyof ScrapingSessionRecord]);
    
    if (fields.length === 0) return;
    
    const setClause = fields.map((field, index) => {
      const dbField = field === 'filters' || field === 'errors' || field === 'warnings' || field === 'metadata' 
        ? field 
        : field.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${dbField} = $${index + 2}`;
    }).join(', ');
    
    const updateQuery = `UPDATE scraping_sessions SET ${setClause} WHERE id = $1`;
    
    await db.query(updateQuery, [sessionId, ...values]);
  }
  
  async completeScrapingSession(sessionId: string, stats: Partial<ScrapingSessionRecord>): Promise<void> {
    await this.updateScrapingSession(sessionId, {
      status: 'completed',
      completed_at: new Date(),
      ...stats
    });
  }
  
  // ==================== QUERY METHODS ====================
  
  async getPropertyByExternalId(externalId: string, sourceId: string = 'ues_bg'): Promise<PropertyRecord | null> {
    const query = `SELECT * FROM properties WHERE external_id = $1 AND source_id = $2`;
    const result = await db.query(query, [externalId, sourceId]);
    return result.rows[0] || null;
  }
  
  async getPropertiesWithPriceChanges(days: number = 7): Promise<any[]> {
    const query = `
      SELECT p.*, ph.old_price, ph.new_price, ph.change_type, ph.changed_at
      FROM properties p
      JOIN price_history ph ON p.id = ph.property_id
      WHERE ph.changed_at >= NOW() - INTERVAL '${days} days'
      AND ph.change_type != 'initial'
      ORDER BY ph.changed_at DESC
    `;
    const result = await db.query(query);
    return result.rows;
  }
  
  async getActivePropertiesCount(): Promise<number> {
    const result = await db.query('SELECT COUNT(*) FROM properties WHERE is_active = true');
    return parseInt(result.rows[0].count);
  }
  
  async getScrapingSessionStats(sessionId: string): Promise<ScrapingSessionRecord | null> {
    const query = `SELECT * FROM scraping_sessions WHERE id = $1`;
    const result = await db.query(query, [sessionId]);
    return result.rows[0] || null;
  }
}