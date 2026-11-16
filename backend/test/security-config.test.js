const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { getJwtSecret, parseAllowedOrigins, isAllowedOrigin, createCorsOptions } = require('../src/config/security.config');

test('required authentication configuration rejects a missing JWT secret', () => {
  assert.throws(() => getJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET is required/);
});

test('JWT configuration rejects short secrets and accepts the documented minimum', () => {
  assert.throws(() => getJwtSecret({ JWT_SECRET: 's'.repeat(29) }), /at least 30 characters/);
  assert.equal(getJwtSecret({ JWT_SECRET: 's'.repeat(30) }).length, 30);
});

test('development CORS allowlist includes local frontend and configured exact origins', () => {
  const origins = parseAllowedOrigins({
    NODE_ENV: 'development',
    CLIENT_URL: 'https://greensteps.example',
    CORS_ALLOWED_ORIGINS: 'https://admin.example, http://localhost:4200'
  });
  assert.deepEqual([...origins].sort(), [
    'http://127.0.0.1:4200', 'http://localhost:4200',
    'https://admin.example', 'https://greensteps.example'
  ]);
  assert.equal(isAllowedOrigin('https://admin.example', origins), true);
  assert.equal(isAllowedOrigin('https://admin.example.attacker.test', origins), false);
});

test('production CORS requires an explicit frontend origin and rejects URL paths', () => {
  assert.throws(() => parseAllowedOrigins({ NODE_ENV: 'production' }), /CORS_ALLOWED_ORIGINS or CLIENT_URL is required/);
  assert.throws(() => parseAllowedOrigins({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://greensteps.example/path' }), /must be an origin/);
});

test('CORS callback permits an exact origin with credentials and rejects lookalike hosts', async () => {
  const options = createCorsOptions(new Set(['https://greensteps.example']));
  assert.equal(options.credentials, true);
  await new Promise((resolve, reject) => options.origin('https://greensteps.example', (error, allowed) => {
    try { assert.equal(error, null); assert.equal(allowed, true); resolve(); } catch (assertionError) { reject(assertionError); }
  }));
  await new Promise(resolve => options.origin('https://greensteps.example.attacker.test', error => {
    assert.equal(error.code, 'CORS_ORIGIN_DENIED');
    assert.equal(error.statusCode, 403);
    resolve();
  }));
});

test('CORS preflight grants credentials only to configured origins', async t => {
  const app = express();
  app.use(cors(createCorsOptions(new Set(['https://greensteps.example']))));
  app.post('/write', (_req, res) => res.sendStatus(204));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/write`;

  const allowed = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: 'https://greensteps.example',
    'Access-Control-Request-Method': 'POST'
  } });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://greensteps.example');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const denied = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: 'https://attacker.example',
    'Access-Control-Request-Method': 'POST'
  } });
  assert.equal(denied.status, 403);
});
