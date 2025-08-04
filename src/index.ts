import { SiteAnalyzer } from './analyzer/SiteAnalyzer';
import { PropertyParser } from './parser/PropertyParser';
import { ConfigManager } from './config/ConfigManager';

export { SiteAnalyzer, PropertyParser, ConfigManager };

export * from './types';

// Main function for programmatic usage
export async function parseRealEstate(url: string, configId?: string) {
  const configManager = new ConfigManager();
  await configManager.init();
  
  let config;
  
  if (configId) {
    config = configManager.getConfig(configId);
    if (!config) {
      throw new Error(`Configuration '${configId}' not found`);
    }
  } else {
    // Auto-analyze and create config
    const analyzer = new SiteAnalyzer();
    try {
      const analysis = await analyzer.analyzeSite(url);
      config = configManager.createConfigFromUrl(url, analysis.suggestedConfig);
    } finally {
      await analyzer.close();
    }
  }
  
  const parser = new PropertyParser(config);
  try {
    return await parser.parseListings(url);
  } finally {
    await parser.close();
  }
}

// Quick start function for ues.bg
export async function parseUESBG(filters?: { city?: string; propertyType?: string }) {
  const configManager = new ConfigManager();
  const config = configManager.getUESBGConfig();
  
  let url = config.baseUrl;
  
  // Apply filters if provided
  if (filters?.city) {
    url += `/bg/bgr/${filters.city.toLowerCase()}/`;
  }
  if (filters?.propertyType) {
    url += `${filters.propertyType}/`;
  }
  
  const parser = new PropertyParser(config);
  try {
    return await parser.parseListings(url);
  } finally {
    await parser.close();
  }
}