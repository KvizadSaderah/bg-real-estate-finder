export interface RentalFilters {
  // Location filters
  city?: string;
  district?: string;
  
  // Property type filters
  propertyType?: 'apartment' | 'house' | 'office' | 'studio' | 'room' | 'apartament' | 'kashta' | 'ofis' | 'staya' | 'all';
  
  // Price filters
  priceMin?: number;
  priceMax?: number;
  
  // Size filters
  areaMin?: number;
  areaMax?: number;
  
  // Room filters
  rooms?: number | 'all';
  
  // Feature filters
  furnished?: boolean;
  parking?: boolean;
  balcony?: boolean;
  airConditioning?: boolean;
  
  // Additional filters
  floorMin?: number;
  floorMax?: number;
  newBuilding?: boolean;
  
  // Sorting
  sortBy?: 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc' | 'date_desc';
  
  // Pagination
  page?: number;
  limit?: number;
}

export interface UESBGFilters extends RentalFilters {
  // UES.bg specific cities
  city?: 'sofia' | 'plovdiv' | 'varna' | 'burgas' | 'stara-zagora' | 'pleven' | 'all';
  
  // UES.bg property types in Bulgarian
  propertyType?: 'apartament' | 'kashta' | 'ofis' | 'studio' | 'staya' | 'all';
}

export class FilterBuilder {
  private filters: RentalFilters = {};
  
  city(city: string): FilterBuilder {
    this.filters.city = city;
    return this;
  }
  
  propertyType(type: RentalFilters['propertyType']): FilterBuilder {
    this.filters.propertyType = type;
    return this;
  }
  
  priceRange(min?: number, max?: number): FilterBuilder {
    if (min) this.filters.priceMin = min;
    if (max) this.filters.priceMax = max;
    return this;
  }
  
  areaRange(min?: number, max?: number): FilterBuilder {
    if (min) this.filters.areaMin = min;
    if (max) this.filters.areaMax = max;
    return this;
  }
  
  rooms(count: number | 'all'): FilterBuilder {
    this.filters.rooms = count;
    return this;
  }
  
  furnished(value: boolean = true): FilterBuilder {
    this.filters.furnished = value;
    return this;
  }
  
  sortBy(sort: RentalFilters['sortBy']): FilterBuilder {
    this.filters.sortBy = sort;
    return this;
  }
  
  build(): RentalFilters {
    return { ...this.filters };
  }
}

export function buildUESBGUrl(baseUrl: string, filters: UESBGFilters): string {
  let url = baseUrl;
  
  // Base rental URL
  url += '/bg/bgr/imoti/pod-naem';
  
  // City filter
  if (filters.city && filters.city !== 'all') {
    url += `/${filters.city}`;
  } else {
    url += '/all';
  }
  
  // Property type filter
  if (filters.propertyType && filters.propertyType !== 'all') {
    url += `/${filters.propertyType}`;
  } else {
    url += '/all';
  }
  
  // Add query parameters for other filters
  const params = new URLSearchParams();
  
  if (filters.priceMin) params.append('price_min', filters.priceMin.toString());
  if (filters.priceMax) params.append('price_max', filters.priceMax.toString());
  if (filters.areaMin) params.append('area_min', filters.areaMin.toString());
  if (filters.areaMax) params.append('area_max', filters.areaMax.toString());
  if (filters.rooms && filters.rooms !== 'all') params.append('rooms', filters.rooms.toString());
  if (filters.furnished !== undefined) params.append('furnished', filters.furnished.toString());
  if (filters.page) params.append('page', filters.page.toString());
  
  if (params.toString()) {
    url += '?' + params.toString();
  }
  
  return url;
}