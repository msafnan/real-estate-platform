import rateLimit from 'express-rate-limit';
import { ApiError } from '../types';

const tooManyRequests: ApiError = {
  error: { message: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
};

/**
 * Strict limiter for auth endpoints to blunt brute-force / credential-stuffing
 * (Session 3). 10 attempts per IP per 15 minutes.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequests,
});

/**
 * Inquiry submission limiter (Session 7). Blunts rapid-fire lead spam from a
 * single source: 5 submissions per IP per 15 minutes. Keyed by authenticated
 * user id when present, else IP (so a logged-in user is limited per-account).
 */
export const inquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequests,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
});
