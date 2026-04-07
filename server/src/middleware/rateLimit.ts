import rateLimit from 'express-rate-limit';

// Disable the IPv6 keyGenerator validation — we handle proxied IPs via X-Forwarded-For
const keyGenerator = (req: any) => {
  return req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
    || req.headers['x-real-ip']?.toString()
    || req.ip
    || 'unknown';
};

const validate = { ip: false, trustProxy: false, xForwardedForHeader: false, keyGeneratorIpFallback: false };

// Strict limit for auth endpoints (login, register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts, try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate,
});

// General API limit — generous for normal usage
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 req/min per user
  message: { error: 'Too many requests, slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate,
});

// Limit for expensive operations (AI, clipper, export, search)
export const heavyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30, // 30 req/min for heavy ops
  message: { error: 'Too many requests for this resource' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  validate,
});
