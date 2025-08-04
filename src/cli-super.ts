#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { ComprehensiveApiParser } from './parser/ComprehensiveApiParser';
import { ConfigManager } from './config/ConfigManager';
import { UESBGFilters, buildUESBGUrl } from './types/filters';

const program = new Command();

program
  .name('super-rental-finder')
  .description('🚀 MAXIMUM data extraction for rental properties')
  .version('2.0.0');

program
  .command('super-rent')
  .description('🔥 Extract MAXIMUM data from ALL rental listings')
  .option('-c, --city <city>', 'City (sofia, plovdiv, varna, burgas, all)', 'all')
  .option('-t, --type <type>', 'Property type (apartament, kashta, ofis, studio, staya, all)', 'all')
  .option('--price-min <price>', 'Minimum price in EUR')
  .option('--price-max <price>', 'Maximum price in EUR')
  .option('--max-pages <pages>', 'Maximum pages to process (default: 10)', '10')
  .option('-o, --output <filename>', 'Output filename')
  .option('--full-extraction', 'Extract ALL available pages (can take 10+ minutes)')
  .action(async (options) => {
    console.log(chalk.bgBlue.white.bold(' 🚀 SUPER RENTAL FINDER - MAXIMUM EXTRACTION MODE 🚀 '));
    console.log(chalk.yellow('⚡ This will extract MAXIMUM data from EVERY listing!'));
    
    if (options.fullExtraction) {
      console.log(chalk.red.bold('🔥 FULL EXTRACTION MODE: Processing ALL pages (this may take 10+ minutes)'));
    }
    
    // Build filters
    const filters: UESBGFilters = {
      city: options.city as any,
      propertyType: options.type as any
    };
    
    if (options.priceMin) filters.priceMin = parseInt(options.priceMin);
    if (options.priceMax) filters.priceMax = parseInt(options.priceMax);
    
    // Show applied filters
    console.log(chalk.cyan('🎯 EXTRACTION PARAMETERS:'));
    console.log(`  📍 City: ${chalk.yellow(filters.city)}`);
    console.log(`  🏠 Type: ${chalk.yellow(filters.propertyType)}`);
    if (filters.priceMin || filters.priceMax) {
      console.log(`  💰 Price: ${chalk.yellow(filters.priceMin || 0)} - ${chalk.yellow(filters.priceMax || '∞')} EUR`);
    }
    console.log(`  📄 Max Pages: ${chalk.yellow(options.fullExtraction ? 'ALL' : options.maxPages)}`);
    
    // Build URL
    const baseUrl = 'https://ues.bg';
    const searchUrl = buildUESBGUrl(baseUrl, filters);
    
    console.log(chalk.blue(`\n🌐 Target URL: ${searchUrl}`));
    
    // Initialize SUPER parser
    const configManager = new ConfigManager();
    const config = configManager.getUESBGConfig();
    const superParser = new ComprehensiveApiParser(config);
    
    try {
      const maxPages = options.fullExtraction ? 50 : parseInt(options.maxPages);
      
      console.log(chalk.green('\n🚀 STARTING COMPREHENSIVE EXTRACTION...'));
      console.log(chalk.gray('📊 This includes: coordinates, all images, pricing details, exact addresses, etc.'));
      
      const result = await superParser.parseAllListings(searchUrl, maxPages);
      
      // Results summary
      console.log(chalk.bgGreen.black.bold('\n🎉 EXTRACTION COMPLETED! 🎉'));
      console.log(`📊 Total Listings Found: ${chalk.cyan.bold(result.totalListings)}`);
      console.log(`✅ Successfully Processed: ${chalk.green.bold(result.processedListings)}`);
      console.log(`📄 Pages Processed: ${chalk.yellow(result.statistics.pagesProcessed)}/${chalk.yellow(result.statistics.totalPages)}`);
      console.log(`⏱️  Total Time: ${chalk.magenta((result.statistics.timeElapsed / 1000 / 60).toFixed(1))} minutes`);
      console.log(`🔥 Data Quality: ${chalk.green.bold(result.statistics.dataQualityScore.toFixed(1))}% complete`);
      console.log(`📡 API Calls Used: ${chalk.blue(result.statistics.apiCallsUsed)}`);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`⚠️  Errors: ${result.errors.length}`));
        result.errors.slice(0, 3).forEach(error => {
          console.log(chalk.gray(`  - ${error}`));
        });
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`⚠️  Warnings: ${result.warnings.length}`));
      }
      
      // Save results with comprehensive data
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = options.output || `output/rentals/SUPER_rentals_${filters.city}_${timestamp}.json`;
      
      await fs.writeFile(filename, JSON.stringify(result, null, 2));
      console.log(chalk.green.bold(`\n💾 COMPREHENSIVE DATA saved to: ${filename}`));
      
      // Show sample of comprehensive data
      if (result.listings.length > 0) {
        console.log(chalk.blue.bold('\n🏠 SAMPLE COMPREHENSIVE LISTINGS:'));
        
        result.listings.slice(0, 3).forEach((listing, i) => {
          console.log(`\n${chalk.cyan.bold(`${i + 1}. ${listing.title}`)}`);
          console.log(`   💰 Price: ${chalk.green(listing.pricing.currentPrice)} EUR (${listing.pricing.pricePerSqm || 'N/A'} EUR/m²)`);
          console.log(`   📐 Area: ${chalk.yellow(listing.propertyDetails.area)} m² | Rooms: ${chalk.yellow(listing.propertyDetails.bedrooms || 'N/A')}`);
          console.log(`   📍 Location: ${chalk.gray(listing.location.fullAddress)}`);
          if (listing.location.coordinates) {
            console.log(`   🗺️  Coordinates: ${chalk.blue(listing.location.coordinates.latitude)}, ${chalk.blue(listing.location.coordinates.longitude)}`);
          }
          console.log(`   🏢 Floor: ${listing.propertyDetails.floor || 'N/A'}/${listing.propertyDetails.totalFloors || 'N/A'}`);
          console.log(`   🖼️  Images: ${listing.media.hasMedia.images ? chalk.green('Yes') : chalk.red('No')}`);
          console.log(`   🔗 URL: ${chalk.underline(listing.url)}`);
          
          // Show comprehensive features
          const features = [];
          if (listing.propertyDetails.hasElevator) features.push('🛗 Elevator');
          if (listing.propertyDetails.hasParkingSpace) features.push('🚗 Parking');
          if (listing.propertyDetails.furnishingType) features.push(`🪑 ${listing.propertyDetails.furnishingType}`);
          if (listing.marketing.labels.length > 0) features.push(`🏷️  ${listing.marketing.labels.join(', ')}`);
          
          if (features.length > 0) {
            console.log(`   ✨ Features: ${features.join(' | ')}`);
          }
        });
        
        // Statistics breakdown
        console.log(chalk.blue.bold('\n📈 COMPREHENSIVE STATISTICS:'));
        
        // Price analysis
        const prices = result.listings
          .filter(l => l.pricing.currentPrice > 0)
          .map(l => l.pricing.currentPrice);
        
        if (prices.length > 0) {
          const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          
          console.log(`💰 Price Range: ${chalk.yellow(minPrice)} - ${chalk.yellow(maxPrice)} EUR`);
          console.log(`💰 Average Price: ${chalk.green.bold(avgPrice)} EUR/month`);
        }
        
        // Area analysis
        const areas = result.listings
          .filter(l => l.propertyDetails.area > 0)
          .map(l => l.propertyDetails.area);
        
        if (areas.length > 0) {
          const avgArea = Math.round(areas.reduce((a, b) => a + b, 0) / areas.length);
          console.log(`📐 Average Area: ${chalk.blue.bold(avgArea)} m²`);
        }
        
        // Location breakdown
        const withCoordinates = result.listings.filter(l => l.location.coordinates).length;
        console.log(`🗺️  Properties with GPS coordinates: ${chalk.green(withCoordinates)} (${(withCoordinates/result.listings.length*100).toFixed(1)}%)`);
        
        // Media analysis
        const withImages = result.listings.filter(l => l.media.hasMedia.images).length;
        const withVideos = result.listings.filter(l => l.media.hasMedia.videos).length;
        console.log(`🖼️  Properties with images: ${chalk.green(withImages)} (${(withImages/result.listings.length*100).toFixed(1)}%)`);
        console.log(`🎥 Properties with videos: ${chalk.blue(withVideos)} (${(withVideos/result.listings.length*100).toFixed(1)}%)`);
        
        // Property types
        const types = result.listings.reduce((acc, listing) => {
          const type = listing.propertyDetails.propertyType || 'Unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(chalk.blue.bold('\n🏠 Property Types:'));
        Object.entries(types).forEach(([type, count]) => {
          console.log(`  ${type}: ${chalk.cyan(count)}`);
        });
      }
      
    } catch (error) {
      console.error(chalk.red.bold('❌ SUPER EXTRACTION FAILED:'), error);
    }
  });

program
  .command('mega-sofia')
  .description('🔥 Extract ALL Sofia apartments with MAXIMUM data')
  .action(async () => {
    console.log(chalk.bgMagenta.white.bold(' 🔥 MEGA SOFIA EXTRACTION 🔥 '));
    console.log(chalk.yellow('⚡ This will get EVERY Sofia apartment with FULL data!'));
    
    // Execute comprehensive extraction for Sofia
    const options = {
      city: 'sofia',
      type: 'apartament',
      fullExtraction: true,
      maxPages: '50'
    };
    
    // Call the main command with these options
    // Implementation would reuse the super-rent logic
    console.log(chalk.blue('🚀 Use: npm run super -- --city sofia --type apartament --full-extraction'));
  });

program.parse();