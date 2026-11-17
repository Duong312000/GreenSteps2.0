const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createChatAccess, catalogKeyMatches, TOKEN_TTL_SECONDS } = require('../src/services/n8n-chat-access.service');
const { createSupportRouter } = require('../src/routes/support.routes');

const secret = 'test-chat-secret-with-at-least-thirty-two-characters';
const env = {
  N8N_CHAT_WEBHOOK_URL: 'https://n8n.example.test/webhook/greensteps',
  N8N_CHAT_JWT_SECRET: secret,
  N8N_CATALOG_API_KEY: 'test-catalog-api-key'
};

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise(resolve => server.close(resolve));
}

async function withRouter(options, run) {
  const app = express();
  app.use(express.json());
  app.use('/api/support', createSupportRouter(options));
  const server = http.createServer(app);
  const base = await listen(server);
  try { await run(base); }
  finally { await close(server); }
}

test('chat access issues a scoped two-minute HS256 token for the configured webhook', () => {
  const access = createChatAccess({ env, userId: 'user-123' });
  const claims = jwt.verify(access.token, secret, {
    algorithms: ['HS256'], issuer: 'greensteps-backend', audience: 'greensteps-n8n-chat'
  });

  assert.equal(access.success, true);
  assert.equal(access.webhookUrl, env.N8N_CHAT_WEBHOOK_URL);
  assert.equal(access.expiresIn, TOKEN_TTL_SECONDS);
  assert.equal(claims.scope, 'greensteps:chat');
  assert.equal(claims.sub, 'user-123');
  assert.equal(claims.exp - claims.iat, 120);
});

test('chat access refuses missing secrets and non-HTTPS production webhook URLs', () => {
  assert.throws(() => createChatAccess({ env: { ...env, N8N_CHAT_JWT_SECRET: 'short' } }), error => error.code === 'CHAT_NOT_CONFIGURED');
  assert.throws(() => createChatAccess({ env: { ...env, N8N_CHAT_WEBHOOK_URL: 'http://n8n.example.test/webhook/chat' } }), error => error.code === 'CHAT_NOT_CONFIGURED');
});

test('catalog API key comparison accepts only the configured non-empty key', () => {
  assert.equal(catalogKeyMatches(env.N8N_CATALOG_API_KEY, env.N8N_CATALOG_API_KEY), true);
  assert.equal(catalogKeyMatches('wrong-key', env.N8N_CATALOG_API_KEY), false);
  assert.equal(catalogKeyMatches('', env.N8N_CATALOG_API_KEY), false);
  assert.equal(catalogKeyMatches(env.N8N_CATALOG_API_KEY, undefined), false);
});

test('chat-access endpoint returns a browser token and catalog endpoint forwards destination to the read-only loader', async () => {
  let catalogRequest;
  const catalog = { available: true, query: { destination: 'Đà Lạt', durationDays: 3 }, tours: [{ id: 'dalat-3d', title: 'Đà Lạt xanh', days: 3 }], services: [] };

  await withRouter({
    env,
    catalogLoader: async request => { catalogRequest = request; return catalog; }
  }, async base => {
    const accessResponse = await fetch(`${base}/api/support/chat-access`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(accessResponse.status, 200);
    const access = await accessResponse.json();
    assert.equal(access.success, true);
    assert.equal(access.webhookUrl, env.N8N_CHAT_WEBHOOK_URL);
    assert.equal(jwt.verify(access.token, secret).scope, 'greensteps:chat');

    const catalogResponse = await fetch(`${base}/api/support/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GreenSteps-Catalog-Key': env.N8N_CATALOG_API_KEY },
      body: JSON.stringify({ message: 'Tìm tour 3 ngày 2 đêm Đà Lạt', requestIntent: 'tour_search', destination: 'Đà Lạt' })
    });
    assert.equal(catalogResponse.status, 200);
    assert.deepEqual(await catalogResponse.json(), { success: true, catalog });
    assert.equal(catalogRequest.query.destination, 'Đà Lạt');
    assert.equal(catalogRequest.query.durationDays, 3);
    assert.equal(catalogRequest.includeServices, false);
    assert.equal(catalogRequest.includeServiceCandidates, false);
  });
});

test('catalog endpoint rejects an invalid API key and malformed chat messages', async () => {
  await withRouter({ env, catalogLoader: async () => { throw new Error('loader must not run'); } }, async base => {
    const unauthorized = await fetch(`${base}/api/support/catalog`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GreenSteps-Catalog-Key': 'wrong' },
      body: JSON.stringify({ message: 'Tìm tour Đà Lạt' })
    });
    assert.equal(unauthorized.status, 401);

    const invalid = await fetch(`${base}/api/support/catalog`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GreenSteps-Catalog-Key': env.N8N_CATALOG_API_KEY },
      body: JSON.stringify({ message: '  ' })
    });
    assert.equal(invalid.status, 400);
  });
});
