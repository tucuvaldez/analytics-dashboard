import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticationError } from '../errors/AppError.js';

export interface AccessPayload {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export const signAccessToken = (payload: AccessPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

export const signRefreshToken = (userId: string): { token: string; expiresAt: Date } => {
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ sub: userId, jti: crypto.randomUUID() } satisfies RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.JWT_REFRESH_EXPIRES_IN_DAYS}d` as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
  return { token, expiresAt };
};

export const verifyAccessToken = (token: string): AccessPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as AccessPayload;
  } catch (err) {
    throw new AuthenticationError(
      err instanceof jwt.TokenExpiredError ? 'Access token expired' : 'Invalid access token',
    );
  }
};

export const verifyRefreshToken = (token: string): RefreshPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as RefreshPayload;
  } catch {
    throw new AuthenticationError('Invalid or expired refresh token');
  }
};

/** Refresh tokens are stored as sha256 hashes, never in plain text. */
export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
