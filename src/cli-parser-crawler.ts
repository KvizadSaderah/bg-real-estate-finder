#!/usr/bin/env ts-node

import { parserCrawler } from './crawlers/ParserCrawler';
import { parserConfigManager } from './config/ParserConfig';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const siteId = args[1];

    try {
        switch (command) {
            case 'run':
                if (siteId) {
                    console.log(`🚀 Running crawler for site: ${siteId}`);
                    await parserCrawler.runSite(siteId);
                } else {
                    console.log('🎯 Running crawler for all enabled sites');
                    await parserCrawler.runAllEnabledSites();
                }
                break;

            case 'test':
                if (!siteId) {
                    console.error('❌ Site ID required for test command');
                    console.log('Usage: npm run crawler test <siteId>');
                    process.exit(1);
                }
                console.log(`🧪 Testing site: ${siteId}`);
                await parserCrawler.testSite(siteId);
                break;

            case 'list':
                console.log('📋 Available parser sites:');
                const config = await parserConfigManager.loadConfig();
                config.sites.forEach(site => {
                    const status = site.enabled ? '✅ Enabled' : '❌ Disabled';
                    console.log(`  ${site.id} - ${site.name} (${status})`);
                });
                break;

            case 'help':
            default:
                console.log(`
🕷️  Parser Crawler CLI

Usage:
  npm run crawler <command> [options]

Commands:
  run              Run all enabled sites
  run <siteId>     Run specific site
  test <siteId>    Test specific site (limited run)
  list             List all configured sites
  help             Show this help

Examples:
  npm run crawler run              # Run all enabled sites
  npm run crawler run ues_bg       # Run specific site
  npm run crawler test ues_bg      # Test site configuration
  npm run crawler list             # Show available sites
`);
                break;
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Crawler error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}