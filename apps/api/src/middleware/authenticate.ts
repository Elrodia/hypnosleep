import type { Request, Response, NextFunction } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { unauthenticated } from '../utils/errors.js';

const { verify } = jsonwebtoken;

export interface JwtPayload {
  userId: string;
  plan: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Express middleware to validate JWT bearer tokens.
 * Attaches decoded payload to `req.user` on success.
 * Returns 401 UNAUTHENTICATED on missing or invalid tokens.
 */
export function authenticate() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set');
  }

  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next(unauthenticated('Missing or invalid Authorization header'));
      return;
    }

    const token = authHeader.slice(7);

    try {
      const decoded = verify(token, secret) as JwtPayload;
      req.user = decoded;
      next();
    } catch {
      next(unauthenticated('Invalid or expired token'));
    }
  };
}
