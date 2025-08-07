import fs from 'fs/promises';
import path from 'path';

export interface FieldMapping {
  selector: string;
  attribute?: string; // 'text', 'href', 'src', or any HTML attribute
  transform?: 'number' | 'currency' | 'area' | 'date' | 'boolean';
  regex?: string;
  required?: boolean;
}

export interface ParserSite {
  id: string;
  name: string;
  baseUrl: string;
  searchUrls: string[];
  enabled: boolean;
  maxPages: number;
  selectors: {
    // List page selectors
    propertyLinks: string;
    nextPageButton?: string;
    
    // Property detail selectors
    title: FieldMapping;
    price: FieldMapping;
    area?: FieldMapping;
    rooms?: FieldMapping;
    floor?: FieldMapping;
    totalFloors?: FieldMapping;
    city: FieldMapping;
    quarter?: FieldMapping;
    address?: FieldMapping;
    description?: FieldMapping;
    propertyType?: FieldMapping;
    images?: FieldMapping;
    phone?: FieldMapping;
    email?: FieldMapping;
    agency?: FieldMapping;
    features?: FieldMapping; // parking, elevator, etc
  };
  waitTimes: {
    betweenPages: number;
    betweenProperties: number;
  };
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface ParserConfiguration {
  sites: ParserSite[];
  globalSettings: {
    timeout: number;
    retries: number;
    defaultWaitTime: number;
    concurrency: number;
  };
}

export class ParserConfigManager {
  private configPath: string;
  private config: ParserConfiguration | null = null;

  constructor() {
    this.configPath = path.resolve('./config/parser-config.json');
  }

  async loadConfig(): Promise<ParserConfiguration> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      return this.config!;
    } catch (error) {
      // Return default config if file doesn't exist
      this.config = this.getDefaultConfig();
      await this.saveConfig();
      return this.config;
    }
  }

  async saveConfig(config?: ParserConfiguration): Promise<void> {
    if (config) {
      this.config = config;
    }
    
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getDefaultConfig(): ParserConfiguration {
    return {
      sites: [
        {
          id: 'ues_bg',
          name: 'UES.bg',
          baseUrl: 'https://ues.bg',
          searchUrls: [
            'https://ues.bg/bg/find?form_action=search&property_type=for_rent&property_kind=apartament&city_id=66'
          ],
          enabled: true,
          maxPages: 3,
          selectors: {
            propertyLinks: 'a[href*="/bg/for_rent/"]',
            nextPageButton: 'a.next-page',
            title: {
              selector: 'h1.property-title, .title-main, h1',
              attribute: 'text',
              required: true
            },
            price: {
              selector: '.price-main .price, .price-value, .property-price',
              attribute: 'text',
              transform: 'currency',
              regex: '\\d+',
              required: true
            },
            area: {
              selector: '.property-area, .area-value, [data-area]',
              attribute: 'text',
              transform: 'area',
              regex: '\\d+(\\.\\d+)?'
            },
            rooms: {
              selector: '.rooms-count, .property-rooms, [data-rooms]',
              attribute: 'text',
              transform: 'number',
              regex: '\\d+'
            },
            floor: {
              selector: '.floor-info .floor, .property-floor',
              attribute: 'text',
              transform: 'number',
              regex: '\\d+'
            },
            totalFloors: {
              selector: '.floor-info .total-floors, .building-floors',
              attribute: 'text',
              transform: 'number',
              regex: '\\d+'
            },
            city: {
              selector: '.location .city, .property-city, .location-city',
              attribute: 'text',
              required: true
            },
            quarter: {
              selector: '.location .quarter, .neighborhood, .property-quarter',
              attribute: 'text'
            },
            address: {
              selector: '.full-address, .property-address, .location-full',
              attribute: 'text'
            },
            description: {
              selector: '.property-description, .description-text, .property-details',
              attribute: 'text'
            },
            propertyType: {
              selector: '.property-type, .type-value, [data-type]',
              attribute: 'text'
            },
            images: {
              selector: '.property-images img, .gallery img, .photo-gallery img',
              attribute: 'src'
            },
            phone: {
              selector: '.contact-phone, .phone-number, [data-phone]',
              attribute: 'text',
              regex: '\\+?[\\d\\s\\-\\(\\)]+'
            },
            email: {
              selector: '.contact-email, .email-address, [data-email]',
              attribute: 'text'
            },
            agency: {
              selector: '.agency-name, .broker-name, .publisher-name',
              attribute: 'text'
            },
            features: {
              selector: '.property-features li, .amenities li, .features-list li',
              attribute: 'text'
            }
          },
          waitTimes: {
            betweenPages: 2000,
            betweenProperties: 1000
          },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          headers: {
            'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8'
          }
        }
      ],
      globalSettings: {
        timeout: 30000,
        retries: 3,
        defaultWaitTime: 1000,
        concurrency: 2
      }
    };
  }

  async getSite(siteId: string): Promise<ParserSite | null> {
    const config = await this.loadConfig();
    return config.sites.find(site => site.id === siteId) || null;
  }

  async addSite(site: ParserSite): Promise<void> {
    const config = await this.loadConfig();
    
    // Check if site already exists
    const existingIndex = config.sites.findIndex(s => s.id === site.id);
    if (existingIndex >= 0) {
      config.sites[existingIndex] = site;
    } else {
      config.sites.push(site);
    }
    
    await this.saveConfig(config);
  }

  async removeSite(siteId: string): Promise<boolean> {
    const config = await this.loadConfig();
    const initialLength = config.sites.length;
    config.sites = config.sites.filter(site => site.id !== siteId);
    
    if (config.sites.length !== initialLength) {
      await this.saveConfig(config);
      return true;
    }
    return false;
  }

  async updateSite(siteId: string, updates: Partial<ParserSite>): Promise<boolean> {
    const config = await this.loadConfig();
    const siteIndex = config.sites.findIndex(site => site.id === siteId);
    
    if (siteIndex >= 0) {
      config.sites[siteIndex] = { ...config.sites[siteIndex], ...updates };
      await this.saveConfig(config);
      return true;
    }
    return false;
  }

  async toggleSite(siteId: string): Promise<boolean> {
    const config = await this.loadConfig();
    const site = config.sites.find(s => s.id === siteId);
    
    if (site) {
      site.enabled = !site.enabled;
      await this.saveConfig(config);
      return site.enabled;
    }
    return false;
  }

  async validateSiteConfig(site: ParserSite): Promise<string[]> {
    const errors: string[] = [];

    if (!site.id || site.id.trim() === '') {
      errors.push('Site ID is required');
    }

    if (!site.name || site.name.trim() === '') {
      errors.push('Site name is required');
    }

    if (!site.baseUrl || !this.isValidUrl(site.baseUrl)) {
      errors.push('Valid base URL is required');
    }

    if (!site.searchUrls || site.searchUrls.length === 0) {
      errors.push('At least one search URL is required');
    } else {
      site.searchUrls.forEach((url, index) => {
        if (!this.isValidUrl(url)) {
          errors.push(`Search URL ${index + 1} is not valid`);
        }
      });
    }

    if (!site.selectors.propertyLinks) {
      errors.push('Property links selector is required');
    }

    if (!site.selectors.title?.selector) {
      errors.push('Title selector is required');
    }

    if (!site.selectors.price?.selector) {
      errors.push('Price selector is required');
    }

    if (!site.selectors.city?.selector) {
      errors.push('City selector is required');
    }

    return errors;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async exportConfig(): Promise<string> {
    const config = await this.loadConfig();
    return JSON.stringify(config, null, 2);
  }

  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as ParserConfiguration;
      
      // Basic validation
      if (!config.sites || !Array.isArray(config.sites)) {
        throw new Error('Invalid configuration: sites array is required');
      }

      await this.saveConfig(config);
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const parserConfigManager = new ParserConfigManager();