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
  const { store, User, AuthOtp, PendingRegistration, Wallet, WalletTransaction, ServiceBooking, TourBooking, Schedule, ScheduleSample, ScheduleActivity, GreenService, CommentPost, CPGS, CPSS, Provider, Vender, Badge, BadgeService } = require('../src/models');
  const { Op } = require('../src/db/mongo-store');
  const app = require('../src/app');
  const bcrypt = require('bcrypt');
  let server;
  try {
    await store.sync();
    await t.test('review booking IDs have a unique partial index and no duplicates in the isolated database', async () => {
      const indexes = await CommentPost.collection.listIndexes().toArray();
      const bookingIndex = indexes.find(index => index.key?.booking_id === 1 && index.unique === true);
      assert.ok(bookingIndex, 'CommentPost.booking_id unique index is missing');
      assert.equal(bookingIndex.partialFilterExpression?.booking_id?.$type, 'string');
      const duplicates = await CommentPost.collection.aggregate([
        { $match: { booking_id: { $type: 'string' } } },
        { $group: { _id: '$booking_id', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]).toArray();
      assert.deepEqual(duplicates, []);
    });
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
    async function request(route, body, token, expectedStatus = 200) {
      const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const json = await response.json();
      assert.equal(response.status, expectedStatus, JSON.stringify(json));
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
    await t.test('completed booking review writes are owner-bound, unique, and linked for tour and service', async () => {
      await ServiceBooking.create({
        id: 'service-review-booking', user_id: 'test-user', service_id: 'test-service',
        fullname: 'Test customer', name_service: 'Nhà xanh', booking_date: '2026-12-01',
        guests: 1, value: 200000, payment_method: 'card', status: 'completed', evoucher_code: 'EV-SRV-REVIEW'
      });
      await TourBooking.create({
        id: 'tour-review-booking', user_id: 'test-user', schedule_id: 'test-tour',
        fullname: 'Test customer', tour_name: 'Tour xanh', booking_date: '2026-12-01',
        guests: 1, value: 300000, payment_method: 'card', status: 'completed', evoucher_code: 'EV-TOUR-REVIEW'
      });
      const login = await request('/auth/login', { username: 'mongo_test', password });

      const tourResult = await request('/reviews/tour', {
        userId: 'forged-user', bookingId: 'tour-review-booking', tourId: 'test-tour', rating: 5, text: 'Tour tốt'
      }, login.token, 201);
      const tourReview = await CommentPost.findOne({ where: { booking_id: 'tour-review-booking' } });
      assert.equal(tourReview.user_id, 'test-user');
      assert.equal(tourReview.tour_id, 'test-tour');
      assert.equal((await CPSS.findOne({ where: { comment_id: tourReview.id } })).schedule_sample_id, 'test-tour');
      assert.equal(tourResult.reviews_count, 1);
      assert.equal((await ScheduleSample.findByPk('test-tour')).rating, 5);
      assert.equal((await request('/reviews/tour', {
        bookingId: 'tour-review-booking', tourId: 'test-tour', rating: 4, text: 'Lần hai'
      }, login.token, 409)).success, false);
      await TourBooking.create({
        id: 'concurrent-tour-review-booking', user_id: 'test-user', schedule_id: 'test-tour',
        fullname: 'Test customer', tour_name: 'Tour xanh', booking_date: '2026-12-02',
        guests: 1, value: 300000, payment_method: 'card', status: 'completed', evoucher_code: 'EV-TOUR-CONCURRENT'
      });
      const concurrentRequests = await Promise.all([1, 2].map(() => fetch(base + '/reviews/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
        body: JSON.stringify({ bookingId: 'concurrent-tour-review-booking', tourId: 'test-tour', rating: 3, text: 'Tour okay' })
      })));
      assert.deepEqual(concurrentRequests.map(response => response.status).sort(), [201, 409]);
      assert.equal((await ScheduleSample.findByPk('test-tour')).rating, 4);
      assert.equal((await ScheduleSample.findByPk('test-tour')).votes_count, 2);

      const serviceResult = await request('/reviews/service', {
        bookingId: 'service-review-booking', serviceId: 'test-service', rating: 4, text: 'Dịch vụ tốt'
      }, login.token, 201);
      const serviceReview = await CommentPost.findOne({ where: { booking_id: 'service-review-booking' } });
      assert.equal(serviceReview.user_id, 'test-user');
      assert.equal(serviceReview.service_id, 'test-service');
      assert.equal((await CPGS.findOne({ where: { comment_id: serviceReview.id } })).service_id, 'test-service');
      assert.equal(serviceResult.reviews_count, 2); // the existing review-hook fixture plus this booking review
      assert.equal((await GreenService.findByPk('test-service')).bookings_count, await ServiceBooking.count({ where: { service_id: 'test-service' } }));

      await TourBooking.create({
        id: 'rollback-tour-review-booking', user_id: 'test-user', schedule_id: 'test-tour',
        fullname: 'Test customer', tour_name: 'Tour xanh', booking_date: '2026-12-03',
        guests: 1, value: 300000, payment_method: 'card', status: 'completed', evoucher_code: 'EV-TOUR-ROLLBACK'
      });
      const tourBeforeFailedReview = await ScheduleSample.findByPk('test-tour');
      const tourRatingBeforeFailedReview = { rating: tourBeforeFailedReview.rating, votes_count: tourBeforeFailedReview.votes_count };
      const originalCPSSCreate = CPSS.create;
      try {
        CPSS.create = async () => { throw new Error('injected CPSS write failure'); };
        await request('/reviews/tour', { bookingId: 'rollback-tour-review-booking', tourId: 'test-tour', rating: 1, text: 'rollback' }, login.token, 500);
      } finally {
        CPSS.create = originalCPSSCreate;
      }
      assert.equal(await CommentPost.findOne({ where: { booking_id: 'rollback-tour-review-booking' } }), null);
      const tourAfterFailedReview = await ScheduleSample.findByPk('test-tour');
      assert.deepEqual({ rating: tourAfterFailedReview.rating, votes_count: tourAfterFailedReview.votes_count }, tourRatingBeforeFailedReview);

      await ServiceBooking.create({
        id: 'rollback-service-review-booking', user_id: 'test-user', service_id: 'test-service',
        fullname: 'Test customer', name_service: 'Nhà xanh', booking_date: '2026-12-04',
        guests: 1, value: 200000, payment_method: 'card', status: 'completed', evoucher_code: 'EV-SRV-ROLLBACK'
      });
      const serviceBeforeFailedReview = await GreenService.findByPk('test-service');
      const serviceRatingBeforeFailedReview = { rating: serviceBeforeFailedReview.rating, votes_count: serviceBeforeFailedReview.votes_count, reviews_count: serviceBeforeFailedReview.reviews_count };
      const originalCPGSCreate = CPGS.create;
      try {
        CPGS.create = async () => { throw new Error('injected CPGS write failure'); };
        await request('/reviews/service', { bookingId: 'rollback-service-review-booking', serviceId: 'test-service', rating: 1, text: 'rollback' }, login.token, 500);
      } finally {
        CPGS.create = originalCPGSCreate;
      }
      assert.equal(await CommentPost.findOne({ where: { booking_id: 'rollback-service-review-booking' } }), null);
      const serviceAfterFailedReview = await GreenService.findByPk('test-service');
      assert.deepEqual({ rating: serviceAfterFailedReview.rating, votes_count: serviceAfterFailedReview.votes_count, reviews_count: serviceAfterFailedReview.reviews_count }, serviceRatingBeforeFailedReview);

      const password_hash = await bcrypt.hash(password, 4);
      await User.create({ id: 'test-provider', username: 'mongo_provider', email: 'mongo-provider@example.com', password_hash, is_verified: true, role: 'provider', company_name: 'Green Provider' });
      await Vender.create({ id: 'test-vender', user_id: 'test-provider', registration_date: new Date() });
      await Provider.create({ id: 'test-provider-record', user_id: 'test-provider', name_provider: 'Green Provider', destination: 'Da Lat', provider_status: 'active' });
      await GreenService.update({ vender_id: 'test-vender' }, { where: { id: 'test-service' } });
      await ScheduleSample.update({ provider_id: 'test-provider-record' }, { where: { id: 'test-tour' } });
      const customerLogin = await request('/auth/login', { username: 'mongo_test', password });
      const providerLogin = await request('/auth/login', { username: 'mongo_provider', password });
      const providerReviews = await request('/reviews/provider?providerId=forged-provider', undefined, providerLogin.token);
      assert.equal(providerReviews.length, 4); // Includes the earlier aggregate-hook fixture review and concurrent-booking review.
      assert.deepEqual(new Set(providerReviews.map(review => review.type)), new Set(['tour', 'service']));
      assert.equal((await request('/reviews/provider?serviceId=someone-elses-service', undefined, providerLogin.token, 403)).success, false);
      await request(`/reviews/${tourReview.id}/reply`, { text: 'Tour reply' }, providerLogin.token, 201);
      await request(`/reviews/${serviceReview.id}/reply`, { text: 'Service reply' }, providerLogin.token, 201);
      const tourReviewsAfterReply = await request('/reviews/tour/test-tour');
      const serviceReviewsAfterReply = await request('/reviews/service/test-service');
      assert.equal(tourReviewsAfterReply.find(review => review.id === tourReview.id).replies[0].text, 'Tour reply');
      assert.equal(serviceReviewsAfterReply.find(review => review.id === serviceReview.id).replies[0].text, 'Service reply');
      const providerReviewsAfterReload = await request('/reviews/provider', undefined, providerLogin.token);
      assert.equal(providerReviewsAfterReload.find(review => review.id === tourReview.id).providerReply.text, 'Tour reply');
      assert.equal(providerReviewsAfterReload.find(review => review.id === serviceReview.id).providerReply.text, 'Service reply');

      const createdServiceBooking = await request('/bookings', {
        type: 'service', targetId: 'test-service', bookingDate: '2020-12-01', guests: 1, paymentMethod: 'counter'
      }, customerLogin.token);
      const lifecycleServiceBookingId = createdServiceBooking.bookingId;
      assert.ok(lifecycleServiceBookingId?.startsWith('BKS-'));
      await request(`/bookings/${lifecycleServiceBookingId}/approve`, {}, providerLogin.token);
      await request(`/bookings/${lifecycleServiceBookingId}/complete`, {}, providerLogin.token);
      assert.equal((await ServiceBooking.findByPk(lifecycleServiceBookingId)).status, 'completed');
      const serviceLifecycleResponse = await request('/reviews/service', {
        bookingId: lifecycleServiceBookingId, serviceId: 'test-service', rating: 5, text: 'Review sau service completed'
      }, customerLogin.token, 201);
      const serviceLifecycleReview = await CommentPost.findOne({ where: { booking_id: lifecycleServiceBookingId } });
      assert.equal(serviceLifecycleReview.user_id, 'test-user');
      assert.equal((await CPGS.findOne({ where: { comment_id: serviceLifecycleReview.id } })).service_id, 'test-service');
      assert.equal(serviceLifecycleResponse.reviews_count, 3);
      const providerServiceReviews = await request('/reviews/provider?serviceId=test-service', undefined, providerLogin.token);
      assert.ok(providerServiceReviews.some(review => review.id === serviceLifecycleReview.id));
      await request(`/reviews/${serviceLifecycleReview.id}/reply`, { text: 'Phản hồi cho service vừa hoàn thành' }, providerLogin.token, 201);
      const customerReloadedServiceReviews = await request('/reviews/service/test-service');
      assert.equal(customerReloadedServiceReviews.find(review => review.id === serviceLifecycleReview.id).replies[0].text, 'Phản hồi cho service vừa hoàn thành');

      await Schedule.create({ id: 'other-tour', tour_name: 'Other tour', destination: 'Da Nang', days: 1 });
      await ScheduleSample.create({ id: 'other-tour', cost: 150000, provider_id: 'other-provider-record' });
      await Provider.create({ id: 'other-provider-record', user_id: 'other-provider', name_provider: 'Other Provider', destination: 'Da Nang', provider_status: 'active' });
      const createdTourBooking = await request('/bookings', {
        type: 'tour', targetId: 'test-tour', bookingDate: '2999-12-01', guests: 1, paymentMethod: 'counter'
      }, customerLogin.token);
      const lifecycleBookingId = createdTourBooking.bookingId;
      assert.ok(lifecycleBookingId?.startsWith('BKT-'));
      await TourBooking.create({
        id: 'foreign-provider-tour-booking', user_id: 'test-user', schedule_id: 'other-tour',
        fullname: 'Test customer', tour_name: 'Other tour', booking_date: '2020-12-01',
        guests: 1, value: 150000, payment_method: 'card', status: 'deposit', booking_status: 'accepted',
        payment_status: 'deposit_paid', evoucher_code: 'EV-FOREIGN-TOUR'
      });
      const providerBookings = await request('/bookings?providerId=test-provider', undefined, providerLogin.token);
      assert.ok(providerBookings.some(booking => booking.id === 'service-review-booking' && booking.type === 'service'));
      assert.ok(providerBookings.some(booking => booking.id === lifecycleBookingId && booking.type === 'tour'));
      assert.equal(providerBookings.some(booking => booking.id === 'foreign-provider-tour-booking'), false);
      assert.equal((await request(`/bookings/${lifecycleBookingId}`, undefined, providerLogin.token)).booking.id, lifecycleBookingId);
      await request('/bookings/foreign-provider-tour-booking', undefined, providerLogin.token, 403);
      await request(`/reviews/provider?tourId=other-tour`, undefined, providerLogin.token, 403);
      await request(`/bookings/${lifecycleBookingId}/approve`, {}, providerLogin.token);
      await request(`/bookings/${lifecycleBookingId}/complete`, {}, providerLogin.token, 409);
      assert.equal((await TourBooking.findByPk(lifecycleBookingId)).status, 'deposit');
      await TourBooking.update({ booking_date: '2020-12-01' }, { where: { id: lifecycleBookingId } });
      await request(`/bookings/${lifecycleBookingId}/complete`, {}, providerLogin.token);
      assert.equal((await TourBooking.findByPk(lifecycleBookingId)).operation_status, 'completed');
      const lifecycleReviewResponse = await request('/reviews/tour', {
        bookingId: lifecycleBookingId, tourId: 'test-tour', rating: 5, text: 'Review sau tour completed'
      }, customerLogin.token, 201);
      const lifecycleReview = await CommentPost.findOne({ where: { booking_id: lifecycleBookingId } });
      assert.equal(lifecycleReview.user_id, 'test-user');
      assert.equal((await CPSS.findOne({ where: { comment_id: lifecycleReview.id } })).schedule_sample_id, 'test-tour');
      assert.equal(lifecycleReviewResponse.reviews_count, 3);
      const providerLifecycleReviews = await request('/reviews/provider?tourId=test-tour', undefined, providerLogin.token);
      assert.ok(providerLifecycleReviews.some(review => review.id === lifecycleReview.id));
      await request(`/reviews/${lifecycleReview.id}/reply`, { text: 'Phản hồi cho booking vừa hoàn thành' }, providerLogin.token, 201);
      const customerReloadedTourReviews = await request('/reviews/tour/test-tour');
      assert.equal(customerReloadedTourReviews.find(review => review.id === lifecycleReview.id).replies[0].text, 'Phản hồi cho booking vừa hoàn thành');
      await request('/bookings/foreign-provider-tour-booking/complete', {}, providerLogin.token, 403);
      await TourBooking.update({ status: 'completed' }, { where: { id: 'foreign-provider-tour-booking' } });
      const foreignReviewResponse = await request('/reviews/tour', {
        bookingId: 'foreign-provider-tour-booking', tourId: 'other-tour', rating: 4, text: 'Đánh giá tour provider khác'
      }, customerLogin.token, 201);
      const foreignTourReview = await CommentPost.findOne({ where: { booking_id: 'foreign-provider-tour-booking' } });
      assert.ok(foreignReviewResponse.success);
      await request(`/reviews/${foreignTourReview.id}/reply`, { text: 'Không có quyền trả lời' }, providerLogin.token, 403);
      assert.equal(await CommentPost.count({ where: { parent_comment_id: foreignTourReview.id } }), 0);
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
