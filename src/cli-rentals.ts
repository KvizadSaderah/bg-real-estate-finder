#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { PropertyParser } from './parser/PropertyParser';
import { ApiParser } from './parser/ApiParser';
import { ConfigManager } from './config/ConfigManager';
import { UESBGFilters, buildUESBGUrl, FilterBuilder } from './types/filters';

const program = new Command();

program
  .name('rental-finder')
  .description('Real estate rental listings finder with filtering')
  .version('1.0.0');

program
  .command('rent')
  .description('Find rental properties with filters')
  .option('-c, --city <city>', 'City (sofia, plovdiv, varna, burgas, all)', 'all')
  .option('-t, --type <type>', 'Property type (apartament, kashta, ofis, studio, staya, all)', 'all')
  .option('--price-min <price>', 'Minimum price in EUR')
  .option('--price-max <price>', 'Maximum price in EUR')
  .option('--area-min <area>', 'Minimum area in sq.m')
  .option('--area-max <area>', 'Maximum area in sq.m')
  .option('-r, --rooms <rooms>', 'Number of rooms (1,2,3,4,5+)')
  .option('-f, --furnished', 'Only furnished properties')
  .option('-o, --output <filename>', 'Output filename')
  .option('--debug', 'Show debug information')
  .option('--api', 'Use API parsing for all pages (recommended)')
  .option('--html', 'Use HTML parsing (single page only)')
  .action(async (options) => {
    console.log(chalk.blue('🏠 Searching for rental properties...'));
    
    // Build filters
    const filters: UESBGFilters = {
      city: options.city as any,
      propertyType: options.type as any,
      furnished: options.furnished
    };
    
    if (options.priceMin) filters.priceMin = parseInt(options.priceMin);
    if (options.priceMax) filters.priceMax = parseInt(options.priceMax);
    if (options.areaMin) filters.areaMin = parseInt(options.areaMin);
    if (options.areaMax) filters.areaMax = parseInt(options.areaMax);
    if (options.rooms) filters.rooms = parseInt(options.rooms);
    
    // Show applied filters
    console.log(chalk.yellow('🔍 Applied filters:'));
    console.log(`  City: ${chalk.cyan(filters.city)}`);
    console.log(`  Type: ${chalk.cyan(filters.propertyType)}`);
    if (filters.priceMin || filters.priceMax) {
      console.log(`  Price: ${chalk.cyan(filters.priceMin || 0)} - ${chalk.cyan(filters.priceMax || '∞')} EUR`);
    }
    if (filters.areaMin || filters.areaMax) {
      console.log(`  Area: ${chalk.cyan(filters.areaMin || 0)} - ${chalk.cyan(filters.areaMax || '∞')} sq.m`);
    }
    if (filters.rooms) {
      console.log(`  Rooms: ${chalk.cyan(filters.rooms)}`);
    }
    if (filters.furnished) {
      console.log(`  Furnished: ${chalk.green('Yes')}`);
    }
    
    // Build URL
    const baseUrl = 'https://ues.bg';
    const searchUrl = buildUESBGUrl(baseUrl, filters);
    
    if (options.debug) {
      console.log(chalk.gray(`Debug URL: ${searchUrl}`));
    }
    
    // Initialize parser
    const configManager = new ConfigManager();
    const config = configManager.getUESBGConfig();
    
    // Choose parsing method
    const useApi = options.api || (!options.html && !options.debug); // Default to API
    let result;
    
    try {
      if (useApi) {
        console.log(chalk.blue(`🚀 Using API parsing for ALL pages...`));
        console.log(chalk.blue(`🌐 Fetching from: ${searchUrl}`));
        
        const apiParser = new ApiParser(config);
        result = await apiParser.parseAllPages(searchUrl);
        
      } else {
        console.log(chalk.blue(`📄 Using HTML parsing (single page only)...`));
        console.log(chalk.blue(`🌐 Fetching from: ${searchUrl}`));
        
        const parser = new PropertyParser(config);
        result = await parser.parseListings(searchUrl);
      }
      
      // Show all listings first to debug
      console.log(chalk.gray('\n🔍 Debug: Found listings:'));
      result.listings.slice(0, 3).forEach((listing, i) => {
        console.log(`  ${i + 1}. "${listing.title}" - ${listing.price.original} - Transaction: ${listing.details.transactionType}`);
      });
      
      // Remove duplicates first
      const uniqueListings = result.listings.filter((listing, index, self) => {
        // Skip if no meaningful content
        if (!listing.title || listing.title === 'Свържете се с нас') return false;
        
        // Find first occurrence with same title and price
        return index === self.findIndex(l => 
          l.title === listing.title && 
          l.price.original === listing.price.original
        );
      });
      
      console.log(chalk.gray(`🔄 Removed ${result.listings.length - uniqueListings.length} duplicates`));
      
      // Filter results further (client-side filtering)
      let filteredListings = uniqueListings.filter(listing => {
        // Filter by price
        if (filters.priceMin && listing.price.amount > 0 && listing.price.amount < filters.priceMin) return false;
        if (filters.priceMax && listing.price.amount > 0 && listing.price.amount > filters.priceMax) return false;
        
        // Filter by area
        if (filters.areaMin && listing.details.area && listing.details.area < filters.areaMin) return false;
        if (filters.areaMax && listing.details.area && listing.details.area > filters.areaMax) return false;
        
        // Filter by rooms  
        if (filters.rooms && filters.rooms !== 'all' && listing.details.rooms !== filters.rooms) return false;
        
        return true;
      });
      
      console.log(chalk.green('✅ Search completed!'));
      console.log(`📊 Results: ${chalk.cyan(filteredListings.length)} rental properties found`);
      console.log(`⏱️  Time elapsed: ${chalk.yellow((result.statistics.timeElapsed / 1000).toFixed(1))}s`);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow('⚠️  Errors encountered:'));
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      // Save results to organized directory
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = options.output || `output/rentals/rentals_${filters.city}_${timestamp}.json`;
      const outputData = {
        ...result,
        filters,
        searchUrl,
        listings: filteredListings,
        totalFound: filteredListings.length
      };
      
      await fs.writeFile(filename, JSON.stringify(outputData, null, 2));
      console.log(chalk.green(`💾 Results saved to: ${filename}`));
      
      // Show sample listings
      if (filteredListings.length > 0) {
        console.log(chalk.blue('\n🏠 Sample rental listings:'));
        filteredListings.slice(0, 5).forEach((listing, i) => {
          console.log(`\n  ${i + 1}. ${chalk.cyan(listing.title)}`);
          console.log(`     💰 ${listing.price.original}`);
          if (listing.location.address) {
            console.log(`     📍 ${listing.location.address}`);
          }
          if (listing.details.area) {
            console.log(`     📐 ${listing.details.area} кв.м`);
          }
          if (listing.details.rooms) {
            console.log(`     🛏️  ${listing.details.rooms} стая`);
          }
          if (listing.url && !listing.url.includes('javascript')) {
            console.log(`     🔗 ${listing.url}`);
          }
        });
        
        // Statistics
        const prices = filteredListings
          .filter(l => l.price.amount > 0)
          .map(l => l.price.amount);
        
        if (prices.length > 0) {
          const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          
          console.log(chalk.blue('\n📈 Price Statistics:'));
          console.log(`  Average: ${chalk.yellow(avgPrice)} EUR/month`);
          console.log(`  Range: ${chalk.yellow(minPrice)} - ${chalk.yellow(maxPrice)} EUR/month`);
        }
        
        // Property types
        const types = filteredListings.reduce((acc, listing) => {
          const type = listing.details.propertyType;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(chalk.blue('\n🏠 Property Types:'));
        Object.entries(types).forEach(([type, count]) => {
          console.log(`  ${type}: ${chalk.cyan(count)}`);
        });
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Search failed:'), error);
    }
    // API parser doesn't need cleanup like PropertyParser
  });

program
  .command('quick-sofia')
  .description('Quick search for apartments in Sofia')
  .action(async () => {
    console.log(chalk.blue('🏠 Quick search: apartments in Sofia'));
    console.log(chalk.yellow('Use: npm run rent -- --city sofia --type apartament'));
  });

program.parse();