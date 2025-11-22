import { PropertyData, RealityCheckResult } from './AIValidationService';

/**
 * Sofia Real Estate Market Data
 * Based on 2024-2025 market research
 */
export const SOFIA_MARKET_DATA = {
  // Rental prices per month (EUR)
  rentalPrices: {
    studio: { min: 350, max: 800, typical: 500 },
    oneBedroom: { min: 400, max: 1200, typical: 700 },
    twoBedroom: { min: 600, max: 1800, typical: 1000 },
    threeBedroom: { min: 800, max: 2500, typical: 1400 },
    fourPlusRooms: { min: 1200, max: 4000, typical: 2000 }
  },

  // Price per square meter for rentals (EUR/m²)
  pricePerSqm: {
    min: 5,
    max: 25,
    typical: { min: 8, max: 15 }
  },

  // Typical apartment sizes (m²)
  apartmentSizes: {
    studio: { min: 25, max: 45, typical: 35 },
    oneBedroom: { min: 40, max: 70, typical: 55 },
    twoBedroom: { min: 60, max: 100, typical: 75 },
    threeBedroom: { min: 80, max: 140, typical: 100 },
    fourPlusRooms: { min: 100, max: 250, typical: 130 }
  },

  // Known neighborhoods in Sofia
  neighborhoods: [
    // Central
    'Център', 'Center', 'Централна част', 'Сердика', 'Триъгълника',

    // Popular residential
    'Лозенец', 'Lozenets', 'Младост', 'Mladost', 'Студентски град', 'Studentski grad',
    'Драгалевци', 'Dragalevtsi', 'Бояна', 'Boyana', 'Симеоново', 'Simeonovo',
    'Витоша', 'Vitosha', 'Изток', 'Iztok', 'Запад', 'Zapad',

    // Other areas
    'Овча купел', 'Овча Купел', 'Ovcha Kupel', 'Люлин', 'Lyulin',
    'Надежда', 'Nadezhda', 'Красно село', 'Krasno selo',
    'Подуяне', 'Poduene', 'Оборище', 'Oborishte',
    'Редута', 'Reduta', 'Манастирски ливади', 'Manastirski livadi',
    'Хаджи Димитър', 'Hadji Dimitar', 'Слатина', 'Slatina',
    'Банишора', 'Banishora', 'Зона Б-5', 'Zona B-5',
    'Гео Милев', 'Geo Milev', 'Дружба', 'Druzhba',

    // Metro stations (common in listings)
    'метро', 'metro', 'м. ', 'станция'
  ],

  // Property types
  propertyTypes: {
    apartment: ['апартамент', 'apartament', 'apartment', 'двустаен', 'тристаен', 'четиристаен'],
    studio: ['студио', 'studio', 'гарсониера', 'едностаен'],
    house: ['къща', 'kashta', 'house', 'вила', 'vila'],
    office: ['офис', 'ofis', 'office'],
    room: ['стая', 'staya', 'room']
  }
};

/**
 * Detailed Reality Check Results
 */
export interface DetailedRealityCheckResult extends RealityCheckResult {
  detailedChecks: {
    priceRange: { passed: boolean; expected: string; actual: string; };
    pricePerSqm: { passed: boolean; expected: string; actual: string; };
    areaSize: { passed: boolean; expected: string; actual: string; };
    roomsToArea: { passed: boolean; expected: string; actual: string; };
    neighborhoodValid: { passed: boolean; expected: string; actual: string; };
    dataCompleteness: { passed: boolean; expected: string; actual: string; };
  };
  marketComparison: {
    priceVsMarket: 'below' | 'typical' | 'above' | 'extreme';
    areaVsMarket: 'small' | 'typical' | 'large' | 'extreme';
    suggestion: string;
  };
}

/**
 * Enhanced Reality Check Service
 * Performs detailed validation without requiring AI
 */
export class RealityCheckService {

  /**
   * Perform comprehensive reality check on property data
   * Works without AI - uses market data and rules
   */
  performDetailedCheck(data: PropertyData): DetailedRealityCheckResult {
    const checks = {
      priceRange: this.checkPriceRange(data),
      pricePerSqm: this.checkPricePerSqm(data),
      areaSize: this.checkAreaSize(data),
      roomsToArea: this.checkRoomsToArea(data),
      neighborhoodValid: this.checkNeighborhood(data),
      dataCompleteness: this.checkDataCompleteness(data)
    };

    const warnings: string[] = [];
    const passedChecks = Object.values(checks).filter(c => c.passed).length;
    const totalChecks = Object.values(checks).length;

    // Collect warnings
    Object.entries(checks).forEach(([key, check]) => {
      if (!check.passed) {
        warnings.push(`${key}: Expected ${check.expected}, got ${check.actual}`);
      }
    });

    // Calculate score
    const baseScore = (passedChecks / totalChecks) * 100;
    const score = Math.round(baseScore);

    // Market comparison
    const marketComparison = this.compareToMarket(data);

    return {
      passed: score >= 70, // Pass if at least 70% of checks pass
      score,
      checks: {
        priceRealistic: checks.priceRange.passed && checks.pricePerSqm.passed,
        areaRealistic: checks.areaSize.passed,
        locationValid: checks.neighborhoodValid.passed,
        dataComplete: checks.dataCompleteness.passed
      },
      warnings,
      details: this.generateDetailedReport(checks, marketComparison),
      detailedChecks: checks,
      marketComparison
    };
  }

  /**
   * Check if price is in realistic range for Sofia
   */
  private checkPriceRange(data: PropertyData): { passed: boolean; expected: string; actual: string } {
    if (!data.price) {
      return {
        passed: false,
        expected: 'Price should be provided',
        actual: 'No price'
      };
    }

    // Determine expected range based on rooms or area
    let expectedRange = { min: 400, max: 3000 };

    if (data.rooms) {
      if (data.rooms === 1) {
        expectedRange = SOFIA_MARKET_DATA.rentalPrices.studio;
      } else if (data.rooms === 2) {
        expectedRange = SOFIA_MARKET_DATA.rentalPrices.oneBedroom;
      } else if (data.rooms === 3) {
        expectedRange = SOFIA_MARKET_DATA.rentalPrices.twoBedroom;
      } else if (data.rooms === 4) {
        expectedRange = SOFIA_MARKET_DATA.rentalPrices.threeBedroom;
      } else if (data.rooms >= 5) {
        expectedRange = SOFIA_MARKET_DATA.rentalPrices.fourPlusRooms;
      }
    } else if (data.area) {
      // Estimate based on area
      if (data.area < 45) expectedRange = SOFIA_MARKET_DATA.rentalPrices.studio;
      else if (data.area < 70) expectedRange = SOFIA_MARKET_DATA.rentalPrices.oneBedroom;
      else if (data.area < 100) expectedRange = SOFIA_MARKET_DATA.rentalPrices.twoBedroom;
      else if (data.area < 140) expectedRange = SOFIA_MARKET_DATA.rentalPrices.threeBedroom;
      else expectedRange = SOFIA_MARKET_DATA.rentalPrices.fourPlusRooms;
    }

    const isPriceInRange = data.price >= expectedRange.min * 0.7 && data.price <= expectedRange.max * 1.5;

    return {
      passed: isPriceInRange,
      expected: `€${expectedRange.min}-€${expectedRange.max}`,
      actual: `€${data.price}`
    };
  }

  /**
   * Check price per square meter
   */
  private checkPricePerSqm(data: PropertyData): { passed: boolean; expected: string; actual: string } {
    if (!data.price || !data.area) {
      return {
        passed: data.price !== undefined, // Pass if only price is missing area
        expected: 'Both price and area needed for validation',
        actual: `Price: ${data.price || 'N/A'}, Area: ${data.area || 'N/A'}`
      };
    }

    const pricePerSqm = data.price / data.area;
    const { min, max } = SOFIA_MARKET_DATA.pricePerSqm;

    // Allow 20% variance
    const isPricePerSqmValid = pricePerSqm >= min * 0.8 && pricePerSqm <= max * 1.2;

    return {
      passed: isPricePerSqmValid,
      expected: `€${min}-€${max}/m²`,
      actual: `€${pricePerSqm.toFixed(2)}/m²`
    };
  }

  /**
   * Check if area is realistic
   */
  private checkAreaSize(data: PropertyData): { passed: boolean; expected: string; actual: string } {
    if (!data.area) {
      return {
        passed: false,
        expected: 'Area should be provided',
        actual: 'No area'
      };
    }

    // General range: 25-250 m² for residential
    const isAreaValid = data.area >= 25 && data.area <= 250;

    return {
      passed: isAreaValid,
      expected: '25-250 m²',
      actual: `${data.area} m²`
    };
  }

  /**
   * Check if rooms count matches area
   */
  private checkRoomsToArea(data: PropertyData): { passed: boolean; expected: string; actual: string } {
    if (!data.rooms || !data.area) {
      return {
        passed: true, // Skip check if data missing
        expected: 'Both rooms and area needed',
        actual: `Rooms: ${data.rooms || 'N/A'}, Area: ${data.area || 'N/A'}`
      };
    }

    // Rough estimates: 1 room = 30-45m², 2 rooms = 50-80m², etc.
    const minArea = data.rooms * 25;
    const maxArea = data.rooms * 70;

    const isRoomsToAreaValid = data.area >= minArea && data.area <= maxArea;

    return {
      passed: isRoomsToAreaValid,
      expected: `${minArea}-${maxArea} m² for ${data.rooms} rooms`,
      actual: `${data.area} m²`
    };
  }

  /**
   * Check if neighborhood/location is known in Sofia
   */
  private checkNeighborhood(data: PropertyData): { passed: boolean; expected: string; actual: string } {
    const location = (data.city + ' ' + (data.quarter || '')).toLowerCase();

    // Check if Sofia is mentioned
    const isSofia = location.includes('sofia') || location.includes('софия');

    // Check if known neighborhood is mentioned
    const hasKnownNeighborhood = SOFIA_MARKET_DATA.neighborhoods.some(neighborhood =>
      location.includes(neighborhood.toLowerCase())
    );

    const isValid = isSofia || hasKnownNeighborhood;

    return {
      passed: isValid,
      expected: 'Sofia or known Sofia neighborhood',
      actual: data.city + (data.quarter ? `, ${data.quarter}` : '')
    };
  }

  /**
   * Check data completeness
   */
  private checkDataCompleteness(data: PropertyData): { passed: boolean; expected: string; actual: string } {
    const requiredFields = ['title', 'price', 'city'];
    const recommendedFields = ['area', 'rooms', 'quarter'];

    const missingRequired = requiredFields.filter(field => !data[field as keyof PropertyData]);
    const missingRecommended = recommendedFields.filter(field => !data[field as keyof PropertyData]);

    const completenessScore = (
      (requiredFields.length - missingRequired.length) * 2 +
      (recommendedFields.length - missingRecommended.length)
    ) / (requiredFields.length * 2 + recommendedFields.length);

    return {
      passed: completenessScore >= 0.7, // 70% complete
      expected: 'Required: title, price, city. Recommended: area, rooms, quarter',
      actual: `Missing required: [${missingRequired.join(', ') || 'none'}], Missing recommended: [${missingRecommended.join(', ') || 'none'}]`
    };
  }

  /**
   * Compare property to market averages
   */
  private compareToMarket(data: PropertyData): {
    priceVsMarket: 'below' | 'typical' | 'above' | 'extreme';
    areaVsMarket: 'small' | 'typical' | 'large' | 'extreme';
    suggestion: string;
  } {
    let priceVsMarket: 'below' | 'typical' | 'above' | 'extreme' = 'typical';
    let areaVsMarket: 'small' | 'typical' | 'large' | 'extreme' = 'typical';
    let suggestion = '';

    // Price comparison
    if (data.price && data.area) {
      const pricePerSqm = data.price / data.area;
      const typicalMin = SOFIA_MARKET_DATA.pricePerSqm.typical.min;
      const typicalMax = SOFIA_MARKET_DATA.pricePerSqm.typical.max;

      if (pricePerSqm < typicalMin * 0.7) {
        priceVsMarket = 'below';
        suggestion = 'Price significantly below market - verify if this is accurate or a great deal!';
      } else if (pricePerSqm < typicalMin) {
        priceVsMarket = 'below';
        suggestion = 'Price below market average - could be a good deal.';
      } else if (pricePerSqm > typicalMax * 1.5) {
        priceVsMarket = 'extreme';
        suggestion = 'Price significantly above market - premium location or verify accuracy.';
      } else if (pricePerSqm > typicalMax) {
        priceVsMarket = 'above';
        suggestion = 'Price above market average - premium property or location.';
      } else {
        suggestion = 'Price is within typical market range.';
      }
    }

    // Area comparison
    if (data.area) {
      if (data.area < 40) {
        areaVsMarket = 'small';
      } else if (data.area > 120) {
        areaVsMarket = 'large';
      } else if (data.area > 200) {
        areaVsMarket = 'extreme';
      }
    }

    return { priceVsMarket, areaVsMarket, suggestion };
  }

  /**
   * Generate detailed report
   */
  private generateDetailedReport(
    checks: Record<string, { passed: boolean; expected: string; actual: string }>,
    marketComparison: any
  ): string {
    const failedChecks = Object.entries(checks)
      .filter(([_, check]) => !check.passed)
      .map(([name, check]) => `${name}: ${check.actual} (expected: ${check.expected})`);

    let report = '';

    if (failedChecks.length === 0) {
      report = 'All reality checks passed. Data appears realistic for Sofia market.';
    } else {
      report = `Failed checks: ${failedChecks.join('; ')}. `;
    }

    report += ` ${marketComparison.suggestion}`;

    return report;
  }

  /**
   * Quick validation (simplified check)
   */
  quickValidation(data: PropertyData): boolean {
    if (!data.price || !data.city) return false;

    // Basic sanity checks
    if (data.price < 100 || data.price > 10000) return false;
    if (data.area && (data.area < 10 || data.area > 500)) return false;
    if (data.rooms && (data.rooms < 1 || data.rooms > 10)) return false;

    const location = (data.city + ' ' + (data.quarter || '')).toLowerCase();
    const isSofia = location.includes('sofia') || location.includes('софия');

    return isSofia;
  }
}

export const realityCheckService = new RealityCheckService();
