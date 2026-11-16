const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAgentCatalog, queryFromRequest } = require('../src/services/greensteps-agent-catalog.service');
const structured = require('../src/services/greensteps-chat-structured.service');
const fastPath = require('../src/services/greensteps-chat-fast-path.service');
const { createChatAdapter } = require('../src/services/greensteps-chat.service');
const { createLegacyChatAdapter } = require('../src/services/greensteps-chat-legacy-adapter.service');
const { createCatalogModels } = require('./helpers/greensteps-catalog-models');
const workbook = require('../../docs/superpowers/reports/greensteps-351-workbook-extracted.json');

const rows = workbook.sheets.TestCases.slice(1).map(row => row.cells);
const sourceText = id => rows.find(row => row.A === id)?.F;
const catalog = {
  available: true, page: 1, pageSize: 20, truncated: false, truncatedTours: false,
  tours: [
    { id: 'T-DN-001', title: 'Tour Đà Nẵng 3 ngày', destination: 'Đà Nẵng', days: 3, cost: 1790000 },
    { id: 'T-DN-002', title: 'Tour Đà Nẵng 2 ngày', destination: 'Đà Nẵng', days: 2, cost: 1350000 },
    { id: 'T-PY-001', title: 'Tour Phú Yên 3 ngày', destination: 'Phú Yên', days: 3, cost: 1200000 }
  ], services: []
};

test('INT-001 to INT-018: itinerary wording synonyms classify as CREATE', () => {
  for (const id of ['INT-001','INT-002','INT-003','INT-004','INT-005','INT-006','INT-007','INT-008','INT-009',
    'INT-010','INT-011','INT-012','INT-013','INT-014','INT-015','INT-016','INT-017','INT-018']) {
    const message = sourceText(id);
    assert.equal(structured.isItineraryRequest({ message, history: [] }), true, id + ': ' + message);
    const days = Number(message.match(/\b(\d{1,2})\s*(?:ngày|ngay)\b/i)?.[1]) || (/(?:3N2Đ|3N2D)/i.test(message) ? 3 : 0);
    const clarification = structured.itineraryClarification({ message, history: [] }, catalog);
    if (!days) {
      assert.ok(clarification, id + ' must ask for a missing duration');
      assert.match(clarification.reply, /bao lâu|bao nhiêu ngày/i, id);
    } else {
      assert.equal(clarification, null, id + ' must not ask again for a supplied duration');
      const output = structured.normalizeStructuredResponse({ output: {
        message: 'Lịch trình gợi ý', itinerary: {
          destination: 'Đà Nẵng', durationDays: days,
          days: Array.from({ length: days }, (_, index) => ({ activities: [{ name: `Activity ${index + 1}` }] }))
        }
      } }, 'output', catalog, { message, history: [] });
      assert.equal(output.itinerary.days.length, days, id + ' must preserve the requested duration');
    }
  }
});

test('INT-019 / DEST-001 / TOUR-001: Da Nang statement is destination-filtered tour discovery', () => {
  const message = sourceText('INT-019');
  assert.equal(queryFromRequest({ message }).destination, 'Đà Nẵng');
  assert.equal(typeof fastPath.tourDiscoveryReply, 'function', 'must have a dedicated discovery flow');
  const result = fastPath.tourDiscoveryReply(message, catalog);
  assert.equal(result.type, 'tour_recommendations');
  assert.deepEqual(result.tours.map(tour => tour.id), ['T-DN-001', 'T-DN-002']);
  assert.ok(result.suggestedQuestions.some(question => question.includes('Tự tạo lịch trình')));
  assert.equal(result.itinerary, null);
});

test('INT-037: explicit create wording wins over discovery wording', () => {
  assert.equal(structured.isItineraryRequest({ message: sourceText('INT-037'), history: [] }), true);
});

test('INT-038 / INT-039 / INT-040: discovery, create and draft wording keep distinct intents', () => {
  const discovery = { message: sourceText('INT-038'), history: [] };
  const create = { message: sourceText('INT-039'), history: [] };
  const draft = { message: sourceText('INT-040'), history: [] };
  assert.equal(structured.isExplicitTourSearchRequest(discovery), true, 'INT-038 remains discovery');
  assert.equal(structured.isItineraryRequest(discovery), false, 'INT-038 must not create a plan');
  assert.equal(queryFromRequest(discovery).destination, '', 'INT-038 has no destination; do not parse a filler phrase as one');
  assert.equal(structured.isItineraryRequest(create), true, 'INT-039 explicitly requests a plan');
  assert.equal(structured.isExplicitTourSearchRequest(create), false, 'INT-039 must not search tours instead');
  assert.equal(structured.isItineraryRequest(draft), true, 'INT-040 is a draft itinerary request');
  assert.equal(structured.itineraryClarification(draft, catalog)?.type, undefined);
  assert.match(structured.itineraryClarification(draft, catalog)?.reply || '', /điểm đến|ở đâu/i);
});

test('DEST-008: three alternatives ask the user to choose all three destinations', () => {
  const message = sourceText('DEST-008');
  const choices = fastPath.destinationChoiceClarification(message, {
    ...catalog,
    tours: [...catalog.tours, { id: 'T-DL-001', title: 'Tour Đà Lạt', destination: 'Đà Lạt', days: 2, cost: 1000000 }]
  });
  assert.equal(choices.type, 'clarification');
  assert.equal(choices.suggestedQuestions.length, 3);
  for (const destination of ['Phú Yên', 'Đà Nẵng', 'Đà Lạt']) assert.match(choices.reply, new RegExp(destination));
  assert.deepEqual(choices.tours, []);
});

test('DEST-012 / DEST-030 / SLOT-027: current positive destination beats history and exclusions', () => {
  assert.equal(queryFromRequest({ message: sourceText('DEST-012') }).destination, 'Đà Nẵng');
  assert.equal(queryFromRequest({ message: sourceText('DEST-030') }).destination, 'Đà Nẵng');
  assert.equal(queryFromRequest({ message: sourceText('SLOT-027') }).destination, 'Đà Nẵng');
});

test('DEST-005: typo destination must ask for confirmation instead of silently searching', () => {
  const message = sourceText('DEST-005');
  const response = fastPath.destinationCorrectionClarification(message, {
    ...catalog,
    tours: [...catalog.tours, { id: 'T-DL-001', title: 'Tour Đà Lạt', destination: 'Đà Lạt', days: 2, cost: 1000000 }]
  });
  assert.equal(response.type, 'clarification');
  assert.match(response.reply, /Đà Lạt/);
  assert.deepEqual(response.tours, []);
});

test('TOUR-002 / TOUR-023: a verified empty search keeps the custom itinerary CTA', () => {
  const message = sourceText('TOUR-002');
  assert.equal(queryFromRequest({ message }).destination, 'Đà Nẵng');
  const response = fastPath.tourDiscoveryReply(message, {
    ...catalog, tours: [], truncatedTours: false
  });
  assert.equal(response.type, 'tour_recommendations');
  assert.equal(response.totalTours, 0);
  assert.equal(response.itinerary, null);
  assert.ok(response.suggestedQuestions.some(question => question.includes('Tự tạo lịch trình')));
});

test('TOUR-004 / TOUR-005 / TOUR-006: destination, duration and budget are combined with AND', async () => {
  const tours = [
    { id: 'T-DN-3D-18', title: 'Đà Nẵng 3 ngày giá thấp', destination: 'Đà Nẵng', days: 3, cost: 1800000 },
    { id: 'T-DN-2D-10', title: 'Đà Nẵng 2 ngày', destination: 'Đà Nẵng', days: 2, cost: 1000000 },
    { id: 'T-DN-3D-25', title: 'Đà Nẵng 3 ngày đắt', destination: 'Đà Nẵng', days: 3, cost: 2500000 },
    { id: 'T-PY-3D-10', title: 'Phú Yên 3 ngày', destination: 'Phú Yên', days: 3, cost: 1000000 }
  ];
  const query = queryFromRequest({ message: sourceText('TOUR-006') });
  assert.deepEqual(query, { destination: 'Đà Nẵng', durationDays: 3, maxBudget: 2000000, serviceType: null, page: 1, pageSize: 20 });
  const result = await loadAgentCatalog({ query, models: createCatalogModels({ tours }) });
  assert.deepEqual(result.tours.map(tour => tour.id), ['T-DN-3D-18']);
});

test('TOUR-017: loading the next catalog page retains destination and does not repeat page one', async () => {
  const tours = Array.from({ length: 5 }, (_, index) => ({
    id: `T-DN-${index + 1}`, title: `Đà Nẵng ${index + 1}`, destination: 'Đà Nẵng', days: 3, cost: 100000 + index
  })).concat([{ id: 'T-PY-1', title: 'Phú Yên', destination: 'Phú Yên', days: 3, cost: 100000 }]);
  const models = createCatalogModels({ tours });
  const first = await loadAgentCatalog({ query: { destination: 'Đà Nẵng', page: 1, pageSize: 2 }, models });
  const second = await loadAgentCatalog({ query: { destination: 'Đà Nẵng', page: 2, pageSize: 2 }, models });
  assert.deepEqual(first.tours.map(row => row.id), ['T-DN-1', 'T-DN-2']);
  assert.equal(first.truncatedTours, true);
  assert.deepEqual(second.tours.map(row => row.id), ['T-DN-3', 'T-DN-4']);
  assert.ok(second.tours.every(row => row.destination === 'Đà Nẵng'));
});

test('TOUR-021 / TOUR-022: explicit self-planning stays CREATE and does not become package-tour purchase', () => {
  assert.equal(structured.isItineraryRequest({ message: sourceText('TOUR-021'), history: [] }), true);
  assert.equal(structured.isExplicitTourSearchRequest({ message: sourceText('TOUR-021'), history: [] }), false);
  const buttonAction = sourceText('TOUR-022');
  assert.equal(structured.isItineraryRequest({ message: buttonAction, history: [] }), true);
  assert.equal(queryFromRequest({ message: buttonAction }).destination, 'Đà Nẵng');
  const clarification = structured.itineraryClarification({ message: buttonAction, history: [] }, catalog);
  assert.ok(clarification, 'TOUR-022 must ask for the missing days instead of creating immediately');
  assert.match(clarification.reply, /bao lâu|bao nhiêu ngày/i);
});

test('DEST-018 / SLOT-003: missing destination asks before invoking n8n', async () => {
  let n8nCalls = 0;
  const send = createChatAdapter({
    env: { N8N_WEBHOOK_URL: 'https://n8n.invalid/test', N8N_AUTH_HEADER_NAME: 'X-Test-Key', N8N_AUTH_HEADER_VALUE: 'local-only', N8N_CATALOG_CACHE_MS: '0' },
    models: createCatalogModels({ tours: catalog.tours }),
    fetchImpl: async () => { n8nCalls++; throw new Error('must not call n8n before required slots exist'); }
  });
  const result = await send({ message: sourceText('SLOT-003'), sessionId: 'greensteps-p0-003', history: [] });
  assert.equal(result.type, 'clarification');
  assert.match(result.reply, /ở đâu|điểm đến/i);
  assert.equal(n8nCalls, 0);
  assert.equal(queryFromRequest({ message: sourceText('DEST-018') }).destination, '');
});

test('DEST-019 / CTX-018 / CTX-026: answer destination in the active plan, but reset has no inherited slots', () => {
  const firstQuestion = structured.itineraryClarification({ message: 'Tạo lịch trình', history: [] }, catalog);
  const activeSession = {
    message: 'Đà Nẵng',
    history: [
      { role: 'user', content: 'Tạo lịch trình' },
      { role: 'assistant', content: firstQuestion.reply }
    ]
  };
  const secondQuestion = structured.itineraryClarification(activeSession, catalog);
  assert.match(secondQuestion.reply, /Đà Nẵng.*(?:bao lâu|bao nhiêu ngày)/);

  const newSessionAfterReset = structured.itineraryClarification({ message: 'Tạo lịch trình', history: [] }, catalog);
  assert.match(newSessionAfterReset.reply, /điểm đến|ở đâu/i);
  assert.doesNotMatch(newSessionAfterReset.reply, /Đà Nẵng|Phú Yên/);
});

test('CTX-019: two adapter sessions do not share destinations or conversation state', async () => {
  const send = createChatAdapter({
    env: { N8N_WEBHOOK_URL: 'https://n8n.invalid/test', N8N_AUTH_HEADER_NAME: 'X-Test-Key', N8N_AUTH_HEADER_VALUE: 'local-only', N8N_CATALOG_CACHE_MS: '0' },
    models: createCatalogModels({ tours: catalog.tours }),
    fetchImpl: async () => { throw new Error('slot clarification must not call n8n'); }
  });
  const sessionA = await send({ message: 'Tạo lịch trình Đà Nẵng', sessionId: 'greensteps-session-a', history: [] });
  assert.equal(sessionA.type, 'clarification');
  assert.match(sessionA.reply, /Đà Nẵng/);
  const sessionB = await send({ message: 'Tạo lịch trình', sessionId: 'greensteps-session-b', history: [] });
  assert.equal(sessionB.type, 'clarification');
  assert.match(sessionB.reply, /điểm đến|ở đâu/i);
  assert.doesNotMatch(sessionB.reply, /Đà Nẵng/);
});

test('PLAN-006 / CTX-007 / CTX-008 / CTX-013: the latest explicit destination and duration win', () => {
  assert.equal(queryFromRequest({ message: sourceText('PLAN-006') }).destination, 'Đà Nẵng');
  const ctx007 = { message: 'Đổi sang Phú Yên', history: [{ role: 'user', content: 'Tạo lịch trình Đà Nẵng 3 ngày' }] };
  const ctx007Plan = structured.normalizeStructuredResponse({ output: {
    message: 'Lịch trình Phú Yên 3 ngày',
    itinerary: { destination: 'Phú Yên', durationDays: 3, days: Array.from({ length: 3 }, () => ({ activities: [{ name: 'Biển' }] })) }
  } }, 'output', catalog, ctx007);
  assert.equal(ctx007Plan.itinerary.destination, 'Phú Yên');
  assert.equal(ctx007Plan.itinerary.days.length, 3);

  const ctx008Current = sourceText('CTX-008').split('|').at(-1).replace(/^\s*USER:\s*/, '');
  assert.equal(queryFromRequest({ message: ctx008Current }).destination, 'Đà Nẵng');
  assert.equal(queryFromRequest({ message: sourceText('CTX-013').split('|').at(-1).trim() }).durationDays, 4);
});

test('FLOW-C: destination correction retains the original two-day duration', () => {
  const input = {
    message: 'Thôi đổi sang Đà Nẵng',
    history: [{ role: 'user', content: 'Tạo lịch trình Phú Yên 2 ngày' }]
  };
  assert.equal(structured.isItineraryRequest(input), true);
  const normalized = structured.normalizeStructuredResponse({ output: {
    message: 'Lịch trình Đà Nẵng 2 ngày',
    itinerary: { destination: 'Đà Nẵng', durationDays: 2, days: [
      { title: 'Ngày 1', activities: [{ name: 'Sơn Trà' }] },
      { title: 'Ngày 2', activities: [{ name: 'Biển Mỹ Khê' }] }
    ] }
  } }, 'output', catalog, input);
  assert.equal(normalized.itinerary.destination, 'Đà Nẵng');
  assert.equal(normalized.itinerary.days.length, 2);
  assert.equal(normalized.itinerary.days.flat().some(activity => /Tuy Hòa|Phú Yên/i.test(activity.name)), false);
});

test('SLOT-017 / SLOT-018: budget uncertainty or refusal does not block itinerary creation', () => {
  for (const id of ['SLOT-017','SLOT-018']) {
    const input = {
      message: sourceText(id),
      history: [
        { role: 'user', content: 'Tạo lịch trình Đà Nẵng' },
        { role: 'assistant', content: 'Bạn muốn đi Đà Nẵng trong bao lâu?' }
      ]
    };
    assert.equal(structured.isItineraryRequest(input), true, id);
    assert.equal(structured.itineraryClarification(input, catalog), null, id + ' should proceed without budget');
  }
});

test('PLAN-019 / PLAN-023: incomplete day arrays or unnamed activities are not rendered as valid plans', () => {
  const input = { message: sourceText('PLAN-019'), history: [] };
  const tooFewDays = structured.normalizeStructuredResponse({ output: {
    message: 'Đây là lịch trình Đà Nẵng 3 ngày.',
    itinerary: { destination: 'Đà Nẵng', durationDays: 3, days: [
      { activities: [{ name: 'Bãi biển' }] }, { activities: [{ name: 'Bảo tàng' }] }
    ] }
  } }, 'output', catalog, input);
  assert.equal(tooFewDays.itinerary, null);

  const unnamed = structured.normalizeStructuredResponse({ output: {
    message: 'Đây là lịch trình gợi ý.',
    itinerary: { destination: 'Đà Nẵng', durationDays: 3, days: Array.from({ length: 3 }, () => ({ activities: [{ time: '08:00' }] })) }
  } }, 'output', catalog, { message: sourceText('PLAN-023'), history: [] });
  assert.equal(unnamed.itinerary, null);
});

test('PLAN-020: an itinerary whose title contradicts its canonical destination is rejected', () => {
  const response = structured.normalizeStructuredResponse({ output: {
    message: 'Lịch trình Phú Yên',
    itinerary: {
      name: 'Phú Yên', destination: 'Đà Nẵng', durationDays: 1,
      days: [{ title: 'Phú Yên', activities: [{ name: 'Biển Tuy Hòa' }] }]
    }
  } }, 'output', catalog, { message: 'Tạo lịch trình Đà Nẵng 1 ngày', history: [] });
  assert.equal(response.itinerary, null);
  assert.match(response.reply, /điểm đến khác|chưa hiển thị/i);
});

test('SEC-021: catalog failure stops price answers before calling n8n', async () => {
  let n8nCalls = 0;
  const send = createChatAdapter({
    env: { N8N_WEBHOOK_URL: 'https://n8n.invalid/test', N8N_AUTH_HEADER_NAME: 'X-Test-Key', N8N_AUTH_HEADER_VALUE: 'local-only', N8N_CATALOG_CACHE_MS: '0' },
    models: { Schedule: null, ScheduleSample: null, ScheduleActivity: null, GreenService: null },
    fetchImpl: async () => { n8nCalls++; return { ok: true, json: async () => ({ reply: '500.000 VND' }) }; }
  });
  await assert.rejects(send({ message: 'Giá chính xác tour Đà Nẵng bao nhiêu?', sessionId: 'greensteps-sec-021', history: [] }), error => {
    assert.equal(error.code, 'CHAT_CATALOG_UNAVAILABLE');
    assert.equal(error.statusCode, 503);
    return true;
  });
  assert.equal(n8nCalls, 0);
});

test('DEST-011: parser selects destination after origin wording', () => {
  assert.equal(queryFromRequest({ message: sourceText('DEST-011') }).destination, 'Đà Nẵng');
});

test('DEST-013: parser excludes the rejected destination', () => {
  assert.equal(queryFromRequest({ message: sourceText('DEST-013') }).destination, 'Đà Lạt');
});

test('API-006: backend rejects tours from another destination', () => {
  const input = { message: 'Tìm tour Đà Nẵng', history: [] };
  const response = structured.normalizeStructuredResponse({ output: {
    type: 'tour_recommendations', message: 'Đây là các tour phù hợp.', tours: [{ id: 'T-PY-001' }]
  } }, 'output', catalog, input);
  assert.deepEqual(response.tours, []);
  assert.equal(response.type, 'tour_recommendations');
  assert.match(response.reply, /không tìm thấy|chưa tìm thấy|chưa có/i);
});

test('DEST-007: ambiguous destination alternatives ask the user to choose', () => {
  const message = 'Tui muốn đi Đà Lạt hay Đà Nẵng';
  assert.equal(queryFromRequest({ message }).destination, '');
  const result = fastPath.destinationChoiceClarification(message, {
    ...catalog,
    tours: [...catalog.tours, { id: 'T-DL-001', title: 'Tour Đà Lạt', destination: 'Đà Lạt', days: 2, cost: 1000000 }]
  });
  assert.equal(result.type, 'clarification');
  assert.match(result.reply, /Đà Lạt.*Đà Nẵng|Đà Nẵng.*Đà Lạt/);
  assert.deepEqual(result.tours, []);
});

test('VER-030: service type mismatch cannot become a verified activity', () => {
  const source = {
    ...catalog,
    serviceCandidates: [{
      id: 'S-DN-STAY', name: 'Homestay Đà Nẵng', type: 'stay', destination: 'Đà Nẵng',
      cost: 900000, carbon: 4, status: 'active'
    }]
  };
  const plan = structured.canonicalItinerary({
    destination: 'Đà Nẵng', durationDays: 1,
    days: [{ activities: [{ name: 'Ăn trưa', type: 'dining', serviceId: 'S-DN-STAY', cost: 100000, carbon: 0 }] }]
  }, source, 'Đà Nẵng', 1);
  const activity = plan.days[0][0];
  assert.equal(activity.verified, false);
  assert.equal(activity.serviceId, null);
  assert.equal(activity.cost, 0);
  assert.equal(activity.carbon, 0);
});

test('VER-001 / VER-011: verify a real catalog ID and trust catalog price/carbon over Gemini values', () => {
  const service = {
    id: 'S-DN-VERIFIED', name: 'Green stay Đà Nẵng', type: 'stay', destination: 'Đà Nẵng',
    cost: 650000, carbon: 1.75, status: 'active'
  };
  const source = { ...catalog, serviceCandidates: [service] };
  const plan = structured.canonicalItinerary({
    destination: 'Đà Nẵng', durationDays: 1,
    days: [{ activities: [{ name: 'AI invented hotel', type: 'stay', serviceId: service.id, cost: 9999999, carbon: 999 }] }]
  }, source, 'Đà Nẵng', 1);
  const activity = plan.days[0][0];
  assert.equal(activity.verified, true);
  assert.equal(activity.serviceId, service.id);
  assert.equal(activity.name, service.name);
  assert.equal(activity.cost, service.cost);
  assert.equal(activity.carbon, service.carbon);
});

test('VER-002 / VER-003 / VER-004 / VER-005 / VER-015: reject unknown, cross-destination and non-active IDs', () => {
  const candidates = [
    { id: 'S-PY-ACTIVE', name: 'Active elsewhere', type: 'stay', destination: 'Phú Yên', cost: 200000, carbon: 1, status: 'active' },
    { id: 'S-DN-PENDING', name: 'Pending stay', type: 'stay', destination: 'Đà Nẵng', cost: 300000, carbon: 1, status: 'pending' },
    { id: 'S-DN-APPROVED', name: 'Approved only', type: 'stay', destination: 'Đà Nẵng', cost: 400000, carbon: 1, status: 'approved' }
  ];
  for (const id of ['S-MISSING', 'S-PY-ACTIVE', 'S-DN-PENDING', 'S-DN-APPROVED']) {
    const plan = structured.canonicalItinerary({
      destination: 'Đà Nẵng', durationDays: 1,
      days: [{ activities: [{ name: 'Suggested activity', type: 'stay', serviceId: id, cost: 777777, carbon: 7 }] }]
    }, { ...catalog, serviceCandidates: candidates }, 'Đà Nẵng', 1);
    const activity = plan.days[0][0];
    assert.equal(activity.verified, false, id);
    assert.equal(activity.serviceId, null, id);
    assert.equal(activity.cost, 0, id);
    assert.equal(activity.carbon, 0, id);
  }
});

test('VER-006: hidden active services cannot be verified', () => {
  const source = {
    ...catalog,
    serviceCandidates: [{
      id: 'S-DN-HIDDEN', name: 'Hidden stay', type: 'stay', destination: 'Đà Nẵng',
      cost: 900000, carbon: 4, status: 'active', catalogHidden: true
    }]
  };
  const plan = structured.canonicalItinerary({
    destination: 'Đà Nẵng', durationDays: 1,
    days: [{ activities: [{ name: 'Stay', type: 'stay', serviceId: 'S-DN-HIDDEN' }] }]
  }, source, 'Đà Nẵng', 1);
  assert.equal(plan.days[0][0].verified, false);
  assert.equal(plan.days[0][0].serviceId, null);
});

test('SLOT-001 / SLOT-002 / SLOT-004 / SLOT-005: ask only for missing itinerary slots', () => {
  const dn = { ...catalog, tours: [...catalog.tours, { id: 'T-DN', title: 'Đà Nẵng tour', destination: 'Đà Nẵng', days: 3, cost: 1 }] };
  const needDays = structured.itineraryClarification({ message: 'Lên lịch trình đi Đà Nẵng', history: [] }, dn);
  assert.match(needDays.reply, /Đà Nẵng.*bao lâu|Đà Nẵng.*bao nhiêu ngày/);
  const needDestination = structured.itineraryClarification({ message: 'Lên lịch trình 3 ngày', history: [] }, dn);
  assert.match(needDestination.reply, /ở đâu|điểm đến/);
  assert.ok(needDestination.suggestedQuestions.includes('Đà Nẵng'));
  assert.equal(structured.itineraryClarification({ message: 'Tạo lịch trình Đà Nẵng 3 ngày', history: [] }, dn), null);
  assert.equal(structured.itineraryClarification({ message: 'Lập kế hoạch Đà Nẵng 3N2Đ', history: [] }, dn), null);
});

test('SLOT-008 / SLOT-009: zero and negative duration are rejected', () => {
  for (const id of ['SLOT-008', 'SLOT-009']) {
    const response = structured.itineraryClarification({ message: sourceText(id), history: [] }, catalog);
    assert.ok(response, id + ' should request a valid duration');
    assert.match(response.reply, /1 đến 14 ngày/);
  }
});

test('CTX-001 / CTX-002: destination and duration are retained through clarification turns', () => {
  const first = structured.itineraryClarification({ message: 'Hãy tạo lịch trình', history: [] }, catalog);
  assert.match(first.reply, /điểm đến|ở đâu/);
  const secondInput = {
    message: 'Đà Nẵng',
    history: [
      { role: 'user', content: 'Hãy tạo lịch trình' },
      { role: 'assistant', content: first.reply }
    ]
  };
  const second = structured.itineraryClarification(secondInput, {
    ...catalog,
    tours: [...catalog.tours, { id: 'T-DN', title: 'Đà Nẵng tour', destination: 'Đà Nẵng', days: 3, cost: 1 }]
  });
  assert.match(second.reply, /Đà Nẵng.*bao lâu|Đà Nẵng.*bao nhiêu ngày/);
  const third = structured.itineraryClarification({
    message: '3 ngày',
    history: [...secondInput.history, { role: 'user', content: 'Đà Nẵng' }, { role: 'assistant', content: second.reply }]
  }, catalog);
  assert.equal(third, null);
});

test('CTX-003: a bare numeric answer to a duration question means number of days', () => {
  const history = [
    { role: 'user', content: 'Hãy tạo lịch trình Đà Nẵng' },
    { role: 'assistant', content: 'Bạn muốn đi Đà Nẵng trong bao lâu? Chọn thời lượng bên dưới.' }
  ];
  assert.equal(structured.itineraryClarification({ message: '3', history }, catalog), null);
});

test('TOUR-001 / API-001 / API-002: adapter paths use fixture catalog data and preserve legacy response shape', async () => {
  const tours = [
    { id: 'T-DN-001', title: 'Tour Đà Nẵng 3 ngày', destination: 'Đà Nẵng', days: 3, cost: 1790000 },
    { id: 'T-PY-001', title: 'Tour Phú Yên 3 ngày', destination: 'Phú Yên', days: 3, cost: 1200000 }
  ];
  let n8nCalls = 0;
  const send = createChatAdapter({
    env: { N8N_WEBHOOK_URL: 'https://n8n.invalid/test', N8N_AUTH_HEADER_NAME: 'X-Test-Key', N8N_AUTH_HEADER_VALUE: 'local-only', N8N_CATALOG_CACHE_MS: '0' },
    models: createCatalogModels({ tours }),
    fetchImpl: async () => { n8nCalls++; throw new Error('fixture discovery must not call n8n'); }
  });
  const support = await send({ message: 'Tui muốn đi Đà Nẵng', sessionId: 'greensteps-case-001', history: [] });
  assert.deepEqual(support.tours.map(tour => tour.id), ['T-DN-001']);
  assert.ok(support.suggestedQuestions.some(question => question.startsWith('Tự tạo lịch trình')));
  assert.equal(support.itinerary, null);

  const legacy = createLegacyChatAdapter({ sendCatalogChat: send });
  const legacyResult = await legacy({ message: 'Tui muốn đi Đà Nẵng' });
  assert.equal(legacyResult.success, true);
  assert.equal(typeof legacyResult.reply, 'string');
  assert.equal(legacyResult.recommendation, null);
  assert.equal(legacyResult.action, null);
  assert.match(legacyResult.reply, /Tour Đà Nẵng/);
  assert.doesNotMatch(legacyResult.reply, /Tour Phú Yên/);
  assert.equal(n8nCalls, 0);
});

test('VER-017 / PLAN-001: page-two fixture service is available to a canonical three-day plan', async () => {
  const services = Array.from({ length: 23 }, (_, index) => ({
    id: 'S-DN-' + String(index + 1).padStart(2, '0'),
    name: 'Dịch vụ Đà Nẵng ' + (index + 1), type: index === 22 ? 'food' : 'attraction',
    destination: 'Đà Nẵng', cost: 100000 + index * 1000, carbon: 0.5, status: 'active'
  }));
  const target = services[22];
  const catalogResult = await loadAgentCatalog({
    query: { destination: 'Đà Nẵng' }, models: createCatalogModels({ services }), includeServiceCandidates: true
  });
  assert.equal(catalogResult.available, true);
  assert.equal(catalogResult.serviceCandidates.some(service => service.id === target.id), true);
  assert.equal(catalogResult.serviceCandidatesPage, 2);
  const plan = structured.canonicalItinerary({
    name: 'Đà Nẵng 3 ngày', destination: 'Đà Nẵng', durationDays: 3,
    days: [
      { activities: [{ name: 'Food activity', type: 'dining', serviceId: target.id }] },
      { activities: [{ name: 'Sơn Trà' }] },
      { activities: [{ name: 'Biển Mỹ Khê' }] }
    ]
  }, catalogResult, 'Đà Nẵng', 3);
  assert.equal(plan.name, 'Đà Nẵng 3 ngày');
  assert.equal(plan.destination, 'Đà Nẵng');
  assert.equal(plan.days.length, 3);
  assert.equal(plan.days[1][0].name, 'Sơn Trà');
  assert.equal(plan.days[2][0].name, 'Biển Mỹ Khê');
  assert.equal(plan.days[0][0].verified, true);
  assert.equal(plan.days[0][0].serviceId, target.id);
  assert.equal(plan.days[0][0].cost, target.cost);
});
