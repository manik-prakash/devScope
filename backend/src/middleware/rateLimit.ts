import { rateLimit } from 'express-rate-limit';
import { Request } from 'express';

export const sessionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // limit each API key to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.apiKey?.id || req.ip || 'anonymous';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
    });
  },
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
    });
  },
});
