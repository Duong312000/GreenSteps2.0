const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalTour, canonicalItinerary, normalizeStructuredResponse, itineraryClarification, itineraryContextHistory, isItineraryRequest } = require('../src/services/greensteps-chat-structured.service');

const catalog = {
  available: true,
  tours: [{
    id: 'tour-live-1', title: 'Đà Lạt xanh 3 ngày', destination: 'Đà Lạt', days: 3,
    cost: 3200000, carbon: 8, imageUrl: '/images/dalat.jpg', highlights: ['Hồ Tuyền Lâm'], tags: ['Du lịch xanh']
  }],
  services: [{ id: 'srv_live_1', name: 'Vườn quốc gia', type: 'attraction', destination: 'Đà Lạt', cost: 250000, carbon: 1.2, status: 'active' }]
};

test('a new itinerary request asks for missing duration instead of reusing an older tour search', () => {
  const contextCatalog = {
    ...catalog,
    tours: [...catalog.tours, { id: 'tour-danang', title: 'Đà Nẵng xanh', destination: 'Đà Nẵng - Hội An', days: 1, cost: 900000 }]
  };
  const result = itineraryClarification({
    message: 'Lập lịch trình Đà Lạt',
    history: [
      { role: 'user', content: 'Gợi ý tour Đà Nẵng 1 ngày' },
      { role: 'assistant', content: 'Mình đã tìm được tour phù hợp.' }
    ]
  }, contextCatalog);

  assert.ok(result);
  assert.match(result.reply, /Đà Lạt/);
  assert.deepEqual(result.suggestedQuestions, ['2 ngày 1 đêm', '3 ngày 2 đêm', '4 ngày 3 đêm']);
});

test('answers to itinerary clarification use only the active plan conversation', () => {
  const contextCatalog = {
    ...catalog,
    tours: [...catalog.tours, { id: 'tour-danang', title: 'Đà Nẵng xanh', destination: 'Đà Nẵng - Hội An', days: 1, cost: 900000 }]
  };
  const input = {
    message: 'Đà Lạt',
    history: [
      { role: 'user', content: 'Gợi ý tour Đà Nẵng 1 ngày' },
      { role: 'assistant', content: 'Mình đã tìm được tour phù hợp.' },
      { role: 'user', content: 'Lập lịch trình' },
      { role: 'assistant', content: 'Bạn muốn lập lịch trình ở đâu? Chọn một điểm đến bên dưới hoặc nhập tên điểm đến khác.' }
    ]
  };
  const result = itineraryClarification(input, contextCatalog);

  assert.ok(result);
  assert.match(result.reply, /Đà Lạt/);
  assert.deepEqual(itineraryContextHistory(input), input.history.slice(2));
});

test('natural trip creation wording is classified as a custom itinerary', () => {
  const cases = [
    'Tạo cho tui chuyến đi Phú Yên 1 ngày',
    'Thiết kế chuyến đi Hội An',
    'Tạo chuyến đi riêng cho tôi ở Đà Lạt'
  ];
  for (const message of cases) {
    assert.equal(isItineraryRequest({ message, history: [] }), true, message);
  }
});

test('general advice about green tourism is not mistaken for an itinerary request', () => {
  assert.equal(isItineraryRequest({ message: 'Tư vấn du lịch xanh ở Đà Lạt', history: [] }), false);
  assert.equal(isItineraryRequest({ message: 'Gợi ý lịch trình Đà Lạt', history: [] }), true);
  assert.equal(isItineraryRequest({ message: 'Lên lịch đi chơi ở Hội An', history: [] }), true);
});

test('Vietnamese duration shorthand preserves requested itinerary days', () => {
  const message = 'tao lich trinh da lat 3n2d 5tr';
  assert.equal(isItineraryRequest({ message, history: [] }), true);
  assert.equal(itineraryClarification({ message, history: [] }, catalog), null);
});

test('structured tour cards use canonical catalog IDs, prices, images and labels', () => {
  const result = normalizeStructuredResponse({ output: {
    type: 'tour_recommendation', message: 'Mình tìm thấy tour phù hợp.',
    tours: [{ id: 'tour-live-1', name: 'Tour giả', price: 1 }, { id: 'invented-id', name: 'Tour bịa', price: 2 }]
  } }, 'output', catalog, { message: 'Tìm tour Đà Lạt', history: [] });

  assert.equal(result.type, 'tour_recommendations');
  assert.equal(result.tours.length, 1);
  assert.equal(result.tours[0].id, 'tour-live-1');
  assert.equal(result.tours[0].price, 3200000);
  assert.equal(result.tours[0].imageUrl, '/images/dalat.jpg');
  assert.deepEqual(result.tours[0].ecoLabels, ['Du lịch xanh']);
  assert.equal(result.suggestedQuestions.length, 3);
});

test('itinerary activities use verified service data and keep unknown suggestions unpriced', () => {
  const plan = canonicalItinerary({
    name: 'Hành trình Đà Lạt', destination: 'Đà Lạt',
    days: [[
      { name: 'Tên và giá do AI bịa', cost: 9000000, serviceId: 'unknown' },
      { name: 'Vườn quốc gia', cost: 5, serviceId: 'srv_live_1' }
    ]]
  }, catalog);

  assert.equal(plan.estimatedCost, 250000);
  assert.equal(plan.days[0][0].verified, false);
  assert.equal(plan.days[0][0].cost, 0);
  assert.equal(plan.days[0][1].verified, true);
  assert.equal(plan.days[0][1].cost, 250000);
  assert.equal(plan.days[0][1].serviceId, 'srv_live_1');
});

test('itinerary verification requires an exact active service ID and canonicalizes service metadata', () => {
  const plan = canonicalItinerary({
    destination: 'Đà Lạt',
    days: [[
      { name: 'Vườn quốc gia', time: '09:00', cost: 9000000, carbon: 999 },
      { name: 'AI gọi sai tên', time: '10:00', serviceId: 'srv_live_1', cost: 1, carbon: 0 }
    ]]
  }, catalog);

  assert.equal(plan.days[0][0].verified, false);
  assert.equal(plan.days[0][0].serviceId, null);
  assert.equal(plan.days[0][0].cost, 0);
  assert.equal(plan.days[0][0].carbon, 0);
  assert.equal(plan.days[0][1].verified, true);
  assert.equal(plan.days[0][1].name, 'Vườn quốc gia');
  assert.equal(plan.days[0][1].serviceId, 'srv_live_1');
  assert.equal(plan.days[0][1].cost, 250000);
  assert.equal(plan.days[0][1].carbon, 1.2);
  assert.deepEqual(Object.keys(plan.days[0][1]), ['name', 'time', 'cost', 'carbon', 'type', 'verified', 'serviceId']);
});

test('an inactive catalog service ID cannot be verified', () => {
  const inactiveCatalog = {
    ...catalog,
    services: [{ ...catalog.services[0], status: 'inactive' }]
  };
  const plan = canonicalItinerary({
    destination: 'Đà Lạt',
    days: [[{ name: 'Vườn quốc gia', serviceId: 'srv_live_1' }]]
  }, inactiveCatalog);

  assert.equal(plan.days[0][0].verified, false);
  assert.equal(plan.days[0][0].serviceId, null);
  assert.equal(plan.days[0][0].cost, 0);
  assert.equal(plan.days[0][0].carbon, 0);
});

test('itinerary services found outside the display page can be verified by their catalog ID', () => {
  const candidateCatalog = {
    ...catalog,
    services: [],
    serviceCandidates: [{ ...catalog.services[0], id: 'service-page-two' }]
  };
  const plan = canonicalItinerary({
    destination: 'Đà Lạt',
    days: [[{ name: 'Tên Gemini tự viết', serviceId: 'service-page-two' }]]
  }, candidateCatalog);

  assert.equal(plan.days[0][0].verified, true);
  assert.equal(plan.days[0][0].name, 'Vườn quốc gia');
  assert.equal(plan.days[0][0].serviceId, 'service-page-two');
  assert.equal(plan.days[0][0].cost, 250000);
});

test('itinerary rejects an incomplete requested duration instead of padding blank days', () => {
  const plan = canonicalItinerary({ destination: 'Đà Lạt', days: [[{ name: 'Hồ Xuân Hương' }]] }, catalog, 'Đà Lạt', 3);
  assert.equal(plan, null);
});

test('service IDs from a different destination are not trusted or priced', () => {
  const contextCatalog = {
    ...catalog,
    services: [...catalog.services, { id: 'srv_danang', name: 'Chèo thuyền sông Hàn', type: 'activity', destination: 'Đà Nẵng', cost: 500000, status: 'active' }]
  };
  const plan = canonicalItinerary({ destination: 'Đà Lạt', days: [[{ name: 'Chèo thuyền sông Hàn', serviceId: 'srv_danang' }]] }, contextCatalog, 'Đà Lạt');
  assert.equal(plan.days[0][0].verified, false);
  assert.equal(plan.days[0][0].serviceId, null);
  assert.equal(plan.days[0][0].cost, 0);
});

test('an n8n itinerary for the wrong destination is rejected without a proposal card', () => {
  const contextCatalog = {
    ...catalog,
    tours: [...catalog.tours, { id: 'tour-phuyen', title: 'Phú Yên xanh', destination: 'Phú Yên', days: 1, cost: 800000 }]
  };
  const result = normalizeStructuredResponse({ output: {
    type: 'itinerary_proposal', message: 'Lịch trình Đà Nẵng ngày 1',
    itinerary: { destination: 'Đà Nẵng', days: [[{ name: 'Cầu Rồng' }]] }
  } }, 'output', contextCatalog, { message: 'Tạo lịch trình Phú Yên 1 ngày', history: [] });
  assert.equal(result.type, 'text');
  assert.equal(result.itinerary, null);
  assert.deepEqual(result.tours, []);
  assert.match(result.reply, /Phú Yên/);
});

test('an itinerary request never renders package-tour cards when n8n returns the wrong response type', () => {
  const result = normalizeStructuredResponse({ output: {
    type: 'tour_recommendations', message: 'GreenSteps found suitable package tours.',
    tours: [{ id: 'tour-live-1' }]
  } }, 'output', catalog, { message: 'Lập lịch trình Đà Lạt 3 ngày 2 đêm', history: [] });

  assert.equal(result.type, 'text');
  assert.equal(result.itinerary, null);
  assert.deepEqual(result.tours, []);
});

test('plain text day-by-day proposals become editable drafts without invented dates', () => {
  const result = normalizeStructuredResponse([
    { output: 'Lịch trình gợi ý Đà Lạt\nNgày 1: Khám phá trung tâm\n- Hồ Xuân Hương\n- Chợ đêm Đà Lạt\nNgày 2\n- Vườn quốc gia' }
  ], 'output', catalog, { message: 'Lập lịch trình Đà Lạt 2 ngày', history: [] });

  assert.equal(result.type, 'itinerary_proposal');
  assert.equal(result.itinerary.destination, 'Đà Lạt');
  assert.equal(result.itinerary.days.length, 2);
  assert.equal(result.itinerary.startDate, null);
  assert.equal(result.itinerary.days.flat().every(activity => !activity.verified && activity.cost === 0), true);
});

test('canonical tour metadata never carries arbitrary fields from the source', () => {
  const tour = canonicalTour({ ...catalog.tours[0], bookingAvailable: false, token: 'secret', price: 1 });
  assert.equal(tour.bookingAvailable, false);
  assert.equal('token' in tour, false);
  assert.equal(tour.price, 3200000);
  assert.equal(canonicalTour({ ...catalog.tours[0], bookingAvailable: true }).bookingAvailable, true);
  const missingPrice = canonicalTour({ ...catalog.tours[0], cost: null });
  assert.equal(missingPrice.price, null);
  assert.equal(missingPrice.bookingAvailable, false);
});
