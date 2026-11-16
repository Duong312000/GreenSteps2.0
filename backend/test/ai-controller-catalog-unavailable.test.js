const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAiController } = require('../src/controllers/ai.controller');

test('legacy AI controller returns a safe 503 and preserves its response schema on catalog outage', async () => {
  const controller = createAiController({ routeUserIntent: async () => {
    throw Object.assign(new Error('private mongo host'), { statusCode: 503, code: 'CHAT_CATALOG_UNAVAILABLE' });
  }, logger: { error() {} } });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await controller({ body: { message: 'Tìm tour Đà Lạt' } }, res, error => { throw error; });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(Object.keys(res.body).sort(), ['action', 'recommendation', 'reply', 'success', 'tier', 'tierLabel']);
  assert.equal(res.body.success, false);
  assert.equal(res.body.action, null);
  assert.equal(res.body.recommendation, null);
  assert.equal(JSON.stringify(res.body).includes('private mongo host'), false);
});
