// Расширенные типы для максимального извлечения данных
export interface ComprehensivePropertyListing {
  // Базовая информация
  id: string;
  externalId: string;
  sourceId: string;
  title: string;
  description?: string;
  url: string;
  scrapedAt: Date;
  
  // Детальная ценовая информация
  pricing: {
    currentPrice: number;
    currency: string;
    pricePerSqm?: number;
    oldPrice?: number;
    specialPrice?: number;
    hasRequestPrice: boolean;
    hasVATIncluded: boolean;
    priceHistory?: PriceHistoryEntry[];
  };
  
  // Полные характеристики недвижимости
  propertyDetails: {
    // Основные характеристики
    area: number; // общая площадь
    buildArea?: number; // застроенная площадь
    plotArea?: number; // площадь участка
    
    // Комнаты и планировка
    bedrooms?: number;
    bathrooms?: number;
    rooms?: number;
    
    // Этажность
    floor?: number;
    totalFloors?: number;
    apartment?: string;
    
    // Тип и состояние
    propertyType: string;
    propertyKind: string; // жилищен/търговски
    transactionType: 'rent' | 'sale';
    isNewBuilding: boolean;
    buildingYear?: number;
    constructionType?: string;
    
    // Удобства и особенности
    hasElevator: boolean;
    hasParkingSpace: boolean;
    hasBasement: boolean;
    basementArea?: number;
    hasAttic: boolean;
    atticArea?: number;
    ceilingHeight?: number;
    
    // Коммуникации
    heating?: string;
    hasWater: boolean;
    hasElectricity: boolean;
    
    // Мебель и состояние
    furnishingType?: string;
    condition?: string;
  };
  
  // Точная локация
  location: {
    // Административное деление
    country: string;
    region: string;
    municipality: string;
    city: string;
    quarter?: string;
    
    // Адрес
    street?: string;
    streetNumber?: string;
    block?: string;
    entrance?: string;
    
    // Координаты
    coordinates?: {
      latitude: number;
      longitude: number;
      verified: boolean;
    };
    
    // Полный адрес
    fullAddress: string;
  };
  
  // Медиа контент
  media: {
    featuredImage?: string;
    images: PropertyImage[];
    videos: PropertyVideo[];
    virtualTours: VirtualTour[];
    brochures: string[];
    floorPlans: string[];
    hasMedia: {
      images: boolean;
      videos: boolean;
      virtualTours: boolean;
      brochures: boolean;
      floorPlans: boolean;
    };
  };
  
  // Агентство и контакты
  agency: {
    userId: string;
    officeId: string;
    agencyId?: string;
    isExclusive: boolean;
    managersEstate: boolean;
  };
  
  // Статус и метаданные
  status: {
    isActive: boolean;
    isVisible: boolean;
    state: number;
    completion: string;
    isConfidential: boolean;
    isTopOffer: boolean;
    isVIPOffer: boolean;
    immunity?: Date;
  };
  
  // Лейблы и маркетинг
  marketing: {
    labels: string[]; // new-listing, exclusive-offer, etc.
    isForInvestment: boolean;
    isSelection: boolean;
    isCatalogue: boolean;
    exportToImotBG: boolean;
  };
  
  // Временные метки
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date;
    lastPriceChange?: Date;
    createdBy: string;
    updatedBy: string;
  };
  
  // Дополнительные данные
  additional: {
    sourceDescription?: string;
    ownerType?: string;
    referenceType: string;
    cadastralNumber?: string;
    deed?: string;
  };
}

export interface PropertyImage {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  order: number;
}

export interface PropertyVideo {
  url?: string;
  youtubeId?: string;
  thumbnailUrl?: string;
  title?: string;
}

export interface VirtualTour {
  url: string;
  type: string;
  title?: string;
}

export interface PriceHistoryEntry {
  price: number;
  currency: string;
  date: Date;
  changeType: 'increase' | 'decrease' | 'initial';
}

export interface ComprehensiveParseResult {
  success: boolean;
  totalListings: number;
  processedListings: number;
  listings: ComprehensivePropertyListing[];
  errors: string[];
  warnings: string[];
  statistics: {
    pagesProcessed: number;
    totalPages: number;
    timeElapsed: number;
    averagePerPage: number;
    apiCallsUsed: number;
    dataQualityScore: number; // процент заполненности полей
  };
  metadata: {
    searchUrl: string;
    filters: any;
    scrapedAt: Date;
    apiVersion: string;
    dataSource: string;
  };
}