function createMapsRateLimiter({ limit = 20, windowMs = 60_000, maxEntries = 10_000, overflowLimit = limit * 20, now = Date.now } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1000
    || !Number.isSafeInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(overflowLimit) || overflowLimit < 1) {
    throw new Error('Maps rate limit must have positive request, window, and memory limits.');
  }

  const requestsByIp = new Map();
  let overflow = null;
  let requestsSinceCleanup = 0;

  return (req, res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 128);
    const currentTime = now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 250) {
      for (const [key, state] of requestsByIp) {
        if (currentTime - state.startedAt >= windowMs) requestsByIp.delete(key);
      }
      requestsSinceCleanup = 0;
    }

    let state = requestsByIp.get(ip);
    if (!state && requestsByIp.size >= maxEntries) {
      for (const [key, entry] of requestsByIp) {
        if (currentTime - entry.startedAt >= windowMs) requestsByIp.delete(key);
      }
      if (requestsByIp.size >= maxEntries) {
        if (!overflow || currentTime - overflow.startedAt >= windowMs) overflow = { startedAt: currentTime, requests: 0 };
        overflow.requests += 1;
        if (overflow.requests <= overflowLimit) return next();
        return reject(res, overflow.startedAt, windowMs, currentTime);
      }
    }

    if (!state || currentTime - state.startedAt >= windowMs) {
      state = { startedAt: currentTime, requests: 0 };
      requestsByIp.set(ip, state);
    }
    state.requests += 1;
    if (state.requests <= limit) return next();
    return reject(res, state.startedAt, windowMs, currentTime);
  };
}

function reject(res, startedAt, windowMs, currentTime) {
  const retryAfter = Math.max(1, Math.ceil((startedAt + windowMs - currentTime) / 1000));
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({ success: false, code: 'MAPS_RATE_LIMITED', message: 'Quá nhiều yêu cầu bản đồ. Vui lòng thử lại sau.' });
}

module.exports = { createMapsRateLimiter };
