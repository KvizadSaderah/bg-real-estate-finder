import { parserConfigManager, ParserSite } from '../config/ParserConfig';
import { db } from '../database/connection';
import { PropertyService } from '../database/PropertyService';

export class ParserCrawler {
    private propertyService: PropertyService;
    private currentSessionId: string | null = null;

    constructor() {
        this.propertyService = new PropertyService();
    }

    async runSite(siteId: string, testMode = false): Promise<void> {
        const site = await parserConfigManager.getSite(siteId);
        if (!site || !site.enabled) {
            throw new Error(`Site ${siteId} not found or not enabled`);
        }

        console.log(`🚀 Starting crawler for ${site.name} (${siteId})`);

        // Create session
        const sessionId = await this.createSession(site, testMode);
        this.currentSessionId = sessionId;

        try {
            const results = await this.crawlSite(site);
            await this.completeSession(sessionId, 'completed', results);
            console.log(`✅ Crawler completed successfully for ${site.name}`);
        } catch (error) {
            console.error(`❌ Crawler failed for ${site.name}:`, error);
            await this.completeSession(sessionId, 'failed', {
                errors: [error instanceof Error ? error.message : 'Unknown error']
            });
            throw error;
        }
    }

    private async createSession(site: ParserSite, testMode: boolean): Promise<string> {
        const query = `
            INSERT INTO scraping_sessions (
                session_type, 
                search_url,
                started_at, 
                status,
                total_pages,
                metadata
            ) VALUES ($1, $2, NOW(), 'running', $3, $4) 
            RETURNING id
        `;

        const sessionType = testMode ? 'test_run' : 'monitoring_cycle';
        const searchUrl = site.searchUrls[0] || site.baseUrl;
        const metadata = {
            parser_config: site.id,
            site_name: site.name,
            trigger: testMode ? 'test' : 'scheduled',
            user_agent: site.userAgent || 'PropertyCrawler/1.0'
        };

        const result = await db.query(query, [
            sessionType,
            searchUrl,
            site.maxPages,
            JSON.stringify(metadata)
        ]);

        return result.rows[0].id;
    }

    private async crawlSite(site: ParserSite): Promise<any> {
        // This is a mock implementation - replace with actual crawling logic
        console.log(`📡 Crawling ${site.name} with ${site.searchUrls.length} search URLs`);
        
        const results = {
            pages_processed: 0,
            properties_found: 0,
            properties_new: 0,
            properties_updated: 0,
            properties_removed: 0,
            errors_count: 0,
            warnings_count: 0,
            errors: [] as string[],
            warnings: [] as string[]
        };

        // Mock crawling each search URL
        for (let i = 0; i < Math.min(site.searchUrls.length, site.maxPages); i++) {
            const url = site.searchUrls[i];
            console.log(`  📄 Processing page ${i + 1}: ${url}`);
            
            // Simulate processing time
            await this.delay(site.waitTimes.betweenPages);
            
            // Mock results
            const pageResults = await this.mockCrawlPage(site, url);
            
            results.pages_processed++;
            results.properties_found += pageResults.properties_found;
            results.properties_new += pageResults.properties_new;
            results.properties_updated += pageResults.properties_updated;
            results.errors.push(...pageResults.errors);
            results.warnings.push(...pageResults.warnings);
        }

        results.errors_count = results.errors.length;
        results.warnings_count = results.warnings.length;

        return results;
    }

    private async mockCrawlPage(site: ParserSite, url: string): Promise<any> {
        // This simulates parsing a page - replace with real Playwright logic
        
        const results = {
            properties_found: Math.floor(Math.random() * 15) + 5, // 5-20 properties
            properties_new: Math.floor(Math.random() * 8) + 1,    // 1-8 new
            properties_updated: Math.floor(Math.random() * 3),     // 0-3 updated
            errors: [] as string[],
            warnings: [] as string[]
        };

        // Simulate some parsing issues
        if (Math.random() < 0.2) { // 20% chance of error
            results.errors.push(`Failed to parse ${Math.floor(Math.random() * 3) + 1} properties on ${url}`);
        }

        if (Math.random() < 0.4) { // 40% chance of warning
            results.warnings.push(`Missing images for ${Math.floor(Math.random() * 2) + 1} properties`);
        }

        if (Math.random() < 0.3) { // 30% chance of another warning
            results.warnings.push(`Slow server response from ${new URL(url).hostname}`);
        }

        console.log(`    ✓ Found ${results.properties_found} properties, ${results.properties_new} new`);
        
        return results;
    }

    private async completeSession(sessionId: string, status: string, results: any): Promise<void> {
        const query = `
            UPDATE scraping_sessions 
            SET 
                completed_at = NOW(),
                status = $1,
                pages_processed = $2,
                properties_found = $3,
                properties_new = $4,
                properties_updated = $5,
                properties_removed = $6,
                errors_count = $7,
                warnings_count = $8,
                time_elapsed_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
                errors = $9,
                warnings = $10
            WHERE id = $11
        `;

        await db.query(query, [
            status,
            results.pages_processed || 0,
            results.properties_found || 0,
            results.properties_new || 0,
            results.properties_updated || 0,
            results.properties_removed || 0,
            results.errors_count || 0,
            results.warnings_count || 0,
            JSON.stringify(results.errors || []),
            JSON.stringify(results.warnings || []),
            sessionId
        ]);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runAllEnabledSites(): Promise<void> {
        const config = await parserConfigManager.loadConfig();
        const enabledSites = config.sites.filter(site => site.enabled);

        console.log(`🎯 Running crawler for ${enabledSites.length} enabled sites`);

        for (const site of enabledSites) {
            try {
                await this.runSite(site.id);
                // Wait between sites
                await this.delay(5000);
            } catch (error) {
                console.error(`Failed to crawl site ${site.id}:`, error);
            }
        }

        console.log(`✅ Completed crawling all enabled sites`);
    }

    async testSite(siteId: string): Promise<any> {
        console.log(`🧪 Testing site ${siteId}`);
        await this.runSite(siteId, true);
        return { success: true, message: `Test completed for site ${siteId}` };
    }
}

export const parserCrawler = new ParserCrawler();