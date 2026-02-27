import { Client } from '@neondatabase/serverless';

/**
 * Database initialization service
 * Handles schema setup and migrations
 * Should be called once during deployment, not on every request
 */

const SCHEMA_VERSION = '1.0.0';
const INIT_COMPLETE_KEY = '__db_init_complete__';

export async function initializeDatabase(client: Client): Promise<void> {
  try {
    // Create metadata table for tracking initialization
    await client.query(`
      CREATE TABLE IF NOT EXISTS _db_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create main app_data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key_name TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indices for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_app_data_updated_at 
      ON app_data(updated_at DESC);
    `);
  } catch (error) {
    console.error('Database initialization error:', error);
    throw new Error('Failed to initialize database schema');
  }
}

/**
 * Ensures the database is initialized before use
 * Can be called from a setup/deployment script
 */
export async function ensureSchemaInitialized(databaseUrl: string): Promise<void> {
  const client = new Client(databaseUrl);
  try {
    await client.connect();
    await initializeDatabase(client);
    console.log('Database schema verified/initialized');
  } finally {
    await client.end();
  }
}
