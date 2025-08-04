import { SiteConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ConfigManager {
  private configDir: string;
  private configs: Map<string, SiteConfig> = new Map();

  constructor(configDir: string = './configs') {
    this.configDir = configDir;
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      await this.loadConfigs();
    } catch (error) {
      console.error('Failed to initialize config manager:', error);
    }
  }

  async loadConfigs(): Promise<void> {
    try {
      const files = await fs.readdir(this.configDir);
      const configFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of configFiles) {
        const filePath = path.join(this.configDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const config: SiteConfig = JSON.parse(content);
        this.configs.set(config.id, config);
      }
      
      console.log(`Loaded ${this.configs.size} site configurations`);
    } catch (error) {
      console.error('Failed to load configurations:', error);
    }
  }

  async saveConfig(config: SiteConfig): Promise<void> {
    const filePath = path.join(this.configDir, `${config.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    this.configs.set(config.id, config);
    console.log(`Saved configuration for ${config.name}`);
  }

  getConfig(siteId: string): SiteConfig | undefined {
    return this.configs.get(siteId);
  }

  getAllConfigs(): SiteConfig[] {
    return Array.from(this.configs.values());
  }

  createConfigFromUrl(url: string, suggestedConfig: Partial<SiteConfig>): SiteConfig {
    const domain = new URL(url).hostname.replace('www.', '');
    const id = domain.replace(/\./g, '_');
    
    return {
      id,
      name: domain,
      baseUrl: new URL(url).origin,
      type: suggestedConfig.type || 'hybrid',
      selectors: {
        listingContainer: '.properties',
        listingCard: '.property',
        title: 'h2',
        price: '.price',
        location: '.location',
        link: 'a',
        ...suggestedConfig.selectors
      },
      pagination: {
        type: 'none',
        ...suggestedConfig.pagination
      },
      rateLimit: {
        requestsPerMinute: 30,
        delayBetweenPages: 2000,
        ...suggestedConfig.rateLimit
      }
    };
  }

  // Predefined config for ues.bg based on analysis
  getUESBGConfig(): SiteConfig {
    return {
      id: 'ues_bg',
      name: 'Unique Estates Bulgaria',
      baseUrl: 'https://ues.bg',
      type: 'spa',
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
        type: 'infinite_scroll',
        selector: '.load-more, .show-more',
        maxPages: 50
      },
      filters: {
        city: {
          urlPattern: '/bg/bgr/{city}/',
          values: ['sofia', 'plovdiv', 'varna', 'burgas']
        },
        propertyType: {
          urlPattern: '/{type}/',
          values: ['apartament', 'kashta', 'ofis']
        }
      },
      rateLimit: {
        requestsPerMinute: 20,
        delayBetweenPages: 3000
      }
    };
  }
}