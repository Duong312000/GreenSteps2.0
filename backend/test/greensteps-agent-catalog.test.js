const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAgentCatalog } = require('../src/services/greensteps-agent-catalog.service');
const { createChatAdapter } = require('../src/services/greensteps-chat.service');

const env = { PORT: '5055', N8N_CATALOG_ENABLED: 'true', N8N_WEBHOOK_URL: 'http://127.0.0.1:9999/webhook-test/v2', N8N_AUTH_HEADER_NAME: 'X-Test-Key', N8N_AUTH_HEADER_VALUE: 'test-secret' };
const tours = [{ id: 'tour-01', title: 'Tour Đà Lạt', cost: null, carbon: '', days: 3, tags: ['x'], provider_id: 'private', internal_notes: 'private' }];
const services = [
  { id: 'pending-01', name: 'Hidden', status: 'pending' },
  { id: 'unknown-01', name: 'Hidden' },
  { id: 'service-01', name: 'Stay', status: 'active', cost: '500000', carbon: 0, current_data: { email: 'private' } }
];
const listResponse = rows => new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });

test('catalog filters unpublished services, forwards only public fields and preserves missing numbers', async () => {
  const calls = [];
  const catalog = await loadAgentCatalog({ env, fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['X-Test-Key'], undefined);
    return listResponse(url.endsWith('/tours') ? tours : services);
  } });
  assert.deepEqual(calls.sort(), ['http://127.0.0.1:5055/api/services', 'http://127.0.0.1:5055/api/tours']);
  assert.equal(catalog.available, true);
  assert.equal(catalog.tours[0].cost, null);
  assert.equal(catalog.tours[0].carbon, null);
  assert.equal(catalog.services.length, 1);
  assert.equal(catalog.services[0].cost, 500000);
  assert.equal(catalog.services[0].carbon, 0);
  assert.equal(JSON.stringify(catalog).includes('private'), false);
});

test('catalog passes through only an explicit boolean bookability signal', async () => {
  const rows = [
    { id: 'bookable', title: 'Tour bookable', bookingAvailable: true },
    { id: 'not-bookable', title: 'Tour closed', bookingAvailable: false },
    { id: 'untrusted', title: 'Tour unclear', bookingAvailable: 'true' }
  ];
  const catalog = await loadAgentCatalog({ env, fetchImpl: async url => listResponse(url.endsWith('/tours') ? rows : []) });

  assert.equal(catalog.tours[0].bookingAvailable, true);
  assert.equal(catalog.tours[1].bookingAvailable, false);
  assert.equal(catalog.tours[2].bookingAvailable, undefined);
});

test('catalog caps only eligible rows and discloses truncation', async () => {
  const rows = Array.from({ length: 81 }, (_, i) => ({ id: `tour-${i}`, title: 'Tour' }));
  const result = await loadAgentCatalog({ env, fetchImpl: async url => listResponse(url.endsWith('/tours') ? rows : Array(90).fill(services[0]).concat(services[2])) });
  assert.equal(result.tours.length, 80);
  assert.equal(result.services.length, 1);
  assert.equal(result.truncated, true);
});

test('disabled or failed catalog returns unavailable without fabricating records', async () => {
  const disabled = await loadAgentCatalog({ env: {}, fetchImpl: () => { throw new Error('Must not call'); } });
  assert.equal(disabled.reason, 'disabled');
  for (const fetchImpl of [async () => new Response('error', { status: 500 }), async () => listResponse({ tours }), async () => { throw new Error('private connection details'); }]) {
    const result = await loadAgentCatalog({ env, fetchImpl });
    assert.equal(result.available, false);
    assert.deepEqual(result.tours, []);
    assert.equal(JSON.stringify(result).includes('private'), false);
  }
});

test('V2 proxy sends sanitized catalog, strips identity and propagates cancellation before webhook', async () => {
  let payload, posts = 0;
  const adapter = createChatAdapter({ env, fetchImpl: async (url, options) => {
    if (options.method === 'GET') return listResponse(url.endsWith('/tours') ? tours : services);
    posts++;
    payload = JSON.parse(options.body);
    return listResponse({ output: 'Tours from V2', success: true });
  } });
  const input = { message: 'Tìm tour', sessionId: 'catalog-test-session', history: [] };
  assert.equal((await adapter(input, { userId: 'private-user' })).reply, 'Tours from V2');
  assert.equal(payload.context.catalog.available, true);
  assert.equal(payload.context.catalog.services.length, 1);
  assert.equal(JSON.stringify(payload).includes('private'), false);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(adapter(input, { signal: controller.signal }), error => error.code === 'CHAT_CANCELLED');
  assert.equal(posts, 1);
});
