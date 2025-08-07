import * as fs from 'fs/promises';
import * as path from 'path';
import { MonitoringConfig } from '../monitoring/ListingMonitor';
import { NotificationConfig } from '../notifications/NotificationService';

export interface AppConfig {
  monitoring: MonitoringConfig;
  notifications: NotificationConfig;
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export class ConfigManager {
  private configPath: string;
  private config?: AppConfig;

  constructor(configPath: string = './config/app-config.json') {
    this.configPath = path.resolve(configPath);
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      console.log('✅ Configuration loaded from', this.configPath);
      return this.config!;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('📝 Creating default configuration...');
        this.config = this.createDefaultConfig();
        await this.saveConfig(this.config);
        return this.config;
      }
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  async saveConfig(config: AppConfig): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      this.config = config;
      console.log('✅ Configuration saved to', this.configPath);
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  getConfig(): AppConfig | undefined {
    return this.config;
  }

  async updateMonitoringConfig(updates: Partial<MonitoringConfig>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.monitoring = { ...this.config.monitoring, ...updates };
    await this.saveConfig(this.config);
  }

  async updateNotificationConfig(updates: Partial<NotificationConfig>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.notifications = { ...this.config.notifications, ...updates };
    await this.saveConfig(this.config);
  }

  private createDefaultConfig(): AppConfig {
    return {
      monitoring: {
        enabled: true,
        checkInterval: '*/10 * * * *', // Every 10 minutes
        sources: [
          {
            id: 'ues_bg',
            name: 'UES.bg',
            searchUrls: [
              'https://ues.bg/bg/find?form_action=search&property_type=for_rent&property_kind=apartament&city_id=66&source=&state=&t=1',
              'https://ues.bg/bg/find?form_action=search&property_type=for_rent&property_kind=studio&city_id=66'
            ],
            maxPages: 3
          }
        ],
        filters: {
          minPrice: 500,
          maxPrice: 2000,
          cities: ['София', 'Sofia'],
          propertyTypes: ['Апартамент', 'Студио']
        }
      },
      notifications: {
        email: {
          enabled: false, // User needs to configure
          smtpHost: '',
          smtpPort: 587,
          smtpUser: '',
          smtpPass: '',
          fromEmail: '',
          toEmail: ''
        },
        webhook: {
          enabled: false,
          url: '',
          headers: {}
        },
        desktop: {
          enabled: true
        }
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'real_estate',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || ''
      }
    };
  }

  async addMonitoringSource(source: MonitoringConfig['sources'][0]): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.monitoring.sources.push(source);
    await this.saveConfig(this.config);
  }

  async removeMonitoringSource(sourceId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.monitoring.sources = this.config.monitoring.sources.filter(s => s.id !== sourceId);
    await this.saveConfig(this.config);
  }

  async updateMonitoringSource(sourceId: string, updates: Partial<MonitoringConfig['sources'][0]>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const sourceIndex = this.config.monitoring.sources.findIndex(s => s.id === sourceId);
    if (sourceIndex === -1) {
      throw new Error(`Source ${sourceId} not found`);
    }

    this.config.monitoring.sources[sourceIndex] = { 
      ...this.config.monitoring.sources[sourceIndex], 
      ...updates 
    };
    
    await this.saveConfig(this.config);
  }

  // Helper methods for common configuration scenarios
  async setupEmailNotifications(emailConfig: NonNullable<NotificationConfig['email']>): Promise<void> {
    await this.updateNotificationConfig({
      email: { ...emailConfig, enabled: true }
    });
  }

  async setupWebhookNotifications(webhookUrl: string, headers?: Record<string, string>): Promise<void> {
    await this.updateNotificationConfig({
      webhook: {
        enabled: true,
        url: webhookUrl,
        headers
      }
    });
  }

  async setMonitoringInterval(interval: string): Promise<void> {
    await this.updateMonitoringConfig({
      checkInterval: interval
    });
  }

  async setPriceFilters(minPrice?: number, maxPrice?: number): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const currentFilters = this.config.monitoring.filters || {};
    await this.updateMonitoringConfig({
      filters: {
        ...currentFilters,
        minPrice,
        maxPrice
      }
    });
  }

  async setCityFilters(cities: string[]): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const currentFilters = this.config.monitoring.filters || {};
    await this.updateMonitoringConfig({
      filters: {
        ...currentFilters,
        cities
      }
    });
  }

  // Validation methods
  validateConfig(config: AppConfig): string[] {
    const errors: string[] = [];

    // Validate monitoring config
    if (config.monitoring.enabled) {
      if (!config.monitoring.checkInterval) {
        errors.push('Monitoring interval is required when monitoring is enabled');
      }

      if (config.monitoring.sources.length === 0) {
        errors.push('At least one monitoring source is required');
      }

      config.monitoring.sources.forEach((source, index) => {
        if (!source.id) errors.push(`Source ${index + 1} missing ID`);
        if (!source.name) errors.push(`Source ${index + 1} missing name`);
        if (!source.searchUrls || source.searchUrls.length === 0) {
          errors.push(`Source ${index + 1} missing search URLs`);
        }
      });
    }

    // Validate notification config
    if (config.notifications.email?.enabled) {
      const email = config.notifications.email;
      if (!email.smtpHost) errors.push('Email SMTP host is required');
      if (!email.smtpUser) errors.push('Email SMTP user is required');
      if (!email.smtpPass) errors.push('Email SMTP password is required');
      if (!email.fromEmail) errors.push('From email address is required');
      if (!email.toEmail) errors.push('To email address is required');
    }

    if (config.notifications.webhook?.enabled) {
      if (!config.notifications.webhook.url) {
        errors.push('Webhook URL is required when webhook notifications are enabled');
      }
    }

    return errors;
  }

  async validateAndSaveConfig(config: AppConfig): Promise<void> {
    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    await this.saveConfig(config);
  }
}