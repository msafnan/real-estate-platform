import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../types';

/** Thrown by controllers/services to produce a specific HTTP status. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiError = {
    error: { message: `Route not found: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' },
  };
  res.status(404).json(body);
}

/**
 * Central error handler — guarantees a consistent JSON error shape (D-13).
 * Must keep 4 args so Express recognises it as an error handler.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isHttp = err instanceof HttpError;
  const statusCode = isHttp ? err.statusCode : 500;
  const message = isHttp ? err.message : 'Internal server error';

  if (!isHttp) {
    // Unexpected error — log the full thing server-side.
    // eslint-disable-next-line no-console
    console.error(err);
  }

  const body: ApiError = {
    error: {
      message,
      code: isHttp ? err.code : 'INTERNAL_ERROR',
      details: isHttp ? err.details : undefined,
    },
  };
  res.status(statusCode).json(body);
}
