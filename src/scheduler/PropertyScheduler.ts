import * as cron from 'node-cron';
import { ComprehensiveApiParser } from '../parser/ComprehensiveApiParser';
import { PropertyService } from '../database/PropertyService';
import { db } from '../database/connection';
import { SiteConfig } from '../types';

export interface SchedulerConfig {
  // Расписания для разных типов сканирования
  schedules: {
    fullScan: string;     // Полное сканирование всех объявлений
    updateCheck: string;  // Проверка обновлений активных объявлений  
    priceMonitor: string; // Мониторинг изменений цен
  };
  
  // Настройки сканирования
  scanning: {
    maxPagesPerScan: number;
    delayBetweenRequests: number;
    enableDatabase: boolean;
    enableNotifications: boolean;
  };
  
  // URL для сканирования
  searchUrls: {
    apartments: string;
    houses: string;
    offices: string;
    all: string;
  };
}

export class PropertyScheduler {
  private isRunning: boolean = false;
  private config: SchedulerConfig;
  private siteConfig: SiteConfig;
  private parser: ComprehensiveApiParser;
  private propertyService: PropertyService;
  private scheduledTasks: cron.ScheduledTask[] = [];

  constructor(config: SchedulerConfig, siteConfig: SiteConfig) {
    this.config = config;
    this.siteConfig = siteConfig;
    this.parser = new ComprehensiveApiParser(siteConfig);
    this.propertyService = new PropertyService();
  }

  // ==================== SCHEDULER CONTROL ====================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Scheduler is already running');
      return;
    }

    console.log('🚀 Starting Property Scheduler...');
    
    // Initialize database connection
    if (this.config.scanning.enableDatabase) {
      await db.connect();
      console.log('✅ Database connection established');
    }

    // Schedule full scan
    if (this.config.schedules.fullScan) {
      const fullScanTask = cron.schedule(this.config.schedules.fullScan, () => {
        this.runFullScan();
      });
      
      this.scheduledTasks.push(fullScanTask);
      console.log(`📅 Full scan scheduled: ${this.config.schedules.fullScan}`);
    }

    // Schedule update checks
    if (this.config.schedules.updateCheck) {
      const updateTask = cron.schedule(this.config.schedules.updateCheck, () => {
        this.runUpdateCheck();
      });
      
      this.scheduledTasks.push(updateTask);
      console.log(`📅 Update check scheduled: ${this.config.schedules.updateCheck}`);
    }

    // Schedule price monitoring
    if (this.config.schedules.priceMonitor) {
      const priceTask = cron.schedule(this.config.schedules.priceMonitor, () => {
        this.runPriceMonitoring();
      });
      
      this.scheduledTasks.push(priceTask);
      console.log(`📅 Price monitoring scheduled: ${this.config.schedules.priceMonitor}`);
    }

    this.isRunning = true;
    console.log('✅ Property Scheduler started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️  Scheduler is not running');
      return;
    }

    console.log('🛑 Stopping Property Scheduler...');
    
    // Stop all scheduled tasks
    this.scheduledTasks.forEach(task => {
      task.stop();
    });
    this.scheduledTasks = [];

    // Close database connection
    if (this.config.scanning.enableDatabase) {
      await db.close();
      console.log('📡 Database connection closed');
    }

    this.isRunning = false;
    console.log('✅ Property Scheduler stopped');
  }

  // ==================== SCHEDULED OPERATIONS ====================

  private async runFullScan(): Promise<void> {
    console.log('🔍 Starting scheduled full scan...');
    
    try {
      const results = await Promise.allSettled([
        this.scanCategory('apartments', this.config.searchUrls.apartments),
        this.scanCategory('houses', this.config.searchUrls.houses),
        this.scanCategory('offices', this.config.searchUrls.offices)
      ]);

      let totalProperties = 0;
      let totalErrors = 0;

      results.forEach((result, index) => {
        const category = ['apartments', 'houses', 'offices'][index];
        if (result.status === 'fulfilled') {
          totalProperties += result.value.processedListings;
          totalErrors += result.value.errors.length;
          console.log(`✅ ${category}: ${result.value.processedListings} properties processed`);
        } else {
          console.error(`❌ ${category} scan failed:`, result.reason);
          totalErrors++;
        }
      });

      console.log(`🎉 Full scan completed: ${totalProperties} properties, ${totalErrors} errors`);
      
      if (this.config.scanning.enableNotifications) {
        await this.sendNotification('Full Scan Completed', {
          totalProperties,
          totalErrors,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Full scan failed:', error);
    }
  }

  private async scanCategory(category: string, searchUrl: string): Promise<any> {
    console.log(`📋 Scanning ${category} from: ${searchUrl}`);
    
    const result = await this.parser.parseAllListings(
      searchUrl,
      this.config.scanning.maxPagesPerScan,
      this.config.scanning.enableDatabase
    );

    return result;
  }

  private async runUpdateCheck(): Promise<void> {
    console.log('🔄 Starting scheduled update check...');
    
    try {
      // Get list of active properties from database
      const activeCount = await this.propertyService.getActivePropertiesCount();
      console.log(`📊 Checking updates for ${activeCount} active properties`);

      // For now, run a light scan to detect changes
      // TODO: Implement more efficient update checking
      const result = await this.parser.parseAllListings(
        this.config.searchUrls.all,
        Math.min(5, this.config.scanning.maxPagesPerScan), // Limit to 5 pages for updates
        this.config.scanning.enableDatabase
      );

      console.log(`🔄 Update check completed: ${result.processedListings} properties checked`);

    } catch (error) {
      console.error('❌ Update check failed:', error);
    }
  }

  private async runPriceMonitoring(): Promise<void> {
    console.log('💰 Starting scheduled price monitoring...');
    
    try {
      // Get properties with recent price changes
      const recentChanges = await this.propertyService.getPropertiesWithPriceChanges(7);
      
      console.log(`📈 Found ${recentChanges.length} properties with recent price changes`);

      if (recentChanges.length > 0 && this.config.scanning.enableNotifications) {
        await this.sendNotification('Price Changes Detected', {
          changesCount: recentChanges.length,
          changes: recentChanges.slice(0, 5), // Send first 5 changes
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Price monitoring failed:', error);
    }
  }

  // ==================== NOTIFICATION SYSTEM ====================

  private async sendNotification(title: string, data: any): Promise<void> {
    // TODO: Implement notification system (email, webhook, etc.)
    console.log(`📧 NOTIFICATION: ${title}`, data);
    
    // Example webhook implementation:
    /*
    try {
      await axios.post(process.env.WEBHOOK_URL, {
        title,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
    */
  }

  // ==================== MANUAL OPERATIONS ====================

  async runManualScan(searchUrl: string, maxPages?: number): Promise<any> {
    if (!this.isRunning) {
      await db.connect();
    }

    console.log('🔧 Running manual scan...');
    
    try {
      const result = await this.parser.parseAllListings(
        searchUrl,
        maxPages || this.config.scanning.maxPagesPerScan,
        this.config.scanning.enableDatabase
      );

      console.log(`✅ Manual scan completed: ${result.processedListings} properties`);
      return result;

    } catch (error) {
      console.error('❌ Manual scan failed:', error);
      throw error;
    } finally {
      if (!this.isRunning) {
        await db.close();
      }
    }
  }

  async getSchedulerStatus(): Promise<{
    isRunning: boolean;
    activeTasksCount: number;
    nextScheduledTasks: string[];
    databaseConnected: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      activeTasksCount: this.scheduledTasks.length,
      nextScheduledTasks: this.scheduledTasks.map((task, index) => {
        const schedules = [
          this.config.schedules.fullScan,
          this.config.schedules.updateCheck,
          this.config.schedules.priceMonitor
        ];
        return schedules[index] || 'unknown';
      }),
      databaseConnected: db.isConnectedStatus
    };
  }

  // ==================== CONFIGURATION ====================

  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      schedules: {
        ...this.config.schedules,
        ...newConfig.schedules
      },
      scanning: {
        ...this.config.scanning,
        ...newConfig.scanning
      },
      searchUrls: {
        ...this.config.searchUrls,
        ...newConfig.searchUrls
      }
    };

    console.log('⚙️  Scheduler configuration updated');
  }
}

// Default configuration
export const defaultSchedulerConfig: SchedulerConfig = {
  schedules: {
    fullScan: '0 2 * * *',      // Daily at 2:00 AM
    updateCheck: '0 */4 * * *',  // Every 4 hours
    priceMonitor: '0 */2 * * *'  // Every 2 hours
  },
  scanning: {
    maxPagesPerScan: 50,
    delayBetweenRequests: 1200,
    enableDatabase: true,
    enableNotifications: true
  },
  searchUrls: {
    apartments: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/apartament',
    houses: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/kashta',
    offices: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/ofis',
    all: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia'
  }
};