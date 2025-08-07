// Enhanced Global State
class PropertyApp {
    constructor() {
        // Core state
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentFilters = {};
        this.currentSort = 'date-desc';
        this.currentView = 'grid';
        this.properties = [];
        this.allCities = [];
        this.priceRange = null;
        
        // User preferences
        this.favorites = this.loadFavorites();
        this.recentlyViewed = this.loadRecentlyViewed();
        this.savedSearches = this.loadSavedSearches();
        this.comparisonList = [];
        
        // UI elements
        this.map = null;
        this.mapMarkers = [];
        
        // Initialize
        this.init();
    }
    
    init() {
        // Load initial data
        this.loadStats();
        this.loadCities();
        this.initializePriceSlider();
        this.loadProperties();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update UI
        this.updateFavoritesCount();
        this.updateRecentlyViewed();
    }
    
    setupEventListeners() {
        // Auto-apply filters on Enter key
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.matches('.form-control')) {
                this.applyFilters();
            }
        });
        
        // Auto-complete for city filter
        const cityFilter = document.getElementById('cityFilter');
        if (cityFilter) {
            cityFilter.addEventListener('input', (e) => {
                this.handleCityAutocomplete(e.target.value);
            });
        }
        
        // Area filters
        ['minArea', 'maxArea', 'minFloor', 'maxFloor'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    if (this.shouldAutoApplyFilters()) {
                        this.applyFilters();
                    }
                });
            }
        });
        
        // Property type filter
        const propertyTypeFilter = document.getElementById('propertyTypeFilter');
        if (propertyTypeFilter) {
            propertyTypeFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
        
        // Window resize handler for responsive map
        window.addEventListener('resize', () => {
            if (this.map && this.currentView === 'map') {
                setTimeout(() => this.map.invalidateSize(), 100);
            }
        });
    }
    
    shouldAutoApplyFilters() {
        // Auto-apply filters for better UX, but debounce to avoid too many requests
        return true;
    }
    
    handleKeyboardNavigation(e) {
        // ESC key closes modals
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            });
        }
        
        // Arrow keys for property navigation
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            this.navigateProperties(e.key === 'ArrowRight' ? 1 : -1);
        }
    }
    
    // Local storage helpers
    loadFavorites() {
        try {
            return JSON.parse(localStorage.getItem('propertyFavorites') || '[]');
        } catch {
            return [];
        }
    }
    
    saveFavorites() {
        localStorage.setItem('propertyFavorites', JSON.stringify(this.favorites));
        this.updateFavoritesCount();
    }
    
    loadRecentlyViewed() {
        try {
            return JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        } catch {
            return [];
        }
    }
    
    saveRecentlyViewed() {
        localStorage.setItem('recentlyViewed', JSON.stringify(this.recentlyViewed));
        this.updateRecentlyViewed();
    }
    
    loadSavedSearches() {
        try {
            return JSON.parse(localStorage.getItem('savedSearches') || '[]');
        } catch {
            return [];
        }
    }
    
    saveSavedSearches() {
        localStorage.setItem('savedSearches', JSON.stringify(this.savedSearches));
    }
}

// Global app instance - will be initialized when DOM is ready
let app;

// Backward compatibility functions
function applyFilters() { if (app) app.applyFilters(); }
function clearFilters() { if (app) app.clearFilters(); }
function loadProperties(page) { if (app) app.loadProperties(page); }
function showPropertyDetails(id) { if (app) app.showPropertyDetails(id); }

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing PropertyApp...');
    app = new PropertyApp();
    window.app = app; // Make it globally accessible
});

// Enhanced statistics loading
PropertyApp.prototype.loadStats = async function() {
    try {
        const response = await fetch('/api/stats');
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data.overview;
            
            // Update stats with animations
            this.updateStatElement('totalProperties', stats.total_properties || 0);
            this.updateStatElement('avgPrice', stats.avg_price ? 
                this.formatPrice(Math.round(stats.avg_price)) : '-');
            this.updateStatElement('recentProperties', stats.recent_properties || 0);
            this.updateStatElement('topOffers', stats.top_offers || 0);
            
            document.getElementById('statsText').textContent = 
                `${stats.total_properties} properties • Updated ${new Date().toLocaleDateString()}`;
                
            // Store cities for autocomplete
            if (result.data.cities) {
                this.allCities = result.data.cities.map(city => city.city).filter(Boolean);
                this.populateCitiesDatalist();
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        this.showNotification('Failed to load statistics', 'error');
    }
};

PropertyApp.prototype.updateStatElement = function(id, value) {
    const element = document.getElementById(id);
    if (element) {
        // Add animation class
        element.classList.add('slide-up');
        element.textContent = value;
        
        // Remove animation class after animation completes
        setTimeout(() => {
            element.classList.remove('slide-up');
        }, 300);
    }
};

PropertyApp.prototype.formatPrice = function(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
};

PropertyApp.prototype.loadCities = async function() {
    // Cities are loaded as part of stats, but we can also load them separately if needed
};

PropertyApp.prototype.populateCitiesDatalist = function() {
    const datalist = document.getElementById('citiesList');
    if (datalist && this.allCities.length > 0) {
        datalist.innerHTML = this.allCities
            .map(city => `<option value="${city}">`)
            .join('');
    }
};

PropertyApp.prototype.handleCityAutocomplete = function(value) {
    // Auto-complete logic is handled by the datalist
    // We could add more sophisticated filtering here if needed
};

// Enhanced property loading with sorting and view management
PropertyApp.prototype.loadProperties = async function(page = 1) {
    this.showLoading();
    
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: this.currentView === 'map' ? '100' : '12', // Load more for map view
            sort: this.currentSort,
            ...this.currentFilters
        });
        
        const response = await fetch(`/api/properties?${params}`);
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            this.properties = result.data;
            this.displayProperties(result.data);
            this.updatePagination(result.pagination);
            this.updateResultsCount(result.pagination);
            this.currentPage = page;
            this.totalPages = result.pagination.pages;
            
            // Show sort controls
            document.getElementById('sortControls').style.display = 'flex';
        } else {
            this.showNoProperties();
        }
    } catch (error) {
        console.error('Error loading properties:', error);
        this.showError('Failed to load properties');
    }
};

PropertyApp.prototype.updateResultsCount = function(pagination) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount && pagination) {
        const start = (pagination.page - 1) * pagination.limit + 1;
        const end = Math.min(pagination.page * pagination.limit, pagination.total);
        resultsCount.textContent = `Showing ${start}-${end} of ${pagination.total} properties`;
    }
};

// Enhanced property display with multiple view modes
PropertyApp.prototype.displayProperties = function(properties) {
    this.hideLoading();
    
    switch (this.currentView) {
        case 'grid':
        case 'compact':
            this.displayGridView(properties);
            break;
        case 'list':
            this.displayListView(properties);
            break;
        case 'map':
            this.displayMapView(properties);
            break;
    }
    
    // Hide no properties message
    document.getElementById('noProperties').style.display = 'none';
};

PropertyApp.prototype.displayGridView = function(properties) {
    const container = document.getElementById('propertiesContainer');
    const listContainer = document.getElementById('propertiesListContainer');
    const mapView = document.getElementById('mapView');
    
    // Show/hide appropriate containers
    container.style.display = 'grid';
    listContainer.style.display = 'none';
    mapView.style.display = 'none';
    
    // Clear and populate grid with CSS Grid layout
    container.innerHTML = '';
    let gridClass = 'properties-grid';
    if (this.currentView === 'compact') {
        gridClass += ' compact';
    }
    container.className = gridClass;
    
    properties.forEach((property, index) => {
        const card = this.createPropertyCard(property);
        card.classList.add('fade-in');
        card.style.animationDelay = `${index * 0.05}s`;
        container.appendChild(card);
    });
};

PropertyApp.prototype.displayListView = function(properties) {
    const container = document.getElementById('propertiesContainer');
    const listContainer = document.getElementById('propertiesListContainer');
    const mapView = document.getElementById('mapView');
    
    // Show/hide appropriate containers
    container.style.display = 'none';
    listContainer.style.display = 'block';
    mapView.style.display = 'none';
    
    // Clear and populate list
    listContainer.innerHTML = '';
    
    properties.forEach((property, index) => {
        const listItem = this.createPropertyListItem(property);
        listItem.classList.add('fade-in');
        listItem.style.animationDelay = `${index * 0.05}s`;
        listContainer.appendChild(listItem);
    });
};

PropertyApp.prototype.displayMapView = function(properties) {
    const container = document.getElementById('propertiesContainer');
    const listContainer = document.getElementById('propertiesListContainer');
    const mapView = document.getElementById('mapView');
    
    // Show/hide appropriate containers
    container.style.display = 'none';
    listContainer.style.display = 'none';
    mapView.style.display = 'block';
    
    // Initialize or update map
    this.initializeMap(properties);
};

// Enhanced property card creation with all features
PropertyApp.prototype.createPropertyCard = function(property) {
    const card = document.createElement('div');
    card.className = 'card property-card';
    
    const badges = [];
    if (property.is_top_offer) badges.push('<span class="top-offer-badge">TOP</span>');
    if (property.is_vip_offer) badges.push('<span class="vip-offer-badge">VIP</span>');
    
    const roomsText = property.rooms ? `${property.rooms}` : '';
    const floorText = property.floor && property.total_floors ? 
        `${property.floor}/${property.total_floors}` : property.floor ? `${property.floor}` : '';
    const areaText = property.area ? `${Math.round(property.area)}` : '';
    
    const isFavorited = this.favorites.includes(property.external_id);
    if (isFavorited) card.classList.add('favorited');
    
    card.onclick = () => this.showPropertyDetails(property.external_id);
    
    card.innerHTML = `
        <div class="property-image">
            <i class="fas fa-home"></i>
            <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" onclick="event.stopPropagation(); app.toggleFavorite('${property.external_id}')" aria-label="Add to favorites">
                <i class="fas fa-heart"></i>
            </button>
        </div>
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="price-badge">
                    ${property.current_price ? this.formatPrice(property.current_price) : '—'}
                    ${property.price_per_sqm ? `<div class="price-per-sqm">${this.formatPrice(property.price_per_sqm)}/m²</div>` : ''}
                </div>
                <div class="d-flex gap-1">
                    ${badges.join('')}
                </div>
            </div>
            
            <h6 class="property-title" title="${property.title || 'No title'}">
                ${this.truncateText(property.title || 'Unnamed Property', 65)}
            </h6>
            
            <div class="property-location">
                <i class="fas fa-map-marker-alt"></i>
                ${property.quarter ? `${property.quarter}, ` : ''}${property.city || 'Unknown location'}
            </div>
            
            <div class="property-meta">
                ${areaText ? `<div class="property-meta-item"><i class="fas fa-expand-arrows-alt"></i>${areaText} m²</div>` : ''}
                ${roomsText ? `<div class="property-meta-item"><i class="fas fa-bed"></i>${roomsText} rooms</div>` : ''}
                ${floorText ? `<div class="property-meta-item"><i class="fas fa-building"></i>Floor ${floorText}</div>` : ''}
                ${property.property_type ? `<div class="property-meta-item"><i class="fas fa-tag"></i>${property.property_type}</div>` : ''}
            </div>
            
            <div class="mt-auto pt-2 d-flex justify-content-between align-items-center">
                <small class="text-muted">
                    <i class="fas fa-clock me-1"></i>
                    ${this.formatDate(property.scraped_at)}
                </small>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); app.addToComparison('${property.external_id}')" title="Compare">
                        <i class="fas fa-balance-scale"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Quick Preview on Hover -->
        <div class="quick-preview">
            <h6>Quick Preview</h6>
            ${property.description ? `<p>${this.truncateText(property.description, 120)}</p>` : '<p class="text-muted">No description available</p>'}
            <div class="d-flex gap-2 justify-content-between">
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); app.showPropertyDetails('${property.external_id}')">
                    <i class="fas fa-eye me-1"></i>View Details
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); window.open('${property.url}', '_blank')">
                    <i class="fas fa-external-link-alt me-1"></i>UES.bg
                </button>
            </div>
        </div>
    `;
    
    return card;
};

// Create property list item for list view
PropertyApp.prototype.createPropertyListItem = function(property) {
    const item = document.createElement('div');
    item.className = 'card property-card mb-3';
    
    const badges = [];
    if (property.is_top_offer) badges.push('<span class="top-offer-badge">TOP</span>');
    if (property.is_vip_offer) badges.push('<span class="vip-offer-badge">VIP</span>');
    
    const isFavorited = this.favorites.includes(property.external_id);
    
    item.innerHTML = `
        <div class="card-body" onclick="app.showPropertyDetails('${property.external_id}')">
            <div class="row align-items-center">
                <div class="col-md-2">
                    <div class="property-image" style="height: 120px; border-radius: 8px;">
                        <i class="fas fa-home" style="font-size: 2rem;"></i>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <h5 class="property-title mb-0">${this.truncateText(property.title || 'Unnamed Property', 80)}</h5>
                        <div class="d-flex gap-1">
                            ${badges.join('')}
                        </div>
                    </div>
                    <div class="property-location mb-2">
                        <i class="fas fa-map-marker-alt"></i>
                        ${property.quarter ? `${property.quarter}, ` : ''}${property.city || 'Unknown location'}
                    </div>
                    <div class="property-meta">
                        ${property.area ? `<div class="property-meta-item"><i class="fas fa-expand-arrows-alt"></i>${Math.round(property.area)} m²</div>` : ''}
                        ${property.rooms ? `<div class="property-meta-item"><i class="fas fa-bed"></i>${property.rooms} rooms</div>` : ''}
                        ${property.floor ? `<div class="property-meta-item"><i class="fas fa-building"></i>Floor ${property.floor}${property.total_floors ? `/${property.total_floors}` : ''}</div>` : ''}
                        ${property.property_type ? `<div class="property-meta-item"><i class="fas fa-tag"></i>${property.property_type}</div>` : ''}
                    </div>
                </div>
                <div class="col-md-3 text-end">
                    <div class="price-badge mb-2">
                        ${property.current_price ? this.formatPrice(property.current_price) : '—'}
                        ${property.price_per_sqm ? `<div class="price-per-sqm">${this.formatPrice(property.price_per_sqm)}/m²</div>` : ''}
                    </div>
                    <small class="text-muted d-block">
                        <i class="fas fa-clock me-1"></i>
                        ${this.formatDate(property.scraped_at)}
                    </small>
                </div>
                <div class="col-md-1">
                    <div class="d-flex flex-column gap-2">
                        <button class="btn btn-sm ${isFavorited ? 'btn-warning' : 'btn-outline-primary'}" onclick="event.stopPropagation(); app.toggleFavorite('${property.external_id}')" title="Favorite">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); app.addToComparison('${property.external_id}')" title="Compare">
                            <i class="fas fa-balance-scale"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return item;
};

// Enhanced property details modal with all available data
PropertyApp.prototype.showPropertyDetails = async function(externalId) {
    const modal = new bootstrap.Modal(document.getElementById('propertyModal'));
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
    const modalBody = document.getElementById('modalBody');
    const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
    
    // Reset modal state
    modalTitle.textContent = 'Loading...';
    modalSubtitle.textContent = '';
    modalBody.innerHTML = `
        <div class="text-center p-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Loading property details...</p>
        </div>
    `;
    
    modal.show();
    
    try {
        console.log('Fetching property details for:', externalId);
        const response = await fetch(`/api/properties/${encodeURIComponent(externalId)}`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('API Response:', result);
        
        if (result.success && result.data) {
            const property = result.data;
            
            // Add to recently viewed
            this.addToRecentlyViewed(property);
            
            // Update modal header
            modalTitle.textContent = property.title || 'Property Details';
            modalSubtitle.textContent = `${property.quarter ? `${property.quarter}, ` : ''}${property.city || 'Unknown location'}`;
            
            // Update favorite button
            const isFavorited = this.favorites.includes(property.external_id);
            modalFavoriteBtn.className = isFavorited ? 'btn btn-warning btn-sm' : 'btn btn-outline-primary btn-sm';
            modalFavoriteBtn.innerHTML = '<i class="fas fa-heart"></i>';
            modalFavoriteBtn.onclick = () => this.toggleFavorite(property.external_id);
            
            // Create detailed content
            modalBody.innerHTML = this.createPropertyDetailsHTML(property);
            
            // Store current property for comparison
            this.currentModalProperty = property;
        } else {
            const errorMsg = result.error || 'Property not found';
            modalBody.innerHTML = `
                <div class="alert alert-warning">
                    <h5><i class="fas fa-exclamation-triangle me-2"></i>Property Not Available</h5>
                    <p>${errorMsg}</p>
                    <hr>
                    <p class="mb-0">This property may have been removed or is temporarily unavailable.</p>
                    <div class="mt-3">
                        <button class="btn btn-primary" onclick="app.loadProperties(app.currentPage)">
                            <i class="fas fa-refresh me-2"></i>Refresh Properties
                        </button>
                        <button class="btn btn-outline-secondary ms-2" data-bs-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Close
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading property details:', error);
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <h5>Connection Error</h5>
                <p>Unable to load property details. Please check your internet connection and try again.</p>
                <hr>
                <small class="text-muted">Error: ${error.message}</small>
            </div>
        `;
    }
};

// Comprehensive property details HTML with all available data
PropertyApp.prototype.createPropertyDetailsHTML = function(property) {
    const priceHistory = property.priceHistory || property.pricehistory || [];
    const media = property.media || [];
    
    return `
        <div class="container-fluid">
            <!-- Property Hero Section -->
            <div class="row mb-4">
                <div class="col-12">
                    <div class="d-flex justify-content-between align-items-start p-4 bg-light rounded">
                        <div>
                            <h2 class="text-primary mb-1">
                                ${property.current_price ? this.formatPrice(property.current_price) : 'Price not available'}
                                ${property.price_per_sqm ? `<small class="text-muted ms-2">(${this.formatPrice(property.price_per_sqm)}/m²)</small>` : ''}
                            </h2>
                            <div class="d-flex gap-2 mb-2">
                                ${property.is_top_offer ? '<span class="top-offer-badge">TOP OFFER</span>' : ''}
                                ${property.is_vip_offer ? '<span class="vip-offer-badge">VIP</span>' : ''}
                                ${property.transaction_type ? `<span class="badge bg-secondary">${property.transaction_type}</span>` : ''}
                            </div>
                        </div>
                        <div class="text-end">
                            <a href="${property.url}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-external-link-alt me-2"></i>View on UES.bg
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <!-- Left Column: Main Details -->
                <div class="col-lg-8">
                    <!-- Location Information -->
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-map-marker-alt me-2"></i>Location</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-2"><strong>Address:</strong></p>
                                    <p>${property.full_address || `${property.quarter || ''} ${property.city || 'Not specified'}`}</p>
                                    ${property.quarter ? `<p><strong>Quarter:</strong> ${property.quarter}</p>` : ''}
                                    ${property.city ? `<p><strong>City:</strong> ${property.city}</p>` : ''}
                                </div>
                                <div class="col-md-6">
                                    ${property.latitude && property.longitude ? `
                                        <p><strong>Coordinates:</strong></p>
                                        <p class="text-muted">Lat: ${property.latitude}</p>
                                        <p class="text-muted">Lng: ${property.longitude}</p>
                                        <button class="btn btn-sm btn-outline-primary" onclick="app.showPropertyOnMap(${property.latitude}, ${property.longitude})">
                                            <i class="fas fa-map me-1"></i>View on Map
                                        </button>
                                    ` : '<p class="text-muted">Location coordinates not available</p>'}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Property Details -->
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-info-circle me-2"></i>Property Details</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    ${property.area ? `<div class="mb-2"><strong>Area:</strong> ${Math.round(property.area)} m²</div>` : ''}
                                    ${property.rooms ? `<div class="mb-2"><strong>Rooms:</strong> ${property.rooms}</div>` : ''}
                                    ${property.bedrooms ? `<div class="mb-2"><strong>Bedrooms:</strong> ${property.bedrooms}</div>` : ''}
                                    ${property.bathrooms ? `<div class="mb-2"><strong>Bathrooms:</strong> ${property.bathrooms}</div>` : ''}
                                    ${property.property_type ? `<div class="mb-2"><strong>Property Type:</strong> ${property.property_type}</div>` : ''}
                                </div>
                                <div class="col-md-6">
                                    ${property.floor ? `<div class="mb-2"><strong>Floor:</strong> ${property.floor}${property.total_floors ? ` of ${property.total_floors}` : ''}</div>` : ''}
                                    ${property.total_floors ? `<div class="mb-2"><strong>Total Floors:</strong> ${property.total_floors}</div>` : ''}
                                    ${property.construction_year ? `<div class="mb-2"><strong>Construction Year:</strong> ${property.construction_year}</div>` : ''}
                                    ${property.heating_type ? `<div class="mb-2"><strong>Heating:</strong> ${property.heating_type}</div>` : ''}
                                    ${property.parking ? `<div class="mb-2"><strong>Parking:</strong> ${property.parking}</div>` : ''}
                                </div>
                            </div>
                            
                            <!-- Additional Features -->
                            ${property.features && property.features.length > 0 ? `
                                <div class="mt-3">
                                    <strong>Features:</strong>
                                    <div class="d-flex flex-wrap gap-2 mt-2">
                                        ${property.features.map(feature => `<span class="badge bg-light text-dark">${feature}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Description -->
                    ${property.description ? `
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="fas fa-align-left me-2"></i>Description</h5>
                            </div>
                            <div class="card-body">
                                <p class="mb-0">${property.description}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Agency Information -->
                    ${property.agency_name || property.agent_name ? `
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="fas fa-building me-2"></i>Agency Information</h5>
                            </div>
                            <div class="card-body">
                                ${property.agency_name ? `<p><strong>Agency:</strong> ${property.agency_name}</p>` : ''}
                                ${property.agent_name ? `<p><strong>Agent:</strong> ${property.agent_name}</p>` : ''}
                                ${property.agency_phone ? `<p><strong>Phone:</strong> <a href="tel:${property.agency_phone}">${property.agency_phone}</a></p>` : ''}
                                ${property.agency_email ? `<p><strong>Email:</strong> <a href="mailto:${property.agency_email}">${property.agency_email}</a></p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Right Column: Media and Additional Info -->
                <div class="col-lg-4">
                    <!-- Media Gallery -->
                    ${media.length > 0 ? `
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="fas fa-images me-2"></i>Media Gallery</h5>
                            </div>
                            <div class="card-body">
                                <p class="text-muted mb-3">${media.length} media files available</p>
                                <div class="row">
                                    ${media.slice(0, 6).map((item, index) => `
                                        <div class="col-6 mb-2">
                                            <div class="bg-light rounded p-3 text-center" style="height: 80px; display: flex; align-items: center; justify-content: center;">
                                                <i class="fas fa-image text-muted"></i>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                ${media.length > 6 ? `<p class="text-muted small">+${media.length - 6} more images</p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Price History -->
                    ${priceHistory.length > 0 ? `
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="fas fa-chart-line me-2"></i>Price History</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Price</th>
                                                <th>Change</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${priceHistory.slice(0, 10).map(entry => `
                                                <tr>
                                                    <td>${this.formatDate(entry.changed_at)}</td>
                                                    <td>${this.formatPrice(entry.new_price || entry.price)}</td>
                                                    <td>
                                                        ${entry.change_type === 'increase' ? 
                                                            '<span class="text-success"><i class="fas fa-arrow-up"></i></span>' :
                                                            entry.change_type === 'decrease' ?
                                                            '<span class="text-danger"><i class="fas fa-arrow-down"></i></span>' :
                                                            '<span class="text-muted">—</span>'
                                                        }
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Property Status -->
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-info-circle me-2"></i>Property Status</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Status:</strong> <span class="badge bg-success">Active</span></p>
                            <p><strong>Last Updated:</strong> ${this.formatDate(property.scraped_at)}</p>
                            <p><strong>Property ID:</strong> <code>${property.external_id}</code></p>
                            ${property.created_at ? `<p><strong>First Listed:</strong> ${this.formatDate(property.created_at)}</p>` : ''}
                            ${property.views_count ? `<p><strong>Views:</strong> ${property.views_count}</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Similar Properties -->
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-search me-2"></i>Actions</h5>
                        </div>
                        <div class="card-body">
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary" onclick="app.findSimilarProperties('${property.external_id}')">
                                    <i class="fas fa-search me-2"></i>Find Similar
                                </button>
                                <button class="btn btn-outline-primary" onclick="app.addToComparison('${property.external_id}')">
                                    <i class="fas fa-balance-scale me-2"></i>Add to Compare
                                </button>
                                <button class="btn btn-outline-secondary" onclick="app.shareProperty('${property.external_id}')">
                                    <i class="fas fa-share me-2"></i>Share Property
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Enhanced pagination with better UX
PropertyApp.prototype.updatePagination = function(pagination) {
    const container = document.getElementById('paginationContainer');
    
    if (pagination.pages <= 1) {
        container.style.display = 'none';
        return;
    }
    
    let paginationHTML = '<nav aria-label="Property pagination"><ul class="pagination justify-content-center">';
    
    // First page
    if (pagination.page > 1) {
        paginationHTML += `<li class="page-item">
            <a class="page-link" href="#" onclick="app.loadProperties(1)" aria-label="First page">
                <i class="fas fa-angle-double-left"></i>
            </a>
        </li>`;
    }
    
    // Previous button
    if (pagination.page > 1) {
        paginationHTML += `<li class="page-item">
            <a class="page-link" href="#" onclick="app.loadProperties(${pagination.page - 1})" aria-label="Previous page">
                <i class="fas fa-angle-left"></i> Previous
            </a>
        </li>`;
    }
    
    // Page numbers with smart truncation
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);
    
    // Show dots if we're not starting from page 1
    if (startPage > 1) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === pagination.page;
        paginationHTML += `<li class="page-item ${isActive ? 'active' : ''}">
            <a class="page-link" href="#" onclick="app.loadProperties(${i})" ${isActive ? 'aria-current="page"' : ''}>${i}</a>
        </li>`;
    }
    
    // Show dots if we're not ending at the last page
    if (endPage < pagination.pages) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    
    // Next button
    if (pagination.page < pagination.pages) {
        paginationHTML += `<li class="page-item">
            <a class="page-link" href="#" onclick="app.loadProperties(${pagination.page + 1})" aria-label="Next page">
                Next <i class="fas fa-angle-right"></i>
            </a>
        </li>`;
    }
    
    // Last page
    if (pagination.page < pagination.pages) {
        paginationHTML += `<li class="page-item">
            <a class="page-link" href="#" onclick="app.loadProperties(${pagination.pages})" aria-label="Last page">
                <i class="fas fa-angle-double-right"></i>
            </a>
        </li>`;
    }
    
    paginationHTML += '</ul></nav>';
    
    // Add page info
    paginationHTML += `
        <div class="text-center mt-2">
            <small class="text-muted">
                Page ${pagination.page} of ${pagination.pages} 
                (${pagination.total} total properties)
            </small>
        </div>
    `;
    
    container.innerHTML = paginationHTML;
    container.style.display = 'block';
};

// Enhanced filter application with price slider support
PropertyApp.prototype.applyFilters = function() {
    this.currentFilters = {};
    
    // Text filters
    const city = document.getElementById('cityFilter').value.trim();
    const minArea = document.getElementById('minArea').value;
    const maxArea = document.getElementById('maxArea').value;
    const minFloor = document.getElementById('minFloor').value;
    const maxFloor = document.getElementById('maxFloor').value;
    const propertyType = document.getElementById('propertyTypeFilter').value;
    
    // Price range from slider
    if (this.priceRange) {
        const priceValues = this.priceRange.get();
        this.currentFilters.minPrice = Math.round(priceValues[0]);
        this.currentFilters.maxPrice = Math.round(priceValues[1]);
    }
    
    // Apply text filters
    if (city) this.currentFilters.city = city;
    if (minArea) this.currentFilters.minArea = minArea;
    if (maxArea) this.currentFilters.maxArea = maxArea;
    if (minFloor) this.currentFilters.minFloor = minFloor;
    if (maxFloor) this.currentFilters.maxFloor = maxFloor;
    if (propertyType) this.currentFilters.propertyType = propertyType;
    
    // Apply quick filters
    const activeQuickFilters = document.querySelectorAll('.quick-filter-btn.active');
    activeQuickFilters.forEach(btn => {
        const filter = btn.dataset.filter;
        const rooms = btn.dataset.rooms;
        
        if (filter === 'top-offers') this.currentFilters.isTopOffer = true;
        if (filter === 'vip-offers') this.currentFilters.isVipOffer = true;
        if (filter === 'recent') this.currentFilters.recent = true;
        if (filter === 'with-images') this.currentFilters.hasImages = true;
        if (rooms) this.currentFilters.rooms = rooms;
    });
    
    // Reset to first page and load
    this.loadProperties(1);
    
    // Show notification
    this.showNotification('Filters applied', 'success');
};

// Enhanced filter clearing
PropertyApp.prototype.clearFilters = function() {
    // Clear text inputs
    document.getElementById('cityFilter').value = '';
    document.getElementById('minArea').value = '';
    document.getElementById('maxArea').value = '';
    document.getElementById('minFloor').value = '';
    document.getElementById('maxFloor').value = '';
    document.getElementById('propertyTypeFilter').value = '';
    
    // Reset price slider
    if (this.priceRange) {
        this.priceRange.set([500, 5000]);
    }
    
    // Clear quick filters
    document.querySelectorAll('.quick-filter-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Reset filters object
    this.currentFilters = {};
    
    // Reset sort to default
    document.getElementById('sortSelect').value = 'date-desc';
    this.currentSort = 'date-desc';
    
    // Load properties
    this.loadProperties(1);
    
    // Show notification
    this.showNotification('All filters cleared', 'info');
};

// Enhanced utility functions
PropertyApp.prototype.showLoading = function() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('propertiesContainer').style.display = 'none';
    document.getElementById('propertiesListContainer').style.display = 'none';
    document.getElementById('mapView').style.display = 'none';
    document.getElementById('noProperties').style.display = 'none';
    document.getElementById('paginationContainer').style.display = 'none';
    document.getElementById('sortControls').style.display = 'none';
};

PropertyApp.prototype.hideLoading = function() {
    document.getElementById('loading').style.display = 'none';
};

PropertyApp.prototype.showNoProperties = function() {
    this.hideLoading();
    document.getElementById('propertiesContainer').style.display = 'none';
    document.getElementById('propertiesListContainer').style.display = 'none';
    document.getElementById('mapView').style.display = 'none';
    document.getElementById('noProperties').style.display = 'block';
    document.getElementById('paginationContainer').style.display = 'none';
    document.getElementById('sortControls').style.display = 'none';
};

PropertyApp.prototype.showError = function(message) {
    this.hideLoading();
    const container = document.getElementById('propertiesContainer');
    container.innerHTML = `<div class="col-12"><div class="alert alert-danger fade-in">${message}</div></div>`;
    container.style.display = 'block';
};

PropertyApp.prototype.truncateText = function(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
};

PropertyApp.prototype.formatDate = function(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

PropertyApp.prototype.showNotification = function(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
};

// Backward compatibility
function showLoading() { app.showLoading(); }
function hideLoading() { app.hideLoading(); }
function showNoProperties() { app.showNoProperties(); }
function showError(message) { app.showError(message); }
function truncateText(text, length) { return app.truncateText(text, length); }
function formatDate(dateString) { return app.formatDate(dateString); }

// Additional enhanced functionality

// Price slider initialization
PropertyApp.prototype.initializePriceSlider = function() {
    const priceRangeElement = document.getElementById('priceRange');
    if (priceRangeElement && typeof noUiSlider !== 'undefined') {
        this.priceRange = noUiSlider.create(priceRangeElement, {
            start: [500, 5000],
            connect: true,
            range: {
                'min': 100,
                'max': 10000
            },
            step: 50,
            tooltips: {
                to: (value) => Math.round(value) + ' EUR',
                from: (value) => Number(value.replace(' EUR', ''))
            },
            format: {
                to: (value) => Math.round(value),
                from: (value) => Number(value)
            }
        });
        
        this.priceRange.on('update', (values) => {
            document.getElementById('minPriceValue').textContent = Math.round(values[0]) + ' EUR';
            document.getElementById('maxPriceValue').textContent = Math.round(values[1]) + ' EUR';
        });
        
        this.priceRange.on('end', () => {
            if (this.shouldAutoApplyFilters()) {
                this.applyFilters();
            }
        });
    }
};

// View management
function setView(view) {
    app.currentView = view;
    
    // Update button states
    document.querySelectorAll('.view-toggle button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Handle different view button names
    const viewBtnMap = {
        'grid': 'gridViewBtn',
        'compact': 'compactViewBtn', 
        'list': 'listViewBtn',
        'map': 'mapViewBtn'
    };
    
    const btnId = viewBtnMap[view];
    if (btnId) {
        document.getElementById(btnId).classList.add('active');
    }
    
    // Load properties in new view
    app.loadProperties(app.currentPage);
}

// Sorting functionality
function applySorting() {
    app.currentSort = document.getElementById('sortSelect').value;
    app.loadProperties(1);
}

// Quick filter toggles
function toggleQuickFilter(button, filterType, value) {
    button.classList.toggle('active');
    app.applyFilters();
}

function toggleRoomFilter(button, rooms) {
    // Single selection for rooms
    document.querySelectorAll('[data-rooms]').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    app.applyFilters();
}

// Favorites management
PropertyApp.prototype.toggleFavorite = function(externalId) {
    const index = this.favorites.indexOf(externalId);
    if (index > -1) {
        this.favorites.splice(index, 1);
        this.showNotification('Removed from favorites', 'info');
    } else {
        this.favorites.push(externalId);
        this.showNotification('Added to favorites', 'success');
    }
    
    this.saveFavorites();
    
    // Update UI
    this.updatePropertyCardFavoriteState(externalId);
    this.updateModalFavoriteButton(externalId);
};

PropertyApp.prototype.updatePropertyCardFavoriteState = function(externalId) {
    const cards = document.querySelectorAll(`[onclick*="${externalId}"]`);
    const isFavorited = this.favorites.includes(externalId);
    
    cards.forEach(card => {
        const favoriteBtn = card.querySelector('.favorite-btn');
        const propertyCard = card.querySelector('.property-card') || card;
        
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('favorited', isFavorited);
        }
        if (propertyCard) {
            propertyCard.classList.toggle('favorited', isFavorited);
        }
    });
};

PropertyApp.prototype.updateModalFavoriteButton = function(externalId) {
    const modalBtn = document.getElementById('modalFavoriteBtn');
    if (modalBtn && this.currentModalProperty && this.currentModalProperty.external_id === externalId) {
        const isFavorited = this.favorites.includes(externalId);
        modalBtn.className = isFavorited ? 'btn btn-warning btn-sm' : 'btn btn-outline-primary btn-sm';
    }
};

PropertyApp.prototype.updateFavoritesCount = function() {
    document.getElementById('favoritesCount').textContent = this.favorites.length;
};

function toggleFavoritesView() {
    const favoritesView = document.getElementById('favoritesView');
    const mainContent = document.querySelector('.col-lg-9 > *:not(#favoritesView)');
    
    if (favoritesView.style.display === 'none' || !favoritesView.style.display) {
        // Show favorites
        favoritesView.style.display = 'block';
        Array.from(mainContent).forEach(el => {
            if (el !== favoritesView) el.style.display = 'none';
        });
        app.displayFavorites();
    } else {
        // Hide favorites
        favoritesView.style.display = 'none';
        Array.from(mainContent).forEach(el => {
            if (el !== favoritesView) el.style.display = '';
        });
    }
}

PropertyApp.prototype.displayFavorites = function() {
    const container = document.getElementById('favoritesContainer');
    
    if (this.favorites.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-heart fa-3x text-muted mb-3"></i>
                <h4>No favorites yet</h4>
                <p class="text-muted">Start adding properties to your favorites to see them here</p>
            </div>
        `;
        return;
    }
    
    // Load favorite properties (simplified - in real app, you'd fetch these)
    container.innerHTML = `
        <div class="col-12 text-center py-3">
            <div class="spinner-border" role="status"></div>
            <p class="mt-2">Loading your favorites...</p>
        </div>
    `;
    
    // TODO: Implement actual favorites loading from API
};

// Recently viewed management
PropertyApp.prototype.addToRecentlyViewed = function(property) {
    // Remove if already exists
    this.recentlyViewed = this.recentlyViewed.filter(item => item.external_id !== property.external_id);
    
    // Add to beginning
    this.recentlyViewed.unshift({
        external_id: property.external_id,
        title: property.title,
        price: property.current_price,
        city: property.city,
        viewedAt: new Date().toISOString()
    });
    
    // Keep only last 10
    this.recentlyViewed = this.recentlyViewed.slice(0, 10);
    
    this.saveRecentlyViewed();
};

PropertyApp.prototype.updateRecentlyViewed = function() {
    const container = document.getElementById('recentlyViewedList');
    const card = document.getElementById('recentlyViewedCard');
    
    if (this.recentlyViewed.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    container.innerHTML = this.recentlyViewed.slice(0, 5).map(item => `
        <div class="d-flex align-items-center mb-2 p-2 border rounded" style="cursor: pointer;" onclick="app.showPropertyDetails('${item.external_id}')">
            <div class="flex-grow-1">
                <div class="fw-bold" style="font-size: 0.85rem;">${this.truncateText(item.title, 40)}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${item.city} • ${this.formatPrice(item.price)}</div>
            </div>
        </div>
    `).join('');
};

// Map functionality
PropertyApp.prototype.initializeMap = function(properties) {
    const mapContainer = document.getElementById('mapContainer');
    
    if (!mapContainer || typeof L === 'undefined') {
        console.warn('Map container or Leaflet not available');
        return;
    }
    
    // Initialize map if not exists
    if (!this.map) {
        this.map = L.map('mapContainer').setView([42.6977, 23.3219], 12); // Sofia center
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }
    
    // Clear existing markers
    this.mapMarkers.forEach(marker => this.map.removeLayer(marker));
    this.mapMarkers = [];
    
    // Add property markers
    const validProperties = properties.filter(p => p.latitude && p.longitude);
    
    if (validProperties.length === 0) {
        // Show message about no coordinates
        const popup = L.popup()
            .setLatLng([42.6977, 23.3219])
            .setContent('No properties with coordinates found in current results')
            .openOn(this.map);
        return;
    }
    
    validProperties.forEach(property => {
        const marker = L.marker([property.latitude, property.longitude])
            .bindPopup(`
                <div class="p-2">
                    <h6>${this.truncateText(property.title, 50)}</h6>
                    <p class="mb-1"><strong>${this.formatPrice(property.current_price)}</strong></p>
                    <p class="mb-1 text-muted">${property.city}</p>
                    <button class="btn btn-sm btn-primary" onclick="app.showPropertyDetails('${property.external_id}')">
                        View Details
                    </button>
                </div>
            `);
        
        marker.addTo(this.map);
        this.mapMarkers.push(marker);
    });
    
    // Fit map to markers
    if (this.mapMarkers.length > 1) {
        const group = new L.featureGroup(this.mapMarkers);
        this.map.fitBounds(group.getBounds().pad(0.1));
    } else if (this.mapMarkers.length === 1) {
        this.map.setView([validProperties[0].latitude, validProperties[0].longitude], 15);
    }
};

PropertyApp.prototype.showPropertyOnMap = function(lat, lng) {
    if (this.map) {
        this.map.setView([lat, lng], 16);
        
        // Switch to map view
        setView('map');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('propertyModal'));
        if (modal) modal.hide();
    }
};

// Comparison functionality
PropertyApp.prototype.addToComparison = function(externalId) {
    if (this.comparisonList.includes(externalId)) {
        this.showNotification('Property already in comparison', 'warning');
        return;
    }
    
    if (this.comparisonList.length >= 3) {
        this.showNotification('Maximum 3 properties can be compared', 'warning');
        return;
    }
    
    this.comparisonList.push(externalId);
    this.showNotification(`Added to comparison (${this.comparisonList.length}/3)`, 'success');
    
    // Show comparison button if we have properties to compare
    if (this.comparisonList.length > 1) {
        this.showComparisonButton();
    }
};

PropertyApp.prototype.showComparisonButton = function() {
    // Implementation for showing floating comparison button
    let button = document.getElementById('floatingCompareBtn');
    if (!button) {
        button = document.createElement('button');
        button.id = 'floatingCompareBtn';
        button.className = 'btn btn-primary position-fixed';
        button.style.cssText = 'bottom: 20px; right: 20px; z-index: 1000; border-radius: 50px; padding: 12px 20px;';
        button.onclick = () => this.showComparison();
        document.body.appendChild(button);
    }
    
    button.innerHTML = `<i class="fas fa-balance-scale me-2"></i>Compare (${this.comparisonList.length})`;
    button.style.display = 'block';
};

PropertyApp.prototype.showComparison = function() {
    // Show comparison modal
    const modal = new bootstrap.Modal(document.getElementById('comparisonModal'));
    modal.show();
    
    // TODO: Implement comparison table
    document.getElementById('comparisonBody').innerHTML = `
        <div class="text-center p-4">
            <h5>Property Comparison</h5>
            <p>Comparing ${this.comparisonList.length} properties...</p>
            <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-outline-danger" onclick="app.clearComparison()">Clear All</button>
            </div>
        </div>
    `;
};

PropertyApp.prototype.clearComparison = function() {
    this.comparisonList = [];
    const button = document.getElementById('floatingCompareBtn');
    if (button) button.style.display = 'none';
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('comparisonModal'));
    if (modal) modal.hide();
};

// Save search functionality
function saveSearch() {
    const searchName = prompt('Enter a name for this search:');
    if (searchName) {
        app.savedSearches.push({
            name: searchName,
            filters: { ...app.currentFilters },
            sort: app.currentSort,
            createdAt: new Date().toISOString()
        });
        
        app.saveSavedSearches();
        app.showNotification('Search saved successfully', 'success');
    }
}

// Additional utility functions
PropertyApp.prototype.findSimilarProperties = function(externalId) {
    // TODO: Implement similar properties search
    this.showNotification('Finding similar properties...', 'info');
};

PropertyApp.prototype.shareProperty = function(externalId) {
    const url = `${window.location.origin}/property/${externalId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Property Listing',
            url: url
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('Property link copied to clipboard', 'success');
        });
    }
};

function toggleFavoriteModal() {
    if (app.currentModalProperty) {
        app.toggleFavorite(app.currentModalProperty.external_id);
    }
}

function addToComparison() {
    if (app.currentModalProperty) {
        app.addToComparison(app.currentModalProperty.external_id);
    }
}

// Navigation helpers
PropertyApp.prototype.navigateProperties = function(direction) {
    // TODO: Implement property navigation with arrow keys
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new PropertyApp();
});