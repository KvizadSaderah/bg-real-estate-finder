#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ComprehensiveApiParser } from './parser/ComprehensiveApiParser';
import { db } from './database/connection';

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
    maxPages: 999
  },
  rateLimit: {
    requestsPerMinute: 30,
    delayBetweenPages: 1200
  }
};

program
  .name('full-scan')
  .description('Comprehensive full scan of ALL listings from UES.bg')
  .version('1.0.0');

program
  .command('all')
  .description('Scan ALL categories and cities for maximum coverage')
  .option('--max-pages <number>', 'Maximum pages per category', '999')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 STARTING COMPREHENSIVE FULL SCAN'));
      console.log(chalk.yellow('⚡ This will scan ALL categories and cities for maximum property coverage'));
      console.log(chalk.gray('   This may take 30-60 minutes depending on data volume\n'));

      const parser = new ComprehensiveApiParser(siteConfig);
      const maxPages = parseInt(options.maxPages);
      
      // Define all search URLs for comprehensive coverage
      const searchUrls = [
        // Main categories
        {
          name: 'All Sofia Rentals',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia',
          priority: 'high'
        },
        {
          name: 'All Sofia Sales',
          url: 'https://ues.bg/bg/bgr/imoti/prodava/sofia',
          priority: 'high'
        },
        
        // Property types in Sofia
        {
          name: 'Sofia Apartments (Rent)',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/apartament',
          priority: 'high'
        },
        {
          name: 'Sofia Houses (Rent)',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/kashta',
          priority: 'medium'
        },
        {
          name: 'Sofia Offices (Rent)',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/ofis',
          priority: 'medium'
        },
        {
          name: 'Sofia Commercial (Rent)',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/targovskiobekt',
          priority: 'low'
        },
        
        // Other major cities
        {
          name: 'Plovdiv Rentals',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/plovdiv',
          priority: 'medium'
        },
        {
          name: 'Varna Rentals',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/varna',
          priority: 'medium'
        },
        {
          name: 'Burgas Rentals',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/burgas',
          priority: 'medium'
        },
        
        // All rentals and sales (comprehensive)
        {
          name: 'All Bulgaria Rentals',
          url: 'https://ues.bg/bg/bgr/imoti/pod-naem/all/all',
          priority: 'high'
        },
        {
          name: 'All Bulgaria Sales',
          url: 'https://ues.bg/bg/bgr/imoti/prodava/all/all',
          priority: 'medium'
        }
      ];

      let totalProcessed = 0;
      let totalErrors = 0;
      let totalTime = 0;

      console.log(chalk.blue(`📋 Planned scans: ${searchUrls.length} categories`));
      console.log(chalk.gray(`📄 Max pages per category: ${maxPages}\n`));

      // Process high priority URLs first
      const highPriority = searchUrls.filter(s => s.priority === 'high');
      const mediumPriority = searchUrls.filter(s => s.priority === 'medium');
      const lowPriority = searchUrls.filter(s => s.priority === 'low');

      const orderedUrls = [...highPriority, ...mediumPriority, ...lowPriority];

      for (let i = 0; i < orderedUrls.length; i++) {
        const search = orderedUrls[i];
        console.log(chalk.cyan(`\n🔍 [${i + 1}/${orderedUrls.length}] ${search.name}`));
        console.log(chalk.gray(`   ${search.url}`));
        console.log(chalk.gray(`   Priority: ${search.priority.toUpperCase()}`));

        try {
          const startTime = Date.now();
          const result = await parser.parseAllListings(search.url, maxPages, true);
          const elapsed = Date.now() - startTime;
          totalTime += elapsed;

          if (result.success) {
            totalProcessed += result.processedListings;
            console.log(chalk.green(`   ✅ Success: ${result.processedListings} properties in ${(elapsed/1000).toFixed(1)}s`));
            
            if (result.errors.length > 0) {
              console.log(chalk.yellow(`   ⚠️  ${result.errors.length} errors encountered`));
              totalErrors += result.errors.length;
            }
          } else {
            console.log(chalk.red(`   ❌ Failed: ${result.errors.length} errors`));
            totalErrors += result.errors.length;
          }

          // Progress summary
          const progress = ((i + 1) / orderedUrls.length * 100).toFixed(1);
          console.log(chalk.blue(`   📊 Progress: ${progress}% | Total properties: ${totalProcessed}`));

          // Respect rate limits between categories
          if (i < orderedUrls.length - 1) {
            console.log(chalk.gray(`   ⏱️  Cooling down for 3 seconds...`));
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

        } catch (error) {
          console.error(chalk.red(`   ❌ Category failed: ${error}`));
          totalErrors++;
        }
      }

      // Final summary
      console.log(chalk.green('\n🎉 COMPREHENSIVE SCAN COMPLETED!'));
      console.log(chalk.blue('📊 Final Statistics:'));
      console.log(`   ${chalk.cyan('Total Properties:')} ${totalProcessed}`);
      console.log(`   ${chalk.cyan('Total Errors:')} ${totalErrors}`);
      console.log(`   ${chalk.cyan('Total Time:')} ${(totalTime/1000/60).toFixed(1)} minutes`);
      console.log(`   ${chalk.cyan('Categories Scanned:')} ${orderedUrls.length}`);
      console.log(`   ${chalk.cyan('Average per Category:')} ${Math.round(totalProcessed/orderedUrls.length)} properties`);

      if (totalErrors > 0) {
        console.log(chalk.yellow(`\n⚠️  ${totalErrors} errors encountered during scan`));
        console.log(chalk.gray('   Check individual category logs for details'));
      }

      await db.close();

    } catch (error) {
      console.error(chalk.red('❌ Full scan failed:'), error);
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Quick scan of main categories only')
  .option('--max-pages <number>', 'Maximum pages per category', '20')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 STARTING QUICK COMPREHENSIVE SCAN'));
      
      const parser = new ComprehensiveApiParser(siteConfig);
      const maxPages = parseInt(options.maxPages);
      
      const quickUrls = [
        'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/apartament',
        'https://ues.bg/bg/bgr/imoti/pod-naem/sofia/kashta',
        'https://ues.bg/bg/bgr/imoti/pod-naem/all/all'
      ];

      let totalProcessed = 0;

      for (const url of quickUrls) {
        console.log(chalk.cyan(`\n🔍 Scanning: ${url}`));
        const result = await parser.parseAllListings(url, maxPages, true);
        totalProcessed += result.processedListings;
        console.log(chalk.green(`✅ ${result.processedListings} properties processed`));
        
        // Short delay between scans
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(chalk.green(`\n🎉 Quick scan completed: ${totalProcessed} total properties`));
      await db.close();

    } catch (error) {
      console.error(chalk.red('❌ Quick scan failed:'), error);
      process.exit(1);
    }
  });

program.parse();