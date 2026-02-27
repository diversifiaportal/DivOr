import { Client, Pool } from '@neondatabase/serverless';

/**
 * Application Data Repository Service
 * Handles CRUD operations for app_data table
 * Separated from HTTP handling and authentication concerns
 */

export interface AppData {
  keyName: string;
  data: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

// Connection pool instance - shared across serverless function invocations
let poolInstance: Pool | null = null;

/**
 * Gets or creates a connection pool for the database
 * Reuses connections across serverless invocations to avoid connection overhead
 */
function getPool(databaseUrl: string): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: databaseUrl });
  }
  return poolInstance;
}

export class AppDataService {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = getPool(databaseUrl);
  }

  /**
   * Retrieves data for a given key
   */
  async getData(keyName: string): Promise<AppData | null> {
    try {
      const result = await this.pool.query(
        'SELECT key_name, data, created_at, updated_at FROM app_data WHERE key_name = $1',
        [keyName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        keyName: row.key_name,
        data: row.data,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      };
    } catch (error) {
      console.error('Error retrieving data from database:', error);
      throw error;
    }
  }

  /**
   * Saves or updates data for a given key
   */
  async saveData(keyName: string, data: unknown): Promise<AppData> {
    try {
      const query = `
        INSERT INTO app_data (key_name, data, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (key_name)
        DO UPDATE SET data = $2, updated_at = NOW()
        RETURNING key_name, data, created_at, updated_at;
      `;

      const result = await this.pool.query(query, [
        keyName,
        JSON.stringify(data),
      ]);

      const row = result.rows[0];
      return {
        keyName: row.key_name,
        data: JSON.parse(row.data),
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      };
    } catch (error) {
      console.error('Error saving data to database:', error);
      throw error;
    }
  }

  /**
   * Deletes data for a given key
   */
  async deleteData(keyName: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM app_data WHERE key_name = $1',
        [keyName]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting data from database:', error);
      throw error;
    }
  }

  /**
   * Lists all keys (with optional filtering)
   */
  async listKeys(pattern?: string): Promise<string[]> {
    try {
      let query = 'SELECT key_name FROM app_data';
      const params: string[] = [];

      if (pattern) {
        query += ' WHERE key_name LIKE $1';
        params.push(pattern);
      }

      query += ' ORDER BY updated_at DESC';

      const result = await this.pool.query(query, params);
      return result.rows.map((row) => row.key_name);
    } catch (error) {
      console.error('Error listing keys from database:', error);
      throw error;
    }
  }
}
