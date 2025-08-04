#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { SiteAnalyzer } from './analyzer/SiteAnalyzer';
import { PropertyParser } from './parser/PropertyParser';
import { ConfigManager } from './config/ConfigManager';

const program = new Command();

program
  .name('real-estate-finder')
  .description('Advanced real estate listings crawler and parser')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a real estate website structure')
  .argument('<url>', 'URL of the real estate website to analyze')
  .option('-s, --save', 'Save the generated configuration')
  .action(async (url: string, options) => {
    console.log(chalk.blue('🔍 Analyzing website structure...'));
    
    const analyzer = new SiteAnalyzer();
    const configManager = new ConfigManager();
    await configManager.init();
    
    try {
      const analysis = await analyzer.analyzeSite(url);
      
      console.log(chalk.green('✅ Analysis completed!'));
      console.log('\n📊 Analysis Results:');
      console.log(`  Site Type: ${chalk.yellow(analysis.siteType)}`);
      console.log(`  Has Listings: ${analysis.hasListings ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`  API Endpoints Found: ${chalk.cyan(analysis.apiEndpoints.length)}`);
      
      if (analysis.potentialSelectors.cards.length > 0) {
        console.log('\n🎯 Best Card Selectors:');
        analysis.potentialSelectors.cards.slice(0, 3).forEach((selector, i) => {
          console.log(`  ${i + 1}. ${chalk.cyan(selector.selector)} (confidence: ${(selector.confidence * 100).toFixed(1)}%)`);
        });
      }
      
      if (analysis.apiEndpoints.length > 0) {
        console.log('\n🌐 API Endpoints:');
        analysis.apiEndpoints.forEach(endpoint => {
          console.log(`  ${chalk.green(endpoint.method)} ${endpoint.url}`);
        });
      }
      
      console.log('\n⚙️  Suggested Configuration:');
      console.log(JSON.stringify(analysis.suggestedConfig, null, 2));
      
      if (options.save) {
        const config = configManager.createConfigFromUrl(url, analysis.suggestedConfig);
        await configManager.saveConfig(config);
        console.log(chalk.green(`💾 Configuration saved as: ${config.id}.json`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
    } finally {
      await analyzer.close();
    }
  });

program
  .command('parse')
  .description('Parse listings from a real estate website')
  .argument('<url>', 'URL of the real estate website to parse')
  .option('-c, --config <configId>', 'Use specific configuration ID')
  .option('-o, --output <filename>', 'Output filename (default: listings_<timestamp>.json)')
  .action(async (url: string, options) => {
    console.log(chalk.blue('🚀 Starting to parse listings...'));
    
    const configManager = new ConfigManager();
    await configManager.init();
    
    let config;
    
    if (options.config) {
      config = configManager.getConfig(options.config);
      if (!config) {
        console.error(chalk.red(`❌ Configuration '${options.config}' not found`));
        return;
      }
    } else {
      // Try to find config by URL or create a basic one
      const domain = new URL(url).hostname.replace('www.', '');
      const configId = domain.replace(/\./g, '_');
      
      config = configManager.getConfig(configId);
      
      if (!config) {
        console.log(chalk.yellow('⚠️  No configuration found, analyzing site first...'));
        const analyzer = new SiteAnalyzer();
        
        try {
          const analysis = await analyzer.analyzeSite(url);
          config = configManager.createConfigFromUrl(url, analysis.suggestedConfig);
          
          console.log(chalk.blue('💡 Generated configuration based on analysis'));
        } catch (error) {
          console.error(chalk.red('❌ Failed to analyze site:'), error);
          return;
        } finally {
          await analyzer.close();
        }
      }
    }
    
    // Special handling for ues.bg
    if (url.includes('ues.bg')) {
      config = configManager.getUESBGConfig();
      console.log(chalk.blue('🎯 Using optimized ues.bg configuration'));
    }
    
    const parser = new PropertyParser(config);
    
    try {
      const result = await parser.parseListings(url);
      
      console.log(chalk.green('✅ Parsing completed!'));
      console.log(`📊 Results: ${chalk.cyan(result.totalFound)} listings found`);
      console.log(`⏱️  Time elapsed: ${chalk.yellow((result.statistics.timeElapsed / 1000).toFixed(1))}s`);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow('⚠️  Errors encountered:'));
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      // Save results
      const filename = options.output || `listings_${Date.now()}.json`;
      await fs.writeFile(filename, JSON.stringify(result, null, 2));
      console.log(chalk.green(`💾 Results saved to: ${filename}`));
      
      // Show sample listings
      if (result.listings.length > 0) {
        console.log('\n🏠 Sample listings:');
        result.listings.slice(0, 3).forEach((listing, i) => {
          console.log(`\n  ${i + 1}. ${chalk.cyan(listing.title)}`);
          console.log(`     💰 ${listing.price.original}`);
          console.log(`     📍 ${listing.location.address}`);
          if (listing.details.area) {
            console.log(`     📐 ${listing.details.area} кв.м`);
          }
          if (listing.url) {
            console.log(`     🔗 ${listing.url}`);
          }
        });
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Parsing failed:'), error);
    } finally {
      await parser.close();
    }
  });

program
  .command('list-configs')
  .description('List all available site configurations')
  .action(async () => {
    const configManager = new ConfigManager();
    await configManager.init();
    
    const configs = configManager.getAllConfigs();
    
    if (configs.length === 0) {
      console.log(chalk.yellow('📝 No configurations found'));
      return;
    }
    
    console.log(chalk.blue('📋 Available configurations:'));
    configs.forEach(config => {
      console.log(`\n  🏠 ${chalk.cyan(config.name)} (${config.id})`);
      console.log(`     🌐 ${config.baseUrl}`);
      console.log(`     ⚙️  Type: ${config.type}`);
      console.log(`     🔄 Pagination: ${config.pagination.type}`);
    });
  });

program.parse();