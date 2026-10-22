const NodeCache = require('node-cache');
const cache = new NodeCache();

/**
 * Express middleware for in-memory caching.
 * Caches the JSON response of GET requests for the specified duration.
 * @param {number} durationSec - Cache TTL in seconds (default: 600 = 10 minutes)
 */
const cacheMiddleware = (durationSec = 600) => (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET' || req.query.nocache === 'true' || req.headers['x-no-cache'] === 'true') return next();

  const key = req.originalUrl || req.url;
  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  // Override res.json to intercept and cache the response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    cache.set(key, body, durationSec);
    originalJson(body);
  };
  next();
};

/**
 * Clear cached entries matching a pattern substring.
 * Call this after data mutations (create/update/delete).
 * @param {string} pattern - Substring to match against cache keys
 */
const clearCache = (pattern) => {
  const keys = cache.keys().filter(k => k.includes(pattern));
  keys.forEach(k => cache.del(k));
};

module.exports = { cacheMiddleware, clearCache };
