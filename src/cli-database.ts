#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { PropertyScheduler, defaultSchedulerConfig } from './scheduler/PropertyScheduler';
import { db } from './database/connection';
import { PropertyService } from './database/PropertyService';
import { ComprehensiveApiParser } from './parser/ComprehensiveApiParser';

const program = new Command();

// Site configuration for UES.bg
const siteConfig = {
  id: 'ues_bg',
  name: 'UES.bg',
  baseUrl: 'https://ues.bg',
  type: 'hybrid' as const,
  selectors: {
    listingContainer: '',
    listingCard: '',
    title: '',
    price: '',
    location: '',
    link: '',
    image: ''
  },
  pagination: {
    type: 'page_numbers' as const,
    selector: '',
    maxPages: 50
  },
  rateLimit: {
    requestsPerMinute: 30,
    delayBetweenPages: 1200
  }
};

let scheduler: PropertyScheduler;

program
  .name('real-estate-db')
  .description('Database and scheduler management for UES.bg property tracking')
  .version('1.0.0');

// ==================== DATABASE COMMANDS ====================

program
  .command('db:init')
  .description('Initialize database connection and create tables')
  .action(async () => {
    try {
      console.log(chalk.blue('🔧 Initializing database...'));
      
      await db.connect();
      console.log(chalk.green('✅ Database connection established'));
      
      // TODO: Run schema creation if needed
      console.log(chalk.yellow('💡 Run the schema.sql file manually to create tables'));
      console.log(chalk.gray('   psql -U postgres -d real_estate -f src/database/schema.sql'));
      
      await db.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Database initialization failed:'), error);
      process.exit(1);
    }
  });

program
  .command('db:status')
  .description('Check database connection and table status')
  .action(async () => {
    try {
      console.log(chalk.blue('📊 Checking database status...'));
      
      await db.connect();
      
      // Check if tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('properties', 'property_pricing', 'property_details', 'scraping_sessions')
      `;
      
      const result = await db.query(tablesQuery);
      const existingTables = result.rows.map((row: any) => row.table_name);
      
      console.log(chalk.green('✅ Database connected'));
      console.log(chalk.blue('📋 Tables status:'));
      
      const requiredTables = ['properties', 'property_pricing', 'property_details', 'scraping_sessions'];
      requiredTables.forEach(table => {
        const exists = existingTables.includes(table);
        console.log(`  ${exists ? '✅' : '❌'} ${table}`);
      });
      
      // Get basic stats
      if (existingTables.includes('properties')) {
        const statsQuery = 'SELECT COUNT(*) as total FROM properties WHERE is_active = true';
        const stats = await db.query(statsQuery);
        console.log(chalk.blue(`📈 Active properties: ${stats.rows[0].total}`));
      }
      
      await db.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Database status check failed:'), error);
    }
  });

// ==================== SCANNING COMMANDS ====================

program
  .command('scan')
  .description('Run a one-time comprehensive scan and save to database')
  .option('--url <url>', 'Search URL to scan', 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia')
  .option('--pages <number>', 'Maximum pages to scan', '10')
  .option('--no-db', 'Skip database saving')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting manual property scan...'));
      
      const parser = new ComprehensiveApiParser(siteConfig);
      const maxPages = parseInt(options.pages);
      const saveToDb = options.db !== false;
      
      console.log(chalk.gray(`📋 URL: ${options.url}`));
      console.log(chalk.gray(`📄 Max pages: ${maxPages}`));
      console.log(chalk.gray(`💾 Save to DB: ${saveToDb ? 'Yes' : 'No'}`));
      
      const result = await parser.parseAllListings(options.url, maxPages, saveToDb);
      
      console.log(chalk.green('\n🎉 Scan completed!'));
      console.log(chalk.blue(`📊 Results:`));
      console.log(`  ${chalk.cyan('Total found:')} ${result.totalListings}`);
      console.log(`  ${chalk.cyan('Processed:')} ${result.processedListings}`);
      console.log(`  ${chalk.cyan('Pages:')} ${result.statistics.pagesProcessed}/${result.statistics.totalPages}`);
      console.log(`  ${chalk.cyan('Time:')} ${(result.statistics.timeElapsed / 1000).toFixed(1)}s`);
      console.log(`  ${chalk.cyan('Quality:')} ${result.statistics.dataQualityScore.toFixed(1)}%`);
      
      if (result.errors.length > 0) {
        console.log(chalk.red(`❌ Errors: ${result.errors.length}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Scan failed:'), error);
      process.exit(1);
    }
  });

// ==================== SCHEDULER COMMANDS ====================

program
  .command('scheduler:start')
  .description('Start the automated property scheduler')
  .option('--config <file>', 'Custom scheduler configuration file')
  .action(async (options) => {
    try {
      console.log(chalk.blue('⏰ Starting property scheduler...'));
      
      // Initialize scheduler
      scheduler = new PropertyScheduler(defaultSchedulerConfig, siteConfig);
      
      // Start scheduler
      await scheduler.start();
      
      console.log(chalk.green('✅ Property scheduler is running'));
      console.log(chalk.yellow('Press Ctrl+C to stop'));
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n⏹️  Stopping scheduler...'));
        await scheduler.stop();
        process.exit(0);
      });
      
      // Keep process alive
      process.stdin.resume();
      
    } catch (error) {
      console.error(chalk.red('❌ Scheduler start failed:'), error);
      process.exit(1);
    }
  });

program
  .command('scheduler:status')
  .description('Check scheduler status')
  .action(async () => {
    try {
      if (!scheduler) {
        console.log(chalk.yellow('⚠️  Scheduler is not running'));
        return;
      }
      
      const status = await scheduler.getSchedulerStatus();
      
      console.log(chalk.blue('📊 Scheduler Status:'));
      console.log(`  ${chalk.cyan('Running:')} ${status.isRunning ? '✅ Yes' : '❌ No'}`);
      console.log(`  ${chalk.cyan('Active tasks:')} ${status.activeTasksCount}`);
      console.log(`  ${chalk.cyan('Database:')} ${status.databaseConnected ? '✅ Connected' : '❌ Disconnected'}`);
      
      if (status.nextScheduledTasks.length > 0) {
        console.log(chalk.blue('📅 Scheduled tasks:'));
        status.nextScheduledTasks.forEach((schedule, index) => {
          const taskTypes = ['Full Scan', 'Update Check', 'Price Monitor'];
          console.log(`  ${taskTypes[index]}: ${schedule}`);
        });
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Status check failed:'), error);
    }
  });

// ==================== ANALYTICS COMMANDS ====================

program
  .command('stats')
  .description('Show property database statistics')
  .action(async () => {
    try {
      console.log(chalk.blue('📊 Loading property statistics...'));
      
      const propertyService = new PropertyService();
      await db.connect();
      
      // Basic counts
      const totalActive = await propertyService.getActivePropertiesCount();
      console.log(chalk.green(`📈 Active properties: ${totalActive}`));
      
      // Recent price changes
      const recentChanges = await propertyService.getPropertiesWithPriceChanges(7);
      console.log(chalk.blue(`💰 Price changes (last 7 days): ${recentChanges.length}`));
      
      if (recentChanges.length > 0) {
        console.log(chalk.gray('Recent price changes:'));
        recentChanges.slice(0, 5).forEach((change: any) => {
          const changeSymbol = change.change_type === 'increase' ? '📈' : '📉';
          console.log(`  ${changeSymbol} ${change.title.slice(0, 50)}... ${change.old_price}→${change.new_price} ${change.currency}`);
        });
      }
      
      await db.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Stats loading failed:'), error);
    }
  });

// ==================== UTILITY COMMANDS ====================

program
  .command('test-db')
  .description('Test database connection and basic operations')
  .action(async () => {
    try {
      console.log(chalk.blue('🧪 Testing database operations...'));
      
      await db.connect();
      console.log(chalk.green('✅ Database connection test passed'));
      
      // Test basic query
      const testQuery = 'SELECT NOW() as current_time';
      const result = await db.query(testQuery);
      console.log(chalk.green(`✅ Query test passed: ${result.rows[0].current_time}`));
      
      await db.close();
      console.log(chalk.green('✅ All database tests passed'));
      
    } catch (error) {
      console.error(chalk.red('❌ Database test failed:'), error);
      process.exit(1);
    }
  });

program.parse();