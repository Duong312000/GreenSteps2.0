const express = require('express');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { softAuth } = require('../middlewares/auth.middleware');
const { validateChatInput, createChatAdapter } = require('../services/greensteps-chat.service');

function createSupportRouter(options = {}) {
  const router = express.Router();
  const send = createChatAdapter(options);
  const requests = new Map();
  router.post('/chat', softAuth, async (req, res) => {
    const start = performance.now();
    const requestId = randomUUID();
    const metrics = { path: 'validation', catalogMs: 0, n8nMs: 0 };
    const finish = () => {
      const entry = { event: 'greensteps_chat_performance', requestId, path: metrics.path, intent: metrics.intent,
        status: res.statusCode, upstreamStatus: metrics.upstreamStatus, code: metrics.code, catalogMs: metrics.catalogMs, n8nMs: metrics.n8nMs, agentMs: metrics.agentMs,
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
