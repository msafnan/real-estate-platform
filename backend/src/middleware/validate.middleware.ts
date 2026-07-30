import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HttpError } from './error.middleware';

/**
 * Generic Zod validation middleware (D-10). Validates `body`, `query` and
 * `params` against the given schema and replaces them with the parsed
 * (typed, coerced) values. On failure, forwards a 400 with field details.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      throw new HttpError(
        400,
        'Validation failed',
        'VALIDATION_ERROR',
        result.error.flatten(),
      );
    }

    // Assign parsed values back (coerced types, stripped unknown keys).
    const parsed = result.data as {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
    if (parsed.body !== undefined) req.body = parsed.body;
    // req.query / req.params are read-only getters on some Express versions;
    // assign defensively.
    if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
    if (parsed.params !== undefined) Object.assign(req.params, parsed.params);

    next();
  };
}
