import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AuthenticationError, ConflictError, NotFoundError } from '../errors/AppError.js';
import { authenticate, currentUser } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';

const router = Router();

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Invalid email address'));

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt ignores bytes past 72
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerBody = z.object({ email, password });
// On login we deliberately don't enforce password *format*, only presence.
const loginBody = z.object({ email, password: z.string().min(1, 'Password is required').max(72) });
// The refresh token normally travels in an httpOnly cookie; the body is a fallback for curl/mobile clients.
const tokenBody = z.object({ refreshToken: z.string().min(1).optional() });

const REFRESH_COOKIE = 'refresh_token';
const cookieOptions = () =>
  ({
    httpOnly: true, // not readable from JS => XSS cannot steal it
    secure: env.isProduction || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/auth', // only sent to /auth/* endpoints
  }) as const;

const readRefreshToken = (req: Request): string => {
  const token = (req.body as z.infer<typeof tokenBody>).refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== 'string' || !token) throw new AuthenticationError('Refresh token required');
  return token;
};

/**
 * Sets the refresh cookie and sends the session. Browser clients send
 * `X-Token-Delivery: cookie` and never see the refresh token in the body.
 */
function sendSession(
  req: Request,
  res: Response,
  status: number,
  tokens: Awaited<ReturnType<typeof issueTokens>>,
  user?: ReturnType<typeof publicUser>,
) {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions(),
    maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  });
  const { refreshToken, ...rest } = tokens;
  const cookieOnly = req.get('x-token-delivery') === 'cookie';
  res.status(status).json({ data: { ...(user && { user }), ...(cookieOnly ? rest : { ...rest, refreshToken }) } });
}

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_ROUNDS);

const publicUser = (u: { id: string; email: string; role: string; createdAt: Date }) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
});

async function issueTokens(user: { id: string; email: string; role: 'USER' | 'ADMIN' }) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken, expiresAt } = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
  });
  return { accessToken, refreshToken, tokenType: 'Bearer' as const };
}

router.post(
  '/register',
  authLimiter,
  validate({ body: registerBody }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof registerBody>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email is already registered');

    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, env.BCRYPT_ROUNDS) },
    });

    sendSession(req, res, 201, await issueTokens(user), publicUser(user));
  }),
);

router.post(
  '/login',
  authLimiter,
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginBody>;

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    // Same message for "unknown email" and "wrong password" (no user enumeration).
    if (!user || !valid) throw new AuthenticationError('Invalid email or password');

    sendSession(req, res, 200, await issueTokens(user), publicUser(user));
  }),
);

// No authLimiter here: a refresh needs a valid signed token (nothing to brute-force) and the
// browser app calls it on every page load, so it only falls under the global limiter.
router.post(
  '/refresh',
  validate({ body: tokenBody }),
  asyncHandler(async (req, res) => {
    const refreshToken = readRefreshToken(req);
    const payload = verifyRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });

    if (!stored || stored.userId !== payload.sub) throw new AuthenticationError('Invalid or expired refresh token');

    if (stored.revokedAt) {
      // A rotated token was presented again: assume theft and kill every session for this user.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AuthenticationError('Refresh token already used');
    }
    if (stored.expiresAt <= new Date()) throw new AuthenticationError('Invalid or expired refresh token');

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new AuthenticationError('Invalid or expired refresh token');

    // Rotation: revoke atomically. If two requests race with the same token only one wins.
    const revoked = await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new AuthenticationError('Refresh token already used');

    sendSession(req, res, 200, await issueTokens(user));
  }),
);

router.post(
  '/logout',
  validate({ body: tokenBody }),
  asyncHandler(async (req, res) => {
    const refreshToken = (req.body as z.infer<typeof tokenBody>).refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken === 'string' && refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    res.status(204).send();
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: currentUser(req).id } });
    if (!user) throw new NotFoundError('User');
    res.json({ data: { user: publicUser(user) } });
  }),
);

export default router;
