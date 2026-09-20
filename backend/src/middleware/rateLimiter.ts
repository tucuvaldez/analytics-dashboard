import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { RateLimitError } from '../errors/AppError.js';

const build = (max: number) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Route through the central error handler so the response shape stays consistent.
    handler: (_req, _res, next) => next(new RateLimitError()),
  });

/** Applied to the whole API. */
export const globalLimiter = build(env.RATE_LIMIT_MAX);

/** Much stricter limiter for login/register/refresh to slow down brute-force attempts. */
export const authLimiter = build(env.AUTH_RATE_LIMIT_MAX);
