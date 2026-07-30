import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { HttpError } from './error.middleware';

/**
 * Verifies the Bearer access token on protected routes and attaches
 * `req.user` (D-3). Rejects with 401 if the token is missing/invalid/expired.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or malformed Authorization header', 'UNAUTHENTICATED');
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    throw new HttpError(401, 'Invalid or expired access token', 'UNAUTHENTICATED');
  }
}
