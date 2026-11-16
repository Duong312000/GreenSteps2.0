const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const { createHmac, randomBytes, randomUUID } = require('node:crypto');
const { isAllowedOrigin } = require('../config/security.config');

function attachRequestId(req, res, next) {
  req.requestId = randomUUID();
  res.set('X-Request-Id', req.requestId);
  next();
}

function createCookieCsrfProtection(allowedOrigins) {
  return (req, res, next) => {
    const hasBearer = /^Bearer\s+\S+/i.test(req.headers?.authorization || '');
    const hasCookieToken = Boolean(req.cookies?.token);
    if (SAFE_METHODS.has(String(req.method || 'GET').toUpperCase()) || hasBearer || !hasCookieToken) return next();
    const origin = req.headers?.origin;
    if (isAllowedOrigin(origin, allowedOrigins)) return next();
    return res.status(403).json({ success: false, code: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not allowed.' });
  };
}

function createLoginRateLimiter({ limit = 10, windowMs = 15 * 60 * 1000, maxEntries = 10000, overflowLimit = limit * 1000, now = Date.now, onLimit = () => {} } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1000 || !Number.isSafeInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(overflowLimit) || overflowLimit < 1) {
    throw new Error('Login rate limit must have positive attempt, window, and memory limits.');
  }
  const attemptsByIp = new Map();
  let overflowState = null;
  let requestsSinceCleanup = 0;
  return (req, res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 128);
    const currentTime = now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 250) {
      for (const [key, state] of attemptsByIp) {
        if (currentTime - state.startedAt >= windowMs) attemptsByIp.delete(key);
      }
      requestsSinceCleanup = 0;
    }
    let state = attemptsByIp.get(ip);
    if (!state) {
      if (attemptsByIp.size >= maxEntries) {
        for (const [key, entry] of attemptsByIp) {
          if (currentTime - entry.startedAt >= windowMs) attemptsByIp.delete(key);
        }
      }
      if (attemptsByIp.size >= maxEntries) {
        if (!overflowState || currentTime - overflowState.startedAt >= windowMs) overflowState = { startedAt: currentTime, attempts: 0, limitEventRecorded: false };
        overflowState.attempts += 1;
        if (overflowState.attempts <= overflowLimit) return next();
        if (!overflowState.limitEventRecorded) {
          overflowState.limitEventRecorded = true;
          try { onLimit(req); } catch {}
        }
        const retryAfter = Math.max(1, Math.ceil((overflowState.startedAt + windowMs - currentTime) / 1000));
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ success: false, code: 'LOGIN_RATE_LIMITED', message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.' });
      }
      state = { startedAt: currentTime, attempts: 0, limitEventRecorded: false };
      attemptsByIp.set(ip, state);
    } else if (currentTime - state.startedAt >= windowMs) {
      state = { startedAt: currentTime, attempts: 0, limitEventRecorded: false };
      attemptsByIp.set(ip, state);
    }
    state.attempts += 1;
    if (state.attempts <= limit) return next();
    if (!state.limitEventRecorded) {
      state.limitEventRecorded = true;
      try { onLimit(req); } catch {}
    }
    const retryAfter = Math.max(1, Math.ceil((state.startedAt + windowMs - currentTime) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, code: 'LOGIN_RATE_LIMITED', message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.' });
  };
}
function createAdminAccessEventRecorder(recordEvent) {
  return (req, res, next) => {
    res.once('finish', () => {
      const path = String(req.originalUrl || req.path || '').split('?')[0];
      if (!/\/api(?:\/v1)?\/admin(?:\/|$)/.test(path) || ![401, 403].includes(res.statusCode)) return;
      Promise.resolve(recordEvent({ req, status: res.statusCode })).catch(() => {});
    });
    next();
  };
}

module.exports = { attachRequestId, createAdminAccessEventRecorder, createCookieCsrfProtection, createLoginRateLimiter };
