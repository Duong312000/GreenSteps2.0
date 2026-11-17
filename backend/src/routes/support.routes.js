const express = require('express');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { softAuth } = require('../middlewares/auth.middleware');
const { validateChatInput, createChatAdapter } = require('../services/greensteps-chat.service');
const { createChatAccess, catalogKeyMatches } = require('../services/n8n-chat-access.service');
const { loadAgentCatalog, queryFromRequest } = require('../services/greensteps-agent-catalog.service');

function rateLimit(requests, req, now = Date.now()) {
  const key = req.user?.id || req.ip || 'unknown';
  for (const [id, entry] of requests) if (entry.expires < now) requests.delete(id);
  const entry = requests.get(key) || { expires: now + 60000, count: 0 };
  entry.count++;
  requests.set(key, entry);
  return entry.count <= 20;
}

function createSupportRouter(options = {}) {
  const router = express.Router();
  const send = createChatAdapter(options);
  const env = options.env || process.env;
  const catalogLoader = options.catalogLoader || loadAgentCatalog;
  const requests = new Map();

  router.post('/chat-access', softAuth, (req, res) => {
    if (!rateLimit(requests, req)) {
      res.set('Retry-After', '60');
      return res.status(429).json({ success: false, code: 'CHAT_RATE_LIMITED', message: 'Too many chat requests. Try again in a minute.' });
    }
    try {
      return res.json(createChatAccess({ env, userId: req.user?.id }));
    } catch (error) {
      return res.status(error.statusCode || 503).json({
        success: false,
        code: error.code || 'CHAT_NOT_CONFIGURED',
        message: error.message || 'AI chat is not configured.'
      });
    }
  });

  router.post('/catalog', async (req, res) => {
    const expectedKey = env.N8N_CATALOG_API_KEY;
    if (!catalogKeyMatches(req.get('X-GreenSteps-Catalog-Key'), expectedKey)) {
      return res.status(401).json({ success: false, code: 'CATALOG_UNAUTHORIZED' });
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 4000) {
      return res.status(400).json({ success: false, code: 'CATALOG_INPUT_INVALID' });
    }
    const requestIntent = ['itinerary', 'tour_search'].includes(req.body?.requestIntent)
      ? req.body.requestIntent
      : 'general';
    const catalogPage = Number.isInteger(req.body?.catalogPage) && req.body.catalogPage > 0
      ? Math.min(req.body.catalogPage, 10000)
      : 1;
    try {
      const catalog = await catalogLoader({
        query: queryFromRequest({ message, destination: req.body?.destination, catalogPage }),
        includeServiceCandidates: requestIntent === 'itinerary',
        includeServices: requestIntent !== 'tour_search'
      });
      if (!catalog.available) {
        return res.status(503).json({ success: false, code: 'CHAT_CATALOG_UNAVAILABLE' });
      }
      return res.json({ success: true, catalog });
    } catch {
      return res.status(503).json({ success: false, code: 'CHAT_CATALOG_UNAVAILABLE' });
    }
  });

  router.post('/chat', softAuth, async (req, res) => {
    const start = performance.now();
    const requestId = randomUUID();
    const metrics = { path: 'validation', catalogMs: 0, n8nMs: 0 };
    const finish = () => {
      const entry = { event: 'greensteps_chat_performance', requestId, path: metrics.path, intent: metrics.intent,
        status: res.statusCode, upstreamStatus: metrics.upstreamStatus, upstreamErrorName: metrics.upstreamErrorName,
        upstreamErrorCode: metrics.upstreamErrorCode, upstreamErrorSyscall: metrics.upstreamErrorSyscall,
        code: metrics.code, catalogMs: metrics.catalogMs, n8nMs: metrics.n8nMs, agentMs: metrics.agentMs,
        totalApiMs: Math.round((performance.now() - start) * 100) / 100, disconnected: !res.writableEnded };
      (options.logger || console.info)(JSON.stringify(entry));
    };
    res.once('close', finish);
    res.set('X-Request-Id', requestId);
    res.set('Access-Control-Expose-Headers', 'Server-Timing, X-Chat-Path, X-Request-Id');
    const timing = () => {
      res.set('X-Chat-Path', metrics.path);
      res.set('Server-Timing', `catalog;dur=${metrics.catalogMs}, n8n;dur=${metrics.n8nMs}, api;dur=${(performance.now() - start).toFixed(2)}`);
    };
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    try {
      const input = validateChatInput(req.body);
      const now = Date.now();
      const key = req.user?.id || req.ip;
      for (const [id, entry] of requests) if (entry.expires < now) requests.delete(id);
      const entry = requests.get(key) || { expires: now + 60000, count: 0 };
      entry.count++;
      requests.set(key, entry);
      if (entry.count > 20) return res.status(429).json({ success: false, code: 'CHAT_RATE_LIMITED', message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ một phút nhé.' });
      req.once('aborted', disconnect);
      res.once('close', disconnect);
      const result = await send(input, { signal: controller.signal, metrics });
      if (!controller.signal.aborted) { timing(); res.json(result); }
    } catch (error) {
      metrics.code = error.code || 'CHAT_UNAVAILABLE';
      if (!controller.signal.aborted) { timing(); res.status(error.statusCode || 502).json({ success: false, code: metrics.code, message: error.message || 'Trợ lý AI tạm thời chưa sẵn sàng.' }); }
    } finally {
      req.off('aborted', disconnect);
      res.off('close', disconnect);
    }
  });
  return router;
}
module.exports = createSupportRouter();
module.exports.createSupportRouter = createSupportRouter;
