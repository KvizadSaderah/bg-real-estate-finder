// Additional parser management methods for PropertyApp

PropertyApp.prototype.openParserSiteModal = function(siteId = null) {
    this.currentEditingSite = siteId;
    const modal = document.getElementById('parserSiteModal');
    const title = document.getElementById('parserModalTitle');
    
    if (siteId) {
        title.textContent = 'Edit Parser Site';
        this.loadParserSiteData(siteId);
    } else {
        title.textContent = 'Add New Parser Site';
        this.resetParserSiteForm();
        this.setupFieldSelectors();
    }
    
    modal.classList.remove('hidden');
};

PropertyApp.prototype.loadParserSiteData = function(siteId) {
    fetch(`/api/admin/parser/sites/${siteId}`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                this.populateParserSiteForm(result.data);
            }
        })
        .catch(error => {
            console.error('Error loading parser site data:', error);
        });
};

PropertyApp.prototype.populateParserSiteForm = function(site) {
    // Basic info
    document.getElementById('siteId').value = site.id;
    document.getElementById('siteName').value = site.name;
    document.getElementById('baseUrl').value = site.baseUrl;
    document.getElementById('maxPages').value = site.maxPages;
    document.getElementById('siteEnabled').checked = site.enabled;
    
    // Search URLs
    const container = document.getElementById('searchUrlsContainer');
    container.innerHTML = site.searchUrls.map(url => `
        <div class="flex items-center space-x-2">
            <input type="url" class="search-url flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none" value="${url}">
            <button type="button" onclick="removeSearchUrl(this)" class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    // List selectors
    document.getElementById('propertyLinks').value = site.selectors.propertyLinks || '';
    document.getElementById('nextPageButton').value = site.selectors.nextPageButton || '';
    
    // Wait times
    document.getElementById('betweenPages').value = site.waitTimes.betweenPages;
    document.getElementById('betweenProperties').value = site.waitTimes.betweenProperties;
    document.getElementById('userAgent').value = site.userAgent || '';
    
    // Field selectors
    this.setupFieldSelectors(site.selectors);
};

PropertyApp.prototype.setupFieldSelectors = function(selectors = {}) {
    const container = document.getElementById('fieldSelectorsContainer');
    const fields = [
        { name: 'title', label: 'Title', required: true },
        { name: 'price', label: 'Price', required: true },
        { name: 'area', label: 'Area (m²)' },
        { name: 'rooms', label: 'Rooms' },
        { name: 'floor', label: 'Floor' },
        { name: 'totalFloors', label: 'Total Floors' },
        { name: 'city', label: 'City', required: true },
        { name: 'quarter', label: 'Quarter/Neighborhood' },
        { name: 'address', label: 'Full Address' },
        { name: 'description', label: 'Description' },
        { name: 'propertyType', label: 'Property Type' },
        { name: 'images', label: 'Images' },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
        { name: 'agency', label: 'Agency' },
        { name: 'features', label: 'Features/Amenities' }
    ];

    container.innerHTML = fields.map(field => {
        const fieldData = selectors[field.name] || {};
        return `
            <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">
                    ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
                </label>
                <input type="text" 
                       id="${field.name}Selector" 
                       class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none text-sm" 
                       placeholder="CSS selector for ${field.label.toLowerCase()}"
                       value="${fieldData.selector || ''}"
                       ${field.required ? 'required' : ''}>
                <div class="flex items-center space-x-2">
                    <select id="${field.name}Attribute" class="px-2 py-1 border border-gray-200 rounded text-xs">
                        <option value="text" ${fieldData.attribute === 'text' ? 'selected' : ''}>Text</option>
                        <option value="href" ${fieldData.attribute === 'href' ? 'selected' : ''}>href</option>
                        <option value="src" ${fieldData.attribute === 'src' ? 'selected' : ''}>src</option>
                        <option value="value" ${fieldData.attribute === 'value' ? 'selected' : ''}>value</option>
                    </select>
                    <input type="text" 
                           id="${field.name}Regex" 
                           class="flex-1 px-2 py-1 border border-gray-200 rounded text-xs" 
                           placeholder="Optional regex pattern"
                           value="${fieldData.regex || ''}">
                </div>
            </div>
        `;
    }).join('');
};

PropertyApp.prototype.resetParserSiteForm = function() {
    document.getElementById('parserSiteForm').reset();
    document.getElementById('siteEnabled').checked = true;
    document.getElementById('betweenPages').value = 2000;
    document.getElementById('betweenProperties').value = 1000;
    document.getElementById('maxPages').value = 3;
    
    // Reset search URLs to single empty input
    document.getElementById('searchUrlsContainer').innerHTML = `
        <div class="flex items-center space-x-2">
            <input type="url" class="search-url flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none" placeholder="https://example.com/search?...">
            <button type="button" onclick="removeSearchUrl(this)" class="px-3 py-2 text-red-600 hover:text-red-800 transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
};

PropertyApp.prototype.saveParserSite = function() {
    const formData = this.collectParserSiteFormData();
    const method = this.currentEditingSite ? 'PUT' : 'POST';
    const url = this.currentEditingSite ? 
        `/api/admin/parser/sites/${this.currentEditingSite}` : 
        '/api/admin/parser/sites';

    return fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            this.showNotification('Parser site saved successfully', 'success');
            this.closeParserSiteModal();
            this.loadParserSites();
        } else {
            this.showNotification(result.error || 'Error saving parser site', 'error');
            if (result.details) {
                console.error('Validation errors:', result.details);
            }
        }
    })
    .catch(error => {
        console.error('Error saving parser site:', error);
        this.showNotification('Error saving parser site', 'error');
    });
};

PropertyApp.prototype.collectParserSiteFormData = function() {
    // Collect search URLs
    const searchUrls = Array.from(document.querySelectorAll('.search-url'))
        .map(input => input.value.trim())
        .filter(url => url !== '');

    // Collect field selectors
    const selectors = {
        propertyLinks: document.getElementById('propertyLinks').value,
        nextPageButton: document.getElementById('nextPageButton').value || undefined
    };

    // Collect all field selectors
    const fields = ['title', 'price', 'area', 'rooms', 'floor', 'totalFloors', 'city', 'quarter', 
                   'address', 'description', 'propertyType', 'images', 'phone', 'email', 'agency', 'features'];
    
    fields.forEach(field => {
        const selectorEl = document.getElementById(`${field}Selector`);
        const attributeEl = document.getElementById(`${field}Attribute`);
        const regexEl = document.getElementById(`${field}Regex`);
        
        if (selectorEl?.value) {
            selectors[field] = {
                selector: selectorEl.value,
                attribute: attributeEl?.value || 'text',
                required: ['title', 'price', 'city'].includes(field)
            };
            
            if (regexEl?.value) {
                selectors[field].regex = regexEl.value;
            }
        }
    });

    return {
        id: document.getElementById('siteId').value,
        name: document.getElementById('siteName').value,
        baseUrl: document.getElementById('baseUrl').value,
        searchUrls: searchUrls,
        enabled: document.getElementById('siteEnabled').checked,
        maxPages: parseInt(document.getElementById('maxPages').value),
        selectors: selectors,
        waitTimes: {
            betweenPages: parseInt(document.getElementById('betweenPages').value),
            betweenProperties: parseInt(document.getElementById('betweenProperties').value)
        },
        userAgent: document.getElementById('userAgent').value || undefined
    };
};

PropertyApp.prototype.testSelectors = function() {
    const testUrl = document.getElementById('testUrl').value;
    if (!testUrl) {
        this.showNotification('Please enter a test URL', 'error');
        return;
    }

    const formData = this.collectParserSiteFormData();
    
    const resultsContainer = document.getElementById('selectorTestResults');
    const resultsContent = document.getElementById('testResultsContent');
    
    resultsContainer.classList.remove('hidden');
    resultsContent.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Testing selectors...</div>';

    fetch('/api/admin/parser/test-selectors', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: testUrl,
            selectors: formData.selectors
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            this.displaySelectorTestResults(result.data.results);
        } else {
            resultsContent.innerHTML = `<div class="text-red-600">Test failed: ${result.error}</div>`;
        }
    })
    .catch(error => {
        console.error('Error testing selectors:', error);
        resultsContent.innerHTML = `<div class="text-red-600">Test failed: ${error.message}</div>`;
    });
};

PropertyApp.prototype.displaySelectorTestResults = function(results) {
    const resultsContent = document.getElementById('testResultsContent');
    
    resultsContent.innerHTML = Object.keys(results).map(field => {
        const result = results[field];
        const statusClass = result.found ? 'text-green-600' : 'text-red-600';
        const statusIcon = result.found ? 'fa-check-circle' : 'fa-times-circle';
        
        return `
            <div class="flex items-start space-x-3 p-3 bg-white rounded border">
                <i class="fas ${statusIcon} ${statusClass} mt-1"></i>
                <div class="flex-1">
                    <div class="font-medium text-gray-800">${field}</div>
                    <div class="text-sm text-gray-600 font-mono">${result.selector}</div>
                    ${result.found ? 
                        `<div class="text-sm text-green-700 mt-1">✓ Found: "${result.value}"</div>` : 
                        `<div class="text-sm text-red-700 mt-1">✗ ${result.error || 'Not found'}</div>`
                    }
                </div>
            </div>
        `;
    }).join('');
};

PropertyApp.prototype.toggleParserSite = function(siteId) {
    return fetch(`/api/admin/parser/sites/${siteId}/toggle`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            this.showNotification(result.message, 'info');
            this.loadParserSites();
        } else {
            this.showNotification('Error toggling site', 'error');
        }
    })
    .catch(error => {
        console.error('Error toggling parser site:', error);
        this.showNotification('Error toggling site', 'error');
    });
};

PropertyApp.prototype.deleteParserSite = function(siteId) {
    if (!confirm('Are you sure you want to delete this parser site? This action cannot be undone.')) {
        return;
    }

    return fetch(`/api/admin/parser/sites/${siteId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            this.showNotification('Parser site deleted', 'success');
            this.loadParserSites();
        } else {
            this.showNotification('Error deleting site', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting parser site:', error);
        this.showNotification('Error deleting site', 'error');
    });
};

PropertyApp.prototype.closeParserSiteModal = function() {
    const modal = document.getElementById('parserSiteModal');
    modal.classList.add('hidden');
    this.currentEditingSite = null;
};

PropertyApp.prototype.exportParserConfig = function() {
    window.location.href = '/api/admin/parser/export';
};

PropertyApp.prototype.importParserConfig = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    
                    fetch('/api/admin/parser/import', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ config })
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            this.showNotification('Configuration imported successfully', 'success');
                            this.loadParserSites();
                        } else {
                            this.showNotification(result.error || 'Import failed', 'error');
                        }
                    });
                } catch (error) {
                    this.showNotification('Invalid JSON file', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
};