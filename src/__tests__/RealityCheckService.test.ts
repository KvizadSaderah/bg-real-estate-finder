import { RealityCheckService, PropertyData } from '../ai/RealityCheckService';

describe('RealityCheckService', () => {
  let service: RealityCheckService;

  beforeEach(() => {
    service = new RealityCheckService();
  });

  describe('Price Range Validation', () => {
    it('should pass for typical 2-bedroom price', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.priceRange.passed).toBe(true);
      expect(result.detailedChecks.priceRange.score).toBeGreaterThan(70);
    });

    it('should fail for unrealistically low price', () => {
      const data: PropertyData = {
        price: 100, // Too low for Sofia
        area: 80,
        rooms: 2,
        location: 'Center, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.priceRange.passed).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('suspiciously low'));
    });

    it('should fail for unrealistically high price', () => {
      const data: PropertyData = {
        price: 10000, // Too high for typical rental
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.priceRange.passed).toBe(false);
    });

    it('should validate studio prices correctly', () => {
      const data: PropertyData = {
        price: 500,
        area: 35,
        rooms: 1,
        location: 'Mladost, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.priceRange.passed).toBe(true);
    });

    it('should validate 3-bedroom prices correctly', () => {
      const data: PropertyData = {
        price: 1400,
        area: 110,
        rooms: 3,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.priceRange.passed).toBe(true);
    });
  });

  describe('Price Per Square Meter Validation', () => {
    it('should pass for typical price per sqm', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80, // 12.5 EUR/sqm - typical
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.pricePerSqm.passed).toBe(true);
    });

    it('should fail for price per sqm below minimum', () => {
      const data: PropertyData = {
        price: 300,
        area: 100, // 3 EUR/sqm - too low
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.pricePerSqm.passed).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('sqm is below'));
    });

    it('should fail for price per sqm above maximum', () => {
      const data: PropertyData = {
        price: 3000,
        area: 100, // 30 EUR/sqm - too high
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.pricePerSqm.passed).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('sqm is above'));
    });

    it('should categorize price correctly', () => {
      const dataTypical: PropertyData = {
        price: 1000,
        area: 80, // 12.5 EUR/sqm
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(dataTypical);
      expect(result.marketComparison.category).toBe('typical');
    });
  });

  describe('Area Size Validation', () => {
    it('should pass for typical apartment area', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.areaSize.passed).toBe(true);
    });

    it('should fail for area too small', () => {
      const data: PropertyData = {
        price: 500,
        area: 15, // Too small
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.areaSize.passed).toBe(false);
    });

    it('should fail for area too large', () => {
      const data: PropertyData = {
        price: 2000,
        area: 300, // Too large for typical rental
        rooms: 3,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.areaSize.passed).toBe(false);
    });
  });

  describe('Rooms to Area Ratio Validation', () => {
    it('should pass for proper 2-bedroom apartment', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80, // 40 sqm per room
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.roomsToArea.passed).toBe(true);
    });

    it('should fail when rooms too many for area', () => {
      const data: PropertyData = {
        price: 1000,
        area: 60, // Too small for 4 rooms
        rooms: 4,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.roomsToArea.passed).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('area is too small'));
    });

    it('should handle studio apartments correctly', () => {
      const data: PropertyData = {
        price: 500,
        area: 35,
        rooms: 1,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.roomsToArea.passed).toBe(true);
    });
  });

  describe('Neighborhood Validation', () => {
    it('should pass for known Sofia neighborhoods (English)', () => {
      const locations = [
        'Center, Sofia',
        'Lozenets, Sofia',
        'Mladost, Sofia',
        'Manastirski Livadi, Sofia'
      ];

      locations.forEach(location => {
        const data: PropertyData = {
          price: 1000,
          area: 80,
          rooms: 2,
          location
        };

        const result = service.performDetailedCheck(data);
        expect(result.detailedChecks.neighborhoodValid.passed).toBe(true);
      });
    });

    it('should pass for known Sofia neighborhoods (Bulgarian)', () => {
      const locations = [
        'Център, София',
        'Лозенец, София',
        'Младост, София',
        'Манастирски ливади, София'
      ];

      locations.forEach(location => {
        const data: PropertyData = {
          price: 1000,
          area: 80,
          rooms: 2,
          location
        };

        const result = service.performDetailedCheck(data);
        expect(result.detailedChecks.neighborhoodValid.passed).toBe(true);
      });
    });

    it('should warn for unknown neighborhoods', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Unknown District, Sofia'
      };

      const result = service.performDetailedCheck(data);
      // May pass but with lower score
      expect(result.score).toBeLessThan(100);
    });

    it('should handle locations without Sofia', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets' // Without "Sofia"
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.neighborhoodValid.passed).toBe(true);
    });
  });

  describe('Data Completeness Validation', () => {
    it('should pass with all required fields', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.dataCompleteness.passed).toBe(true);
      expect(result.detailedChecks.dataCompleteness.score).toBe(100);
    });

    it('should fail with missing price', () => {
      const data: PropertyData = {
        price: 0, // Missing
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.dataCompleteness.passed).toBe(false);
    });

    it('should fail with missing area', () => {
      const data: PropertyData = {
        price: 1000,
        area: 0, // Missing
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.dataCompleteness.passed).toBe(false);
    });

    it('should fail with missing location', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: '' // Missing
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.dataCompleteness.passed).toBe(false);
    });

    it('should still pass with missing rooms (optional)', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 0, // Missing but optional
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      // Should still pass but with lower score
      expect(result.detailedChecks.dataCompleteness.score).toBeLessThan(100);
      expect(result.detailedChecks.dataCompleteness.score).toBeGreaterThan(50);
    });
  });

  describe('Overall Score Calculation', () => {
    it('should have high score for perfect listing', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should fail overall when score below 70', () => {
      const data: PropertyData = {
        price: 50, // Way too low
        area: 10, // Too small
        rooms: 5, // Too many for area
        location: 'Unknown, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(70);
    });

    it('should provide warnings array', () => {
      const data: PropertyData = {
        price: 100,
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should provide detailed report', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.details).toBeDefined();
      expect(result.details.length).toBeGreaterThan(0);
    });
  });

  describe('Market Comparison', () => {
    it('should categorize below market correctly', () => {
      const data: PropertyData = {
        price: 400, // Below typical for 2-bedroom
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.marketComparison.category).toBe('below_market');
    });

    it('should categorize typical market correctly', () => {
      const data: PropertyData = {
        price: 1000, // Typical for 2-bedroom
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.marketComparison.category).toBe('typical');
    });

    it('should categorize above market correctly', () => {
      const data: PropertyData = {
        price: 1700, // Above typical for 2-bedroom
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.marketComparison.category).toBe('above_market');
    });

    it('should categorize extreme correctly', () => {
      const data: PropertyData = {
        price: 5000, // Way above max
        area: 80,
        rooms: 2,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.marketComparison.category).toBe('extreme');
    });

    it('should provide market suggestions', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.marketComparison.suggestion).toBeDefined();
      expect(result.marketComparison.suggestion.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative values gracefully', () => {
      const data: PropertyData = {
        price: -100,
        area: -50,
        rooms: -1,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(30);
    });

    it('should handle very large values', () => {
      const data: PropertyData = {
        price: 999999,
        area: 9999,
        rooms: 100,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(false);
    });

    it('should handle empty location string', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: ''
      };

      const result = service.performDetailedCheck(data);
      expect(result.detailedChecks.dataCompleteness.passed).toBe(false);
    });

    it('should handle location without Sofia', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: 2,
        location: 'Lozenets' // Valid neighborhood, missing city
      };

      const result = service.performDetailedCheck(data);
      // Should still pass since Lozenets is a known neighborhood
      expect(result.detailedChecks.neighborhoodValid.passed).toBe(true);
    });

    it('should handle undefined rooms', () => {
      const data: PropertyData = {
        price: 1000,
        area: 80,
        rooms: undefined as any,
        location: 'Sofia'
      };

      const result = service.performDetailedCheck(data);
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should validate luxury apartment correctly', () => {
      const data: PropertyData = {
        price: 2200,
        area: 150,
        rooms: 3,
        location: 'Center, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(true);
      expect(result.marketComparison.category).toMatch(/above_market|typical/);
    });

    it('should validate budget studio correctly', () => {
      const data: PropertyData = {
        price: 450,
        area: 32,
        rooms: 1,
        location: 'Mladost, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(70);
    });

    it('should validate typical family apartment', () => {
      const data: PropertyData = {
        price: 1400,
        area: 110,
        rooms: 3,
        location: 'Lozenets, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(true);
      expect(result.marketComparison.category).toBe('typical');
    });

    it('should detect suspicious listing (too cheap)', () => {
      const data: PropertyData = {
        price: 200,
        area: 100,
        rooms: 3,
        location: 'Center, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.passed).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('suspiciously low'));
    });

    it('should detect overpriced listing', () => {
      const data: PropertyData = {
        price: 3500,
        area: 70,
        rooms: 2,
        location: 'Mladost, Sofia'
      };

      const result = service.performDetailedCheck(data);
      expect(result.warnings).toContain(expect.stringContaining('above'));
    });
  });
});
