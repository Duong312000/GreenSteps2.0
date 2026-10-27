const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixedReply, catalogReply, compactAiInput } = require('../src/services/greensteps-chat-fast-path.service');
const { createChatAdapter } = require('../src/services/greensteps-chat.service');
const catalog = { available: true, truncated: false, tours: [
  { id: 'T1', title: 'Tour Đà Lạt', destination: 'Đà Lạt', days: 3, cost: 1950000 },
  { id: 'T2', title: 'Tour đúng 3 triệu', destination: 'Đà Lạt', days: 3, cost: 3000000 },
  { id: 'T3', title: 'Tour chưa có giá', destination: 'Đà Lạt', days: 3, cost: null },
  { id: 'T4', title: 'Tour Huế', destination: 'Huế', days: 3, cost: 1000000 }
], services: [
  { id: 'S1', name: 'Homestay A', destination: 'Đà lạt', type: 'stay', cost: 100000 },
  { id: 'S2', name: 'Khách sạn B', destination: 'Đà Lạt', type: 'stay', cost: 200000 },
  { id: 'S3', name: 'Bếp xanh', destination: 'Đà Lạt', type: 'food', cost: 50000 }
] };

test('only exact fixed prompts bypass catalog and n8n, even without AI credentials', async () => {
  let calls = 0;
  const send = createChatAdapter({ env: {}, fetchImpl: () => { calls++; throw Error('Must not fetch'); } });
  const response = await send({ message: 'Xin chào.', sessionId: 'fixed-session', history: [] });
  assert.equal(response.success, true);
  assert.equal(calls, 0);
  assert.equal(fixedReply('Xin chào, lập lịch trình cho tôi'), undefined);
});

test('destination lookup deduplicates accents/case without inventing places', () => {
  const result = catalogReply('GreenSteps có những điểm đến nào?', catalog);
  assert.equal(result.intent, 'destinations');
  assert.equal((result.reply.match(/Đà [Ll]ạt/g) || []).length, 1);
  assert.match(result.reply, /Huế/);
});

test('tour grammar applies every filter, strict upper bounds and missing prices', () => {
  const result = catalogReply('Tìm tour Đà Lạt 3 ngày dưới 3 triệu.', catalog);
  assert.equal(result.intent, 'tours');
  assert.match(result.reply, /1\.950\.000/);
  assert.doesNotMatch(result.reply, /Tour đúng|chưa có giá|Tour Huế/);
  assert.match(catalogReply('Tìm tour Đà Lạt 3 ngày tối đa 3 triệu', catalog).reply, /3\.000\.000/);
  assert.match(catalogReply('Tìm tour Đà Lạt 2 ngày dưới 3 triệu', catalog).reply, /Chưa tìm thấy/);
});

test('natural gợi ý tour requests return ranked real catalog entries and an honest empty state', () => {
  const result = catalogReply('Gợi ý tour Đà Lạt 3 ngày 2 đêm', catalog);
  assert.equal(result.type, 'tour_recommendations');
  assert.equal(result.totalTours, 3);
  assert.equal(result.catalogAvailable, true);
  assert.deepEqual(result.tours.map(tour => tour.id), ['T1', 'T2', 'T3']);
  const empty = catalogReply('Gợi ý tour Đà Lạt 5 ngày', catalog);
  assert.equal(empty.type, 'tour_recommendations');
  assert.equal(empty.totalTours, 0);
  assert.equal(empty.tours.length, 0);
  assert.ok(empty.suggestedQuestions.length > 0);
});

test('tour search matches a requested city inside a real multi-city destination', () => {
  const composite = { ...catalog, tours: [...catalog.tours, { id: 'T5', title: 'Đà Nẵng – Hội An', destination: 'Đà Nẵng – Hội An', days: 3, cost: 2500000 }] };
  const result = catalogReply('Gợi ý tour Đà Nẵng 3 ngày 2 đêm', composite);
  assert.deepEqual(result.tours.map(tour => tour.id), ['T5']);
  assert.equal(result.tours[0].destination, 'Đà Nẵng – Hội An');
  const aiInput = compactAiInput({ message: 'Gợi ý tour Đà Nẵng 3 ngày', history: [] }, composite);
  assert.deepEqual(aiInput.catalog.tours.map(tour => tour.id), ['T5']);
});

test('homestay does not include all lodging; service types are explicit', () => {
  const result = catalogReply('Tìm homestay tại Đà Lạt.', catalog);
  assert.equal(result.intent, 'services');
  assert.match(result.reply, /Homestay A/);
  assert.doesNotMatch(result.reply, /Khách sạn|Bếp/);
  assert.match(catalogReply('Tìm ăn uống tại Đà Lạt', catalog).reply, /Bếp xanh/);
});

test('ambiguous, contextual, compound and unsupported qualifiers fall back to AI', () => {
  for (const message of ['Lập lịch trình Đà Lạt 3 ngày 2 đêm', 'Tìm tour Đà Lạt 3 ngày dưới 3 triệu cho gia đình', 'Tìm tour Đà Lạt không đi Langbiang', 'Tìm tour Đà Lạt hoặc Huế', 'Tìm homestay tại Đà Lạt có hồ bơi', 'Tìm tour Đà Lạt 3 ngày 1 đêm', 'Tìm tour Đà Lạt dưới -3 triệu', 'Giá tour đó bao nhiêu', 'Tìm tour dưới 3 triệu', 'Tìm tour Hà Nội']) {
    assert.equal(catalogReply(message, catalog), null, message);
  }
  assert.equal(catalogReply('Tìm homestay tại Đà Lạt', { ...catalog, available: false }), null);
});

test('prices and sums require exact uniquely verified catalog products', () => {
  assert.match(catalogReply('Xem giá tour T1', catalog).reply, /1\.950\.000/);
  assert.match(catalogReply('Giá tour T3', catalog).reply, /chưa có giá/);
  assert.match(catalogReply('Tính tổng dịch vụ S1 x 2 + dịch vụ S3 x 1', catalog).reply, /250\.000/);
  for (const message of ['Tính tổng tour T1 x 2 + dịch vụ S1 x 1', 'Tính tổng tour T3 x 2', 'Tính tổng tour T1 x 0', 'Tính tổng 100000 + 200000', 'Giá tour không tồn tại']) assert.equal(catalogReply(message, catalog), null);
});

test('tour recommendations still pass through n8n while public catalog records stay cached', async () => {
  let catalogCalls = 0;
  let webhookCalls = 0;
  const send = createChatAdapter({ env: {
    N8N_CATALOG_ENABLED: 'true',
    N8N_WEBHOOK_URL: 'https://workflow.example.test/webhook/chat',
    N8N_AUTH_HEADER_NAME: 'X-Test-Agent-Key',
    N8N_AUTH_HEADER_VALUE: 'test-only-secret'
  }, fetchImpl: async (url, options) => {
    if (options.method === 'GET') catalogCalls++;
    else webhookCalls++;
    if (options.method !== 'GET') return new Response(JSON.stringify({ output: {
      type: 'tour_recommendations', message: 'Tour phù hợp.', tours: [{ id: 'T1' }]
    } }), { headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(url.endsWith('/tours') ? catalog.tours : catalog.services.map(s => ({ ...s, status: 'active' }))));
  } });
  for (let i = 0; i < 3; i++) {
    const metrics = {};
    const result = await send({ message: 'Tìm tour Đà Lạt 3 ngày dưới 3 triệu', sessionId: 'cache-session', history: [] }, { metrics });
    assert.equal(result.success, true);
    assert.equal(result.tours[0].id, 'T1');
    assert.equal(metrics.path, 'ai');
    assert.ok(metrics.n8nMs > 0);
  }
  assert.equal(catalogCalls, 2);
  assert.equal(webhookCalls, 3);
});

test('AI payload bounds history and reduces catalog with a disclosed scope', () => {
  const result = compactAiInput({ message: 'Lập lịch trình Đà Lạt', currentTours: [{ id: 'T1' }, { id: 'invented' }], history: Array(20).fill({ role: 'user', content: 'x'.repeat(2000) }) }, catalog);
  assert.equal(result.history.length, 6);
  assert.equal(result.history[0].content.length, 1000);
  assert.equal(result.catalog.tours.some(t => t.destination === 'Huế'), false);
  assert.equal(result.catalog.truncated, true);
  assert.deepEqual(result.currentTours.map(tour => tour.id), ['T1']);
  assert.equal(result.currentTours[0].title, catalog.tours[0].title);
});
