const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../src/config/env');
const configured = process.env.TEST_MONGODB_URI;

test('MongoDB API, relationships, financial transactions and migrated response shapes', { skip: !configured }, async t => {
  // A generated database makes these tests independent from real customer data.
  const uri = new URL(configured);
  const databaseName = `GreenStepsMigrationTest_${Date.now()}`;
  uri.pathname = `/${databaseName}`;
  process.env.MONGODB_URI = uri.toString();
  const { store, User, AuthOtp, PendingRegistration, Wallet, WalletTransaction, ServiceBooking, Schedule, ScheduleSample, ScheduleActivity, GreenService, CommentPost, CPGS, Badge, BadgeService } = require('../src/models');
  const { Op } = require('../src/db/mongo-store');
  const app = require('../src/app');
  const bcrypt = require('bcrypt');
  let server;
  try {
    await store.sync();
    const password = 'TestMongo123!';
    await User.create({ id: 'test-user', username: 'mongo_test', email: 'mongo-test@example.com', password_hash: await bcrypt.hash(password, 4), is_verified: true });
    await Wallet.create({ id: 'test-wallet', user_id: 'test-user', balance: 1000000, registered: true });
    await GreenService.create({ id: 'test-service', name_service: 'Nhà xanh', type: 'stay', cost: 200000, destination: 'Đà Lạt' });
    await Schedule.create({ id: 'test-tour', tour_name: 'Tour xanh', destination: 'Đà Lạt', days: 1 });
    await ScheduleSample.create({ id: 'test-tour', cost: 300000 });
    await ScheduleActivity.create({ id: 'test-activity', schedule_id: 'test-tour', service_id: 'test-service', day_number: 1, time: '08:00', activity_name: 'Nghỉ dưỡng', activity_cost: 200000 });
    await Badge.create({ id: 'green', badges_description: 'Xanh', foruserortour: 1 });
    await BadgeService.create({ service_id: 'test-service', badge_name: 'green' });

    await t.test('nested joins, junctions, virtual values and literal search', async () => {
      const sample = await ScheduleSample.findByPk('test-tour', { include: [{ model: Schedule, include: [ScheduleActivity] }] });
      assert.equal(sample.Schedule.ScheduleActivities[0].type, 'lodging');
      const service = await GreenService.findByPk('test-service', { include: [Badge] });
      assert.equal(service.Badges[0].id, 'green');
      assert.equal((await GreenService.findAll({ where: { destination: { [Op.iLike]: '%đà lạt%' } } })).length, 1);
    });
    await t.test('commit, callback rollback, manual rollback and stale wallet protection', async () => {
      await store.transaction(async transaction => {
        const wallet = await Wallet.findByPk('test-wallet', { transaction });
        await wallet.update({ balance: 900000 }, { transaction });
        await WalletTransaction.create({ id: 'pay', wallet_id: wallet.id, type: 'payment', description: 'Test', amount: 100000 }, { transaction });
      });
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 900000);
      await assert.rejects(store.transaction(async transaction => {
        await Wallet.update({ balance: 100 }, { where: { id: 'test-wallet' }, transaction });
        await WalletTransaction.create({ id: 'rolled-back', wallet_id: 'test-wallet', type: 'payment', description: 'rollback', amount: 100 }, { transaction });
        throw new Error('rollback test');
      }), /rollback test/);
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 900000);
      assert.equal(await WalletTransaction.findByPk('rolled-back'), null);
      const tx = await store.transaction();
      await Wallet.update({ balance: 200 }, { where: { id: 'test-wallet' }, transaction: tx });
      await tx.rollback();
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 900000);
      const first = await Wallet.findByPk('test-wallet');
      const stale = await Wallet.findByPk('test-wallet');
      await first.update({ balance: 800000 });
      await assert.rejects(stale.update({ balance: 700000 }), error => error.statusCode === 409);
      await assert.rejects(first.update({ balance: -1 }), /minimum/);
      let attempts = 0;
      await assert.rejects(store.transaction(async transaction => {
        attempts++;
        await Wallet.update({ balance: 10 }, { where: { id: 'test-wallet' }, transaction });
        const { MongoServerError } = require('mongodb');
        const error = new MongoServerError({ message: 'test conflict' });
        error.addErrorLabel('TransientTransactionError');
        throw error;
      }), /test conflict/);
      assert.equal(attempts, 1);
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 800000);
    });
    await t.test('review hooks aggregate ratings in the same transaction', async () => {
      await store.transaction(async transaction => {
        await CommentPost.create({ id: 'review', user_id: 'test-user', service_id: 'test-service', text: 'Tốt', rating: 4 }, { transaction });
        await CPGS.create({ comment_id: 'review', service_id: 'test-service' }, { transaction });
      });
      assert.equal((await GreenService.findByPk('test-service')).rating, 4);
      await assert.rejects(store.transaction(async transaction => {
        await CommentPost.create({ id: 'failed-review', service_id: 'test-service', text: 'Không lưu', rating: 2 }, { transaction });
        throw new Error('rollback rating');
      }), /rollback rating/);
      assert.equal((await GreenService.findByPk('test-service')).rating, 4);
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(route, body, token) {
      const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const json = await response.json();
      assert.equal(response.status, 200, JSON.stringify(json));
      return json;
    }
    await t.test('HTTP login, both API prefixes, tours, services, wallet and itinerary round trip', async () => {
      const health = await request('/health');
      assert.equal(health.transactions, true);
      const login = await request('/auth/login', { username: 'mongo_test', password });
      assert.equal(login.user.id, 'test-user');
      assert.equal(login.user.role, 'traveler');
      assert.equal(login.user.password_hash, undefined);
      assert.equal((await request('/wallet', undefined, login.token)).wallet.balance, 800000);
      const tours = await request('/tours');
      assert.equal(tours[0].id, 'test-tour');
      assert.equal(tours[0].data[0][0].type, 'lodging');
      assert.equal((await request('/services')).length, 1);
      assert.equal((await fetch(base.replace('/api', '/api/v1') + '/tours')).status, 200);
      await request('/itineraries', { id: 'custom-test', user_id: 'test-user', name: 'Chuyến đi', destination: 'Đà Lạt', days: 1, totalCost: 50000, status: 'draft', daysData: [[{ name: 'Đi bộ', time: '09:00', cost: 50000, carbon: 2 }]] }, login.token);
      const itinerary = await request('/itineraries/custom-test', undefined, login.token);
      assert.ok(JSON.stringify(itinerary).includes('Đi bộ'));
      assert.equal(await ScheduleActivity.count({ where: { schedule_id: 'custom-test' } }), 1);
      await request('/bookings', { type: 'service', targetId: 'test-service', bookingDate: '2026-12-01', guests: 1, paymentMethod: 'wallet', customerPhone: '0900000000' }, login.token);
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 600000);
      assert.equal(await ServiceBooking.count({ where: { user_id: 'test-user' } }), 1);
      const payment = await WalletTransaction.findOne({ where: { type: 'escrow_hold' } });
      assert.equal((await request(`/wallet/transaction-status/${payment.id}`, undefined, login.token)).status, 'pending');
      assert.equal((await request('/wallet/pay', { userId: 'test-user', itineraryId: 'custom-test', amount: 50000 }, login.token)).balance, 550000);
      assert.equal((await WalletTransaction.findOne({ where: { reference_id: 'custom-test', status: 'success' } })).amount, -50000);
      await request('/wallet/pay-qr', { userId: 'test-user', itineraryId: 'custom-test', amount: 10000 }, login.token);
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 550000);
      const invalidPayment = await fetch(base + '/wallet/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'test-user', itineraryId: 'custom-test', amount: -50000 }) });
      assert.equal(invalidPayment.status, 400);
      assert.equal((await Wallet.findByPk('test-wallet')).balance, 550000);
      await Wallet.update({ green_points: 1000 }, { where: { id: 'test-wallet' } });
      assert.equal((await request('/vouchers/redeem', {}, login.token)).remainingPoints, 0);
    });
    await t.test('existing checkout OTP and registration OTP persist and consume in MongoDB', async () => {
      const { createHmac } = require('node:crypto');
      const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
      const otp = '123456';
      const otp_hash = 'sha256:' + createHmac('sha256', JWT_SECRET).update(otp).digest('hex');
      const dates = { expires_at: new Date(Date.now() + 300000), resend_available_at: new Date() };
      await AuthOtp.create({ id: 'checkout-otp', user_id: 'test-user', purpose: 'RESET_PASSWORD', otp_hash, ...dates });
      const checkout = await request('/auth/verify-checkout-otp', { email: 'mongo-test@example.com', otp });
      assert.equal(checkout.user.id, 'test-user');
      assert.ok((await AuthOtp.findByPk('checkout-otp')).consumed_at instanceof Date);
      await PendingRegistration.create({ id: 'registration-otp', username: 'new_mongo_user', email: 'new-mongo@example.com', password_hash: await bcrypt.hash('OtherMongo123!', 4), otp_hash, ...dates });
      const registration = await request('/auth/register/verify-otp', { email: 'new-mongo@example.com', otp });
      assert.equal(registration.user.username, 'new_mongo_user');
      assert.equal((await User.findByPk(registration.user.id)).is_verified, true);
      assert.ok((await PendingRegistration.findByPk('registration-otp')).consumed_at instanceof Date);
    });
    await t.test('merged OAuth routes link MongoDB identities and protect profile ownership', async () => {
      const originalFetch = global.fetch;
      const keys = ['GOOGLE_CLIENT_ID', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_GRAPH_VERSION'];
      const saved = keys.map(key => process.env[key]);
      Object.assign(process.env, { GOOGLE_CLIENT_ID: 'test-google-client', FACEBOOK_APP_ID: 'test-facebook-app', FACEBOOK_APP_SECRET: 'test-secret', FACEBOOK_GRAPH_VERSION: 'v99.0' });
      let facebookId = 'facebook-owner';
      global.fetch = async (url, options) => {
        if (String(url).startsWith('https://graph.facebook.com/')) {
          const value = String(url).includes('/debug_token')
            ? { data: { is_valid: true, type: 'USER', app_id: 'test-facebook-app', user_id: facebookId, expires_at: Date.now() / 1000 + 3600 } }
            : { id: facebookId, email: 'mongo-test@example.com', name: 'Facebook name' };
          return { ok: true, json: async () => value };
        }
        if (String(url).startsWith('https://oauth2.googleapis.com/')) return { ok: true, json: async () => ({ aud: 'test-google-client', sub: 'google-owner', expires_in: 3600 }) };
        if (String(url).startsWith('https://openidconnect.googleapis.com/')) return { ok: true, json: async () => ({ sub: 'google-owner', email: 'migration-test@gmail.com', email_verified: true, name: 'Google name' }) };
        return originalFetch(url, options);
      };
      try {
        const before = await User.count();
        const facebook = await request('/auth/facebook-login', { accessToken: 'verified-facebook-token' });
        assert.equal(facebook.user.id, 'test-user');
        assert.equal((await User.findByPk('test-user')).facebook_id, facebookId);
        assert.equal(await User.count(), before);
        assert.equal((await request('/auth/facebook-login', { accessToken: 'verified-facebook-token' })).user.id, 'test-user');
        const config = await request('/auth/facebook/config');
        assert.equal(config.enabled, true);
        assert.equal(JSON.stringify(config).includes('test-secret'), false);
        facebookId = 'conflicting-facebook';
        const conflict = await fetch(base + '/auth/facebook-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: 'other-facebook-token' }) });
        assert.equal(conflict.status, 409);
        const google = await request('/auth/google-login', { accessToken: 'verified-google-token' });
        assert.equal(google.user.email, 'migration-test@gmail.com');
        assert.equal((await request('/auth/google-login', { accessToken: 'verified-google-token' })).user.id, google.user.id);
        assert.equal((await fetch(base + '/auth/profile')).status, 401);
        const profile = await fetch(base + `/auth/profile/${google.user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facebook.token}` }, body: JSON.stringify({ fullname: 'Owner updated', role: 'admin' }) });
        assert.equal(profile.status, 200);
        const result = await profile.json();
        assert.equal(result.user.id, 'test-user');
        assert.equal(result.user.role, 'traveler');
        assert.equal(result.user.password_hash, undefined);
        // A nullable external identity must not prevent unrelated users registering.
        const password_hash = await bcrypt.hash('TestMongo123!', 4);
        for (const id of ['null-fb-1', 'null-fb-2']) await User.create({ id, username: id, email: `${id}@example.com`, password_hash, facebook_id: null });
      } finally {
        global.fetch = originalFetch;
        keys.forEach((key, index) => saved[index] === undefined ? delete process.env[key] : process.env[key] = saved[index]);
      }
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (store.db.databaseName === databaseName && databaseName.startsWith('GreenStepsMigrationTest_')) await store.db.dropDatabase();
    await store.close();
  }
});
