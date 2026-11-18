'use strict';

const express = require('express');
const { softAuth } = require('../middlewares/auth.middleware');
const telemetry = require('../services/telemetry.service');

const router = express.Router();

// sendBeacon posts text/plain to avoid a CORS preflight; JSON bodies are already parsed globally.
const beaconText = express.text({ type: 'text/plain', limit: '64kb' });

/** Small fixed-window limiter keyed by IP + visitor id. In-memory is enough for telemetry. */
function createTelemetryLimiter({ limit = 60, windowMs = 60_000, maxEntries = 20_000 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > maxEntries) {
      for (const [key, state] of hits) if (now - state.start >= windowMs) hits.delete(key);
      if (hits.size > maxEntries) hits.clear();
    }
    let visitor = '';
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      visitor = String(body?.aid || '').slice(0, 64);
    } catch { /* invalid body is rejected by the handler */ }
    const key = `${req.ip || 'unknown'}|${visitor}`;
    const state = hits.get(key);
    if (!state || now - state.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    state.count += 1;
    if (state.count > limit) return res.status(429).json({ success: false, message: 'Too many telemetry requests.' });
    return next();
  };
}

const limiter = createTelemetryLimiter();

router.post('/batch', beaconText, limiter, softAuth, async (req, res, next) => {
  try {
    const result = await telemetry.ingestBatch({
      body: req.body,
      user: req.user,
      userAgent: req.headers['user-agent']
    });
    res.status(202).json({ success: true, ...result });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
});

router.post('/consent', beaconText, limiter, softAuth, async (req, res, next) => {
  try {
    await telemetry.recordConsent({ body: req.body, user: req.user });
    res.status(201).json({ success: true });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
});

module.exports = router;
module.exports.createTelemetryLimiter = createTelemetryLimiter;
