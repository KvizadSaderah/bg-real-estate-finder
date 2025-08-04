import { chromium, Browser, Page } from 'playwright';

interface APIDiscoveryResult {
  site: string;
  apiEndpoints: Array<{
    url: string;
    method: string;
    containsListings: boolean;
    searchPattern?: string;
    dataStructure?: any;
  }>;
  feasibility: 'high' | 'medium' | 'low';
  notes: string[];
}

class APIDiscoveryTester {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false, // Set to false to see what's happening
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
  }

  async testSite(siteName: string, baseUrl: string, searchPath: string): Promise<APIDiscoveryResult> {
    if (!this.browser) {
      await this.init();
    }

    const page = await this.browser!.newPage();
    const apiEndpoints: any[] = [];
    const notes: string[] = [];

    // Intercept network requests
    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'] || '';
      const responseUrl = response.url();
      
      if (contentType.includes('application/json') && response.status() === 200) {
        try {
          const data = await response.json();
          console.log(`🔍 JSON API found: ${responseUrl}`);
          
          const containsListings = this.looksLikeListingsData(data);
          
          apiEndpoints.push({
            url: responseUrl,
            method: response.request().method(),
            containsListings,
            dataStructure: this.getDataStructure(data)
          });

          if (containsListings) {
            console.log(`✅ Listings API detected!`);
            notes.push(`Found listings API: ${responseUrl}`);
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    });

    try {
      const fullUrl = `${baseUrl}${searchPath}`;
      console.log(`Testing ${siteName}: ${fullUrl}`);
      
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Try to trigger more requests by scrolling and interacting
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);

      // Try to find and click search/filter buttons to trigger API calls
      const searchButtons = await page.$$eval('button, input[type="submit"], .search-btn, .filter-btn', 
        elements => elements.map(el => el.textContent).filter(text => text && text.trim()));
      
      if (searchButtons.length > 0) {
        notes.push(`Found ${searchButtons.length} potential search/filter buttons`);
      }

      // Check if there are forms we can submit
      const forms = await page.$$('form');
      if (forms.length > 0) {
        notes.push(`Found ${forms.length} forms on the page`);
      }

      const listingsEndpoints = apiEndpoints.filter(ep => ep.containsListings);
      const feasibility = this.calculateFeasibility(listingsEndpoints, apiEndpoints);

      await page.close();

      return {
        site: siteName,
        apiEndpoints,
        feasibility,
        notes
      };

    } catch (error) {
      await page.close();
      return {
        site: siteName,
        apiEndpoints: [],
        feasibility: 'low',
        notes: [`Error: ${error}`]
      };
    }
  }

  private looksLikeListingsData(data: any): boolean {
    if (!data) return false;
    
    // Check if it's an array or has array property
    const arrayToCheck = Array.isArray(data) ? data : 
                        (data.items || data.results || data.listings || data.properties || 
                         data.data || data.offers || data.ads);
    
    if (!Array.isArray(arrayToCheck) || arrayToCheck.length === 0) return false;
    
    // Check first item for property-like structure
    const firstItem = arrayToCheck[0];
    if (typeof firstItem !== 'object') return false;
    
    const keys = Object.keys(firstItem).map(k => k.toLowerCase());
    const realEstateKeys = ['price', 'title', 'location', 'area', 'rooms', 'address', 'type', 'id'];
    const matchCount = realEstateKeys.filter(key => 
      keys.some(k => k.includes(key))
    ).length;
    
    return matchCount >= 2;
  }

  private getDataStructure(data: any): any {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        length: data.length,
        firstItemKeys: data[0] ? Object.keys(data[0]).slice(0, 10) : []
      };
    } else if (typeof data === 'object' && data) {
      const keys = Object.keys(data);
      const arrayKeys = keys.filter(key => Array.isArray(data[key]));
      return {
        type: 'object',
        keys: keys.slice(0, 10),
        arrayKeys,
        arrayLengths: arrayKeys.reduce((acc, key) => {
          acc[key] = data[key].length;
          return acc;
        }, {} as any)
      };
    }
    return { type: typeof data };
  }

  private calculateFeasibility(listingsEndpoints: any[], allEndpoints: any[]): 'high' | 'medium' | 'low' {
    if (listingsEndpoints.length > 0) {
      return 'high';
    } else if (allEndpoints.length > 0) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

async function testPrioritySites() {
  const tester = new APIDiscoveryTester();
  
  const sites = [
    {
      name: 'SUPRIMMO',
      baseUrl: 'https://suprimmo.net',
      searchPath: '/bg/search/rent/sofia'
    },
    {
      name: 'Bulgarian Properties',
      baseUrl: 'https://bulgarianproperties.com',
      searchPath: '/search/rentals/sofia'
    },
    {
      name: 'Luximmo Finest Estates',
      baseUrl: 'https://luximmo.bg',
      searchPath: '/bg/search?type=rent&location=sofia'
    },
    {
      name: 'ТИТАН ПРОПЪРТИС РЕНТ ООД',
      baseUrl: 'https://titanproperties.bg',
      searchPath: '/bg/search/rent'
    },
    {
      name: 'Yavlena (Явлена)',
      baseUrl: 'https://yavlena.com',
      searchPath: '/bg/obiavi/naem/sofia-grad'
    }
  ];

  const results: APIDiscoveryResult[] = [];

  for (const site of sites) {
    try {
      console.log(`\n=== Testing ${site.name} ===`);
      const result = await tester.testSite(site.name, site.baseUrl, site.searchPath);
      results.push(result);
      
      // Wait between sites to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to test ${site.name}:`, error);
      results.push({
        site: site.name,
        apiEndpoints: [],
        feasibility: 'low',
        notes: [`Failed to test: ${error}`]
      });
    }
  }

  await tester.close();

  // Print detailed results
  console.log('\n=== API DISCOVERY RESULTS ===\n');
  
  results.forEach(result => {
    console.log(`## ${result.site}`);
    console.log(`Feasibility: ${result.feasibility.toUpperCase()}`);
    console.log(`API Endpoints found: ${result.apiEndpoints.length}`);
    
    if (result.apiEndpoints.length > 0) {
      console.log('Endpoints:');
      result.apiEndpoints.forEach(ep => {
        console.log(`  - ${ep.method} ${ep.url}`);
        console.log(`    Contains listings: ${ep.containsListings ? 'YES' : 'NO'}`);
        if (ep.dataStructure) {
          console.log(`    Data structure: ${JSON.stringify(ep.dataStructure, null, 2)}`);
        }
      });
    }
    
    if (result.notes.length > 0) {
      console.log('Notes:');
      result.notes.forEach(note => console.log(`  - ${note}`));
    }
    
    console.log('---\n');
  });

  return results;
}

// Run the test
testPrioritySites().catch(console.error);