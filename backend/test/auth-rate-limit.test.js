const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoginRateLimiter } = require('../src/middlewares/security.middleware');

function response() {
  return { statusCode: 200, headers: {}, body: null, set(name, value) { this.headers[name] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('login limiter throttles an IP temporarily and allows it again after the window', () => {
  let now = 1_000;
  const limiter = createLoginRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });
  const run = () => { const res = response(); let nextCalled = false; limiter({ ip: '203.0.113.8', headers: {} }, res, () => { nextCalled = true; }); return { res, nextCalled }; };
  assert.equal(run().nextCalled, true);
  assert.equal(run().nextCalled, true);
  const limited = run();
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.res.headers['Retry-After'], '60');
  now += 60_001;
  assert.equal(run().nextCalled, true);
});

test('login limiter bounds exact per-IP state and protects overflow without cross-IP collisions', () => {
  let now = 1_000;
  let blockedEvents = 0;
  const limiter = createLoginRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 1, overflowLimit: 2, now: () => now, onLimit: () => blockedEvents += 1 });
  const run = ip => { const res = response(); let nextCalled = false; limiter({ ip, headers: {} }, res, () => { nextCalled = true; }); return { res, nextCalled }; };
  assert.equal(run('ip-a').nextCalled, true);
  assert.equal(run('ip-b').nextCalled, true);
  assert.equal(run('ip-c').nextCalled, true);
  assert.equal(run('ip-d').res.statusCode, 429);
  assert.equal(run('ip-a').res.statusCode, 429);
  assert.equal(run('ip-a').res.statusCode, 429);
  assert.equal(blockedEvents, 2);
  now += 60_001;
  assert.equal(run('ip-b').nextCalled, true);
});