
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppDataService } from '../services/appDataService';
import { validateAuthentication, isAuthorizedForKey, UnauthorizedError, ForbiddenError } from '../services/auth';

/**
 * getData API Endpoint
 * 
 * GET /api/getData?key=keyname
 * 
 * Retrieves data from the app_data table based on the provided key
 * Requires authentication and validates authorization for the requested key
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Input validation
    const { key } = req.query;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Key parameter is required' });
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

    // Authorization - check if user has permission to access this key
    if (!isAuthorizedForKey(authContext, key)) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }

    // Fetch data from repository
    const appDataService = new AppDataService(process.env.DATABASE_URL);
    const appData = await appDataService.getData(key);

    if (!appData) {
      return res.status(200).json(null);
    }

    return res.status(200).json(appData.data);
  } catch (error: any) {
    // Log detailed error internally
    console.error('getData error:', error);

    // Return generic error message to client to prevent information leakage
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
