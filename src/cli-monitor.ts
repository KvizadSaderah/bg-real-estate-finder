#!/usr/bin/env ts-node

import { Command } from 'commander';
import chalk from 'chalk';
import { ListingMonitor } from './monitoring/ListingMonitor';
import { NotificationService } from './notifications/NotificationService';
import { ConfigManager } from './config/MonitoringConfig';
import { db } from './database/connection';

const program = new Command();

async function initializeServices() {
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  const notificationService = new NotificationService(config.notifications);
  const listingMonitor = new ListingMonitor(config.monitoring, notificationService);
  
  return { configManager, listingMonitor, notificationService, config };
}

program
  .name('monitor')
  .description('Real Estate Listing Monitor')
  .version('1.0.0');

// Start monitoring service
program
  .command('start')
  .description('Start the listing monitoring service')
  .option('-d, --daemon', 'Run in daemon mode (keeps running)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting Real Estate Listing Monitor'));
      
      await db.connect();
      console.log(chalk.green('✅ Database connected'));
      
      const { listingMonitor, notificationService } = await initializeServices();
      
      // Test notification service
      const notificationTest = await notificationService.testConnection();
      if (!notificationTest) {
        console.log(chalk.yellow('⚠️  Notification service test failed, but continuing...'));
      }
      
      if (options.daemon) {
        console.log(chalk.blue('🔄 Starting monitoring in daemon mode...'));
        listingMonitor.start();
        
        // Keep the process running
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n🛑 Stopping monitoring service...'));
          listingMonitor.stop();
          db.close().then(() => {
            console.log(chalk.green('✅ Monitoring service stopped'));
            process.exit(0);
          });
        });
        
        // Keep alive
        setInterval(() => {
          const session = listingMonitor.getCurrentSession();
          if (session) {
            console.log(chalk.gray(`📊 Current session: ${session.status} - ${session.newListingsFound} new listings`));
          }
        }, 60000); // Log status every minute
        
      } else {
        console.log(chalk.blue('🔍 Running single monitoring cycle...'));
        const session = await listingMonitor.runMonitoringCycle();
        
        console.log(chalk.green('\n✅ Monitoring cycle completed:'));
        console.log(`   📊 Sources checked: ${session.sourcesChecked}`);
        console.log(`   🆕 New listings: ${session.newListingsFound}`);
        console.log(`   💰 Price changes: ${session.priceChanges}`);
        console.log(`   ⏱️  Duration: ${session.completedAt ? session.completedAt.getTime() - session.startedAt.getTime() : 0}ms`);
        
        if (session.errors.length > 0) {
          console.log(chalk.yellow(`   ⚠️  Errors: ${session.errors.length}`));
          session.errors.forEach(error => console.log(chalk.red(`      • ${error}`)));
        }
        
        await db.close();
        process.exit(0);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start monitoring service:'), error);
      process.exit(1);
    }
  });

// Configuration management
program
  .command('config')
  .description('Manage monitoring configuration')
  .action(async () => {
    try {
      const { configManager, config } = await initializeServices();
      
      console.log(chalk.blue('📋 Current Configuration:'));
      console.log('\n' + chalk.bold('Monitoring:'));
      console.log(`  Enabled: ${config.monitoring.enabled ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`  Interval: ${config.monitoring.checkInterval}`);
      console.log(`  Sources: ${config.monitoring.sources.length}`);
      
      config.monitoring.sources.forEach((source, index) => {
        console.log(`    ${index + 1}. ${source.name} (${source.searchUrls.length} URLs, max ${source.maxPages} pages)`);
      });
      
      if (config.monitoring.filters) {
        console.log('\n' + chalk.bold('Filters:'));
        if (config.monitoring.filters.minPrice) console.log(`  Min Price: ${config.monitoring.filters.minPrice} EUR`);
        if (config.monitoring.filters.maxPrice) console.log(`  Max Price: ${config.monitoring.filters.maxPrice} EUR`);
        if (config.monitoring.filters.cities) console.log(`  Cities: ${config.monitoring.filters.cities.join(', ')}`);
      }
      
      console.log('\n' + chalk.bold('Notifications:'));
      console.log(`  Email: ${config.notifications.email?.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      console.log(`  Webhook: ${config.notifications.webhook?.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      console.log(`  Desktop: ${config.notifications.desktop?.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to load configuration:'), error);
      process.exit(1);
    }
  });

// Setup email notifications
program
  .command('setup-email')
  .description('Setup email notifications')
  .requiredOption('-h, --host <host>', 'SMTP host')
  .requiredOption('-u, --user <user>', 'SMTP username')
  .requiredOption('-p, --pass <pass>', 'SMTP password')
  .requiredOption('-f, --from <from>', 'From email address')
  .requiredOption('-t, --to <to>', 'To email address')
  .option('--port <port>', 'SMTP port', '587')
  .action(async (options) => {
    try {
      const { configManager } = await initializeServices();
      
      await configManager.setupEmailNotifications({
        enabled: true,
        smtpHost: options.host,
        smtpPort: parseInt(options.port),
        smtpUser: options.user,
        smtpPass: options.pass,
        fromEmail: options.from,
        toEmail: options.to
      });
      
      console.log(chalk.green('✅ Email notifications configured successfully'));
      
      // Test the configuration
      const config = configManager.getConfig()!;
      const notificationService = new NotificationService(config.notifications);
      const testResult = await notificationService.testConnection();
      
      if (testResult) {
        console.log(chalk.green('✅ Email service test successful'));
      } else {
        console.log(chalk.yellow('⚠️  Email service test failed - please check your settings'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup email notifications:'), error);
      process.exit(1);
    }
  });

// Setup webhook notifications
program
  .command('setup-webhook')
  .description('Setup webhook notifications')
  .requiredOption('-u, --url <url>', 'Webhook URL')
  .option('-h, --header <header>', 'Custom headers (format: key:value)', (value, previous) => {
    const headers = previous || {};
    const [key, val] = value.split(':');
    if (key && val) {
      headers[key.trim()] = val.trim();
    }
    return headers;
  })
  .action(async (options) => {
    try {
      const { configManager } = await initializeServices();
      
      await configManager.setupWebhookNotifications(options.url, options.header);
      console.log(chalk.green('✅ Webhook notifications configured successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup webhook notifications:'), error);
      process.exit(1);
    }
  });

// Add monitoring source
program
  .command('add-source')
  .description('Add a new monitoring source')
  .requiredOption('-i, --id <id>', 'Source ID')
  .requiredOption('-n, --name <name>', 'Source name')
  .requiredOption('-u, --url <url>', 'Search URL (can be specified multiple times)', (value, previous) => {
    return previous ? [...previous, value] : [value];
  })
  .option('-p, --pages <pages>', 'Max pages to scan', '3')
  .action(async (options) => {
    try {
      const { configManager } = await initializeServices();
      
      await configManager.addMonitoringSource({
        id: options.id,
        name: options.name,
        searchUrls: Array.isArray(options.url) ? options.url : [options.url],
        maxPages: parseInt(options.pages)
      });
      
      console.log(chalk.green(`✅ Source "${options.name}" added successfully`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to add monitoring source:'), error);
      process.exit(1);
    }
  });

// Set price filters
program
  .command('set-price-filter')
  .description('Set price range filters')
  .option('--min <min>', 'Minimum price')
  .option('--max <max>', 'Maximum price')
  .action(async (options) => {
    try {
      const { configManager } = await initializeServices();
      
      await configManager.setPriceFilters(
        options.min ? parseInt(options.min) : undefined,
        options.max ? parseInt(options.max) : undefined
      );
      
      console.log(chalk.green('✅ Price filters updated successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to update price filters:'), error);
      process.exit(1);
    }
  });

// Set monitoring interval
program
  .command('set-interval')
  .description('Set monitoring check interval')
  .argument('<interval>', 'Cron expression (e.g., "*/5 * * * *" for every 5 minutes)')
  .action(async (interval) => {
    try {
      const { configManager } = await initializeServices();
      
      await configManager.setMonitoringInterval(interval);
      console.log(chalk.green(`✅ Monitoring interval set to: ${interval}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to set monitoring interval:'), error);
      process.exit(1);
    }
  });

// Test notifications
program
  .command('test-notifications')
  .description('Send a test notification')
  .action(async () => {
    try {
      const { notificationService } = await initializeServices();
      
      const testProperty = {
        id: 'test_property',
        title: 'Test Property - Beautiful 2BR Apartment in Sofia Center',
        price: 1200,
        currency: 'EUR',
        city: 'Sofia',
        quarter: 'Center',
        area: 85,
        rooms: 2,
        url: 'https://ues.bg/test-property',
        pricePerSqm: 14.12,
        isTopOffer: true,
        isVipOffer: false,
      };
      
      await notificationService.sendNewListingAlert([testProperty]);
      console.log(chalk.green('✅ Test notification sent successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to send test notification:'), error);
      process.exit(1);
    }
  });

// Status check
program
  .command('status')
  .description('Check monitoring service status')
  .action(async () => {
    try {
      await db.connect();
      
      // Get recent monitoring sessions
      const query = `
        SELECT 
          session_type,
          started_at,
          completed_at,
          status,
          properties_new,
          metadata
        FROM scraping_sessions 
        WHERE session_type = 'monitoring_cycle'
        ORDER BY started_at DESC 
        LIMIT 5
      `;
      
      const result = await db.query(query);
      
      console.log(chalk.blue('📊 Recent Monitoring Sessions:'));
      
      if (result.rows.length === 0) {
        console.log(chalk.gray('   No monitoring sessions found'));
      } else {
        result.rows.forEach((session, index) => {
          const startTime = new Date(session.started_at).toLocaleString();
          const duration = session.completed_at ? 
            new Date(session.completed_at).getTime() - new Date(session.started_at).getTime() : 
            'Running...';
          
          const statusColor = session.status === 'completed' ? chalk.green : 
                             session.status === 'failed' ? chalk.red : chalk.yellow;
          
          console.log(`   ${index + 1}. ${startTime}`);
          console.log(`      Status: ${statusColor(session.status)}`);
          console.log(`      New Properties: ${session.properties_new || 0}`);
          console.log(`      Duration: ${typeof duration === 'number' ? duration + 'ms' : duration}`);
          
          if (session.metadata) {
            try {
              const metadata = JSON.parse(session.metadata);
              if (metadata.priceChanges) {
                console.log(`      Price Changes: ${metadata.priceChanges}`);
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
          
          console.log('');
        });
      }
      
      await db.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to check status:'), error);
      process.exit(1);
    }
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err) {
  console.error(chalk.red('Command failed:'), err);
  process.exit(1);
}

if (!process.argv.slice(2).length) {
  program.outputHelp();
}