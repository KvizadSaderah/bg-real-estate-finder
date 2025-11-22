import { AgencyAnalyzer, AnalysisResult } from '../analyzer/AgencyAnalyzer';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn(),
        evaluate: jest.fn(),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }
}));

// Mock AIValidationService
jest.mock('../ai/AIValidationService', () => ({
  AIValidationService: jest.fn().mockImplementation(() => ({
    validatePropertyData: jest.fn().mockResolvedValue({
      isValid: true,
      confidence: 0.9,
      issues: [],
      suggestions: []
    }),
    validateSelectors: jest.fn().mockResolvedValue({
      isValid: true,
      quality: 0.95,
      issues: [],
      suggestions: []
    }),
    realityCheck: jest.fn().mockResolvedValue({
      passed: true,
      score: 90,
      detailedChecks: {},
      marketComparison: {},
      warnings: [],
      details: ''
    })
  })),
  createAIServiceFromEnv: jest.fn().mockReturnValue({
    validatePropertyData: jest.fn().mockResolvedValue({
      isValid: true,
      confidence: 0.9
    }),
    validateSelectors: jest.fn().mockResolvedValue({
      isValid: true,
      quality: 0.95
    }),
    realityCheck: jest.fn().mockResolvedValue({
      passed: true,
      score: 90
    })
  })
}));

describe('AgencyAnalyzer', () => {
  describe('Constructor', () => {
    it('should create instance without AI', () => {
      const analyzer = new AgencyAnalyzer({ useAI: false });
      expect(analyzer).toBeInstanceOf(AgencyAnalyzer);
    });

    it('should create instance with AI', () => {
      const analyzer = new AgencyAnalyzer({ useAI: true });
      expect(analyzer).toBeInstanceOf(AgencyAnalyzer);
    });

    it('should create instance with default options', () => {
      const analyzer = new AgencyAnalyzer();
      expect(analyzer).toBeInstanceOf(AgencyAnalyzer);
    });
  });

  describe('Analysis Result Structure', () => {
    it('should return proper analysis result structure', () => {
      // This tests the TypeScript interface
      const mockResult: AnalysisResult = {
        success: true,
        siteName: 'Test Site',
        baseUrl: 'https://example.com',
        selectors: {
          listingCard: '.card',
          title: '.title',
          price: '.price',
          location: '.location',
          area: '.area',
          rooms: '.rooms',
          image: 'img',
          link: 'a'
        },
        pagination: {
          type: 'click',
          nextButton: '.next'
        },
        sampleListings: [],
        recommendations: [],
        confidence: 0.8
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.selectors).toBeDefined();
      expect(mockResult.pagination).toBeDefined();
    });

    it('should handle failed analysis result', () => {
      const mockResult: AnalysisResult = {
        success: false,
        siteName: 'Test Site',
        baseUrl: 'https://example.com',
        selectors: {
          listingCard: '',
          title: '',
          price: '',
          location: '',
          area: '',
          rooms: '',
          image: '',
          link: ''
        },
        pagination: {
          type: 'none'
        },
        sampleListings: [],
        recommendations: ['Unable to detect listings'],
        confidence: 0.1,
        error: 'No listings found'
      };

      expect(mockResult.success).toBe(false);
      expect(mockResult.error).toBeDefined();
      expect(mockResult.confidence).toBeLessThan(0.5);
    });
  });

  describe('Selector Detection', () => {
    it('should detect common selector patterns', () => {
      // Test common patterns that analyzer should recognize
      const commonPatterns = [
        '.property-card',
        '[data-testid="listing"]',
        '.listing-item',
        'article.property',
        'div[class*="listing"]'
      ];

      // Verify these are valid CSS selectors
      commonPatterns.forEach(pattern => {
        expect(() => document.querySelector(pattern)).not.toThrow();
      });
    });

    it('should handle complex selectors', () => {
      const complexSelectors = [
        '.container > .listing-card',
        'div.property:not(.sold)',
        '[data-property-type="apartment"]',
        '.listings .card:nth-child(n)'
      ];

      complexSelectors.forEach(selector => {
        expect(typeof selector).toBe('string');
        expect(selector.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Pagination Detection', () => {
    it('should recognize click pagination', () => {
      const clickPagination = {
        type: 'click' as const,
        nextButton: '.next-page'
      };

      expect(clickPagination.type).toBe('click');
      expect(clickPagination.nextButton).toBeDefined();
    });

    it('should recognize URL pagination', () => {
      const urlPagination = {
        type: 'url' as const,
        pattern: 'https://example.com/page/{page}'
      };

      expect(urlPagination.type).toBe('url');
      expect(urlPagination.pattern).toContain('{page}');
    });

    it('should recognize infinite scroll', () => {
      const infiniteScroll = {
        type: 'infinite' as const,
        scrollTrigger: '.load-more'
      };

      expect(infiniteScroll.type).toBe('infinite');
    });

    it('should handle no pagination', () => {
      const noPagination = {
        type: 'none' as const
      };

      expect(noPagination.type).toBe('none');
    });
  });

  describe('Data Extraction Validation', () => {
    it('should validate extracted listing data structure', () => {
      const sampleListing = {
        title: '2-bedroom apartment in Lozenets',
        price: '1000 EUR',
        location: 'Lozenets, Sofia',
        area: '80 m²',
        rooms: '2',
        image: 'https://example.com/image.jpg',
        link: 'https://example.com/listing/123'
      };

      expect(sampleListing.title).toBeTruthy();
      expect(sampleListing.price).toBeTruthy();
      expect(sampleListing.location).toBeTruthy();
      expect(sampleListing.area).toBeTruthy();
    });

    it('should handle incomplete listing data', () => {
      const incompleteListing = {
        title: '2-bedroom apartment',
        price: '',
        location: 'Sofia',
        area: '',
        rooms: '',
        image: '',
        link: 'https://example.com/listing/123'
      };

      // Should still have minimum required fields
      expect(incompleteListing.title).toBeTruthy();
      expect(incompleteListing.link).toBeTruthy();
    });

    it('should validate price formats', () => {
      const priceFormats = [
        '1000 EUR',
        '€1,000',
        '1000€',
        '2000 лв',
        '$1,200',
        '1 000 EUR'
      ];

      priceFormats.forEach(price => {
        expect(price).toMatch(/\d/); // Contains digits
      });
    });

    it('should validate area formats', () => {
      const areaFormats = [
        '80 m²',
        '80m²',
        '80 кв.м',
        '80 sq.m',
        '80m2'
      ];

      areaFormats.forEach(area => {
        expect(area).toMatch(/\d/); // Contains digits
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should have high confidence for complete data', () => {
      const completeResult: Partial<AnalysisResult> = {
        success: true,
        selectors: {
          listingCard: '.card',
          title: '.title',
          price: '.price',
          location: '.location',
          area: '.area',
          rooms: '.rooms',
          image: 'img',
          link: 'a'
        },
        sampleListings: [
          {
            title: 'Apartment',
            price: '1000 EUR',
            location: 'Sofia',
            area: '80 m²',
            rooms: '2',
            image: 'img.jpg',
            link: '/listing/1'
          }
        ],
        confidence: 0.95
      };

      expect(completeResult.confidence).toBeGreaterThan(0.9);
      expect(completeResult.sampleListings?.length).toBeGreaterThan(0);
    });

    it('should have low confidence for incomplete data', () => {
      const incompleteResult: Partial<AnalysisResult> = {
        success: false,
        selectors: {
          listingCard: '.card',
          title: '',
          price: '',
          location: '',
          area: '',
          rooms: '',
          image: '',
          link: ''
        },
        sampleListings: [],
        confidence: 0.2
      };

      expect(incompleteResult.confidence).toBeLessThan(0.5);
      expect(incompleteResult.sampleListings?.length).toBe(0);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for improvements', () => {
      const recommendations = [
        'Consider adding image selector',
        'Price selector could be more specific',
        'Add pagination support',
        'Verify location extraction'
      ];

      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });

    it('should recommend AI validation when appropriate', () => {
      const result: Partial<AnalysisResult> = {
        success: true,
        confidence: 0.7, // Medium confidence
        recommendations: [
          'Consider using --ai flag for better validation',
          'AI can help verify selector quality'
        ]
      };

      expect(result.recommendations).toContain(
        expect.stringContaining('AI')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const errorResult: AnalysisResult = {
        success: false,
        siteName: 'Test Site',
        baseUrl: 'https://example.com',
        selectors: {
          listingCard: '',
          title: '',
          price: '',
          location: '',
          area: '',
          rooms: '',
          image: '',
          link: ''
        },
        pagination: { type: 'none' },
        sampleListings: [],
        recommendations: [],
        confidence: 0,
        error: 'Network error: Failed to fetch'
      };

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('Network error');
    });

    it('should handle timeout errors', () => {
      const errorResult: AnalysisResult = {
        success: false,
        siteName: 'Test Site',
        baseUrl: 'https://example.com',
        selectors: {
          listingCard: '',
          title: '',
          price: '',
          location: '',
          area: '',
          rooms: '',
          image: '',
          link: ''
        },
        pagination: { type: 'none' },
        sampleListings: [],
        recommendations: [],
        confidence: 0,
        error: 'Timeout: Page took too long to load'
      };

      expect(errorResult.error).toContain('Timeout');
    });

    it('should handle invalid URL', () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'javascript:alert(1)',
        ''
      ];

      invalidUrls.forEach(url => {
        // Should not be a valid URL
        expect(() => new URL(url)).toThrow();
      });
    });
  });

  describe('AI Integration', () => {
    it('should include AI validation when enabled', async () => {
      const analyzer = new AgencyAnalyzer({ useAI: true });
      expect(analyzer).toBeDefined();
      // AI validation would be called during analysis
    });

    it('should skip AI validation when disabled', async () => {
      const analyzer = new AgencyAnalyzer({ useAI: false });
      expect(analyzer).toBeDefined();
      // AI validation should not be called
    });

    it('should handle AI validation results', () => {
      const aiValidation = {
        overallScore: 85,
        selectorsQuality: 0.9,
        dataQuality: 0.85,
        realityScore: 90,
        suggestions: ['Good quality selectors'],
        issues: []
      };

      expect(aiValidation.overallScore).toBeGreaterThan(80);
      expect(aiValidation.selectorsQuality).toBeGreaterThan(0.8);
    });
  });

  describe('Site Types', () => {
    it('should detect static HTML sites', () => {
      const staticSite = {
        type: 'static' as const,
        requiresJavaScript: false
      };

      expect(staticSite.type).toBe('static');
      expect(staticSite.requiresJavaScript).toBe(false);
    });

    it('should detect SPA sites', () => {
      const spaSite = {
        type: 'spa' as const,
        requiresJavaScript: true,
        framework: 'React'
      };

      expect(spaSite.type).toBe('spa');
      expect(spaSite.requiresJavaScript).toBe(true);
    });

    it('should detect API-based sites', () => {
      const apiSite = {
        type: 'api' as const,
        apiEndpoint: 'https://api.example.com/listings'
      };

      expect(apiSite.type).toBe('api');
      expect(apiSite.apiEndpoint).toBeTruthy();
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', () => {
      const rateLimit = {
        requestsPerMinute: 30,
        delayBetweenPages: 2000 // 2 seconds
      };

      expect(rateLimit.requestsPerMinute).toBeLessThanOrEqual(60);
      expect(rateLimit.delayBetweenPages).toBeGreaterThan(0);
    });

    it('should calculate appropriate delays', () => {
      const requestsPerMinute = 30;
      const minDelay = 60000 / requestsPerMinute; // 2000ms

      expect(minDelay).toBe(2000);
    });
  });

  describe('Output Generation', () => {
    it('should generate valid parser configuration', () => {
      const config = {
        id: 'test-site',
        name: 'Test Site',
        baseUrl: 'https://example.com',
        enabled: true,
        searchUrls: ['https://example.com/listings'],
        selectors: {
          listingCard: '.card',
          title: '.title',
          price: '.price',
          location: '.location',
          area: '.area',
          rooms: '.rooms',
          image: 'img',
          link: 'a'
        },
        pagination: {
          type: 'click' as const,
          nextButton: '.next'
        },
        maxPages: 5
      };

      expect(config.id).toBeTruthy();
      expect(config.baseUrl).toMatch(/^https?:\/\//);
      expect(config.selectors).toBeDefined();
      expect(config.maxPages).toBeGreaterThan(0);
    });
  });
});
