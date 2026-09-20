import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
};

/** Translates known low-level errors into typed AppErrors. Returns undefined if unknown. */
const normalize = (err: unknown): AppError | undefined => {
  if (err instanceof AppError) return err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return new ConflictError('A record with these values already exists');
    if (err.code === 'P2025') return new NotFoundError('Record');
    if (err.code === 'P2023') return new ValidationError('Invalid identifier format');
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    return new ValidationError('Malformed JSON body');
  }
  // Body too large etc.
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  }
  return undefined;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const known = normalize(err);

  if (known) {
    res.status(known.statusCode).json({
      error: { code: known.code, message: known.message, ...(known.details && { details: known.details }) },
    });
    return;
  }

  // Unexpected: log the full error server-side, expose nothing to the client.
  console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(!env.isProduction && err instanceof Error && { debug: err.message }),
    },
  });
};
