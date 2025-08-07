import express from 'express';
import cors from 'cors';
import { db } from '../database/connection';
import { PropertyService } from '../database/PropertyService';
import { parserConfigManager } from '../config/ParserConfig';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;
const propertyService = new PropertyService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Initialize database connection
async function initializeServer() {
  try {
    await db.connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// API Routes

// Get all properties with pagination and filtering
app.get('/api/properties', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      city,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      rooms,
      propertyType
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    let whereConditions = ['p.is_active = true'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (city) {
      whereConditions.push(`pl.city ILIKE $${paramIndex}`);
      queryParams.push(`%${city}%`);
      paramIndex++;
    }

    if (minPrice) {
      whereConditions.push(`pp.current_price >= $${paramIndex}`);
      queryParams.push(Number(minPrice));
      paramIndex++;
    }

    if (maxPrice) {
      whereConditions.push(`pp.current_price <= $${paramIndex}`);
      queryParams.push(Number(maxPrice));
      paramIndex++;
    }

    if (minArea) {
      whereConditions.push(`pd.area >= $${paramIndex}`);
      queryParams.push(Number(minArea));
      paramIndex++;
    }

    if (maxArea) {
      whereConditions.push(`pd.area <= $${paramIndex}`);
      queryParams.push(Number(maxArea));
      paramIndex++;
    }

    if (rooms) {
      whereConditions.push(`pd.rooms = $${paramIndex}`);
      queryParams.push(Number(rooms));
      paramIndex++;
    }

    if (propertyType) {
      whereConditions.push(`pd.property_type ILIKE $${paramIndex}`);
      queryParams.push(`%${propertyType}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM properties p
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      LEFT JOIN property_details pd ON p.id = pd.property_id
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get properties
    const query = `
      SELECT 
        p.id,
        p.external_id,
        p.title,
        p.description,
        p.url,
        p.scraped_at,
        pp.current_price,
        pp.currency,
        pp.price_per_sqm,
        pd.area,
        pd.rooms,
        pd.bedrooms,
        pd.bathrooms,
        pd.floor,
        pd.total_floors,
        pd.property_type,
        pd.transaction_type,
        pl.city,
        pl.quarter,
        pl.full_address,
        pl.latitude,
        pl.longitude,
        ps.is_top_offer,
        ps.is_vip_offer,
        ps.labels,
        (SELECT thumbnail_url FROM property_media WHERE property_id = p.id AND media_type = 'image' ORDER BY display_order LIMIT 1) as thumbnail_url
      FROM properties p
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      LEFT JOIN property_details pd ON p.id = pd.property_id
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      LEFT JOIN property_status ps ON p.id = ps.property_id
      WHERE ${whereClause}
      ORDER BY p.scraped_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(Number(limit), offset);
    const result = await db.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties'
    });
  }
});

// Get single property with full details
app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    let query;
    let queryParams;

    if (isUuid) {
      query = `
        SELECT 
          p.*,
          pp.*,
          pd.*,
          pl.*,
          ps.*,
          pa.*
        FROM properties p
        LEFT JOIN property_pricing pp ON p.id = pp.property_id
        LEFT JOIN property_details pd ON p.id = pd.property_id
        LEFT JOIN property_locations pl ON p.id = pl.property_id
        LEFT JOIN property_status ps ON p.id = ps.property_id
        LEFT JOIN property_agencies pa ON p.id = pa.property_id
        WHERE p.id = $1::uuid
      `;
      queryParams = [id];
    } else {
      query = `
        SELECT 
          p.*,
          pp.*,
          pd.*,
          pl.*,
          ps.*,
          pa.*
        FROM properties p
        LEFT JOIN property_pricing pp ON p.id = pp.property_id
        LEFT JOIN property_details pd ON p.id = pd.property_id
        LEFT JOIN property_locations pl ON p.id = pl.property_id
        LEFT JOIN property_status ps ON p.id = ps.property_id
        LEFT JOIN property_agencies pa ON p.id = pa.property_id
        WHERE p.external_id = $1
      `;
      queryParams = [id];
    }

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Get property media
    const mediaQuery = `
      SELECT * FROM property_media 
      WHERE property_id = $1 
      ORDER BY display_order, created_at
    `;
    const mediaResult = await db.query(mediaQuery, [result.rows[0].id]);

    // Get price history
    const priceHistoryQuery = `
      SELECT * FROM price_history 
      WHERE property_id = $1 
      ORDER BY changed_at DESC
      LIMIT 10
    `;
    const priceHistoryResult = await db.query(priceHistoryQuery, [result.rows[0].id]);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        media: mediaResult.rows,
        priceHistory: priceHistoryResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property'
    });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    // Basic stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_properties,
        COUNT(CASE WHEN p.scraped_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_properties,
        AVG(pp.current_price) as avg_price,
        MIN(pp.current_price) as min_price,
        MAX(pp.current_price) as max_price,
        COUNT(CASE WHEN ps.is_top_offer THEN 1 END) as top_offers
      FROM properties p
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      LEFT JOIN property_status ps ON p.id = ps.property_id
      WHERE p.is_active = true
    `;

    const statsResult = await db.query(statsQuery);

    // Property types breakdown
    const typesQuery = `
      SELECT 
        pd.property_type,
        COUNT(*) as count,
        AVG(pp.current_price) as avg_price
      FROM properties p
      LEFT JOIN property_details pd ON p.id = pd.property_id
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      WHERE p.is_active = true AND pd.property_type IS NOT NULL
      GROUP BY pd.property_type
      ORDER BY count DESC
    `;

    const typesResult = await db.query(typesQuery);

    // Cities breakdown
    const citiesQuery = `
      SELECT 
        pl.city,
        COUNT(*) as count,
        AVG(pp.current_price) as avg_price
      FROM properties p
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      WHERE p.is_active = true AND pl.city IS NOT NULL
      GROUP BY pl.city
      ORDER BY count DESC
      LIMIT 10
    `;

    const citiesResult = await db.query(citiesQuery);

    // Recent price changes
    const priceChanges = await propertyService.getPropertiesWithPriceChanges(7);

    res.json({
      success: true,
      data: {
        overview: statsResult.rows[0],
        propertyTypes: typesResult.rows,
        cities: citiesResult.rows,
        recentPriceChanges: priceChanges.length
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Get market trends and analysis
app.get('/api/trends', async (req, res) => {
  try {
    const { period = '30', city } = req.query;
    const days = parseInt(period as string);
    
    // Price trends over time
    let priceQuery = `
      SELECT 
        DATE_TRUNC('day', p.scraped_at) as date,
        AVG(pp.current_price) as avg_price,
        MIN(pp.current_price) as min_price,
        MAX(pp.current_price) as max_price,
        COUNT(*) as properties_count,
        pl.city
      FROM properties p
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      WHERE p.scraped_at >= NOW() - INTERVAL '${days} days'
        AND pp.current_price > 0
        AND p.is_active = true
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (city) {
      priceQuery += ` AND pl.city ILIKE $${paramIndex}`;
      queryParams.push(`%${city}%`);
      paramIndex++;
    }
    
    priceQuery += `
      GROUP BY DATE_TRUNC('day', p.scraped_at), pl.city
      ORDER BY date ASC
    `;

    const priceResult = await db.query(priceQuery, queryParams);

    // Price changes analysis
    const priceChangesQuery = `
      SELECT 
        COUNT(*) as total_changes,
        COUNT(CASE WHEN change_type = 'increase' THEN 1 END) as increases,
        COUNT(CASE WHEN change_type = 'decrease' THEN 1 END) as decreases,
        AVG(ABS(change_amount)) as avg_change_amount,
        AVG(ABS(change_percentage)) as avg_change_percentage
      FROM price_history ph
      LEFT JOIN properties p ON ph.property_id = p.id
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      WHERE ph.changed_at >= NOW() - INTERVAL '${days} days'
      ${city ? `AND pl.city ILIKE $${paramIndex}` : ''}
    `;

    const priceChangesResult = await db.query(
      priceChangesQuery, 
      city ? [...queryParams, `%${city}%`] : queryParams
    );

    // Property type distribution trends
    const typeDistributionQuery = `
      SELECT 
        pd.property_type,
        COUNT(*) as count,
        AVG(pp.current_price) as avg_price,
        MIN(pp.current_price) as min_price,
        MAX(pp.current_price) as max_price
      FROM properties p
      LEFT JOIN property_details pd ON p.id = pd.property_id
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      WHERE p.scraped_at >= NOW() - INTERVAL '${days} days'
        AND pp.current_price > 0
        AND p.is_active = true
        AND pd.property_type IS NOT NULL
      ${city ? `AND pl.city ILIKE $${paramIndex}` : ''}
      GROUP BY pd.property_type
      ORDER BY count DESC
    `;

    const typeDistributionResult = await db.query(
      typeDistributionQuery,
      city ? [...queryParams, `%${city}%`] : queryParams
    );

    // Area analysis
    const areaAnalysisQuery = `
      SELECT 
        CASE 
          WHEN pd.area < 50 THEN 'Under 50m²'
          WHEN pd.area < 80 THEN '50-80m²'
          WHEN pd.area < 120 THEN '80-120m²'
          ELSE 'Over 120m²'
        END as area_range,
        COUNT(*) as count,
        AVG(pp.current_price) as avg_price,
        AVG(pp.price_per_sqm) as avg_price_per_sqm
      FROM properties p
      LEFT JOIN property_details pd ON p.id = pd.property_id
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      WHERE p.scraped_at >= NOW() - INTERVAL '${days} days'
        AND pp.current_price > 0
        AND p.is_active = true
        AND pd.area IS NOT NULL
      ${city ? `AND pl.city ILIKE $${paramIndex}` : ''}
      GROUP BY 
        CASE 
          WHEN pd.area < 50 THEN 'Under 50m²'
          WHEN pd.area < 80 THEN '50-80m²'
          WHEN pd.area < 120 THEN '80-120m²'
          ELSE 'Over 120m²'
        END
      ORDER BY avg_price ASC
    `;

    const areaAnalysisResult = await db.query(
      areaAnalysisQuery,
      city ? [...queryParams, `%${city}%`] : queryParams
    );

    // Most active quarters/neighborhoods
    const quartersQuery = `
      SELECT 
        pl.quarter,
        pl.city,
        COUNT(*) as properties_count,
        AVG(pp.current_price) as avg_price,
        MIN(pp.current_price) as min_price,
        MAX(pp.current_price) as max_price
      FROM properties p
      LEFT JOIN property_locations pl ON p.id = pl.property_id
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      WHERE p.scraped_at >= NOW() - INTERVAL '${days} days'
        AND pp.current_price > 0
        AND p.is_active = true
        AND pl.quarter IS NOT NULL
      ${city ? `AND pl.city ILIKE $${paramIndex}` : ''}
      GROUP BY pl.quarter, pl.city
      ORDER BY properties_count DESC
      LIMIT 20
    `;

    const quartersResult = await db.query(
      quartersQuery,
      city ? [...queryParams, `%${city}%`] : queryParams
    );

    res.json({
      success: true,
      data: {
        period: days,
        city: city || 'all',
        priceOverTime: priceResult.rows,
        priceChanges: priceChangesResult.rows[0],
        propertyTypes: typeDistributionResult.rows,
        areaAnalysis: areaAnalysisResult.rows,
        topQuarters: quartersResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market trends'
    });
  }
});

// Get monitoring service status and recent activity
app.get('/api/monitoring/status', async (req, res) => {
  try {
    const recentSessionsQuery = `
      SELECT 
        session_type,
        started_at,
        completed_at,
        status,
        properties_new,
        properties_updated,
        errors_count,
        metadata
      FROM scraping_sessions 
      WHERE session_type = 'monitoring_cycle'
      ORDER BY started_at DESC 
      LIMIT 10
    `;

    const recentSessions = await db.query(recentSessionsQuery);

    // Get new listings from last 24 hours
    const newListingsQuery = `
      SELECT 
        COUNT(*) as count,
        AVG(pp.current_price) as avg_price
      FROM properties p
      LEFT JOIN property_pricing pp ON p.id = pp.property_id
      WHERE p.scraped_at >= NOW() - INTERVAL '24 hours'
        AND p.is_active = true
    `;

    const newListingsResult = await db.query(newListingsQuery);

    // Get price changes from last 7 days
    const priceChangesQuery = `
      SELECT 
        COUNT(*) as total_changes,
        COUNT(CASE WHEN change_type = 'increase' THEN 1 END) as increases,
        COUNT(CASE WHEN change_type = 'decrease' THEN 1 END) as decreases
      FROM price_history 
      WHERE changed_at >= NOW() - INTERVAL '7 days'
    `;

    const priceChangesResult = await db.query(priceChangesQuery);

    res.json({
      success: true,
      data: {
        recentSessions: recentSessions.rows,
        newListings24h: newListingsResult.rows[0],
        priceChanges7d: priceChangesResult.rows[0],
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching monitoring status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring status'
    });
  }
});

// Admin API Routes

// Get crawler configuration
app.get('/api/admin/config', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const configPath = path.resolve('./config/app-config.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      res.json({
        success: true,
        data: config
      });
    } catch (fileError) {
      // Return default config if file doesn't exist
      res.json({
        success: true,
        data: {
          monitoring: {
            enabled: false,
            checkInterval: '*/10 * * * *',
            sources: [],
            filters: {}
          },
          notifications: {
            email: { enabled: false },
            webhook: { enabled: false },
            desktop: { enabled: true }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error loading crawler config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load configuration'
    });
  }
});

// Update crawler configuration
app.post('/api/admin/config', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const configPath = path.resolve('./config/app-config.json');
    const configDir = path.dirname(configPath);
    
    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true });
    
    // Write new configuration
    await fs.writeFile(configPath, JSON.stringify(req.body, null, 2));
    
    res.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Error saving crawler config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration'
    });
  }
});

// Get crawler logs and activity
app.get('/api/admin/logs', async (req, res) => {
  try {
    const { limit = 100, session_type = 'monitoring_cycle' } = req.query;
    
    const query = `
      SELECT 
        id,
        session_type,
        started_at,
        completed_at,
        status,
        total_pages,
        pages_processed,
        properties_found,
        properties_new,
        properties_updated,
        properties_removed,
        errors_count,
        warnings_count,
        time_elapsed_ms,
        errors,
        warnings,
        metadata
      FROM scraping_sessions 
      WHERE session_type = $1
      ORDER BY started_at DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [session_type, parseInt(limit as string)]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching crawler logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs'
    });
  }
});

// Get real-time crawler status
app.get('/api/admin/status', async (req, res) => {
  try {
    // Get latest session info
    const latestSessionQuery = `
      SELECT 
        session_type,
        started_at,
        completed_at,
        status,
        properties_new,
        properties_updated,
        errors_count
      FROM scraping_sessions 
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    
    const latestSession = await db.query(latestSessionQuery);
    
    // Get system stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_properties,
        COUNT(CASE WHEN scraped_at > NOW() - INTERVAL '1 hour' THEN 1 END) as properties_last_hour,
        COUNT(CASE WHEN scraped_at > NOW() - INTERVAL '24 hours' THEN 1 END) as properties_last_24h,
        MAX(scraped_at) as last_update
      FROM properties 
      WHERE is_active = true
    `;
    
    const stats = await db.query(statsQuery);
    
    // Get recent errors
    const errorsQuery = `
      SELECT errors, warnings, started_at
      FROM scraping_sessions 
      WHERE (errors IS NOT NULL AND errors != '[]') 
         OR (warnings IS NOT NULL AND warnings != '[]')
      ORDER BY started_at DESC 
      LIMIT 5
    `;
    
    const errors = await db.query(errorsQuery);
    
    res.json({
      success: true,
      data: {
        latestSession: latestSession.rows[0] || null,
        stats: stats.rows[0] || {},
        recentErrors: errors.rows || [],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching crawler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch status'
    });
  }
});

// Start/Stop crawler manually
app.post('/api/admin/crawler/:action', async (req, res) => {
  try {
    const { action } = req.params;
    
    if (action === 'start') {
      // In a real implementation, you'd start the monitoring service
      // For now, we'll simulate by creating a session entry
      
      const sessionQuery = `
        INSERT INTO scraping_sessions (
          session_type,
          started_at,
          status,
          metadata
        ) VALUES (
          'manual_trigger',
          NOW(),
          'running',
          $1
        ) RETURNING id
      `;
      
      const metadata = {
        triggered_by: 'web_admin',
        trigger_time: new Date().toISOString()
      };
      
      const result = await db.query(sessionQuery, [JSON.stringify(metadata)]);
      
      res.json({
        success: true,
        message: 'Crawler started manually',
        sessionId: result.rows[0].id
      });
      
    } else if (action === 'stop') {
      // Update any running sessions to stopped
      await db.query(`
        UPDATE scraping_sessions 
        SET status = 'stopped', completed_at = NOW()
        WHERE status = 'running'
      `);
      
      res.json({
        success: true,
        message: 'Crawler stopped'
      });
      
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "start" or "stop"'
      });
    }
    
  } catch (error) {
    console.error('Error controlling crawler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control crawler'
    });
  }
});

// Test crawler configuration
app.post('/api/admin/test', async (req, res) => {
  try {
    const { url, maxPages = 1 } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    
    // Create a test session entry
    const sessionQuery = `
      INSERT INTO scraping_sessions (
        session_type,
        search_url,
        started_at,
        status,
        total_pages,
        metadata
      ) VALUES (
        'test_run',
        $1,
        NOW(),
        'completed',
        $2,
        $3
      ) RETURNING id
    `;
    
    const metadata = {
      test_url: url,
      test_pages: maxPages,
      timestamp: new Date().toISOString()
    };
    
    const result = await db.query(sessionQuery, [url, maxPages, JSON.stringify(metadata)]);
    
    // Simulate test results
    const testResults = {
      sessionId: result.rows[0].id,
      url: url,
      pagesScanned: maxPages,
      propertiesFound: Math.floor(Math.random() * 20) + 5,
      timeElapsed: Math.floor(Math.random() * 5000) + 1000,
      success: Math.random() > 0.2, // 80% success rate
      errors: Math.random() > 0.7 ? ['Sample error message'] : []
    };
    
    res.json({
      success: true,
      data: testResults
    });
    
  } catch (error) {
    console.error('Error testing crawler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test crawler'
    });
  }
});

// Get crawler performance metrics
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const { period = '7' } = req.query;
    const days = parseInt(period as string);
    
    // Sessions over time
    const sessionsQuery = `
      SELECT 
        DATE_TRUNC('day', started_at) as date,
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_sessions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions,
        SUM(properties_new) as total_new_properties,
        AVG(time_elapsed_ms) as avg_duration_ms
      FROM scraping_sessions 
      WHERE started_at >= NOW() - INTERVAL '${days} days'
        AND session_type = 'monitoring_cycle'
      GROUP BY DATE_TRUNC('day', started_at)
      ORDER BY date ASC
    `;
    
    const sessions = await db.query(sessionsQuery);
    
    // Success rate
    const successRateQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_sessions,
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            (COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal / COUNT(*)) * 100, 
            2
          )
        END as success_rate
      FROM scraping_sessions 
      WHERE started_at >= NOW() - INTERVAL '${days} days'
        AND session_type = 'monitoring_cycle'
    `;
    
    const successRate = await db.query(successRateQuery);
    
    // Top errors
    const errorsQuery = `
      SELECT 
        error_msg,
        COUNT(*) as count
      FROM (
        SELECT jsonb_array_elements_text(errors) as error_msg
        FROM scraping_sessions 
        WHERE started_at >= NOW() - INTERVAL '${days} days'
          AND errors IS NOT NULL 
          AND errors != '[]'
          AND jsonb_typeof(errors) = 'array'
      ) t
      GROUP BY error_msg
      ORDER BY count DESC
      LIMIT 10
    `;
    
    let topErrors;
    try {
      topErrors = await db.query(errorsQuery);
    } catch (error) {
      console.error('Error querying top errors, returning empty result:', error);
      topErrors = { rows: [] };
    }
    
    res.json({
      success: true,
      data: {
        period: days,
        sessionsOverTime: sessions.rows,
        successRate: successRate.rows[0] || { success_rate: 0 },
        topErrors: topErrors.rows
      }
    });
    
  } catch (error) {
    console.error('Error fetching crawler metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

// Parser Configuration API Routes

// Get all parser sites
app.get('/api/admin/parser/sites', async (req, res) => {
  try {
    const config = await parserConfigManager.loadConfig();
    res.json({
      success: true,
      data: config.sites
    });
  } catch (error) {
    console.error('Error loading parser sites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load parser sites'
    });
  }
});

// Get single parser site
app.get('/api/admin/parser/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const site = await parserConfigManager.getSite(siteId);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Parser site not found'
      });
    }
    
    res.json({
      success: true,
      data: site
    });
  } catch (error) {
    console.error('Error loading parser site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load parser site'
    });
  }
});

// Create or update parser site
app.post('/api/admin/parser/sites', async (req, res) => {
  try {
    const site = req.body;
    
    // Validate site configuration
    const errors = await parserConfigManager.validateSiteConfig(site);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    await parserConfigManager.addSite(site);
    
    res.json({
      success: true,
      message: 'Parser site saved successfully'
    });
  } catch (error) {
    console.error('Error saving parser site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save parser site'
    });
  }
});

// Update parser site
app.put('/api/admin/parser/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const updates = req.body;
    
    const success = await parserConfigManager.updateSite(siteId, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Parser site not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Parser site updated successfully'
    });
  } catch (error) {
    console.error('Error updating parser site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update parser site'
    });
  }
});

// Toggle parser site enabled/disabled
app.post('/api/admin/parser/sites/:siteId/toggle', async (req, res) => {
  try {
    const { siteId } = req.params;
    const enabled = await parserConfigManager.toggleSite(siteId);
    
    res.json({
      success: true,
      enabled,
      message: `Parser site ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error toggling parser site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle parser site'
    });
  }
});

// Delete parser site
app.delete('/api/admin/parser/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const success = await parserConfigManager.removeSite(siteId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Parser site not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Parser site deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting parser site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete parser site'
    });
  }
});

// Test parser selectors
app.post('/api/admin/parser/test-selectors', async (req, res) => {
  try {
    const { url, selectors } = req.body;
    
    if (!url || !selectors) {
      return res.status(400).json({
        success: false,
        error: 'URL and selectors are required'
      });
    }
    
    // This would normally use Playwright to test selectors
    // For now, return a mock response
    const testResults = {
      url,
      results: Object.keys(selectors).reduce((acc, field) => {
        acc[field] = {
          selector: selectors[field].selector,
          found: Math.random() > 0.3, // 70% success rate for demo
          value: `Sample ${field} value`,
          error: Math.random() > 0.8 ? `Selector not found: ${selectors[field].selector}` : null
        };
        return acc;
      }, {} as any),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: testResults
    });
  } catch (error) {
    console.error('Error testing selectors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test selectors'
    });
  }
});

// Import/Export parser configuration
app.get('/api/admin/parser/export', async (req, res) => {
  try {
    const configJson = await parserConfigManager.exportConfig();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=parser-config.json');
    res.send(configJson);
  } catch (error) {
    console.error('Error exporting parser config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export configuration'
    });
  }
});

app.post('/api/admin/parser/import', async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration data is required'
      });
    }
    
    await parserConfigManager.importConfig(JSON.stringify(config));
    
    res.json({
      success: true,
      message: 'Configuration imported successfully'
    });
  } catch (error) {
    console.error('Error importing parser config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import configuration'
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Start server
async function startServer() {
  await initializeServer();
  
  app.listen(port, () => {
    console.log(`🚀 Real Estate UI Server running on http://localhost:${port}`);
    console.log(`📊 API available at http://localhost:${port}/api`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await db.close();
  process.exit(0);
});

if (require.main === module) {
  startServer().catch(console.error);
}

export { app };