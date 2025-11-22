#!/usr/bin/env ts-node

/**
 * Automatic Real Estate Aggregator for Sofia, Bulgaria
 *
 * This script runs automated monitoring of all configured real estate agencies
 * and sends notifications about new listings matching specified criteria.
 */

import { Command } from 'commander';
import { ListingMonitor, MonitoringConfig } from './monitoring/ListingMonitor';
import { NotificationService } from './notifications/NotificationService';
import { PropertyService } from './database/PropertyService';
import { parserConfigManager } from './config/ParserConfig';
import { db } from './database/connection';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

const CONFIG_PATH = './config/aggregator-monitoring.json';

interface AggregatorConfig {
  enabled: boolean;
  checkInterval: string; // cron expression
  filters: {
    minPrice?: number;
    maxPrice?: number;
    cities: string[];
    propertyTypes?: string[];
  };
  notifications: {
    email: {
      enabled: boolean;
      toEmail: string;
    };
  };
}

const DEFAULT_CONFIG: AggregatorConfig = {
  enabled: true,
  checkInterval: '*/15 * * * *', // Every 15 minutes
  filters: {
    minPrice: 500,
    maxPrice: 3000,
    cities: ['Sofia', 'София']
  },
  notifications: {
    email: {
      enabled: true,
      toEmail: ''
    }
  }
};

/**
 * Load aggregator configuration
 */
async function loadAggregatorConfig(): Promise<AggregatorConfig> {
  try {
    const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    // Return default config if file doesn't exist
    return DEFAULT_CONFIG;
  }
}

/**
 * Save aggregator configuration
 */
async function saveAggregatorConfig(config: AggregatorConfig): Promise<void> {
  const configDir = path.dirname(CONFIG_PATH);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Convert aggregator config to monitoring config
 */
async function buildMonitoringConfig(aggConfig: AggregatorConfig): Promise<MonitoringConfig> {
  const parserConfig = await parserConfigManager.loadConfig();
  const enabledSites = parserConfig.sites.filter(site => site.enabled);

  return {
    enabled: aggConfig.enabled,
    checkInterval: aggConfig.checkInterval,
    sources: enabledSites.map(site => ({
      id: site.id,
      name: site.name,
      searchUrls: site.searchUrls,
      maxPages: Math.min(site.maxPages, 3) // Limit to 3 pages for monitoring
    })),
    filters: aggConfig.filters
  };
}

program
  .name('auto-aggregator')
  .description('Automatic Real Estate Aggregator with Monitoring')
  .version('1.0.0');

/**
 * Start monitoring
 */
program
  .command('start')
  .description('Start automatic monitoring of all configured agencies')
  .option('--once', 'Run monitoring cycle once and exit')
  .action(async (options: any) => {
    console.log(chalk.blue.bold('\n🏢 SOFIA REAL ESTATE AUTO-AGGREGATOR\n'));

    await db.connect();

    try {
      const aggConfig = await loadAggregatorConfig();

      if (!aggConfig.enabled) {
        console.log(chalk.yellow('⚠️  Aggregator is disabled. Enable it with: auto-aggregator config --enable'));
        return;
      }

      const monitoringConfig = await buildMonitoringConfig(aggConfig);

      console.log(chalk.cyan(`📊 Monitoring ${monitoringConfig.sources.length} agencies:`));
      monitoringConfig.sources.forEach(source => {
        console.log(`  - ${source.name} (${source.searchUrls.length} search URLs)`);
      });

      console.log(chalk.cyan(`\n🔍 Filters:`));
      if (monitoringConfig.filters?.minPrice) {
        console.log(`  Min Price: €${monitoringConfig.filters.minPrice}`);
      }
      if (monitoringConfig.filters?.maxPrice) {
        console.log(`  Max Price: €${monitoringConfig.filters.maxPrice}`);
      }
      if (monitoringConfig.filters?.cities) {
        console.log(`  Cities: ${monitoringConfig.filters.cities.join(', ')}`);
      }

      const notificationService = new NotificationService();
      const propertyService = new PropertyService();
      const monitor = new ListingMonitor(monitoringConfig, notificationService, propertyService);

      if (options.once) {
        console.log(chalk.blue('\n▶️  Running single monitoring cycle...\n'));
        const session = await monitor.runMonitoringCycle();

        console.log(chalk.green('\n✅ Monitoring cycle completed!'));
        console.log(chalk.cyan(`Sources checked: ${session.sourcesChecked}`));
        console.log(chalk.green(`New listings: ${session.newListingsFound}`));
        console.log(chalk.yellow(`Price changes: ${session.priceChanges}`));

        if (session.errors.length > 0) {
          console.log(chalk.red(`\n⚠️  Errors: ${session.errors.length}`));
          session.errors.forEach(err => console.log(`  - ${err}`));
        }
      } else {
        console.log(chalk.blue(`\n▶️  Starting continuous monitoring (${aggConfig.checkInterval})...\n`));
        console.log(chalk.gray('Press Ctrl+C to stop\n'));

        monitor.start();

        // Keep process running
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\n\n🛑 Stopping aggregator...'));
          monitor.stop();
          await db.close();
          process.exit(0);
        });
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      await db.close();
      process.exit(1);
    }
  });

/**
 * Configure aggregator
 */
program
  .command('config')
  .description('Configure aggregator settings')
  .option('--enable', 'Enable monitoring')
  .option('--disable', 'Disable monitoring')
  .option('--interval <cron>', 'Set check interval (cron expression)')
  .option('--min-price <price>', 'Minimum price filter', parseInt)
  .option('--max-price <price>', 'Maximum price filter', parseInt)
  .option('--email <email>', 'Email for notifications')
  .option('--show', 'Show current configuration')
  .action(async (options: any) => {
    let config = await loadAggregatorConfig();

    if (options.show) {
      console.log(chalk.blue.bold('\n📋 CURRENT CONFIGURATION\n'));
      console.log(chalk.cyan('Status:'), config.enabled ? chalk.green('ENABLED') : chalk.red('DISABLED'));
      console.log(chalk.cyan('Check Interval:'), config.checkInterval);
      console.log(chalk.cyan('Min Price:'), config.filters.minPrice ? `€${config.filters.minPrice}` : 'Not set');
      console.log(chalk.cyan('Max Price:'), config.filters.maxPrice ? `€${config.filters.maxPrice}` : 'Not set');
      console.log(chalk.cyan('Cities:'), config.filters.cities.join(', '));
      console.log(chalk.cyan('Email Notifications:'), config.notifications.email.enabled ? 'ON' : 'OFF');
      if (config.notifications.email.toEmail) {
        console.log(chalk.cyan('Email:'), config.notifications.email.toEmail);
      }
      return;
    }

    let changed = false;

    if (options.enable) {
      config.enabled = true;
      changed = true;
      console.log(chalk.green('✅ Monitoring enabled'));
    }

    if (options.disable) {
      config.enabled = false;
      changed = true;
      console.log(chalk.yellow('⚠️  Monitoring disabled'));
    }

    if (options.interval) {
      config.checkInterval = options.interval;
      changed = true;
      console.log(chalk.green(`✅ Check interval set to: ${options.interval}`));
    }

    if (options.minPrice !== undefined) {
      config.filters.minPrice = options.minPrice;
      changed = true;
      console.log(chalk.green(`✅ Min price set to: €${options.minPrice}`));
    }

    if (options.maxPrice !== undefined) {
      config.filters.maxPrice = options.maxPrice;
      changed = true;
      console.log(chalk.green(`✅ Max price set to: €${options.maxPrice}`));
    }

    if (options.email) {
      config.notifications.email.toEmail = options.email;
      config.notifications.email.enabled = true;
      changed = true;
      console.log(chalk.green(`✅ Email notifications set to: ${options.email}`));
    }

    if (changed) {
      await saveAggregatorConfig(config);
      console.log(chalk.green('\n✅ Configuration saved'));
    } else {
      console.log(chalk.yellow('\n⚠️  No changes made. Use --show to view current config'));
    }
  });

/**
 * Quick setup wizard
 */
program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    console.log(chalk.blue.bold('\n🚀 SOFIA REAL ESTATE AGGREGATOR - SETUP WIZARD\n'));

    const config = await loadAggregatorConfig();

    console.log(chalk.cyan('This wizard will help you set up automatic monitoring.\n'));

    // For now, use default values
    // In a real implementation, you'd use readline to prompt for input

    config.enabled = true;
    config.checkInterval = '*/15 * * * *'; // Every 15 minutes
    config.filters.minPrice = 500;
    config.filters.maxPrice = 2000;
    config.filters.cities = ['Sofia', 'София'];

    await saveAggregatorConfig(config);

    console.log(chalk.green('✅ Setup complete!\n'));
    console.log(chalk.cyan('Configuration:'));
    console.log(`  Check Interval: Every 15 minutes`);
    console.log(`  Price Range: €500 - €2000`);
    console.log(`  Cities: Sofia`);
    console.log('');
    console.log(chalk.yellow('Next steps:'));
    console.log(`  1. Review configured agencies: ${chalk.cyan('npm run aggregator:list')}`);
    console.log(`  2. Test monitoring: ${chalk.cyan('npm run auto-aggregator start --once')}`);
    console.log(`  3. Start continuous monitoring: ${chalk.cyan('npm run auto-aggregator start')}`);
  });

/**
 * Status
 */
program
  .command('status')
  .description('Show aggregator status')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 AGGREGATOR STATUS\n'));

    const config = await loadAggregatorConfig();
    const parserConfig = await parserConfigManager.loadConfig();
    const enabledSites = parserConfig.sites.filter(s => s.enabled);

    console.log(chalk.cyan('Monitoring:'), config.enabled ? chalk.green('ENABLED') : chalk.red('DISABLED'));
    console.log(chalk.cyan('Check Interval:'), config.checkInterval);
    console.log(chalk.cyan('Configured Agencies:'), enabledSites.length);
    console.log('');

    console.log(chalk.blue('Enabled Agencies:'));
    enabledSites.forEach((site, i) => {
      console.log(`  ${i + 1}. ${site.name} - ${site.searchUrls.length} search URLs`);
    });
  });

// Handle errors
program.on('command:*', () => {
  console.error(chalk.red('\nInvalid command'));
  program.help();
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.help();
}
