
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataService } from '../services/appDataService';
import { validateAuthentication, isAuthorizedForKey, UnauthorizedError, ForbiddenError } from '../services/auth';

/**
 * saveData API Endpoint
 * 
 * POST /api/saveData
 * Body: { key: string, value: unknown }
 * 
 * Saves or updates data in the app_data table
 * Requires authentication and validates authorization for the provided key
 * 
 * Security features:
 * - Authentication required (Bearer token)
 * - Authorization checks per key (IDOR prevention)
 * - Generic error messages to prevent information leakage
 * - No DDL operations (schema management moved to separate service)
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Input validation
    const { key, value } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Key is required and must be a string' });
    }

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL not configured');
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Authentication
    const authContext = await validateAuthentication(req);
    if (!authContext.isAuthenticated) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Authorization - check if user has permission to write to this key
    if (!isAuthorizedForKey(authContext, key)) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }

    // Save data through repository
    const appDataService = new AppDataService(process.env.DATABASE_URL);
    const result = await appDataService.saveData(key, value);

    return res.status(200).json({ success: true, key: result.keyName });
  } catch (error: any) {
    // Log detailed error internally
    console.error('saveData error:', error);

    // Return generic error message to client to prevent information leakage
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
