import type { NextFunction, Request, Response } from 'express';
import { AuthenticationError, AuthorizationError } from '../errors/AppError.js';
import { verifyAccessToken, type AccessPayload } from '../utils/tokens.js';

export interface AuthUser {
  id: string;
  email: string;
  role: AccessPayload['role'];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Requires `Authorization: Bearer <accessToken>`. */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or malformed Authorization header');
  }
  const payload = verifyAccessToken(header.slice(7).trim());
  req.user = { id: payload.sub, email: payload.email, role: payload.role };
  next();
};

/** Same as `authenticate` but lets anonymous requests through (used for public dashboards). */
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.headers.authorization) return next();
  authenticate(req, res, next);
};

export const requireRole =
  (...roles: AuthUser['role'][]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AuthenticationError();
    if (!roles.includes(req.user.role)) throw new AuthorizationError();
    next();
  };

/** Returns the authenticated user or throws — keeps handlers free of `!` assertions. */
export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw new AuthenticationError();
  return req.user;
};
