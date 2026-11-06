const { store } = require('../config/db.config');

let cacheCol = null;

async function getCacheCollection() {
  if (!cacheCol) {
    await store.authenticate();
    cacheCol = store.db.collection('google_maps_cache');
    try {
      await cacheCol.createIndex({ key: 1 }, { unique: true });
      await cacheCol.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    } catch (e) {}
  }
  return cacheCol;
}

/**
 * Get cached item if it exists and has not expired
 */
async function getCache(key) {
  try {
    const col = await getCacheCollection();
    const doc = await col.findOne({ key, expireAt: { $gt: new Date() } });
    if (doc && doc.data) {
      return doc.data;
    }
  } catch (err) {
    console.warn('[MapsCache] Read error:', err.message);
  }
  return null;
}

/**
 * Store item in cache with TTL (default 7 days)
 */
async function setCache(key, data, ttlDays = 7) {
  try {
    const col = await getCacheCollection();
    const expireAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await col.updateOne(
      { key },
      { $set: { key, data, updatedAt: new Date(), expireAt } },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[MapsCache] Write error:', err.message);
  }
}

/**
 * Get stats of cache (total cached items, space)
 */
async function getCacheStats() {
  try {
    const col = await getCacheCollection();
    const count = await col.countDocuments({ expireAt: { $gt: new Date() } });
    return { count, active: true };
  } catch (err) {
    return { count: 0, active: false, error: err.message };
  }
}

module.exports = {
  getCache,
  setCache,
  getCacheStats
};

