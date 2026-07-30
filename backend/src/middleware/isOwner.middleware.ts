import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from './error.middleware';

/**
 * Ownership guard (Session 4). Loads the property by :id, 404s if missing,
 * 403s if the authenticated user is not the owner. On success attaches the
 * loaded property to `req.property` so handlers can reuse it without a second
 * query. Must run after `authMiddleware`.
 */
export async function isOwner(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  const property = await prisma.property.findUnique({ where: { id } });

  if (!property) {
    throw new HttpError(404, 'Property not found', 'NOT_FOUND');
  }
  if (!req.user || property.ownerId !== req.user.id) {
    throw new HttpError(403, 'You do not own this property', 'FORBIDDEN');
  }

  req.property = property;
  next();
}
