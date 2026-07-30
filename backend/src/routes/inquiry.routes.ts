import { Router } from 'express';
import { createInquiry, listInquiries } from '../controllers/inquiry.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { isOwner } from '../middleware/isOwner.middleware';
import { inquiryRateLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createInquirySchema } from '../validators/inquiry.validators';
import { idParamSchema } from '../validators/property.validators';

// mergeParams so the parent :id (property id) is visible here.
const router = Router({ mergeParams: true });

// Public submit — rate-limited + validated.
router.post(
  '/',
  inquiryRateLimiter,
  validate(idParamSchema),
  validate(createInquirySchema),
  asyncHandler(createInquiry),
);

// Owner-only lead list.
router.get(
  '/',
  authMiddleware,
  validate(idParamSchema),
  asyncHandler(isOwner),
  asyncHandler(listInquiries),
);

export default router;
