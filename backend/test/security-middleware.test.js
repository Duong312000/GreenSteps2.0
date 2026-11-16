const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCookieCsrfProtection } = require('../src/middlewares/security.middleware');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('cookie authentication blocks unsafe requests without an allowlisted origin', () => {
  const middleware = createCookieCsrfProtection(new Set(['https://greensteps.example']));
  const res = response(); let nextCalled = false;
  middleware({ method: 'POST', cookies: { token: 'cookie-jwt' }, headers: {} }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('cookie authentication accepts unsafe requests from the exact configured origin', () => {
  const middleware = createCookieCsrfProtection(new Set(['https://greensteps.example']));
  const res = response(); let nextCalled = false;
  middleware({ method: 'PATCH', cookies: { token: 'cookie-jwt' }, headers: { origin: 'https://greensteps.example' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('Bearer authentication is not blocked by cookie CSRF protection', () => {
  const middleware = createCookieCsrfProtection(new Set(['https://greensteps.example']));
  const res = response(); let nextCalled = false;
  middleware({ method: 'POST', cookies: { token: 'stale-cookie' }, headers: { authorization: 'Bearer valid-token' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
