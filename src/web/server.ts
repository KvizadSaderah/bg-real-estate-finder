import express from 'express';
import cors from 'cors';
import { db } from '../database/connection';
import { PropertyService } from '../database/PropertyService';
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
        ps.labels
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