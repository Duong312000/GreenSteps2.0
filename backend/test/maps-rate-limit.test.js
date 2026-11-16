const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMapsRateLimiter } = require('../src/middlewares/maps-rate-limit.middleware');

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('Maps request limiter caps each IP and resets after its window', () => {
  let now = 1000;
  const limiter = createMapsRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
  let allowed = 0;
  const req = { ip: '192.0.2.10' };
  const res = responseRecorder();
  const next = () => { allowed += 1; };

  limiter(req, res, next);
  limiter(req, res, next);
  limiter(req, res, next);
  assert.equal(allowed, 2);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '1');
  assert.equal(res.body.code, 'MAPS_RATE_LIMITED');

  now += 1000;
  limiter(req, res, next);
  assert.equal(allowed, 3);
});
