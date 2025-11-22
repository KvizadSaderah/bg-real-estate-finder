import axios from 'axios';

export interface AIProvider {
  name: 'gemini' | 'openai';
  apiKey: string;
  model?: string;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-100
  issues: string[];
  suggestions: string[];
  reasoning: string;
}

export interface RealityCheckResult {
  passed: boolean;
  score: number; // 0-100
  checks: {
    priceRealistic: boolean;
    areaRealistic: boolean;
    locationValid: boolean;
    dataComplete: boolean;
  };
  warnings: string[];
  details: string;
}

export interface PropertyData {
  title?: string;
  price?: number;
  area?: number;
  rooms?: number;
  city?: string;
  quarter?: string;
  description?: string;
  propertyType?: string;
}

/**
 * AI-powered validation service for real estate data
 * Supports Google Gemini and OpenAI GPT models
 */
export class AIValidationService {
  private provider: AIProvider;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  /**
   * Validate scraped property data using AI
   */
  async validatePropertyData(
    data: PropertyData,
    siteUrl: string
  ): Promise<ValidationResult> {
    const prompt = `You are a real estate data validation expert. Analyze the following property data scraped from ${siteUrl}:

Title: ${data.title || 'N/A'}
Price: ${data.price ? `€${data.price}` : 'N/A'}
Area: ${data.area ? `${data.area} m²` : 'N/A'}
Rooms: ${data.rooms || 'N/A'}
City: ${data.city || 'N/A'}
Quarter: ${data.quarter || 'N/A'}
Property Type: ${data.propertyType || 'N/A'}
Description: ${data.description ? data.description.substring(0, 200) : 'N/A'}

Validate this data and respond in JSON format:
{
  "isValid": boolean,
  "confidence": number (0-100),
  "issues": ["list of issues found"],
  "suggestions": ["list of improvements"],
  "reasoning": "explanation of your assessment"
}

Check for:
1. Data completeness (are required fields present?)
2. Data consistency (do fields make sense together?)
3. Realistic values (price, area, rooms for Sofia, Bulgaria)
4. Proper formatting (title, description quality)`;

    try {
      const response = await this.callAI(prompt);
      return this.parseValidationResponse(response);
    } catch (error) {
      console.error('AI validation error:', error);
      return {
        isValid: false,
        confidence: 0,
        issues: [`AI validation failed: ${error}`],
        suggestions: ['Manual review required'],
        reasoning: 'AI service unavailable'
      };
    }
  }

  /**
   * Perform reality check on property data
   * Validates if data makes sense for Sofia real estate market
   */
  async realityCheck(data: PropertyData): Promise<RealityCheckResult> {
    const prompt = `You are an expert on the Sofia, Bulgaria real estate market. Perform a reality check on this property:

Price: €${data.price || 0}
Area: ${data.area || 0} m²
Rooms: ${data.rooms || 0}
City: ${data.city || 'Unknown'}
Quarter: ${data.quarter || 'Unknown'}
Property Type: ${data.propertyType || 'Unknown'}

Assess if this data is realistic for Sofia's real estate market. Respond in JSON:
{
  "passed": boolean,
  "score": number (0-100, where 100 is perfectly realistic),
  "checks": {
    "priceRealistic": boolean,
    "areaRealistic": boolean,
    "locationValid": boolean,
    "dataComplete": boolean
  },
  "warnings": ["list of warnings"],
  "details": "detailed explanation"
}

Sofia market context:
- Typical rental prices: €400-€3000/month
- Typical areas: 30-250 m²
- Known neighborhoods: Center, Lozenets, Mladost, Studentski grad, etc.
- Price per m²: typically €5-20 for rentals`;

    try {
      const response = await this.callAI(prompt);
      return this.parseRealityCheckResponse(response);
    } catch (error) {
      console.error('Reality check error:', error);
      return {
        passed: false,
        score: 0,
        checks: {
          priceRealistic: false,
          areaRealistic: false,
          locationValid: false,
          dataComplete: false
        },
        warnings: [`Reality check failed: ${error}`],
        details: 'AI service unavailable'
      };
    }
  }

  /**
   * Validate selector configuration quality
   */
  async validateSelectors(
    selectors: any,
    sampleData: any[],
    siteUrl: string
  ): Promise<ValidationResult> {
    const prompt = `You are an expert in web scraping and CSS selectors. Evaluate the quality of these CSS selectors for scraping ${siteUrl}:

Selectors:
${JSON.stringify(selectors, null, 2)}

Sample data extracted:
${JSON.stringify(sampleData.slice(0, 2), null, 2)}

Assess the selector configuration quality. Respond in JSON:
{
  "isValid": boolean,
  "confidence": number (0-100),
  "issues": ["list of potential issues"],
  "suggestions": ["list of improvements"],
  "reasoning": "detailed assessment"
}

Evaluate:
1. Selector specificity (too broad? too narrow?)
2. Reliability (likely to break with minor HTML changes?)
3. Coverage (capturing all necessary data?)
4. Accuracy (extracting correct data?)`;

    try {
      const response = await this.callAI(prompt);
      return this.parseValidationResponse(response);
    } catch (error) {
      console.error('Selector validation error:', error);
      return {
        isValid: true, // Default to valid if AI fails
        confidence: 50,
        issues: ['AI validation unavailable'],
        suggestions: ['Manual review recommended'],
        reasoning: 'AI service error - default validation applied'
      };
    }
  }

  /**
   * Suggest improvements for parser configuration
   */
  async suggestImprovements(
    config: any,
    validationResults: ValidationResult[]
  ): Promise<string[]> {
    const prompt = `Based on the following parser configuration and validation results, suggest specific improvements:

Current Configuration:
${JSON.stringify(config, null, 2)}

Validation Results:
${JSON.stringify(validationResults, null, 2)}

Provide 3-5 specific, actionable suggestions to improve the parser configuration.
Respond with a JSON array of strings: ["suggestion 1", "suggestion 2", ...]`;

    try {
      const response = await this.callAI(prompt);
      const cleaned = this.cleanJSONResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Improvement suggestion error:', error);
      return [
        'Review selectors for better specificity',
        'Add fallback selectors for critical fields',
        'Validate data extraction with more test cases'
      ];
    }
  }

  /**
   * Call AI provider (Gemini or OpenAI)
   */
  private async callAI(prompt: string): Promise<string> {
    // Rate limiting
    await this.rateLimit();

    if (this.provider.name === 'gemini') {
      return await this.callGemini(prompt);
    } else if (this.provider.name === 'openai') {
      return await this.callOpenAI(prompt);
    }

    throw new Error(`Unsupported AI provider: ${this.provider.name}`);
  }

  /**
   * Call Google Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    const model = this.provider.model || 'gemini-pro';
    const apiKey = this.provider.apiKey;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Invalid Gemini API response');
    }

    return text;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const model = this.provider.model || 'gpt-4o-mini';
    const apiKey = this.provider.apiKey;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in web scraping, real estate data validation, and the Sofia, Bulgaria property market. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent responses
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Invalid OpenAI API response');
    }

    return text;
  }

  /**
   * Parse validation response from AI
   */
  private parseValidationResponse(response: string): ValidationResult {
    try {
      const cleaned = this.cleanJSONResponse(response);
      const parsed = JSON.parse(cleaned);

      return {
        isValid: parsed.isValid ?? true,
        confidence: parsed.confidence ?? 50,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        reasoning: parsed.reasoning ?? 'No reasoning provided'
      };
    } catch (error) {
      console.error('Failed to parse validation response:', error);
      return {
        isValid: true,
        confidence: 50,
        issues: ['Failed to parse AI response'],
        suggestions: [],
        reasoning: 'Parse error'
      };
    }
  }

  /**
   * Parse reality check response from AI
   */
  private parseRealityCheckResponse(response: string): RealityCheckResult {
    try {
      const cleaned = this.cleanJSONResponse(response);
      const parsed = JSON.parse(cleaned);

      return {
        passed: parsed.passed ?? false,
        score: parsed.score ?? 0,
        checks: {
          priceRealistic: parsed.checks?.priceRealistic ?? false,
          areaRealistic: parsed.checks?.areaRealistic ?? false,
          locationValid: parsed.checks?.locationValid ?? false,
          dataComplete: parsed.checks?.dataComplete ?? false
        },
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        details: parsed.details ?? 'No details provided'
      };
    } catch (error) {
      console.error('Failed to parse reality check response:', error);
      return {
        passed: false,
        score: 0,
        checks: {
          priceRealistic: false,
          areaRealistic: false,
          locationValid: false,
          dataComplete: false
        },
        warnings: ['Failed to parse AI response'],
        details: 'Parse error'
      };
    }
  }

  /**
   * Clean JSON response (remove markdown code blocks if present)
   */
  private cleanJSONResponse(response: string): string {
    let cleaned = response.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return cleaned.trim();
  }

  /**
   * Simple rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Minimum 1 second between requests
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): { requestCount: number; provider: string; model: string } {
    return {
      requestCount: this.requestCount,
      provider: this.provider.name,
      model: this.provider.model || 'default'
    };
  }
}

/**
 * Create AI validation service from environment variables
 */
export function createAIServiceFromEnv(): AIValidationService | null {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const preferredProvider = process.env.AI_PROVIDER as 'gemini' | 'openai' || 'gemini';

  if (preferredProvider === 'gemini' && geminiKey) {
    return new AIValidationService({
      name: 'gemini',
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-pro'
    });
  }

  if (preferredProvider === 'openai' && openaiKey) {
    return new AIValidationService({
      name: 'openai',
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    });
  }

  // Fallback to any available key
  if (geminiKey) {
    return new AIValidationService({
      name: 'gemini',
      apiKey: geminiKey,
      model: 'gemini-pro'
    });
  }

  if (openaiKey) {
    return new AIValidationService({
      name: 'openai',
      apiKey: openaiKey,
      model: 'gpt-4o-mini'
    });
  }

  return null; // No AI provider available
}
