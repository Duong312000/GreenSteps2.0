const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('../src/config/env');
// Never send mail for booking fixtures.
require('../src/services/email.service').sendBookingConfirmationEmail = async () => true;
const app = require('../src/app');
const { store, User, GreenService, PartnerCampaign, ServiceBooking } = require('../src/models');
const { calculatePricing } = require('../src/services/booking-pricing.service');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

test('Flash Sale prices agree across detail, quotes, persisted bookings and stock', async () => {
  const tag = 'flash-price-' + randomUUID();
  let server;
  try {
    await store.authenticate();
    await User.create({ id: tag, username: tag, email: tag + '@example.invalid', fullname: 'Flash price test', password_hash: 'unused', role: 'traveler', is_verified: true });
    await GreenService.create({ id: tag, name_service: 'Bike rental', type: 'transport', destination: 'Hội An', cost: 50000, status: 'active', vender_id: tag, max_capacity: 20 });
    await GreenService.create({ id: tag + '-stay', name_service: 'Stay', type: 'stay', destination: 'Hội An', cost: 2850000, status: 'active', vender_id: tag, max_capacity: 10,
      current_data: { rooms: [{ id: 'room', name: 'Room', capacity: 2, available_rooms: 3, price_per_night: 2850000 }] } });
    const campaign = { id: tag, name: 'Flash test', type: 'flash_sale', user_id: tag, vender_id: tag, service_id: tag, status: 'active',
      start_at: new Date(Date.now() - 60000), end_at: new Date(Date.now() + 86400000), discount_type: 'percent', discount_value: 30, usage_limit: 2 };
    await PartnerCampaign.create(campaign);
    await PartnerCampaign.create({ ...campaign, id: tag + '-fixed', service_id: tag + '-stay', discount_type: 'fixed', discount_value: 500000, usage_limit: 10 });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function api(method, path, body) {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ id: tag }, JWT_SECRET, { expiresIn: '10m' }) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    }
    const detail = (await api('GET', `/services/${tag}?flashSale=${tag}`)).data;
    assert.equal(detail.cost, 50000);
    assert.equal(detail.flashSale.sale_price, 35000);
    const input = { type: 'service', targetId: tag, guests: 2, flashSaleId: tag, paymentMethod: 'bank_transfer', bookingDate: '2099-01-10' };
    const quote = await api('POST', '/bookings/quote', { ...input, amount: 1 });
    assert.equal(quote.status, 200, JSON.stringify(quote));
    assert.equal(quote.data.pricing.discount, 30000);
    assert.equal(quote.data.pricing.total, 190000); // 70,000 service + 120,000 fee
    assert.equal(quote.data.pricing.deposit, 57000);
    const booking = await api('POST', '/bookings', { ...input, value: 1 });
    assert.equal(booking.status, 200, JSON.stringify(booking));
    const saved = await ServiceBooking.collection.findOne({ user_id: tag });
    assert.equal(saved.value, 57000);
    assert.equal(saved.pricing_snapshot.flashSale.id, tag);
    assert.equal(saved.pricing_snapshot.discount, 30000);
    assert.equal((await PartnerCampaign.findByPk(tag)).used_count, 2);
    assert.equal((await api('POST', '/bookings/quote', input)).status, 409);
    assert.equal(await ServiceBooking.collection.countDocuments({ user_id: tag }), 1);
    const stay = await calculatePricing({ type: 'service', targetId: tag + '-stay', guestCount: 2, roomId: 'room', roomCount: 1,
      bookingDate: '2099-01-10', checkOutDate: '2099-01-12', flashSaleId: tag + '-fixed' });
    assert.equal(stay.discount, 1000000);
    assert.equal(stay.tourSubtotal - stay.discount, 4700000);
    assert.equal(stay.flashSale.sale_price, 2350000);
    await PartnerCampaign.collection.updateOne({ id: tag + '-fixed' }, { $set: { end_at: new Date(Date.now() - 1) } });
    await assert.rejects(calculatePricing({ type: 'service', targetId: tag + '-stay', guestCount: 1, flashSaleId: tag + '-fixed' }), /Flash Sale/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await Promise.all([ServiceBooking.collection.deleteMany({ user_id: tag }), PartnerCampaign.collection.deleteMany({ user_id: tag }), GreenService.collection.deleteMany({ vender_id: tag }), User.collection.deleteMany({ id: tag })]);
    await store.close();
  }
});
