const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadAgentCatalog } = require('../src/services/greensteps-agent-catalog.service');
const { createChatAdapter } = require('../src/services/greensteps-chat.service');
const { createCatalogModels } = require('./helpers/greensteps-catalog-models');

const env = { N8N_WEBHOOK_URL: 'http://127.0.0.1:9999/webhook-test/v2', N8N_AUTH_HEADER_NAME: 'X-Test-Key', N8N_AUTH_HEADER_VALUE: 'test-secret', N8N_CATALOG_CACHE_MS: '0' };
const tours = [{ id: 'tour-01', title: 'Tour Đà Lạt', destination: 'Đà Lạt', cost: null, carbon: '', days: 3, tags: ['x'], provider_id: 'private', internal_notes: 'private' }];
const services = [
  { id: 'pending-01', name: 'Hidden', status: 'pending' },
  { id: 'available-01', name: 'Legacy', status: 'available' },
  { id: 'hidden-active-01', name: 'Catalog hidden', type: 'food', destination: 'Đà Lạt', status: 'active', current_data: { catalogHidden: true } },
  { id: 'service-01', name: 'Stay', type: 'stay', destination: 'Đà Lạt', status: 'active', cost: 500000, carbon: 0, current_data: { email: 'private', lat: 11.9, lng: 108.4 } }
];

test('catalog returns only public fields, only active services, and preserves missing numbers', async () => {
  const catalog = await loadAgentCatalog({ models: createCatalogModels({ tours, services }) });
  assert.equal(catalog.available, true);
  assert.equal(catalog.tours[0].cost, null);
  assert.equal(catalog.tours[0].carbon, null);
  assert.equal(catalog.services.length, 1);
  assert.equal(catalog.services[0].cost, 500000);
  assert.equal(catalog.services[0].carbon, 0);
  assert.equal(catalog.services[0].lat, 11.9);
  assert.equal(JSON.stringify(catalog).includes('private'), false);
});

test('catalog uses explicit bounded pages and reports the next page when records remain', async () => {
  const manyTours = Array.from({ length: 45 }, (_, index) => ({ id: `tour-${index}`, title: `Tour ${index}`, destination: 'Đà Lạt', days: 3, cost: 1000000 }));
  const manyServices = Array.from({ length: 45 }, (_, index) => ({ id: `service-${index}`, name: `Stay ${index}`, type: 'stay', destination: 'Đà Lạt', status: 'active', cost: 100000 }));
  const catalog = await loadAgentCatalog({ models: createCatalogModels({ tours: manyTours, services: manyServices }), query: { pageSize: 1000 } });
  assert.equal(catalog.pageSize, 40);
  assert.equal(catalog.tours.length, 40);
  assert.equal(catalog.services.length, 40);
  assert.equal(catalog.truncated, true);
  assert.equal(catalog.nextPage, 2);
});

test('disabled or failed database queries return unavailable without leaking errors or inventing rows', async () => {
  const broken = {
    Schedule: { collection: { collectionName: 'schedules' } },
    ScheduleSample: { collection: { collectionName: 'samples', aggregate: () => { throw new Error('private database endpoint'); } } },
    ScheduleActivity: { findAll: async () => [] },
    GreenService: { findAll: async () => { throw new Error('private database endpoint'); } }
  };
  const result = await loadAgentCatalog({ models: broken });
  assert.equal(result.available, false);
  assert.deepEqual(result.tours, []);
  assert.deepEqual(result.services, []);
  assert.equal(JSON.stringify(result).includes('private database endpoint'), false);
});

test('n8n receives the bounded catalog server-to-server and never receives identity fields', async () => {
  let payload, posts = 0;
  const adapter = createChatAdapter({ env, models: createCatalogModels({ tours, services }), fetchImpl: async (url, options) => {
    posts++;
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ output: 'Tours from V2', success: true }));
  } });
  const input = { message: 'Mình cần hỗ trợ về tour', sessionId: 'catalog-test-session', history: [] };
  assert.equal((await adapter(input, { userId: 'private-user' })).reply, 'Tours from V2');
  assert.equal(payload.context.catalog.available, true);
  assert.equal(payload.context.catalog.services.length, 1);
  assert.equal(JSON.stringify(payload).includes('private'), false);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(adapter(input, { signal: controller.signal }), error => error.code === 'CHAT_CANCELLED');
  assert.equal(posts, 1);
});
