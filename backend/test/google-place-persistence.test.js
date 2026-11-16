const { test } = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/controllers/service.controller');
const { GreenService } = require('../src/models');

test('Google Place details cannot be persisted into the internal service catalog while policy is blocked', async () => {
  const originalFind = GreenService.findOne;
  GreenService.findOne = async () => { throw new Error('database must not be accessed'); };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await controller.cacheGooglePlace({ body: { place_id: 'place-id', name: 'Place' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'PLACES_PERSISTENCE_BLOCKED');
  } finally { GreenService.findOne = originalFind; }
});
