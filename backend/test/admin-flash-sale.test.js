const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateFlashUpdate } = require('../src/services/admin-flash-sale.service');
const { campaignState } = require('../src/services/campaign-state.service');
const now = Date.parse('2026-11-12T12:00:00Z');
const row = { _rev: 2, type: 'flash_sale', status: 'active', used_count: 6, usage_limit: 10,
  start_at: new Date(now - 3600000), end_at: new Date(now + 86400000),
  discount_type: 'percent', discount_value: 20, vender_id: 'v1' };
const service = { status: 'active', cost: 50000, vender_id: 'v1' };
const body = { version: 2, usage_limit: 20, discount_type: 'percent', discount_value: 20,
  start_at: row.start_at.toISOString(), end_at: row.end_at.toISOString(), status: 'active' };

test('quantity changes preserve usage and allow more stock for exhausted sales', () => {
  assert.equal(validateFlashUpdate(row, body, service, now).usage_limit, 20);
  const exhausted = { ...row, usage_limit: 6 };
  assert.equal(campaignState(exhausted, now), 'exhausted');
  assert.equal(campaignState({ ...exhausted, ...validateFlashUpdate(exhausted, body, service, now) }, now), 'active');
  assert.equal(validateFlashUpdate(row, { ...body, usage_limit: 6 }, service, now).usage_limit, 6);
});
test('rejects invalid stock, stale versions, dates and unauthorized discount changes', () => {
  for (const change of [{ usage_limit: 5 }, { usage_limit: 1.5 }, { usage_limit: -1 },
    { version: 1 }, { discount_value: 101 }, { discount_value: 30 },
    { start_at: 'bad-date' }, { end_at: new Date(now - 1).toISOString() }, { status: 'fake' }]) {
    assert.throws(() => validateFlashUpdate(row, { ...body, ...change }, service, now));
  }
  assert.throws(() => validateFlashUpdate(row, body, { ...service, vender_id: 'other' }, now));
  assert.throws(() => validateFlashUpdate({ ...row, status: 'cancelled' }, body, service, now));
});
test('campaign state agrees at scheduled, paused, exhausted and expired boundaries', () => {
  assert.equal(campaignState({ ...row, start_at: new Date(now + 1) }, now), 'scheduled');
  assert.equal(campaignState({ ...row, status: 'paused' }, now), 'paused');
  assert.equal(campaignState({ ...row, end_at: new Date(now) }, now), 'expired');
});
