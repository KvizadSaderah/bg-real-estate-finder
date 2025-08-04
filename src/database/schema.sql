-- Real Estate Database Schema for UES.bg Property Tracking
-- Created: 2025-08-04

-- Properties table - main entity
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(50) NOT NULL, -- UES.bg property ID
    source_id VARCHAR(50) NOT NULL DEFAULT 'ues_bg',
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Unique constraint for external property tracking
    CONSTRAINT unique_external_property UNIQUE(external_id, source_id)
);

-- Property pricing information
CREATE TABLE property_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    current_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    price_per_sqm DECIMAL(8,2),
    old_price DECIMAL(12,2),
    special_price DECIMAL(12,2),
    has_request_price BOOLEAN DEFAULT false,
    has_vat_included BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Property details and characteristics
CREATE TABLE property_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Area information
    area DECIMAL(8,2), -- total area in sqm
    build_area DECIMAL(8,2), -- built area
    plot_area DECIMAL(8,2), -- plot area
    
    -- Room configuration
    bedrooms INTEGER,
    bathrooms INTEGER,
    rooms INTEGER,
    
    -- Floor information
    floor INTEGER,
    total_floors INTEGER,
    apartment VARCHAR(10),
    
    -- Property type and characteristics
    property_type VARCHAR(100),
    property_kind VARCHAR(100),
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('rent', 'sale')),
    is_new_building BOOLEAN DEFAULT false,
    building_year INTEGER,
    construction_type VARCHAR(50),
    
    -- Amenities
    has_elevator BOOLEAN DEFAULT false,
    has_parking_space BOOLEAN DEFAULT false,
    has_basement BOOLEAN DEFAULT false,
    basement_area DECIMAL(8,2),
    has_attic BOOLEAN DEFAULT false,
    attic_area DECIMAL(8,2),
    ceiling_height DECIMAL(6,2),
    
    -- Utilities
    heating VARCHAR(100),
    has_water BOOLEAN DEFAULT false,
    has_electricity BOOLEAN DEFAULT false,
    
    -- Condition and furnishing
    furnishing_type VARCHAR(100),
    condition_rating VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_property_details UNIQUE(property_id)
);

-- Property location information
CREATE TABLE property_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Administrative division
    country VARCHAR(100) NOT NULL DEFAULT 'България',
    region VARCHAR(100),
    municipality VARCHAR(100),
    city VARCHAR(100),
    quarter VARCHAR(100),
    
    -- Address details
    street VARCHAR(200),
    street_number VARCHAR(20),
    block VARCHAR(50),
    entrance VARCHAR(10),
    
    -- Coordinates
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    coordinates_verified BOOLEAN DEFAULT false,
    
    -- Full address
    full_address TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_property_location UNIQUE(property_id)
);

-- Property media (images, videos, etc.)
CREATE TABLE property_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video', 'virtual_tour', 'brochure', 'floor_plan')),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    
    -- Video specific fields
    youtube_id VARCHAR(50),
    
    -- Virtual tour specific fields
    tour_type VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Property agency and contact information
CREATE TABLE property_agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id VARCHAR(50),
    office_id VARCHAR(50),
    agency_id VARCHAR(50),
    is_exclusive BOOLEAN DEFAULT false,
    manages_estate BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_property_agency UNIQUE(property_id)
);

-- Property status and marketing information
CREATE TABLE property_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true,
    state INTEGER,
    completion VARCHAR(100),
    is_confidential BOOLEAN DEFAULT false,
    is_top_offer BOOLEAN DEFAULT false,
    is_vip_offer BOOLEAN DEFAULT false,
    immunity_until TIMESTAMP WITH TIME ZONE,
    
    -- Marketing flags
    labels TEXT[], -- array of marketing labels
    is_for_investment BOOLEAN DEFAULT false,
    is_selection BOOLEAN DEFAULT false,
    is_catalogue BOOLEAN DEFAULT false,
    export_to_imot_bg BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_property_status UNIQUE(property_id)
);

-- Price history for tracking changes
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    old_price DECIMAL(12,2),
    new_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    change_type VARCHAR(20) CHECK (change_type IN ('increase', 'decrease', 'initial')),
    change_amount DECIMAL(12,2),
    change_percentage DECIMAL(5,2),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Property change log for tracking all updates
CREATE TABLE property_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- 'price', 'status', 'details', 'media', etc.
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Scraping sessions for tracking data collection runs
CREATE TABLE scraping_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_type VARCHAR(50) NOT NULL, -- 'full_scan', 'update_check', 'targeted'
    search_url TEXT,
    filters JSONB,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    
    -- Statistics
    total_pages INTEGER,
    pages_processed INTEGER,
    properties_found INTEGER,
    properties_new INTEGER,
    properties_updated INTEGER,
    properties_removed INTEGER,
    api_calls_used INTEGER,
    errors_count INTEGER,
    warnings_count INTEGER,
    
    -- Performance metrics
    time_elapsed_ms INTEGER,
    average_per_page_ms INTEGER,
    data_quality_score DECIMAL(3,2), -- 0.00 to 1.00
    
    errors JSONB, -- array of error messages
    warnings JSONB, -- array of warning messages
    metadata JSONB -- additional session metadata
);

-- Indexes for better performance
CREATE INDEX idx_properties_external_id ON properties(external_id);
CREATE INDEX idx_properties_source_id ON properties(source_id);
CREATE INDEX idx_properties_scraped_at ON properties(scraped_at);
CREATE INDEX idx_properties_active ON properties(is_active) WHERE is_active = true;

CREATE INDEX idx_property_pricing_property_id ON property_pricing(property_id);
CREATE INDEX idx_property_pricing_price ON property_pricing(current_price);
CREATE INDEX idx_property_pricing_currency ON property_pricing(currency);

CREATE INDEX idx_property_details_property_id ON property_details(property_id);
CREATE INDEX idx_property_details_area ON property_details(area);
CREATE INDEX idx_property_details_rooms ON property_details(rooms);
CREATE INDEX idx_property_details_transaction_type ON property_details(transaction_type);

CREATE INDEX idx_property_locations_property_id ON property_locations(property_id);
CREATE INDEX idx_property_locations_city ON property_locations(city);
CREATE INDEX idx_property_locations_quarter ON property_locations(quarter);
CREATE INDEX idx_property_locations_coordinates ON property_locations(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX idx_property_media_property_id ON property_media(property_id);
CREATE INDEX idx_property_media_type ON property_media(media_type);

CREATE INDEX idx_scraping_sessions_started_at ON scraping_sessions(started_at);
CREATE INDEX idx_scraping_sessions_status ON scraping_sessions(status);

-- Additional indexes for the tables we removed inline indexes from
CREATE INDEX idx_price_history_property_date ON price_history(property_id, changed_at);
CREATE INDEX idx_property_changes_property_date ON property_changes(property_id, changed_at);
CREATE INDEX idx_property_changes_type ON property_changes(change_type);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW active_properties AS
SELECT 
    p.*,
    pp.current_price,
    pp.currency,
    pp.price_per_sqm,
    pd.area,
    pd.rooms,
    pd.bedrooms,
    pd.property_type,
    pd.transaction_type,
    pl.city,
    pl.quarter,
    pl.full_address,
    ps.is_top_offer,
    ps.is_vip_offer
FROM properties p
LEFT JOIN property_pricing pp ON p.id = pp.property_id
LEFT JOIN property_details pd ON p.id = pd.property_id
LEFT JOIN property_locations pl ON p.id = pl.property_id
LEFT JOIN property_status ps ON p.id = ps.property_id
WHERE p.is_active = true;

CREATE VIEW property_summary AS
SELECT 
    pd.transaction_type,
    pd.property_type,
    pl.city,
    pl.quarter,
    COUNT(*) as total_properties,
    AVG(pp.current_price) as avg_price,
    MIN(pp.current_price) as min_price,
    MAX(pp.current_price) as max_price,
    AVG(pd.area) as avg_area,
    COUNT(CASE WHEN ps.is_top_offer THEN 1 END) as top_offers,
    COUNT(CASE WHEN ps.is_vip_offer THEN 1 END) as vip_offers
FROM properties p
JOIN property_pricing pp ON p.id = pp.property_id
JOIN property_details pd ON p.id = pd.property_id
JOIN property_locations pl ON p.id = pl.property_id
JOIN property_status ps ON p.id = ps.property_id
WHERE p.is_active = true
GROUP BY pd.transaction_type, pd.property_type, pl.city, pl.quarter;