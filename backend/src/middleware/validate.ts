import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError, type ErrorDetail } from '../errors/AppError.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and *replaces* req.body / req.query / req.params with the parsed
 * (coerced, stripped) values, so handlers only ever see clean data.
 */
export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const details: ErrorDetail[] = [];

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
      } else {
        for (const issue of result.error.issues) {
          details.push({ field: [key, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) throw new ValidationError('Validation failed', details);
    next();
  };
