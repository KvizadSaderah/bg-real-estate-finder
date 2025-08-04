import { Pool, PoolConfig } from 'pg';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private isConnected: boolean = false;

  private constructor() {
    const config: PoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'real_estate',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20, // maximum number of clients in the pool
      idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // how long to wait for a connection
    };

    this.pool = new Pool(config);
    
    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      client.release();
      this.isConnected = true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.DB_DEBUG === 'true') {
        console.log('Query executed:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    console.log('📡 Database connection closed');
  }

  public get isConnectedStatus(): boolean {
    return this.isConnected;
  }
}

export const db = DatabaseConnection.getInstance();