const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestPerformanceMiddleware } = require('../src/middlewares/request-performance.middleware');

test('request performance metrics report timings and a safe path without query secrets', () => {
  const previous = process.env.API_PERF_LOGS;
  process.env.API_PERF_LOGS = 'true';
  const logs = [];
  const headers = new Map([['X-Request-Id', 'request-test']]);
  const req = { method: 'GET', originalUrl: '/api/tours/search?token=secret' };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers.set(name, value); },
    getHeader(name) { return headers.get(name); },
    json(body) { this.body = body; return this.end(JSON.stringify(body)); },
    end(body) { this.body = body; return this; }
  };
  let nextCalled = false;

  try {
    requestPerformanceMiddleware({ logger: (...args) => logs.push(args), slowRequestMs: 0 })(req, res, () => { nextCalled = true; });
    res.json({ success: true });

    assert.equal(nextCalled, true);
    assert.match(headers.get('Server-Timing'), /^serialize;dur=.*app;dur=/);
    assert.equal(logs[0][0], '[API PERF]');
    assert.equal(logs[0][1].path, '/api/tours/search');
    assert.equal(JSON.stringify(logs).includes('secret'), false);
    assert.equal(logs[0][1].requestId, 'request-test');
  } finally {
    if (previous === undefined) delete process.env.API_PERF_LOGS;
    else process.env.API_PERF_LOGS = previous;
  }
});
