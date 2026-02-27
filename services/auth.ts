import type { VercelRequest } from '@vercel/node';

/**
 * Authentication and Authorization Service
 * Validates user identity and permissions
 * 
 * IMPORTANT: For production, implement Firebase Admin SDK token verification:
 * 1. Install firebase-admin: npm install firebase-admin
 * 2. Set up service account credentials in Vercel environment
 * 3. Uncomment and use the Firebase verification code below
 */

export interface AuthContext {
  userId: string;
  email?: string;
  isAuthenticated: boolean;
}

/**
 * Extracts and validates authentication token from request
 * Supports Bearer token in Authorization header
 */
export function extractAuthToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validates if a user is authenticated by verifying the token
 * 
 * IMPLEMENTATION INSTRUCTIONS:
 * Replace the current placeholder with Firebase Admin SDK validation:
 * 
 * import * as admin from 'firebase-admin';
 * 
 * export async function validateAuthentication(req: VercelRequest): Promise<AuthContext> {
 *   const token = extractAuthToken(req);
 *   if (!token) {
 *     return { userId: '', isAuthenticated: false };
 *   }
 *   try {
 *     const decodedToken = await admin.auth().verifyIdToken(token);
 *     return {
 *       userId: decodedToken.uid,
 *       email: decodedToken.email,
 *       isAuthenticated: true,
 *     };
 *   } catch (error) {
 *     console.error('Token verification failed:', error);
 *     return { userId: '', isAuthenticated: false };
 *   }
 * }
 */
export async function validateAuthentication(req: VercelRequest): Promise<AuthContext> {
  const token = extractAuthToken(req);

  if (!token) {
    return {
      userId: '',
      isAuthenticated: false,
    };
  }

  // PLACEHOLDER: This is a temporary implementation for development
  // SECURITY WARNING: This does NOT validate token authenticity
  // In production, use Firebase Admin SDK or similar to verify token signatures
  
  // Minimal validation: reject tokens that are suspiciously short
  if (token.length < 10) {
    return {
      userId: '',
      isAuthenticated: false,
    };
  }

  console.warn('[DEVELOPMENT] Using placeholder token validation - NOT suitable for production');
  
  // For development: use token as userId directly
  return {
    userId: token.substring(0, 20),
    isAuthenticated: true,
  };
}

/**
 * Checks if user is authorized to access a specific key
 * Implements object-level authorization to prevent IDOR attacks
 * 
 * Authorization Rules:
 * 1. Unauthenticated users cannot access any key
 * 2. Admin users (userId === 'admin') can access any key
 * 3. Public keys (starting with 'public_') are accessible to all authenticated users
 * 4. User-namespaced keys (user_{userId}_*) are accessible only to that user
 * 5. All other keys are denied by default (deny-all principle)
 */
export function isAuthorizedForKey(authContext: AuthContext, keyName: string): boolean {
  // Unauthenticated users cannot access any resource
  if (!authContext.isAuthenticated) {
    return false;
  }

  // Admin can access everything
  if (authContext.userId === 'admin') {
    return true;
  }

  // Public keys are accessible to all authenticated users
  if (keyName.startsWith('public_')) {
    return true;
  }

  // User can access their own namespaced keys: user_{userId}_*
  const userPrefix = `user_${authContext.userId}_`;
  if (keyName.startsWith(userPrefix)) {
    return true;
  }

  // Deny all other cases (deny-all principle)
  return false;
}

/**
 * Higher-order function to protect endpoints with authentication
 */
export function requireAuth(fn: (authContext: AuthContext) => any) {
  return async (req: VercelRequest) => {
    const authContext = await validateAuthentication(req);
    
    if (!authContext.isAuthenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    return fn(authContext);
  };
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
