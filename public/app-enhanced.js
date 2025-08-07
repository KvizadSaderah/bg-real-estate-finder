// Enhanced PropertyApp with modern UI/UX
class PropertyApp {
    constructor() {
        this.currentView = 'search';
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentFilters = {};
        this.currentSort = 'date-desc';
        this.properties = [];
        this.favorites = this.loadFromStorage('propertyFavorites', []);
        this.recentlyViewed = this.loadFromStorage('recentlyViewed', []);
        this.viewMode = 'grid';
        this.isLoading = false;
        
        // Charts instances
        this.charts = {
            price: null,
            type: null,
            area: null
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializePriceSlider();
        this.loadStats();
        this.showView('search');
        this.loadProperties();
        this.updateFavoritesCount();
        this.setupIntersectionObserver();
    }
    
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Quick filters
        document.querySelectorAll('.quick-filter').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleQuickFilter(e.target));
        });
        
        // Room buttons
        document.querySelectorAll('.room-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleRoomFilter(e.target));
        });
        
        // Search input with debouncing
        const searchInput = document.querySelector('input[placeholder="Search locations, keywords..."]');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.handleQuickSearch(e.target.value);
            }, 300));
        }
        
        // Filter inputs with auto-apply
        ['minPrice', 'maxPrice', 'minArea', 'maxArea', 'propertyType'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.debounce(() => this.applyFilters(), 500)();
                });
            }
        });
        
        // View toggle buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => {
                    b.className = 'view-btn px-3 py-2 text-sm bg-white text-gray-600 hover:bg-gray-50';
                });
                e.target.className = 'view-btn px-3 py-2 text-sm bg-blue-500 text-white';
            });
        });
    }
    
    setupIntersectionObserver() {
        // Infinite scroll for properties
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && this.currentPage < this.totalPages) {
                    this.loadProperties(this.currentPage + 1, true); // append mode
                }
            });
        }, { threshold: 0.1 });
        
        // Observe a sentinel element at the bottom of the properties container
        this.createScrollSentinel(observer);
    }
    
    createScrollSentinel(observer) {
        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.className = 'h-4 w-full';
        
        const container = document.getElementById('propertiesContainer');
        if (container) {
            container.after(sentinel);
            observer.observe(sentinel);
        }
    }
    
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K for quick search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.querySelector('input[placeholder="Search locations, keywords..."]')?.focus();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            this.closeAllModals();
        }
        
        // Number keys for quick view switching
        if (e.key >= '1' && e.key <= '3' && !e.target.matches('input')) {
            const views = ['search', 'trends', 'favorites'];
            this.showView(views[parseInt(e.key) - 1]);
        }
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const result = await response.json();
            
            if (result.success) {
                this.animateStatCards(result.data.overview);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    animateStatCards(stats) {
        const animations = [
            { id: 'totalProperties', value: stats.total_properties || 0 },
            { id: 'avgPrice', value: stats.avg_price ? this.formatPrice(Math.round(stats.avg_price)) : '-' },
            { id: 'newToday', value: stats.recent_properties || 0 },
            { id: 'topOffers', value: stats.top_offers || 0 }
        ];
        
        animations.forEach(({ id, value }, index) => {
            setTimeout(() => {
                this.animateNumber(id, value);
            }, index * 150);
        });
    }
    
    animateNumber(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const isPrice = typeof targetValue === 'string' && targetValue.includes('€');
        const numericValue = isPrice ? 
            parseInt(targetValue.replace(/[€,]/g, '')) : 
            parseInt(targetValue) || 0;
        
        if (isNaN(numericValue)) {
            element.textContent = targetValue;
            return;
        }
        
        let current = 0;
        const increment = numericValue / 30;
        const timer = setInterval(() => {
            current += increment;
            if (current >= numericValue) {
                current = numericValue;
                clearInterval(timer);
            }
            
            element.textContent = isPrice ? 
                this.formatPrice(Math.round(current)) : 
                Math.round(current).toLocaleString();
        }, 50);
    }
    
    async loadProperties(page = 1, append = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        if (!append) {
            this.showLoadingState();
        }
        
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '12',
                sort: this.currentSort,
                ...this.currentFilters
            });
            
            const response = await fetch(`/api/properties?${params}`);
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                if (append) {
                    this.properties = [...this.properties, ...result.data];
                } else {
                    this.properties = result.data;
                }
                
                this.displayProperties(this.properties, append);
                this.updatePagination(result.pagination);
                this.updateResultsCount(result.pagination);
                this.currentPage = page;
                this.totalPages = result.pagination.pages;
            } else if (!append) {
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Error loading properties:', error);
            this.showErrorState('Failed to load properties. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }
    
    displayProperties(properties, append = false) {
        const container = document.getElementById('propertiesContainer');
        if (!container) return;
        
        if (!append) {
            container.innerHTML = '';
        }
        
        // Hide empty state
        document.getElementById('emptyState').classList.add('hidden');
        
        const fragment = document.createDocumentFragment();
        
        properties.slice(append ? this.properties.length - properties.length : 0).forEach((property, index) => {
            const card = this.createPropertyCard(property);
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('fade-in-up');
            fragment.appendChild(card);
        });
        
        container.appendChild(fragment);
    }
    
    createPropertyCard(property) {
        const card = document.createElement('div');
        card.className = 'property-card rounded-2xl overflow-hidden cursor-pointer';
        
        const isFavorited = this.favorites.includes(property.external_id);
        const badges = [];
        
        if (property.is_top_offer) {
            badges.push('<span class="badge-top px-2 py-1 rounded-full text-white text-xs font-bold">TOP</span>');
        }
        if (property.is_vip_offer) {
            badges.push('<span class="badge-vip px-2 py-1 rounded-full text-white text-xs font-bold">VIP</span>');
        }
        
        const imageUrl = property.thumbnail_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop';
        
        card.innerHTML = `
            <div class="relative">
                <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    <img src="${imageUrl}" 
                         alt="${property.title || 'Property'}" 
                         class="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                         onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop'">
                </div>
                
                <!-- Badges -->
                ${badges.length > 0 ? `
                    <div class="absolute top-3 left-3 flex gap-2">
                        ${badges.join('')}
                    </div>
                ` : ''}
                
                <!-- Favorite Button -->
                <button onclick="event.stopPropagation(); app.toggleFavorite('${property.external_id}')" 
                        class="absolute top-3 right-3 w-9 h-9 rounded-full ${isFavorited ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600'} backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-all duration-200">
                    <i class="fas fa-heart text-sm"></i>
                </button>
            </div>
            
            <div class="p-4">
                <!-- Price -->
                <div class="flex items-center justify-between mb-3">
                    <div class="text-2xl font-bold text-gray-900">
                        ${property.current_price ? this.formatPrice(property.current_price) : 'Price on request'}
                    </div>
                    ${property.price_per_sqm ? `
                        <div class="text-sm text-gray-500">
                            ${this.formatPrice(property.price_per_sqm)}/m²
                        </div>
                    ` : ''}
                </div>
                
                <!-- Title -->
                <h3 class="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                    ${this.truncateText(property.title || 'Unnamed Property', 60)}
                </h3>
                
                <!-- Location -->
                <div class="flex items-center text-gray-600 mb-3">
                    <i class="fas fa-map-marker-alt mr-2 text-sm"></i>
                    <span class="text-sm">
                        ${property.quarter ? `${property.quarter}, ` : ''}${property.city || 'Location not specified'}
                    </span>
                </div>
                
                <!-- Property Details -->
                <div class="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    ${property.area ? `
                        <div class="flex items-center">
                            <i class="fas fa-expand-arrows-alt mr-1"></i>
                            ${Math.round(property.area)}m²
                        </div>
                    ` : ''}
                    ${property.rooms ? `
                        <div class="flex items-center">
                            <i class="fas fa-bed mr-1"></i>
                            ${property.rooms} rooms
                        </div>
                    ` : ''}
                    ${property.floor ? `
                        <div class="flex items-center">
                            <i class="fas fa-building mr-1"></i>
                            Floor ${property.floor}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Action Buttons -->
                <div class="flex gap-2">
                    <button onclick="app.showPropertyDetails('${property.external_id}')" 
                            class="flex-1 btn-gradient-primary py-2 px-4 rounded-lg text-white font-medium text-sm hover:shadow-lg transition-all duration-200">
                        <i class="fas fa-eye mr-2"></i>View Details
                    </button>
                    <button onclick="event.stopPropagation(); window.open('${property.url}', '_blank')" 
                            class="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
                
                <!-- Property Age -->
                <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                    <span>Listed ${this.formatDate(property.scraped_at)}</span>
                    <span class="px-2 py-1 bg-gray-100 rounded-full">
                        ID: ${property.external_id.slice(-6)}
                    </span>
                </div>
            </div>
        `;
        
        card.onclick = () => this.showPropertyDetails(property.external_id);
        
        return card;
    }
    
    showView(viewName) {
        this.currentView = viewName;
        
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.className = 'nav-btn text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200';
        });
        
        // Highlight current nav button
        const navButton = document.querySelector(`[onclick="showView('${viewName}')"]`);
        if (navButton) {
            navButton.className = 'nav-btn text-blue-600 font-semibold transition-colors duration-200';
        }
        
        // Show/hide views
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.add('hidden');
        });
        
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('fade-in-up');
        }
        
        // Load view-specific data
        switch (viewName) {
            case 'trends':
                this.loadTrends();
                break;
            case 'favorites':
                this.displayFavorites();
                break;
            case 'admin':
                this.initializeAdmin();
                break;
        }
    }
    
    async showPropertyDetails(externalId) {
        // Add to recently viewed
        this.addToRecentlyViewed(externalId);
        
        // Create and show modal
        this.showPropertyModal(externalId);
        
        try {
            const response = await fetch(`/api/properties/${encodeURIComponent(externalId)}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                this.updatePropertyModal(result.data);
            } else {
                this.showPropertyModalError(result.error || 'Property not found');
            }
        } catch (error) {
            this.showPropertyModalError('Failed to load property details');
        }
    }
    
    showPropertyModal(externalId) {
        const modal = document.createElement('div');
        modal.id = 'propertyModal';
        modal.className = 'fixed inset-0 modal-glass z-50 flex items-center justify-center p-4';
        
        modal.innerHTML = `
            <div class="modal-content-glass rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="sticky top-0 bg-white/90 backdrop-blur-lg p-6 border-b border-gray-200 flex justify-between items-center rounded-t-2xl">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">Property Details</h2>
                        <p class="text-gray-600">Loading...</p>
                    </div>
                    <button onclick="app.closePropertyModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="p-6" id="modalContent">
                    <div class="text-center py-12">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <p class="mt-4 text-gray-600">Loading property details...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePropertyModal();
            }
        });
    }
    
    updatePropertyModal(property) {
        const modalContent = document.getElementById('modalContent');
        if (!modalContent) return;
        
        modalContent.innerHTML = this.createPropertyDetailsHTML(property);
    }
    
    createPropertyDetailsHTML(property) {
        const isFavorited = this.favorites.includes(property.external_id);
        
        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Images Section -->
                <div>
                    <div class="aspect-w-16 aspect-h-10 mb-4">
                        <img src="${property.media?.[0]?.url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop'}" 
                             alt="${property.title}"
                             class="w-full h-64 object-cover rounded-xl">
                    </div>
                    ${property.media?.length > 1 ? `
                        <div class="grid grid-cols-4 gap-2">
                            ${property.media.slice(1, 5).map(img => `
                                <img src="${img.url}" 
                                     class="w-full h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Details Section -->
                <div>
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="text-2xl font-bold text-gray-800 mb-2">${property.title}</h3>
                            <p class="text-gray-600 flex items-center">
                                <i class="fas fa-map-marker-alt mr-2"></i>
                                ${property.quarter ? `${property.quarter}, ` : ''}${property.city || 'Location not specified'}
                            </p>
                        </div>
                        <button onclick="app.toggleFavorite('${property.external_id}')" 
                                class="w-12 h-12 rounded-full ${isFavorited ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'} flex items-center justify-center hover:scale-110 transition-all duration-200">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                    
                    <!-- Price -->
                    <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-3xl font-bold text-gray-800">
                                    ${property.current_price ? this.formatPrice(property.current_price) : 'Price on request'}
                                </div>
                                ${property.price_per_sqm ? `
                                    <div class="text-gray-600">
                                        ${this.formatPrice(property.price_per_sqm)}/m²
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Key Details -->
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        ${property.area ? `
                            <div class="bg-white rounded-xl p-4 border border-gray-100">
                                <div class="text-2xl font-bold text-blue-600">${Math.round(property.area)}</div>
                                <div class="text-gray-600 text-sm">Square meters</div>
                            </div>
                        ` : ''}
                        ${property.rooms ? `
                            <div class="bg-white rounded-xl p-4 border border-gray-100">
                                <div class="text-2xl font-bold text-green-600">${property.rooms}</div>
                                <div class="text-gray-600 text-sm">Rooms</div>
                            </div>
                        ` : ''}
                        ${property.floor ? `
                            <div class="bg-white rounded-xl p-4 border border-gray-100">
                                <div class="text-2xl font-bold text-purple-600">${property.floor}</div>
                                <div class="text-gray-600 text-sm">Floor</div>
                            </div>
                        ` : ''}
                        ${property.property_type ? `
                            <div class="bg-white rounded-xl p-4 border border-gray-100">
                                <div class="text-sm font-semibold text-gray-800">${property.property_type}</div>
                                <div class="text-gray-600 text-sm">Property Type</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Description -->
                    ${property.description ? `
                        <div class="mb-6">
                            <h4 class="font-semibold text-gray-800 mb-2">Description</h4>
                            <p class="text-gray-600 leading-relaxed">${property.description}</p>
                        </div>
                    ` : ''}
                    
                    <!-- Action Buttons -->
                    <div class="flex gap-3">
                        <button onclick="window.open('${property.url}', '_blank')" 
                                class="flex-1 btn-gradient-primary py-3 px-6 rounded-xl text-white font-semibold">
                            <i class="fas fa-external-link-alt mr-2"></i>View on UES.bg
                        </button>
                        <button onclick="app.shareProperty('${property.external_id}')" 
                                class="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                            <i class="fas fa-share"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    closePropertyModal() {
        const modal = document.getElementById('propertyModal');
        if (modal) {
            modal.remove();
        }
    }
    
    closeAllModals() {
        document.querySelectorAll('.modal-glass').forEach(modal => {
            modal.classList.add('hidden');
        });
        
        // Remove dynamically created modals
        const propertyModal = document.getElementById('propertyModal');
        if (propertyModal) {
            propertyModal.remove();
        }
    }
    
    toggleFavorite(externalId) {
        const index = this.favorites.indexOf(externalId);
        if (index > -1) {
            this.favorites.splice(index, 1);
            this.showNotification('Removed from favorites', 'info');
        } else {
            this.favorites.push(externalId);
            this.showNotification('Added to favorites', 'success');
        }
        
        this.saveToStorage('propertyFavorites', this.favorites);
        this.updateFavoritesCount();
        this.updatePropertyCardStates(externalId);
    }
    
    updateFavoritesCount() {
        const badge = document.getElementById('favoritesCountBadge');
        if (badge) {
            badge.textContent = this.favorites.length;
            badge.style.display = this.favorites.length > 0 ? 'flex' : 'none';
        }
    }
    
    updatePropertyCardStates(externalId) {
        const cards = document.querySelectorAll(`[onclick*="${externalId}"]`);
        const isFavorited = this.favorites.includes(externalId);
        
        cards.forEach(card => {
            const favoriteBtn = card.querySelector('button[onclick*="toggleFavorite"]');
            if (favoriteBtn) {
                favoriteBtn.className = `absolute top-3 right-3 w-9 h-9 rounded-full ${
                    isFavorited ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600'
                } backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-all duration-200`;
            }
        });
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };
        
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'} mr-3"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
    
    // Utility methods
    formatPrice(price) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        
        if (diffHours < 1) return 'just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        
        return date.toLocaleDateString('en-GB');
    }
    
    truncateText(text, length) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }
    
    loadFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch {
            return defaultValue;
        }
    }
    
    saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }
    
    addToRecentlyViewed(externalId) {
        this.recentlyViewed = this.recentlyViewed.filter(id => id !== externalId);
        this.recentlyViewed.unshift(externalId);
        this.recentlyViewed = this.recentlyViewed.slice(0, 10);
        this.saveToStorage('recentlyViewed', this.recentlyViewed);
    }
    
    showLoadingState() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        
        if (loadingState) loadingState.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }
    
    hideLoadingState() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.classList.add('hidden');
    }
    
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');
        
        if (emptyState) emptyState.classList.remove('hidden');
        if (loadingState) loadingState.classList.add('hidden');
    }
    
    showErrorState(message) {
        const container = document.getElementById('propertiesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h3>
                    <p class="text-gray-600 mb-4">${message}</p>
                    <button onclick="app.loadProperties()" class="btn-gradient-primary px-6 py-2 rounded-lg text-white font-medium">
                        Try Again
                    </button>
                </div>
            `;
        }
        this.hideLoadingState();
    }
    
    initializePriceSlider() {
        const slider = document.getElementById('priceSlider');
        if (slider && typeof noUiSlider !== 'undefined') {
            noUiSlider.create(slider, {
                start: [500, 3000],
                connect: true,
                range: {
                    'min': 200,
                    'max': 5000
                },
                step: 50,
                format: {
                    to: (value) => Math.round(value),
                    from: (value) => Number(value)
                }
            });
            
            slider.noUiSlider.on('update', (values) => {
                document.getElementById('minPrice').value = values[0];
                document.getElementById('maxPrice').value = values[1];
            });
            
            slider.noUiSlider.on('end', () => {
                this.applyFilters();
            });
        }
    }
}

// Global functions for backward compatibility
let app;

function showView(view) {
    if (app) app.showView(view);
}

function applyFilters() {
    if (app) app.applyFilters();
}

function clearAllFilters() {
    if (app) app.clearAllFilters();
}

function setView(mode) {
    if (app) app.setView(mode);
}

function applySorting() {
    if (app) app.applySorting();
}

function toggleAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const icon = document.getElementById('darkModeIcon');
    if (icon) {
        icon.className = document.documentElement.classList.contains('dark') ? 
            'fas fa-sun' : 'fas fa-moon';
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Admin global functions
function showAdminTab(tabName) {
    if (!app) return;
    
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.className = 'admin-tab px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-800';
    });
    
    const activeTab = document.querySelector(`[onclick="showAdminTab('${tabName}')"]`);
    if (activeTab) {
        activeTab.className = 'admin-tab px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600';
    }
    
    // Show/hide tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const targetContent = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    }
    
    app.currentAdminTab = tabName;
    
    // Load tab-specific data
    switch (tabName) {
        case 'logs':
            app.loadCrawlerLogs();
            break;
        case 'metrics':
            app.loadCrawlerMetrics();
            break;
        case 'parsers':
            app.initializeParsers();
            break;
    }
}

function refreshAdminData() {
    if (app) app.loadAdminData();
}

function loadCrawlerConfig() {
    if (app) app.loadCrawlerConfig();
}

function loadCrawlerLogs() {
    if (app) app.loadCrawlerLogs();
}

function loadCrawlerMetrics() {
    if (app) app.loadCrawlerMetrics();
}

function startCrawler() {
    if (app) app.startCrawler();
}

function stopCrawler() {
    if (app) app.stopCrawler();
}

// Parser management global functions
function addNewParserSite() {
    if (app) app.openParserSiteModal();
}

function editParserSite(siteId) {
    if (app) app.openParserSiteModal(siteId);
}

function toggleParserSite(siteId) {
    if (app) app.toggleParserSite(siteId);
}

function deleteParserSite(siteId) {
    if (app) app.deleteParserSite(siteId);
}

function closeParserSiteModal() {
    if (app) app.closeParserSiteModal();
}

function testSelectors() {
    if (app) app.testSelectors();
}

function exportParserConfig() {
    if (app) app.exportParserConfig();
}

function importParserConfig() {
    if (app) app.importParserConfig();
}

function addSearchUrl() {
    const container = document.getElementById('searchUrlsContainer');
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2';
    div.innerHTML = `
        <input type="url" class="search-url flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none" placeholder="https://example.com/search?...">
        <button type="button" onclick="removeSearchUrl(this)" class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
}

function removeSearchUrl(button) {
    const container = document.getElementById('searchUrlsContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    app = new PropertyApp();
    window.app = app;
    
    // Setup admin form event listeners
    const configForm = document.getElementById('crawlerConfigForm');
    if (configForm) {
        configForm.addEventListener('submit', function(e) {
            e.preventDefault();
            app.saveCrawlerConfig();
        });
    }
    
    const testForm = document.getElementById('testCrawlerForm');
    if (testForm) {
        testForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const url = document.getElementById('testUrl').value;
            const maxPages = document.getElementById('testMaxPages').value;
            app.testCrawler(url, maxPages);
        });
    }
    
    // Setup parser site form event listener
    const parserForm = document.getElementById('parserSiteForm');
    if (parserForm) {
        parserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            app.saveParserSite();
        });
    }
});

// Enhanced PropertyApp methods
PropertyApp.prototype.applyFilters = function() {
    const filters = {};
    
    // Get filter values
    const minPrice = document.getElementById('minPrice')?.value;
    const maxPrice = document.getElementById('maxPrice')?.value;
    const minArea = document.getElementById('minArea')?.value;
    const maxArea = document.getElementById('maxArea')?.value;
    const propertyType = document.getElementById('propertyType')?.value;
    
    if (minPrice) filters.minPrice = minPrice;
    if (maxPrice) filters.maxPrice = maxPrice;
    if (minArea) filters.minArea = minArea;
    if (maxArea) filters.maxArea = maxArea;
    if (propertyType) filters.propertyType = propertyType;
    
    // Quick filters
    document.querySelectorAll('.quick-filter.active').forEach(btn => {
        const filter = btn.dataset.filter;
        if (filter === 'top-offers') filters.isTopOffer = true;
        if (filter === 'vip-offers') filters.isVipOffer = true;
        if (filter === 'recent') filters.recent = true;
        if (filter === 'with-images') filters.hasImages = true;
    });
    
    // Room filters
    const activeRoomBtn = document.querySelector('.room-btn.active');
    if (activeRoomBtn) {
        filters.rooms = activeRoomBtn.dataset.rooms;
    }
    
    this.currentFilters = filters;
    this.loadProperties(1);
};

PropertyApp.prototype.clearAllFilters = function() {
    // Clear inputs
    ['minPrice', 'maxPrice', 'minArea', 'maxArea', 'propertyType'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Clear active states
    document.querySelectorAll('.quick-filter.active, .room-btn.active').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    // Reset price slider
    const slider = document.getElementById('priceSlider');
    if (slider && slider.noUiSlider) {
        slider.noUiSlider.set([500, 3000]);
    }
    
    this.currentFilters = {};
    this.loadProperties(1);
    this.showNotification('All filters cleared', 'info');
};

PropertyApp.prototype.toggleQuickFilter = function(button) {
    button.classList.toggle('active');
    if (button.classList.contains('active')) {
        button.classList.remove('bg-gray-100', 'text-gray-700');
        button.classList.add('bg-blue-500', 'text-white');
    } else {
        button.classList.add('bg-gray-100', 'text-gray-700');
        button.classList.remove('bg-blue-500', 'text-white');
    }
    this.applyFilters();
};

PropertyApp.prototype.toggleRoomFilter = function(button) {
    // Single selection for rooms
    document.querySelectorAll('.room-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    button.classList.add('active', 'bg-blue-500', 'text-white');
    button.classList.remove('bg-gray-100', 'text-gray-700');
    
    this.applyFilters();
};

PropertyApp.prototype.applySorting = function() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        this.currentSort = sortSelect.value;
        this.loadProperties(1);
    }
};

PropertyApp.prototype.setView = function(mode) {
    this.viewMode = mode;
    // This would trigger a re-render with different layout
    this.displayProperties(this.properties);
};

PropertyApp.prototype.updateResultsCount = function(pagination) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount && pagination) {
        const start = (pagination.page - 1) * pagination.limit + 1;
        const end = Math.min(pagination.page * pagination.limit, pagination.total);
        resultsCount.textContent = `${start}-${end} of ${pagination.total.toLocaleString()} properties`;
    }
};

PropertyApp.prototype.updatePagination = function(pagination) {
    // Infinite scroll handles pagination automatically
    // This method can be used for traditional pagination if needed
};

PropertyApp.prototype.handleQuickSearch = function(query) {
    if (query.trim()) {
        this.currentFilters.search = query;
    } else {
        delete this.currentFilters.search;
    }
    this.applyFilters();
};

PropertyApp.prototype.displayFavorites = function() {
    const container = document.getElementById('favoritesContainer');
    if (!container) return;
    
    if (this.favorites.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <i class="fas fa-heart text-gray-400 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-800 mb-2">No favorites yet</h3>
                <p class="text-gray-600 mb-4">Start adding properties to your favorites to see them here</p>
                <button onclick="showView('search')" class="btn-gradient-primary px-6 py-2 rounded-lg text-white font-medium">
                    Browse Properties
                </button>
            </div>
        `;
        return;
    }
    
    // TODO: Load and display favorite properties
    container.innerHTML = `
        <div class="text-center py-8">
            <p class="text-gray-600">Loading your ${this.favorites.length} favorite properties...</p>
        </div>
    `;
};

PropertyApp.prototype.shareProperty = function(externalId) {
    const property = this.properties.find(p => p.external_id === externalId);
    if (!property) return;
    
    if (navigator.share) {
        navigator.share({
            title: property.title,
            text: `Check out this property: ${property.title}`,
            url: property.url
        });
    } else {
        // Fallback: copy to clipboard
        const url = property.url;
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('Property link copied to clipboard', 'success');
        });
    }
};

// Trends functionality (placeholder for now)
PropertyApp.prototype.loadTrends = function() {
    const trendsContent = document.getElementById('trendsContent');
    if (trendsContent) {
        trendsContent.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p class="mt-4 text-gray-600">Loading market trends...</p>
            </div>
        `;
        
        // TODO: Implement trends loading from API
        setTimeout(() => {
            trendsContent.innerHTML = `
                <div class="glass rounded-2xl p-6 text-center">
                    <i class="fas fa-chart-line text-4xl text-blue-500 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">Market Trends</h3>
                    <p class="text-gray-600">Trends analysis will be available once more data is collected.</p>
                </div>
            `;
        }, 1500);
    }
};

// Admin functionality
PropertyApp.prototype.initializeAdmin = function() {
    this.currentAdminTab = 'dashboard';
    this.crawlerConfig = {};
    this.loadAdminData();
};

PropertyApp.prototype.loadAdminData = function() {
    if (this.currentView !== 'admin') return;
    
    // Load all admin data in parallel
    Promise.all([
        this.loadCrawlerStatus(),
        this.loadCrawlerConfig(),
        this.loadCrawlerLogs(),
        this.loadCrawlerMetrics()
    ]).catch(error => {
        console.error('Error loading admin data:', error);
        this.showNotification('Error loading admin data', 'error');
    });
};

PropertyApp.prototype.loadCrawlerStatus = function() {
    return fetch('/api/admin/status')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.updateCrawlerStatusUI(result.data);
            }
        })
        .catch(error => {
            console.error('Error loading crawler status:', error);
        });
};

PropertyApp.prototype.updateCrawlerStatusUI = function(data) {
    // Update status indicator
    const statusElement = document.getElementById('crawlerStatus');
    const statusIcon = document.getElementById('systemStatusIcon');
    const statusText = document.getElementById('systemStatusText');
    const recentActivity = document.getElementById('recentActivityText');
    
    if (statusElement) {
        const isRunning = data.latestSession?.status === 'running';
        const statusClass = isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
        const statusDot = isRunning ? 'bg-green-500' : 'bg-gray-400';
        
        statusElement.className = `flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusClass}`;
        statusElement.innerHTML = `
            <div class="w-2 h-2 rounded-full mr-2 ${statusDot}"></div>
            <span>${isRunning ? 'Running' : 'Idle'}</span>
        `;
    }
    
    if (statusIcon && statusText) {
        const hasErrors = data.recentErrors && data.recentErrors.length > 0;
        if (hasErrors) {
            statusIcon.className = 'w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center';
            statusIcon.innerHTML = '<i class="fas fa-exclamation-triangle text-yellow-600"></i>';
            statusText.textContent = 'Some issues detected';
        } else {
            statusIcon.className = 'w-8 h-8 rounded-full bg-green-100 flex items-center justify-center';
            statusIcon.innerHTML = '<i class="fas fa-check text-green-600"></i>';
            statusText.textContent = 'All systems operational';
        }
    }
    
    if (recentActivity) {
        if (data.latestSession) {
            const lastRun = new Date(data.latestSession.started_at).toLocaleString();
            recentActivity.innerHTML = `Last run: ${lastRun}<br>Properties: +${data.latestSession.properties_new || 0} new, ~${data.latestSession.properties_updated || 0} updated`;
        } else {
            recentActivity.textContent = 'No recent activity';
        }
    }
    
    // Update dashboard stats
    if (data.stats) {
        const stats = data.stats;
        document.getElementById('totalPropertiesScraped').textContent = (stats.total_properties || 0).toLocaleString();
        document.getElementById('propertiesLastHour').textContent = stats.properties_last_hour || '0';
        document.getElementById('propertiesLast24h').textContent = stats.properties_last_24h || '0';
        
        if (stats.last_update) {
            const lastUpdate = new Date(stats.last_update);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
            let timeText = 'Just now';
            if (diffMinutes > 60) {
                timeText = `${Math.floor(diffMinutes / 60)}h ago`;
            } else if (diffMinutes > 0) {
                timeText = `${diffMinutes}m ago`;
            }
            document.getElementById('lastUpdateTime').textContent = timeText;
        }
    }
};

PropertyApp.prototype.loadCrawlerConfig = function() {
    return fetch('/api/admin/config')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.crawlerConfig = result.data;
                this.populateConfigForm();
            }
        })
        .catch(error => {
            console.error('Error loading crawler config:', error);
        });
};

PropertyApp.prototype.populateConfigForm = function() {
    const config = this.crawlerConfig;
    
    // Monitoring settings
    const monitoringEnabled = document.getElementById('monitoringEnabled');
    const checkInterval = document.getElementById('checkInterval');
    
    if (monitoringEnabled && config.monitoring) {
        monitoringEnabled.checked = config.monitoring.enabled;
    }
    
    if (checkInterval && config.monitoring?.checkInterval) {
        checkInterval.value = config.monitoring.checkInterval;
    }
    
    // Price filters
    const minPrice = document.getElementById('configMinPrice');
    const maxPrice = document.getElementById('configMaxPrice');
    
    if (minPrice && config.monitoring?.filters?.minPrice) {
        minPrice.value = config.monitoring.filters.minPrice;
    }
    
    if (maxPrice && config.monitoring?.filters?.maxPrice) {
        maxPrice.value = config.monitoring.filters.maxPrice;
    }
    
    // Email settings
    const emailEnabled = document.getElementById('emailEnabled');
    const emailTo = document.getElementById('emailTo');
    
    if (emailEnabled && config.notifications?.email) {
        emailEnabled.checked = config.notifications.email.enabled;
    }
    
    if (emailTo && config.notifications?.email?.toEmail) {
        emailTo.value = config.notifications.email.toEmail;
    }
};

PropertyApp.prototype.saveCrawlerConfig = function() {
    const formData = new FormData(document.getElementById('crawlerConfigForm'));
    
    const config = {
        monitoring: {
            enabled: document.getElementById('monitoringEnabled').checked,
            checkInterval: document.getElementById('checkInterval').value,
            sources: this.crawlerConfig.monitoring?.sources || [],
            filters: {
                minPrice: parseInt(document.getElementById('configMinPrice').value) || undefined,
                maxPrice: parseInt(document.getElementById('configMaxPrice').value) || undefined,
                ...this.crawlerConfig.monitoring?.filters
            }
        },
        notifications: {
            email: {
                enabled: document.getElementById('emailEnabled').checked,
                toEmail: document.getElementById('emailTo').value,
                ...this.crawlerConfig.notifications?.email
            },
            ...this.crawlerConfig.notifications
        }
    };
    
    return fetch('/api/admin/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            this.showNotification('Configuration saved successfully', 'success');
            this.crawlerConfig = config;
        } else {
            this.showNotification('Error saving configuration', 'error');
        }
    })
    .catch(error => {
        console.error('Error saving config:', error);
        this.showNotification('Error saving configuration', 'error');
    });
};

PropertyApp.prototype.loadCrawlerLogs = function() {
    const sessionType = document.getElementById('logSessionType')?.value || 'monitoring_cycle';
    
    return fetch(`/api/admin/logs?session_type=${sessionType}&limit=50`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.displayCrawlerLogs(result.data);
            }
        })
        .catch(error => {
            console.error('Error loading crawler logs:', error);
        });
};

PropertyApp.prototype.displayCrawlerLogs = function(logs) {
    const container = document.getElementById('crawlerLogsContainer');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-file-alt text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-600">No logs found for this session type</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const startTime = new Date(log.started_at).toLocaleString();
        const duration = log.time_elapsed_ms ? `${Math.round(log.time_elapsed_ms / 1000)}s` : 'N/A';
        const statusClass = log.status === 'completed' ? 'text-green-600' : 
                           log.status === 'failed' ? 'text-red-600' : 'text-yellow-600';
        
        return `
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-3">
                        <span class="font-medium text-gray-800">${log.session_type}</span>
                        <span class="px-2 py-1 rounded text-xs font-medium ${statusClass} bg-gray-100">${log.status}</span>
                    </div>
                    <span class="text-sm text-gray-500">${startTime}</span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">Duration:</span>
                        <span class="font-medium ml-1">${duration}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">New:</span>
                        <span class="font-medium ml-1 text-green-600">${log.properties_new || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Updated:</span>
                        <span class="font-medium ml-1 text-blue-600">${log.properties_updated || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Errors:</span>
                        <span class="font-medium ml-1 text-red-600">${log.errors_count || 0}</span>
                    </div>
                </div>
                
                ${log.errors && log.errors.length > 0 && log.errors !== '[]' ? `
                    <div class="mt-3 p-2 bg-red-50 rounded text-sm">
                        <strong class="text-red-800">Errors:</strong>
                        <ul class="mt-1 text-red-700">
                            ${(() => {
                                try {
                                    const errors = JSON.parse(log.errors);
                                    return Array.isArray(errors) ? errors.map(error => `<li>• ${error}</li>`).join('') : `<li>• ${log.errors}</li>`;
                                } catch (e) {
                                    return `<li>• ${log.errors}</li>`;
                                }
                            })()}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
};

PropertyApp.prototype.loadCrawlerMetrics = function() {
    const period = document.getElementById('metricsTimeframe')?.value || '7';
    
    return fetch(`/api/admin/metrics?period=${period}`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.displayCrawlerMetrics(result.data);
            }
        })
        .catch(error => {
            console.error('Error loading crawler metrics:', error);
        });
};

PropertyApp.prototype.displayCrawlerMetrics = function(data) {
    // Update summary stats
    const totalSessions = document.getElementById('totalSessions');
    const avgDuration = document.getElementById('avgDuration');
    const successRate = document.getElementById('successRate');
    const successfulSessions = document.getElementById('successfulSessions');
    
    if (totalSessions) totalSessions.textContent = data.successRate?.total_sessions || 0;
    if (successfulSessions) successfulSessions.textContent = `${data.successRate?.successful_sessions || 0} successful`;
    if (successRate) successRate.textContent = `${data.successRate?.success_rate || 0}%`;
    if (avgDuration) {
        const avgMs = data.sessionsOverTime?.[0]?.avg_duration_ms;
        avgDuration.textContent = avgMs ? `${Math.round(avgMs / 1000)}s` : 'N/A';
    }
    
    // Display top errors
    const errorsList = document.getElementById('topErrorsList');
    if (errorsList && data.topErrors) {
        if (data.topErrors.length === 0) {
            errorsList.innerHTML = '<p class="text-gray-500 text-sm">No errors in this period</p>';
        } else {
            errorsList.innerHTML = data.topErrors.map(error => `
                <div class="flex items-center justify-between p-2 bg-white rounded border">
                    <span class="text-sm text-gray-700">${error.error_msg}</span>
                    <span class="text-xs text-red-600 font-medium">${error.count}x</span>
                </div>
            `).join('');
        }
    }
};

PropertyApp.prototype.testCrawler = function(url, maxPages) {
    const testResults = document.getElementById('testResults');
    const testResultsContent = document.getElementById('testResultsContent');
    
    if (testResults) testResults.classList.remove('hidden');
    if (testResultsContent) {
        testResultsContent.innerHTML = `
            <div class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-3"></div>
                <span>Running test...</span>
            </div>
        `;
    }
    
    return fetch('/api/admin/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, maxPages: parseInt(maxPages) })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success && testResultsContent) {
            const data = result.data;
            const statusClass = data.success ? 'text-green-600' : 'text-red-600';
            const statusIcon = data.success ? 'fa-check-circle' : 'fa-times-circle';
            
            testResultsContent.innerHTML = `
                <div class="space-y-3">
                    <div class="flex items-center ${statusClass}">
                        <i class="fas ${statusIcon} mr-2"></i>
                        <span class="font-medium">${data.success ? 'Test Successful' : 'Test Failed'}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-600">Pages Scanned:</span>
                            <span class="font-medium ml-2">${data.pagesScanned}</span>
                        </div>
                        <div>
                            <span class="text-gray-600">Properties Found:</span>
                            <span class="font-medium ml-2 text-blue-600">${data.propertiesFound}</span>
                        </div>
                        <div>
                            <span class="text-gray-600">Time Elapsed:</span>
                            <span class="font-medium ml-2">${Math.round(data.timeElapsed / 1000)}s</span>
                        </div>
                        <div>
                            <span class="text-gray-600">Session ID:</span>
                            <span class="font-medium ml-2">${data.sessionId}</span>
                        </div>
                    </div>
                    
                    ${data.errors && data.errors.length > 0 ? `
                        <div class="mt-3 p-3 bg-red-50 rounded">
                            <strong class="text-red-800">Errors:</strong>
                            <ul class="mt-1 text-red-700">
                                ${data.errors.map(error => `<li>• ${error}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Error testing crawler:', error);
        if (testResultsContent) {
            testResultsContent.innerHTML = `
                <div class="text-red-600">
                    <i class="fas fa-times-circle mr-2"></i>
                    Test failed: ${error.message}
                </div>
            `;
        }
    });
};

PropertyApp.prototype.startCrawler = function() {
    return fetch('/api/admin/crawler/start', { method: 'POST' })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.showNotification('Crawler started', 'success');
                setTimeout(() => this.loadCrawlerStatus(), 1000);
            } else {
                this.showNotification('Failed to start crawler', 'error');
            }
        })
        .catch(error => {
            console.error('Error starting crawler:', error);
            this.showNotification('Error starting crawler', 'error');
        });
};

PropertyApp.prototype.stopCrawler = function() {
    return fetch('/api/admin/crawler/stop', { method: 'POST' })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.showNotification('Crawler stopped', 'info');
                setTimeout(() => this.loadCrawlerStatus(), 1000);
            } else {
                this.showNotification('Failed to stop crawler', 'error');
            }
        })
        .catch(error => {
            console.error('Error stopping crawler:', error);
            this.showNotification('Error stopping crawler', 'error');
        });
};

// Parser Site Management
PropertyApp.prototype.initializeParsers = function() {
    this.loadParserSites();
};

PropertyApp.prototype.loadParserSites = function() {
    return fetch('/api/admin/parser/sites')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.displayParserSites(result.data);
            }
        })
        .catch(error => {
            console.error('Error loading parser sites:', error);
        });
};

PropertyApp.prototype.displayParserSites = function(sites) {
    const container = document.getElementById('parserSitesList');
    if (!container) return;

    if (sites.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-code text-4xl text-gray-300 mb-4"></i>
                <h3 class="text-lg font-semibold text-gray-800 mb-2">No Parser Sites Configured</h3>
                <p class="text-gray-600 mb-4">Add your first site to start parsing properties automatically</p>
                <button onclick="addNewParserSite()" class="btn-gradient-primary px-6 py-2 rounded-lg text-white font-medium">
                    <i class="fas fa-plus mr-2"></i>Add Site
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = sites.map(site => `
        <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-4">
                    <div class="flex items-center">
                        <div class="w-3 h-3 rounded-full mr-3 ${site.enabled ? 'bg-green-500' : 'bg-red-500'}"></div>
                        <div>
                            <h4 class="font-semibold text-gray-800">${site.name}</h4>
                            <p class="text-sm text-gray-500">${site.id}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 text-sm text-gray-600">
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">${site.searchUrls.length} URLs</span>
                        <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">Max ${site.maxPages} pages</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleParserSite('${site.id}')" 
                            class="px-3 py-1 rounded text-sm font-medium transition-colors ${site.enabled ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}">
                        ${site.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onclick="editParserSite('${site.id}')" class="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium hover:bg-blue-200">
                        Edit
                    </button>
                    <button onclick="deleteParserSite('${site.id}')" class="px-3 py-1 bg-red-100 text-red-800 rounded text-sm font-medium hover:bg-red-200">
                        Delete
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-600">Base URL:</span>
                    <a href="${site.baseUrl}" target="_blank" class="font-medium text-blue-600 hover:underline ml-2">${site.baseUrl}</a>
                </div>
                <div>
                    <span class="text-gray-600">Wait Times:</span>
                    <span class="font-medium ml-2">${site.waitTimes.betweenPages}ms / ${site.waitTimes.betweenProperties}ms</span>
                </div>
            </div>
            
            <div class="mt-4">
                <details class="text-sm">
                    <summary class="cursor-pointer text-gray-600 hover:text-gray-800">
                        <i class="fas fa-chevron-right mr-1"></i>Search URLs (${site.searchUrls.length})
                    </summary>
                    <div class="mt-2 space-y-1">
                        ${site.searchUrls.map(url => `
                            <div class="pl-4 text-gray-600">
                                <i class="fas fa-link mr-2"></i>
                                <a href="${url}" target="_blank" class="hover:text-blue-600">${url}</a>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
        </div>
    `).join('');
};