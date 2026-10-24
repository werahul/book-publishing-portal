import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** Brute-force protection for the login endpoint (per client IP). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please wait a few minutes and try again.',
      },
    });
  },
});
