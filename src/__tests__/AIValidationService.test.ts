import { AIValidationService, PropertyData } from '../ai/AIValidationService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock RealityCheckService
jest.mock('../ai/RealityCheckService', () => ({
  RealityCheckService: jest.fn().mockImplementation(() => ({
    performDetailedCheck: jest.fn().mockReturnValue({
      passed: true,
      score: 85,
      detailedChecks: {
        priceRange: { passed: true, score: 90 },
        pricePerSqm: { passed: true, score: 85 },
        areaSize: { passed: true, score: 95 },
        roomsToArea: { passed: true, score: 90 },
        neighborhoodValid: { passed: true, score: 80 },
        dataCompleteness: { passed: true, score: 100 }
      },
      marketComparison: {
        category: 'typical',
        suggestion: 'Price is within typical range for Sofia'
      },
      warnings: [],
      details: 'All checks passed'
    })
  })),
  SOFIA_MARKET_DATA: {
    rentalPrices: {
      studio: { min: 350, max: 800, typical: 500 },
      oneBedroom: { min: 400, max: 1200, typical: 700 },
      twoBedroom: { min: 600, max: 1800, typical: 1000 }
    }
  }
}));

describe('AIValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with Gemini provider', () => {
      const service = new AIValidationService('gemini', 'test-key');
      expect(service).toBeInstanceOf(AIValidationService);
    });

    it('should create instance with OpenAI provider', () => {
      const service = new AIValidationService('openai', 'test-key');
      expect(service).toBeInstanceOf(AIValidationService);
    });

    it('should throw error for invalid provider', () => {
      expect(() => {
        new AIValidationService('invalid' as any, 'test-key');
      }).toThrow();
    });

    it('should handle missing API key gracefully', () => {
      const service = new AIValidationService('gemini', '');
      expect(service).toBeInstanceOf(AIValidationService);
    });
  });

  describe('Reality Check (Hybrid Approach)', () => {
    it('should return local check when API key is missing', async () => {
      const service = new AIValidationService('gemini', '');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = await service.realityCheck(data);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(85); // From mocked local check
      expect(result.detailedChecks).toBeDefined();
    });

    it('should use local check when score is very low', async () => {
      // Mock local check with low score
      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 50, // Suspiciously low
        area: 10,
        rooms: 5,
        location: 'Unknown'
      };

      const result = await service.realityCheck(data);

      // Should return immediately without AI call
      expect(result).toBeDefined();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should enhance with AI when conditions are met', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  overallScore: 90,
                  aiInsights: 'Price is reasonable',
                  suggestions: ['Good listing']
                })
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = await service.realityCheck(data);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should fallback to local check on API error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = await service.realityCheck(data);

      // Should return local check results
      expect(result.passed).toBe(true);
      expect(result.score).toBe(85);
    });
  });

  describe('Validate Property Data', () => {
    it('should validate property data with Gemini', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  isValid: true,
                  confidence: 0.9,
                  issues: [],
                  suggestions: ['Data looks good']
                })
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = await service.validatePropertyData(data, 'https://example.com');

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should validate property data with OpenAI', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                isValid: true,
                confidence: 0.85,
                issues: [],
                suggestions: []
              })
            }
          }]
        }
      });

      const service = new AIValidationService('openai', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = await service.validatePropertyData(data, 'https://example.com');

      expect(result.isValid).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('openai.com'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle malformed JSON response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: 'Invalid JSON'
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      await expect(
        service.validatePropertyData(data, 'https://example.com')
      ).rejects.toThrow();
    });

    it('should handle API rate limits', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 429, data: { error: 'Rate limit exceeded' } }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      await expect(
        service.validatePropertyData(data, 'https://example.com')
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      await expect(
        service.validatePropertyData(data, 'https://example.com')
      ).rejects.toThrow();
    });
  });

  describe('Validate Selectors', () => {
    it('should validate selectors successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  isValid: true,
                  quality: 0.95,
                  issues: [],
                  suggestions: ['Selectors look accurate']
                })
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const selectors = {
        title: '.property-title',
        price: '.price',
        area: '.area'
      };
      const sampleData = [
        { title: '2-bedroom apt', price: '1000 EUR', area: '80 m²' }
      ];

      const result = await service.validateSelectors(selectors, sampleData, 'https://example.com');

      expect(result.isValid).toBe(true);
      expect(result.quality).toBeGreaterThan(0.9);
    });

    it('should detect poor quality selectors', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  isValid: false,
                  quality: 0.3,
                  issues: ['Incomplete data extraction'],
                  suggestions: ['Improve title selector']
                })
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const selectors = {
        title: '.wrong-selector'
      };
      const sampleData = [
        { title: '' } // Empty data
      ];

      const result = await service.validateSelectors(selectors, sampleData, 'https://example.com');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Incomplete data extraction');
    });
  });

  describe('Provider-Specific Behavior', () => {
    it('should use correct API endpoint for Gemini', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({ isValid: true }) }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-api-key');
      await service.validatePropertyData(
        { price: 1000, area: 80, rooms: 2, location: 'Sofia' },
        'https://example.com'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should use correct API endpoint for OpenAI', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: JSON.stringify({ isValid: true })
            }
          }]
        }
      });

      const service = new AIValidationService('openai', 'test-api-key');
      await service.validatePropertyData(
        { price: 1000, area: 80, rooms: 2, location: 'Sofia' },
        'https://example.com'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('api.openai.com'),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty property data', async () => {
      const service = new AIValidationService('gemini', '');
      const data: PropertyData = {
        price: 0,
        area: 0,
        rooms: 0,
        location: ''
      };

      const result = await service.realityCheck(data);
      expect(result).toBeDefined();
    });

    it('should handle very large property values', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  isValid: false,
                  confidence: 0.1,
                  issues: ['Values seem unrealistic'],
                  suggestions: ['Verify data source']
                })
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 999999,
        area: 9999,
        rooms: 100,
        location: 'Sofia'
      };

      const result = await service.validatePropertyData(data, 'https://example.com');
      expect(result.isValid).toBe(false);
    });

    it('should handle special characters in location', async () => {
      const service = new AIValidationService('gemini', '');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Център/Center, София/Sofia, България/Bulgaria'
      };

      const result = await service.realityCheck(data);
      expect(result).toBeDefined();
    });

    it('should handle timeout gracefully', async () => {
      mockedAxios.post.mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      await expect(
        service.validatePropertyData(data, 'https://example.com')
      ).rejects.toThrow('Timeout');
    });
  });

  describe('Integration with RealityCheckService', () => {
    it('should use RealityCheckService for local validation', async () => {
      const service = new AIValidationService('gemini', '');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = await service.realityCheck(data);

      // Should use mocked RealityCheckService
      expect(result.score).toBe(85);
      expect(result.detailedChecks).toBeDefined();
      expect(result.marketComparison).toBeDefined();
    });

    it('should merge AI and local results when both available', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  overallScore: 92,
                  aiInsights: 'Excellent listing quality',
                  suggestions: ['Consider highlighting premium features']
                })
              }]
            }
          }]
        }
      });

      const service = new AIValidationService('gemini', 'test-key');
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = await service.realityCheck(data);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      // Should have both local and AI data
      expect(result.detailedChecks).toBeDefined();
    });
  });
});
