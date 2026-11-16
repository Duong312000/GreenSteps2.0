const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('../src/config/env');
const app = require('../src/app');
const { store, User, GreenService, PartnerCampaign, SavedPromotion } = require('../src/models');
const { savedDiscount, consumeSavedPromotion } = require('../src/services/saved-promotions.service');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

test('saved coupons: ownership, repeat and concurrent claims, quantity, expiry and redemption', async () => {
  const tag = 'saved-coupon-' + randomUUID();
  const a = tag + '-a', b = tag + '-b';
  let server;
  try {
    await store.authenticate();
    for (const id of [a, b]) await User.create({ id, username: id, email: id + '@example.invalid', password_hash: 'not-used', role: 'traveler', is_verified: true });
    await GreenService.create({ id: tag, name_service: 'Coupon service', type: 'food', destination: 'Đà Lạt', status: 'active', cost: 100000, vender_id: tag, max_capacity: 20 });
    const campaign = { id: tag, user_id: tag, vender_id: tag, service_id: tag, name: 'Saved coupon', code: tag.toUpperCase(), type: 'voucher', status: 'active',
      start_at: new Date(Date.now() - 60000), end_at: new Date(Date.now() + 86400000), discount_type: 'percent', discount_value: 20, min_order: 50000, usage_limit: 2 };
    await PartnerCampaign.create(campaign);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function api(method, path, user = a, body) {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
        ...(user ? { Authorization: 'Bearer ' + jwt.sign({ id: user }, JWT_SECRET, { expiresIn: '5m' }) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, ...await response.json() };
    }
    assert.equal((await api('POST', `/vouchers/campaigns/${tag}/claim`, null)).status, 401);
    assert.equal((await api('POST', `/vouchers/campaigns/${tag}/claim`)).already_saved, false);
    assert.equal((await api('POST', `/vouchers/campaigns/${tag}/claim`)).already_saved, true);
    assert.equal((await PartnerCampaign.findByPk(tag)).claimed_count, 1);
    const publicAfterClaim = await api('GET', '/partner/promotions/public', null);
    assert.equal(publicAfterClaim.items.find(item => item.id === tag).claimed_count, 1);
    const list = await api('GET', '/vouchers/saved');
    assert.equal(list.vouchers.length, 1);
    assert.equal(list.vouchers[0].code, campaign.code);
    assert.equal(list.vouchers[0].remaining, 1);
    assert.ok(list.vouchers[0].end_at);
    assert.equal((await api('GET', `/vouchers/saved?userId=${a}`, b)).vouchers.length, 0);
    const context = { type: 'service', targetId: tag, total: 100000 };
    await assert.rejects(savedDiscount(b, campaign.code, context), /chưa nhận/);
    await assert.rejects(savedDiscount(a, campaign.code, { ...context, targetId: 'other' }), /không áp dụng/);
    await assert.rejects(savedDiscount(a, campaign.code, { ...context, total: 10000 }), /tối thiểu/);
    assert.equal((await savedDiscount(a, campaign.code, context)).discount, 20000);
    await assert.rejects(store.transaction(async () => { await consumeSavedPromotion(a, campaign.code, context); throw new Error('rollback'); }), /rollback/);
    assert.equal((await PartnerCampaign.findByPk(tag)).used_count, 0);
    await store.transaction(async () => { assert.equal(await consumeSavedPromotion(a, campaign.code, context), true); });
    assert.equal((await PartnerCampaign.findByPk(tag)).used_count, 1);
    assert.equal((await api('GET', '/vouchers/saved')).vouchers[0].status, 'used');
    await assert.rejects(savedDiscount(a, campaign.code, context), /đã được sử dụng/);

    // Exactly one slot remains. Concurrent retries by the same account issue one claim.
    const concurrent = await Promise.all([api('POST', `/vouchers/campaigns/${tag}/claim`, b), api('POST', `/vouchers/campaigns/${tag}/claim`, b)]);
    assert.ok(concurrent.every(result => result.status === 200), JSON.stringify(concurrent));
    assert.equal((await PartnerCampaign.findByPk(tag)).claimed_count, 2);
    assert.equal(await SavedPromotion.collection.countDocuments({ campaign_id: tag }), 2);
    assert.ok(!(await api('GET', '/partner/promotions/public', null)).items.some(item => item.id === tag));
    await PartnerCampaign.collection.updateOne({ id: tag }, { $set: { end_at: new Date(Date.now() - 1) } });
    assert.equal((await api('GET', '/vouchers/saved', b)).vouchers[0].status, 'expired');
    await assert.rejects(savedDiscount(b, campaign.code, context), /hết hạn/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await Promise.all([SavedPromotion.collection.deleteMany({ campaign_id: tag }), PartnerCampaign.collection.deleteMany({ id: tag }), GreenService.collection.deleteMany({ id: tag }), User.collection.deleteMany({ id: { $in: [a, b] } })]);
    await store.close();
  }
});
