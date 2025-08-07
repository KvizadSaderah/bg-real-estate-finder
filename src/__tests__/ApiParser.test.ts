import { ApiParser } from '../parser/ApiParser';
import { SiteConfig } from '../types';
import axios from 'axios';
import mockResponse from './mock-response.json';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiParser', () => {
  const config: SiteConfig = {
    id: 'test',
    name: 'Test Site',
    baseUrl: 'https://example.com',
    type: 'static',
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
      type: 'none'
    },
    rateLimit: {
      requestsPerMinute: 60,
      delayBetweenPages: 1000
    }
  };

  it('should be defined', () => {
    expect(new ApiParser(config)).toBeDefined();
  });

  it('should parse a mock response', async () => {
    mockedAxios.get.mockResolvedValue({ data: mockResponse });
    const parser = new ApiParser(config);
    const result = await parser.parseAllPages('https://example.com');
    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(1);
    expect(result.listings[0].title).toBe('Test Property');
  });
});