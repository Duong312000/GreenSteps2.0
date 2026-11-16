const { performance } = require('node:perf_hooks');

function requestPerformanceMiddleware({ logger = console.info, slowRequestMs = 1000 } = {}) {
  return (req, res, next) => {
    const startedAt = performance.now();
    const path = (req.originalUrl || req.url || '').split('?')[0];
    const originalJson = res.json;
    const originalEnd = res.end;
    let recorded = false;
    let jsonStartedAt = null;

    res.json = function (...args) {
      jsonStartedAt = performance.now();
      return originalJson.apply(this, args);
    };

    res.end = function (...args) {
      if (!recorded) {
        recorded = true;
        const endedAt = performance.now();
        const durationMs = Math.round((endedAt - startedAt) * 100) / 100;
        const serializationMs = jsonStartedAt === null ? 0 : Math.round((endedAt - jsonStartedAt) * 100) / 100;
        const existingTiming = res.getHeader('Server-Timing');
        const timings = `${jsonStartedAt === null ? '' : `serialize;dur=${serializationMs}, `}app;dur=${durationMs}`;
        res.setHeader('Server-Timing', existingTiming ? `${existingTiming}, ${timings}` : timings);
        if (process.env.API_PERF_LOGS === 'true' && durationMs >= slowRequestMs) {
          logger('[API PERF]', {
            requestId: res.getHeader('X-Request-Id') || null,
            method: req.method,
            path,
            status: res.statusCode,
            durationMs,
            serializationMs,
            responseBytes: Number(res.getHeader('Content-Length')) || null,
            timestamp: new Date().toISOString()
          });
        }
      }
      return originalEnd.apply(this, args);
    };

    next();
  };
}

module.exports = { requestPerformanceMiddleware };
