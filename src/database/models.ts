import { v4 as uuidv4 } from 'uuid';

// Database model interfaces matching the schema
export interface PropertyRecord {
  id: string;
  external_id: string;
  source_id: string;
  title: string;
  description?: string;
  url: string;
  scraped_at: Date;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface PropertyPricingRecord {
  id: string;
  property_id: string;
  current_price: number;
  currency: string;
  price_per_sqm?: number;
  old_price?: number;
  special_price?: number;
  has_request_price: boolean;
  has_vat_included: boolean;
  created_at: Date;
}

export interface PropertyDetailsRecord {
  id: string;
  property_id: string;
  area?: number;
  build_area?: number;
  plot_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  rooms?: number;
  floor?: number;
  total_floors?: number;
  apartment?: string;
  property_type?: string;
  property_kind?: string;
  transaction_type: 'rent' | 'sale';
  is_new_building: boolean;
  building_year?: number;
  construction_type?: string;
  has_elevator: boolean;
  has_parking_space: boolean;
  has_basement: boolean;
  basement_area?: number;
  has_attic: boolean;
  attic_area?: number;
  ceiling_height?: number;
  heating?: string;
  has_water: boolean;
  has_electricity: boolean;
  furnishing_type?: string;
  condition_rating?: string;
  created_at: Date;
}

export interface PropertyLocationRecord {
  id: string;
  property_id: string;
  country: string;
  region?: string;
  municipality?: string;
  city?: string;
  quarter?: string;
  street?: string;
  street_number?: string;
  block?: string;
  entrance?: string;
  latitude?: number;
  longitude?: number;
  coordinates_verified: boolean;
  full_address?: string;
  created_at: Date;
}

export interface PropertyMediaRecord {
  id: string;
  property_id: string;
  media_type: 'image' | 'video' | 'virtual_tour' | 'brochure' | 'floor_plan';
  url: string;
  thumbnail_url?: string;
  caption?: string;
  display_order: number;
  youtube_id?: string;
  tour_type?: string;
  created_at: Date;
}

export interface PropertyAgencyRecord {
  id: string;
  property_id: string;
  user_id?: string;
  office_id?: string;
  agency_id?: string;
  is_exclusive: boolean;
  manages_estate: boolean;
  created_at: Date;
}

export interface PropertyStatusRecord {
  id: string;
  property_id: string;
  is_active: boolean;
  is_visible: boolean;
  state?: number;
  completion?: string;
  is_confidential: boolean;
  is_top_offer: boolean;
  is_vip_offer: boolean;
  immunity_until?: Date;
  labels: string[];
  is_for_investment: boolean;
  is_selection: boolean;
  is_catalogue: boolean;
  export_to_imot_bg: boolean;
  created_at: Date;
}

export interface PriceHistoryRecord {
  id: string;
  property_id: string;
  old_price?: number;
  new_price: number;
  currency: string;
  change_type: 'increase' | 'decrease' | 'initial';
  change_amount?: number;
  change_percentage?: number;
  changed_at: Date;
}

export interface PropertyChangeRecord {
  id: string;
  property_id: string;
  change_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  changed_at: Date;
}

export interface ScrapingSessionRecord {
  id: string;
  session_type: string;
  search_url?: string;
  filters?: any;
  started_at: Date;
  completed_at?: Date;
  status: 'running' | 'completed' | 'failed';
  total_pages?: number;
  pages_processed?: number;
  properties_found?: number;
  properties_new?: number;
  properties_updated?: number;
  properties_removed?: number;
  api_calls_used?: number;
  errors_count?: number;
  warnings_count?: number;
  time_elapsed_ms?: number;
  average_per_page_ms?: number;
  data_quality_score?: number;
  errors?: string[];
  warnings?: string[];
  metadata?: any;
}

// Utility functions for creating new records
export function createPropertyRecord(data: Partial<PropertyRecord>): PropertyRecord {
  const now = new Date();
  return {
    id: uuidv4(),
    external_id: data.external_id || '',
    source_id: data.source_id || 'ues_bg',
    title: data.title || '',
    description: data.description,
    url: data.url || '',
    scraped_at: data.scraped_at || now,
    created_at: now,
    updated_at: now,
    is_active: data.is_active !== undefined ? data.is_active : true,
    ...data
  };
}

export function createScrapingSessionRecord(data: Partial<ScrapingSessionRecord>): ScrapingSessionRecord {
  return {
    id: uuidv4(),
    session_type: data.session_type || 'full_scan',
    search_url: data.search_url,
    filters: data.filters,
    started_at: new Date(),
    status: 'running',
    ...data
  };
}