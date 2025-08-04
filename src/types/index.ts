export interface PropertyListing {
  id: string;
  title: string;
  price: {
    amount: number;
    currency: string;
    original: string;
  };
  location: {
    city: string;
    district?: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  details: {
    area?: number;
    rooms?: number;
    bathrooms?: number;
    floor?: number;
    maxFloors?: number;
    propertyType: 'apartment' | 'house' | 'office' | 'commercial' | 'land';
    transactionType: 'sale' | 'rent';
  };
  features: string[];
  images: string[];
  description?: string;
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  url: string;
  sourceId: string;
  externalId: string;
  scrapedAt: Date;
}

export interface SiteConfig {
  id: string;
  name: string;
  baseUrl: string;
  type: 'spa' | 'static' | 'hybrid';
  selectors: {
    listingContainer: string;
    listingCard: string;
    title: string;
    price: string;
    location: string;
    area?: string;
    rooms?: string;
    link: string;
    image?: string;
  };
  pagination: {
    type: 'infinite_scroll' | 'next_button' | 'page_numbers' | 'load_more' | 'none';
    selector?: string;
    maxPages?: number;
  };
  filters?: {
    city?: {
      urlPattern: string;
      values: string[];
    };
    propertyType?: {
      urlPattern: string;
      values: string[];
    };
  };
  apiEndpoints?: string[];
  rateLimit: {
    requestsPerMinute: number;
    delayBetweenPages: number;
  };
}

export interface AnalysisResult {
  siteType: 'spa' | 'static' | 'hybrid';
  hasListings: boolean;
  potentialSelectors: {
    containers: SelectorCandidate[];
    cards: SelectorCandidate[];
    titles: SelectorCandidate[];
    prices: SelectorCandidate[];
  };
  pagination: {
    type: string;
    selectors: string[];
  };
  apiEndpoints: APIEndpoint[];
  suggestedConfig: Partial<SiteConfig>;
}

export interface SelectorCandidate {
  selector: string;
  confidence: number;
  count: number;
  sample?: string;
}

export interface APIEndpoint {
  url: string;
  method: string;
  responseType: string;
  isListings: boolean;
}

export interface ParseResult {
  success: boolean;
  listings: PropertyListing[];
  totalFound: number;
  errors: string[];
  config: SiteConfig;
  statistics: {
    pagesProcessed: number;
    timeElapsed: number;
    averagePerPage: number;
  };
}