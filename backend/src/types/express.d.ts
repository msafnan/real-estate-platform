import { Property } from '@prisma/client';
import { AuthenticatedUser } from './index';

// Declaration merging: make `req.user` (set by authMiddleware) and
// `req.property` (set by the isOwner guard) available across the app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      property?: Property;
    }
  }
}

export {};
