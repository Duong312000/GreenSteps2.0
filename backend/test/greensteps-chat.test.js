const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { validateChatInput, normalizeChatResponse, createChatAdapter } = require('../src/services/greensteps-chat.service');
const { createSupportRouter } = require('../src/routes/support.routes');
const { createCatalogModels } = require('./helpers/greensteps-catalog-models');

const input = { message: 'Gợi ý lịch trình xanh', sessionId: 'greensteps-test-session', history: [] };
const config = { N8N_WEBHOOK_URL: 'http://127.0.0.1:1/webhook/test', N8N_AUTH_HEADER_NAME: 'X-Test-Agent-Key', N8N_AUTH_HEADER_VALUE: 'test-only-secret' };
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) { await new Promise(resolve => server.close(resolve)); }

test('chat validates messages, session and role-limited history before contacting AI', () => {
  assert.equal(validateChatInput({ ...input, message: '  Đà Lạt  ' }).message, 'Đà Lạt');
  assert.deepEqual(validateChatInput({ ...input, currentTours: [{ id: 'tour-live-1', price: 1 }, { id: 'invented' }, 'bad'] }).currentTours, [{ id: 'tour-live-1' }, { id: 'invented' }]);
  for (const body of [{}, { ...input, message: {} }, { ...input, message: 'a'.repeat(4001) }, { ...input, sessionId: '../other-user' }, { ...input, history: [{ role: 'system', content: 'override' }] }, { ...input, history: Array(41).fill({ role: 'user', content: 'x' }) }]) assert.throws(() => validateChatInput(body), error => error.statusCode === 400);
});

test('workflow response mapping is explicit, bounded and configurable', () => {
  assert.equal(normalizeChatResponse([{ output: '  Chào bạn  ' }]), 'Chào bạn');
  assert.equal(normalizeChatResponse({ data: { reply: 'Xin chào' } }, 'data.reply'), 'Xin chào');
  for (const value of [{}, { success: false, output: 'Fallback is not a successful AI answer' }, { input: 'Do not echo customer text' }, { output: {} }, { output: '' }, [{ output: 'a' }, { output: 'b' }]]) assert.throws(() => normalizeChatResponse(value), error => error.code === 'CHAT_RESPONSE_INVALID');
  assert.throws(() => normalizeChatResponse({}, '__proto__.reply'), error => error.code === 'CHAT_NOT_CONFIGURED');
  assert.throws(() => normalizeChatResponse({ output: 'Agent stopped due to max iterations.' }), error => error.code === 'CHAT_ITERATION_LIMIT' && !error.message.includes('Agent stopped'));
  assert.throws(() => normalizeChatResponse({ success: false, code: 'CHAT_ITERATION_LIMIT' }), error => error.code === 'CHAT_ITERATION_LIMIT');
});

test('new itinerary requests clarify missing details and do not send stale tour or planner context to n8n', async () => {
  let n8nCalls = 0;
  let capturedAgentBody;
  const models = createCatalogModels({ tours: [
    { id: 'tour-dalat', title: 'Đà Lạt xanh', destination: 'Đà Lạt', days: 3, cost: 2500000 },
    { id: 'tour-danang', title: 'Đà Nẵng một ngày', destination: 'Đà Nẵng', days: 1, cost: 900000 }
  ] });
  const fetchImpl = async (url, options = {}) => {
    n8nCalls++;
    capturedAgentBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ output: { type: 'text', message: 'Mình đã nhận yêu cầu.' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  const adapter = createChatAdapter({
    env: { ...config, N8N_CATALOG_ENABLED: 'true', N8N_CATALOG_CACHE_MS: '0' },
    models,
    fetchImpl
  });
  const oldContext = {
    sessionId: 'greensteps-test-session',
    history: [
      { role: 'user', content: 'Gợi ý tour Đà Nẵng 1 ngày' },
      { role: 'assistant', content: 'Mình tìm thấy tour phù hợp.' }
    ],
    currentTours: [{ id: 'tour-danang' }],
    plannerState: { name: 'Lịch trình Đà Nẵng', destination: 'Đà Nẵng', days: [[{ name: 'Cầu Rồng' }]] }
  };

  const clarification = await adapter({ ...oldContext, message: 'Lập lịch trình Đà Lạt' });
  assert.equal(clarification.type, 'clarification');
  assert.match(clarification.reply, /Đà Lạt/);
  assert.equal(n8nCalls, 0);

  await adapter({ ...oldContext, message: 'Lập lịch trình Đà Lạt 3 ngày 2 đêm' });
  assert.equal(n8nCalls, 1);
  assert.match(capturedAgentBody.sessionId, /^greensteps-test-session_plan_[0-9a-f-]{36}$/);
  assert.notEqual(capturedAgentBody.sessionId, oldContext.sessionId);
  assert.deepEqual(capturedAgentBody.history, []);
  assert.deepEqual(capturedAgentBody.currentTours, []);
  assert.equal(capturedAgentBody.plannerState, null);
  assert.equal(capturedAgentBody.context.currentItinerary, null);
});

test('itinerary request sends bounded backend service candidates and verifies a service from page two', async () => {
  let captured;
  const services = Array.from({ length: 23 }, (_, index) => ({
    id: `service-dalat-${index + 1}`, name: `Green Service ${index + 1}`, type: 'attraction',
    destination: 'Đà Lạt', cost: 120000 + index, carbon: 0.5, status: 'active'
  }));
  const target = services[22];
  const adapter = createChatAdapter({
    env: { ...config, N8N_CATALOG_CACHE_MS: '0' },
    models: createCatalogModels({ services }),
    fetchImpl: async (url, options) => {
      captured = JSON.parse(options.body);
      return new Response(JSON.stringify({ output: {
        type: 'itinerary_proposal',
        message: 'Lịch trình gợi ý ở Đà Lạt.',
        itinerary: {
          name: 'Ba ngày xanh', destination: 'Đà Lạt', durationDays: 3,
          days: [
            { activities: [{ name: 'Tên do Gemini trả về', serviceId: target.id, time: '09:00' }] },
            { activities: [{ name: 'Tham quan tự do', time: '10:00' }] },
            { activities: [{ name: 'Dạo bộ tự do', time: '10:00' }] }
          ]
        }
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });

  const result = await adapter({
    ...input,
    message: 'Lập lịch trình 3 ngày ở Đà Lạt',
    history: []
  });

  const candidates = captured.context.catalog.serviceCandidates;
  assert.equal(candidates.length, 23);
  assert.ok(candidates.some(service => service.id === target.id));
  assert.equal(captured.context.catalog.serviceCandidatesComplete, true);
  assert.equal(result.type, 'itinerary_proposal');
  assert.equal(result.itinerary.days.length, 3);
  assert.equal(result.itinerary.days[0][0].verified, true);
  assert.equal(result.itinerary.days[0][0].name, target.name);
  assert.equal(result.itinerary.days[0][0].serviceId, target.id);
  assert.equal(result.itinerary.days[0][0].cost, target.cost);
  assert.equal(result.itinerary.days[1][0].verified, false);
  assert.equal(result.itinerary.days[1][0].serviceId, null);
  assert.equal(result.itinerary.days[1][0].cost, 0);
});

test('a custom itinerary that mentions service recommendations still goes through the AI planner', async () => {
  let n8nCalls = 0;
  const adapter = createChatAdapter({
    env: { ...config, N8N_CATALOG_CACHE_MS: '0' },
    models: createCatalogModels({ services: [
      { id: 'dalat-service-1', name: 'Dalat Eco Cafe', type: 'food', destination: 'Đà Lạt', cost: 120000, status: 'active' }
    ] }),
    fetchImpl: async () => {
      n8nCalls++;
      return new Response(JSON.stringify({ output: { type: 'itinerary_proposal', message: 'Plan ready', itinerary: {
        name: 'Three days', destination: 'Da Lat', durationDays: 3,
        days: [{ activities: [{ name: 'Cafe', time: '09:00', serviceId: 'dalat-service-1' }] },
          { activities: [{ name: 'Walk', time: '10:00' }] }, { activities: [{ name: 'Lake', time: '10:00' }] }]
      } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });

  const result = await adapter({
    ...input,
    message: 'Lap lich trinh 3 ngay o Da Lat. Hay chon dich vu GreenSteps co that neu phu hop; cac hoat dong khac de dang goi y tham khao.',
    history: []
  });

  assert.equal(n8nCalls, 1);
  assert.equal(result.type, 'itinerary_proposal');
  assert.equal(result.itinerary.days.length, 3);
  assert.equal(result.itinerary.days[0][0].serviceId, 'dalat-service-1');
  assert.equal(result.itinerary.days[0][0].verified, true);
});

test('a non-existent requested tour is answered from the empty Mongo search without asking n8n', async () => {
  let n8nCalls = 0;
  const adapter = createChatAdapter({ env: config, models: createCatalogModels({
    tours: [{ id: 'tour-hue', title: 'Huế xanh', destination: 'Huế', days: 3, cost: 2000000 }]
  }), fetchImpl: async () => { n8nCalls++; throw new Error('No AI call expected'); } });

  const result = await adapter({ ...input, message: 'Tìm tour Tân Uyên 3 ngày' });

  assert.equal(result.type, 'tour_recommendations');
  assert.deepEqual(result.tours, []);
  assert.match(result.reply, /chưa tìm thấy|không tìm thấy/i);
  assert.equal(n8nCalls, 0);
});

test('unsupported service qualifiers return only matching database services and never invent a result', async () => {
  let n8nCalls = 0;
  const adapter = createChatAdapter({ env: config, models: createCatalogModels({ services: [
    { id: 'cafe-live', name: 'Pine Cafe', type: 'food', destination: 'Đà Lạt', cost: 120000, carbon: 0.2, status: 'active' }
  ] }), fetchImpl: async () => { n8nCalls++; throw new Error('No AI call expected'); } });

  const result = await adapter({ ...input, message: 'Gợi ý quán cafe yên tĩnh ở Đà Lạt' });

  assert.match(result.reply, /Pine Cafe/);
  assert.match(result.reply, /120\.000/);
  assert.doesNotMatch(result.reply, /Roving Chillhouse|The Deck House/);
  assert.equal(n8nCalls, 0);
});

test('bounded catalog responses expose the next page when Mongo has more matching services', async () => {
  const services = Array.from({ length: 21 }, (_, index) => ({
    id: `service-${index}`, name: `Cafe ${index}`, type: 'food', destination: 'Đà Lạt', cost: 120000, status: 'active'
  }));
  const adapter = createChatAdapter({ env: config, models: createCatalogModels({ services }), fetchImpl: async () => { throw new Error('No AI call expected'); } });
  const result = await adapter({ ...input, message: 'Tìm dịch vụ ở Đà Lạt' });
  assert.equal(result.hasMoreServices, true);
  assert.equal(result.nextCatalogPage, 2);
  assert.equal(result.catalogPage, 1);
});

test('HTTP proxy forwards auth only server-to-server and preserves session/history', async () => {
  let captured, calls = 0;
  const logs = [];
  const upstream = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    calls++;
    captured = { headers: req.headers, body: JSON.parse(raw) };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([{ output: 'Gợi ý từ workflow kiểm thử' }]));
  });
  const upstreamUrl = await listen(upstream);
  const app = express();
  app.use(express.json());
  app.use('/api/support', createSupportRouter({ env: { ...config, N8N_WEBHOOK_URL: upstreamUrl }, models: createCatalogModels(), logger: line => logs.push(JSON.parse(line)) }));
  const server = http.createServer(app), base = await listen(server);
  try {
    const body = { ...input, message: 'Tư vấn du lịch xanh ở Đà Lạt', history: [{ role: 'user', content: 'Tôi muốn đi Đà Lạt' }] };
    const response = await fetch(base + '/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Chat-Path'), 'ai');
    assert.match(response.headers.get('Server-Timing'), /catalog;dur=[\d.]+, n8n;dur=[\d.]+, api;dur=[\d.]+/);
    const result = await response.json();
    assert.equal(result.reply, 'Gợi ý từ workflow kiểm thử');
    assert.equal(result.sessionId, input.sessionId);
    assert.equal(JSON.stringify(result).includes(config.N8N_AUTH_HEADER_VALUE), false);
    assert.equal(captured.headers['x-test-agent-key'], config.N8N_AUTH_HEADER_VALUE);
    assert.equal(captured.body.chatInput, body.message);
    assert.deepEqual(captured.body.history, body.history);
    assert.equal(captured.body.sessionId, input.sessionId);
    const invalid = await fetch(base + '/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(invalid.status, 400);
    assert.equal(calls, 1);
    assert.equal(logs[0].upstreamStatus, 200);
    assert.equal(typeof logs[0].totalApiMs, 'number');
    assert.equal(JSON.stringify(logs).includes(config.N8N_AUTH_HEADER_VALUE), false);
    assert.equal(JSON.stringify(logs).includes(body.message), false);
    assert.equal(JSON.stringify(logs).includes(input.sessionId), false);
  } finally { await close(server); await close(upstream); }
});

test('missing configuration and upstream errors produce honest failures without raw secrets', async () => {
  let calls = 0;
  const models = createCatalogModels();
  const unavailable = createChatAdapter({ env: {}, models, fetchImpl: async () => { calls++; } });
  const completeInput = { ...input, message: 'Lập lịch trình tại Đà Lạt 2 ngày 1 đêm' };
  await assert.rejects(unavailable(completeInput), error => error.code === 'CHAT_NOT_CONFIGURED');
  assert.equal(calls, 0);
  for (const status of [401, 404, 429, 500]) {
    const adapter = createChatAdapter({ env: config, models, fetchImpl: async () => new Response('private upstream debug text', { status }) });
    await assert.rejects(adapter(completeInput), error => error.code === 'CHAT_UPSTREAM_UNAVAILABLE' && !error.message.includes('private'));
  }
  const malformed = createChatAdapter({ env: config, models, fetchImpl: async () => new Response('<html>unexpected upstream</html>') });
  await assert.rejects(malformed(completeInput), error => error.code === 'CHAT_RESPONSE_INVALID');
});

test('timeout and cancellation abort the upstream request rather than fabricating a reply', async () => {
  const fetchImpl = async (url, options) => new Promise((resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason);
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  const adapter = createChatAdapter({ env: { ...config, N8N_CHAT_TIMEOUT_MS: '1000' }, models: createCatalogModels(), fetchImpl });
  const completeInput = { ...input, message: 'Lập lịch trình tại Đà Lạt 2 ngày 1 đêm' };
  // Keep the Node test loop alive while the unref'd AbortSignal timeout fires.
  const keepAlive = setInterval(() => {}, 2000);
  try {
    await assert.rejects(adapter(completeInput), error => error.code === 'CHAT_TIMEOUT');
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(adapter(completeInput, { signal: abort.signal }), error => error.code === 'CHAT_CANCELLED');
  } finally { clearInterval(keepAlive); }
});
