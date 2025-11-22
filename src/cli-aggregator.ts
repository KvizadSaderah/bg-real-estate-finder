#!/usr/bin/env ts-node

import { Command } from 'commander';
import { AgencyAnalyzer } from './analyzer/AgencyAnalyzer';
import { parserConfigManager, ParserSite } from './config/ParserConfig';
import { parserCrawler } from './crawlers/ParserCrawler';
import { db } from './database/connection';
import chalk from 'chalk';

const program = new Command();

// Sofia real estate agencies list
const SOFIA_AGENCIES = [
  { name: 'UES.bg', url: 'https://ues.bg', priority: 1 },
  { name: 'Bulgarian Properties', url: 'https://bulgarianproperties.com', priority: 2 },
  { name: 'Luximmo', url: 'https://luximmo.bg', priority: 3 },
  { name: 'Titan Properties', url: 'https://titanproperties.bg', priority: 4 },
  { name: 'SUPRIMMO', url: 'https://suprimmo.net', priority: 5 },
  { name: 'Address', url: 'https://address.bg', priority: 6 },
  { name: 'Yavlena', url: 'https://yavlena.com', priority: 7 },
  { name: 'ERA', url: 'https://era.bg', priority: 8 },
  { name: 'Imoteka', url: 'https://imoteka.bg', priority: 9 },
  { name: 'IRIDA', url: 'https://irida.bg', priority: 10 },
  { name: 'BuildingBox', url: 'https://buildingbox.bg', priority: 11 },
  { name: 'Dream Vision', url: 'https://dreamvision.bg', priority: 12 },
  { name: 'Arsenal Imoti', url: 'https://arsenalimoti.bg', priority: 13 },
  { name: 'Calista Estate', url: 'https://calistaestate.bg', priority: 14 },
  { name: "Sotheby's Realty", url: 'https://sothebys-realty.bg', priority: 15 },
  { name: 'Sofia Imoti', url: 'https://sofiaimoti.com', priority: 16 },
  { name: 'BulgarIMOT', url: 'https://bulgarimot.bg', priority: 17 },
  { name: 'Primoplus', url: 'https://primoplus.bg', priority: 18 },
  { name: 'Avenda', url: 'https://avenda.bg', priority: 19 },
];

program
  .name('aggregator')
  .description('Real Estate Aggregator for Sofia, Bulgaria')
  .version('1.0.0');

/**
 * Analyze a new agency site
 */
program
  .command('analyze')
  .description('Analyze a real estate agency website')
  .argument('<url>', 'Agency website URL')
  .option('-n, --name <name>', 'Agency name')
  .option('-s, --save', 'Save configuration automatically')
  .option('--city <city>', 'City to search for (default: sofia)', 'sofia')
  .option('--ai', 'Enable AI validation (requires GEMINI_API_KEY or OPENAI_API_KEY)')
  .action(async (url: string, options: any) => {
    console.log(chalk.blue.bold('\n🔍 ANALYZING REAL ESTATE AGENCY\n'));

    const analyzer = new AgencyAnalyzer({ useAI: options.ai });
    try {
      const result = await analyzer.analyzeAgencySite(url, options.name || url, {
        searchForRentals: true,
        city: options.city
      });

      console.log(chalk.green('\n✅ Analysis Complete!\n'));
      console.log('Site ID:', chalk.cyan(result.siteId));
      console.log('Site Name:', chalk.cyan(result.siteName));
      console.log('Base URL:', chalk.cyan(result.baseUrl));
      console.log('Search URLs:', result.searchUrls.length);
      result.searchUrls.forEach(url => console.log(`  - ${url}`));

      if (result.detectedSelectors.propertyLinks) {
        console.log(chalk.green('\n✓ Property Links:'), result.detectedSelectors.propertyLinks);
      }
      if (result.detectedSelectors.title) {
        console.log(chalk.green('✓ Title:'), result.detectedSelectors.title.selector);
      }
      if (result.detectedSelectors.price) {
        console.log(chalk.green('✓ Price:'), result.detectedSelectors.price.selector);
      }
      if (result.detectedSelectors.area) {
        console.log(chalk.green('✓ Area:'), result.detectedSelectors.area.selector);
      }
      if (result.detectedSelectors.city) {
        console.log(chalk.green('✓ City:'), result.detectedSelectors.city.selector);
      }

      if (result.recommendations.length > 0) {
        console.log(chalk.yellow('\n💡 Recommendations:'));
        result.recommendations.forEach(rec => console.log(`  - ${rec}`));
      }

      if (result.warnings.length > 0) {
        console.log(chalk.red('\n⚠️  Warnings:'));
        result.warnings.forEach(warn => console.log(`  - ${warn}`));
      }

      if (result.sampleData) {
        console.log(chalk.blue('\n📊 Sample Data:'));
        console.log(`  Listings found: ${result.sampleData.listingsFound}`);
        if (result.sampleData.exampleListings.length > 0) {
          console.log(`  Example:`, JSON.stringify(result.sampleData.exampleListings[0], null, 2));
        }
      }

      // AI Validation Results
      if (result.aiValidation) {
        console.log(chalk.magenta('\n🤖 AI VALIDATION RESULTS\n'));
        console.log(`Overall Score: ${chalk.cyan(result.aiValidation.overallScore + '/100')}`);

        console.log(chalk.blue('\nSelector Quality:'));
        console.log(`  Confidence: ${result.aiValidation.selectorQuality.confidence}%`);
        console.log(`  Valid: ${result.aiValidation.selectorQuality.isValid ? '✓' : '✗'}`);
        if (result.aiValidation.selectorQuality.issues.length > 0) {
          console.log(chalk.yellow('  Issues:'));
          result.aiValidation.selectorQuality.issues.forEach(issue => {
            console.log(`    - ${issue}`);
          });
        }
        if (result.aiValidation.selectorQuality.suggestions.length > 0) {
          console.log(chalk.green('  Suggestions:'));
          result.aiValidation.selectorQuality.suggestions.forEach(sug => {
            console.log(`    - ${sug}`);
          });
        }

        console.log(chalk.blue('\nReality Checks:'));
        const passedChecks = result.aiValidation.realityChecks.filter(r => r.passed).length;
        const totalChecks = result.aiValidation.realityChecks.length;
        console.log(`  Passed: ${passedChecks}/${totalChecks}`);

        result.aiValidation.realityChecks.forEach((check, i) => {
          const status = check.passed ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${status} Check ${i + 1}: ${check.score}/100`);
          if (check.warnings.length > 0) {
            check.warnings.forEach(warn => {
              console.log(chalk.yellow(`     ⚠ ${warn}`));
            });
          }
        });
      }

      // Save configuration if requested
      if (options.save && result.success) {
        // Check AI validation score before saving
        if (result.aiValidation && result.aiValidation.overallScore < 60) {
          console.log(chalk.yellow('\n⚠️  WARNING: Low AI validation score. Review configuration before using.'));
          console.log(chalk.yellow('To save anyway, the configuration will be marked as experimental.'));
        }

        const config = analyzer.analysisToConfig(result);
        await parserConfigManager.addSite(config);
        console.log(chalk.green(`\n✅ Configuration saved for ${result.siteName}`));
      } else if (result.success) {
        console.log(chalk.yellow('\n💾 To save this configuration, run with --save flag'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
    } finally {
      await analyzer.close();
    }
  });

/**
 * Add all priority agencies
 */
program
  .command('setup-all')
  .description('Analyze and setup all priority Sofia agencies')
  .option('--priority <number>', 'Only analyze sites up to this priority level', '6')
  .option('--delay <ms>', 'Delay between analyses in ms', '5000')
  .option('--ai', 'Enable AI validation (requires GEMINI_API_KEY or OPENAI_API_KEY)')
  .action(async (options: any) => {
    console.log(chalk.blue.bold('\n🏢 SETTING UP ALL SOFIA AGENCIES\n'));

    const maxPriority = parseInt(options.priority);
    const delay = parseInt(options.delay);
    const agenciesToSetup = SOFIA_AGENCIES.filter(a => a.priority <= maxPriority);

    console.log(`Setting up ${agenciesToSetup.length} agencies (priority 1-${maxPriority})\n`);
    if (options.ai) {
      console.log(chalk.magenta('🤖 AI validation enabled\n'));
    }

    const analyzer = new AgencyAnalyzer({ useAI: options.ai });
    const results: any[] = [];

    for (const agency of agenciesToSetup) {
      console.log(chalk.cyan(`\n[${ agency.priority}/${maxPriority}] Analyzing ${agency.name}...`));

      try {
        const result = await analyzer.analyzeAgencySite(agency.url, agency.name, {
          searchForRentals: true,
          city: 'sofia'
        });

        results.push(result);

        if (result.success) {
          const config = analyzer.analysisToConfig(result);
          await parserConfigManager.addSite(config);
          console.log(chalk.green(`✅ ${agency.name} configured successfully`));
        } else {
          console.log(chalk.red(`❌ ${agency.name} analysis failed`));
        }

        // Delay between requests
        if (agency !== agenciesToSetup[agenciesToSetup.length - 1]) {
          console.log(chalk.gray(`⏳ Waiting ${delay}ms before next agency...`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(chalk.red(`❌ Failed to analyze ${agency.name}:`), error);
        results.push({ success: false, siteName: agency.name, error });
      }
    }

    await analyzer.close();

    // Summary
    console.log(chalk.blue.bold('\n\n📊 SETUP SUMMARY\n'));
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(`Total agencies: ${results.length}`);
    console.log(chalk.green(`✅ Successful: ${successful}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));

    if (successful > 0) {
      console.log(chalk.green('\n✅ Successfully configured agencies:'));
      results
        .filter(r => r.success)
        .forEach(r => console.log(`  - ${r.siteName} (${r.siteId})`));
    }

    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed agencies:'));
      results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.siteName}`));
    }
  });

/**
 * List all configured sites
 */
program
  .command('list')
  .description('List all configured real estate agency sites')
  .option('--enabled-only', 'Show only enabled sites')
  .action(async (options: any) => {
    console.log(chalk.blue.bold('\n📋 CONFIGURED REAL ESTATE AGENCIES\n'));

    const config = await parserConfigManager.loadConfig();
    let sites = config.sites;

    if (options.enabledOnly) {
      sites = sites.filter(s => s.enabled);
    }

    if (sites.length === 0) {
      console.log(chalk.yellow('No sites configured yet.'));
      console.log(chalk.gray('Run "aggregator setup-all" to configure priority agencies.'));
      return;
    }

    sites.forEach((site, index) => {
      const status = site.enabled ? chalk.green('✓ ENABLED') : chalk.red('✗ DISABLED');
      console.log(`${index + 1}. ${chalk.cyan(site.name)} (${site.id}) - ${status}`);
      console.log(`   Base URL: ${site.baseUrl}`);
      console.log(`   Search URLs: ${site.searchUrls.length}`);
      console.log(`   Max Pages: ${site.maxPages}`);
      console.log('');
    });

    console.log(chalk.blue(`Total: ${sites.length} sites`));
    if (!options.enabledOnly) {
      const enabled = sites.filter(s => s.enabled).length;
      console.log(chalk.green(`Enabled: ${enabled}`));
      console.log(chalk.red(`Disabled: ${sites.length - enabled}`));
    }
  });

/**
 * Enable/disable a site
 */
program
  .command('toggle')
  .description('Enable or disable a site')
  .argument('<siteId>', 'Site ID to toggle')
  .action(async (siteId: string) => {
    const newState = await parserConfigManager.toggleSite(siteId);
    const status = newState ? chalk.green('ENABLED') : chalk.red('DISABLED');
    console.log(`Site ${chalk.cyan(siteId)} is now ${status}`);
  });

/**
 * Run aggregator for all enabled sites
 */
program
  .command('run')
  .description('Run aggregator for all enabled sites')
  .option('--test', 'Test mode (limited results)')
  .option('--site <siteId>', 'Run only for specific site')
  .action(async (options: any) => {
    console.log(chalk.blue.bold('\n🚀 RUNNING REAL ESTATE AGGREGATOR\n'));

    await db.connect();

    try {
      if (options.site) {
        console.log(chalk.cyan(`Running crawler for site: ${options.site}`));
        await parserCrawler.runSite(options.site, options.test);
      } else {
        console.log(chalk.cyan('Running crawler for all enabled sites'));
        await parserCrawler.runAllEnabledSites();
      }

      console.log(chalk.green('\n✅ Aggregator run completed!'));
    } catch (error) {
      console.error(chalk.red('\n❌ Aggregator run failed:'), error);
    } finally {
      await db.close();
    }
  });

/**
 * Show statistics
 */
program
  .command('stats')
  .description('Show aggregator statistics')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 AGGREGATOR STATISTICS\n'));

    await db.connect();

    try {
      // Get total properties
      const totalResult = await db.query('SELECT COUNT(*) as count FROM properties');
      const total = parseInt(totalResult.rows[0].count);

      // Get properties by source
      const bySourceResult = await db.query(`
        SELECT source_site, COUNT(*) as count
        FROM properties
        GROUP BY source_site
        ORDER BY count DESC
      `);

      // Get recent properties
      const recentResult = await db.query(`
        SELECT COUNT(*) as count
        FROM properties
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      const recent24h = parseInt(recentResult.rows[0].count);

      // Get scraping sessions
      const sessionsResult = await db.query(`
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM scraping_sessions
      `);
      const sessions = sessionsResult.rows[0];

      console.log(chalk.cyan('Total Properties:'), total);
      console.log(chalk.cyan('New in last 24h:'), recent24h);
      console.log('');

      console.log(chalk.blue('Properties by Source:'));
      bySourceResult.rows.forEach((row: any) => {
        console.log(`  ${row.source_site}: ${chalk.cyan(row.count)}`);
      });
      console.log('');

      console.log(chalk.blue('Scraping Sessions:'));
      console.log(`  Total: ${sessions.total_sessions}`);
      console.log(`  ${chalk.green('Successful:')} ${sessions.successful}`);
      console.log(`  ${chalk.red('Failed:')} ${sessions.failed}`);

    } catch (error) {
      console.error(chalk.red('❌ Error getting statistics:'), error);
    } finally {
      await db.close();
    }
  });

/**
 * Export configuration
 */
program
  .command('export')
  .description('Export aggregator configuration')
  .option('-o, --output <file>', 'Output file', 'config/aggregator-export.json')
  .action(async (options: any) => {
    const config = await parserConfigManager.exportConfig();
    const fs = require('fs');
    fs.writeFileSync(options.output, config);
    console.log(chalk.green(`✅ Configuration exported to ${options.output}`));
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
