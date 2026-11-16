const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMapsRouter } = require('../src/routes/maps.routes');

function findHandler(router, method, path) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} route exists`);
  return layer.route.stack[0].handle;
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('Maps endpoints fail closed without a configured key and never fall back to a source key', async () => {
  let fetchCount = 0;
  const router = createMapsRouter({ apiKey: '', fetchImpl: async () => { fetchCount += 1; } });
  const res = responseRecorder();
  await findHandler(router, 'get', '/places/search')({ query: { query: 'Đà Lạt' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(fetchCount, 0);
});

test('request rate limiter is mounted before chargeable Maps routes', () => {
  const router = createMapsRouter({ apiKey: '', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  const limitIndex = router.stack.findIndex(layer => layer.handle.name === 'mapsRateLimitMiddleware');
  const searchIndex = router.stack.findIndex(layer => layer.route?.path === '/places/search');
  const routesIndex = router.stack.findIndex(layer => layer.route?.path === '/routes');
  assert.ok(limitIndex >= 0);
  assert.ok(limitIndex < searchIndex);
  assert.ok(limitIndex < routesIndex);
});

test('Places search does not cache or return photos, reviews, or credentials', async () => {
  let fetchCount = 0;
  let requestedFieldMask = '';
  const router = createMapsRouter({
    apiKey: 'test-only-key',
    fetchImpl: async (_url, options) => {
      fetchCount += 1;
      requestedFieldMask = options.headers['X-Goog-FieldMask'];
      return { ok: true, json: async () => ({ places: [{
        id: 'place-1',
        displayName: { text: 'Đà Lạt' },
        formattedAddress: 'Lâm Đồng',
        googleMapsUri: 'https://maps.google.com/?cid=1',
        photos: [{ name: 'places/place-1/photos/photo-1' }],
        reviews: [{ text: { text: 'review' } }]
      }] }) };
    }
  });
  const handler = findHandler(router, 'get', '/places/search');
  const first = responseRecorder();
  const second = responseRecorder();
  await handler({ query: { query: 'Đà Lạt' } }, first);
  await handler({ query: { query: 'Đà Lạt' } }, second);

  assert.equal(fetchCount, 2);
  assert.doesNotMatch(requestedFieldMask, /photos|reviews/);
  assert.deepEqual(first.body.places[0].photos, []);
  assert.deepEqual(first.body.places[0].googleReviews, []);
  assert.equal(first.body.places[0].googleMapsUrl, 'https://maps.google.com/?cid=1');
  const serialized = JSON.stringify(first.body);
  assert.equal(serialized.includes('test-only-key'), false);
  assert.equal(serialized.includes('photo-1'), false);
});

test('Routes responses are not read from or written to a persistent cache', async () => {
  let fetchCount = 0;
  const router = createMapsRouter({
    apiKey: 'test-only-key',
    fetchImpl: async () => {
      fetchCount += 1;
      return { ok: true, json: async () => ({ routes: [{ distanceMeters: 1000, duration: '120s', legs: [] }] }) };
    }
  });
  const handler = findHandler(router, 'post', '/routes');
  const req = { body: { origin: { lat: 16, lng: 108 }, destination: { lat: 16.1, lng: 108.1 } } };
  const first = responseRecorder();
  const second = responseRecorder();
  await handler(req, first);
  await handler(req, second);
  assert.equal(fetchCount, 2);
  assert.equal(first.body.cached, false);
  assert.doesNotMatch(JSON.stringify(first.body), /test-only-key/);
});

test('invalid route coordinates are rejected without calling Google', async () => {
  let fetchCount = 0;
  const router = createMapsRouter({ apiKey: 'test-only-key', fetchImpl: async () => { fetchCount += 1; } });
  const res = responseRecorder();
  await findHandler(router, 'post', '/routes')({
    body: { origin: { lat: '', lng: 108 }, destination: { lat: 16, lng: 108 } }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(fetchCount, 0);
});
