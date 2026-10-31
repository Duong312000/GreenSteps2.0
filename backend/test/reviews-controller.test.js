const { test } = require('node:test');
const assert = require('node:assert/strict');
const { store, User, Vender, Provider, TourBooking, ServiceBooking, Schedule, ScheduleSample, GreenService, CommentPost, CPSS, CPGS } = require('../src/models');
const tourController = require('../src/controllers/tour.controller');
const serviceController = require('../src/controllers/service.controller');
const reviewsController = require('../src/controllers/reviews.controller');
const partnerController = require('../src/controllers/partner.controller');

function replace(target, key, value, restore) {
  restore.push([target, key, target[key]]);
  target[key] = value;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function withPatched(entries, run) {
  const restore = [];
  for (const [target, key, value] of entries) replace(target, key, value, restore);
  try {
    await run();
  } finally {
    for (const [target, key, value] of restore.reverse()) target[key] = value;
  }
}

function transactionStub() {
  return async callback => callback({});
}

async function invoke(handler, req) {
  const res = response();
  await handler(req, res, error => {
    res.status(error.statusCode || error.status || 500).json({ success: false, message: error.message });
  });
  return res;
}

test('tour review author comes from the authenticated account, not request body userId', async () => {
  const created = [];
  const timestamp = new Date('2026-10-31T00:00:00.000Z');
  await withPatched([
    [store, 'transaction', transactionStub()],
    [TourBooking, 'findByPk', async id => ({ id, user_id: 'customer-1', schedule_id: 'tour-1', status: 'completed' })],
    [ServiceBooking, 'findByPk', async () => null],
    [ScheduleSample, 'findByPk', async id => ({ id, rating: 5, votes_count: 1 })],
    [CommentPost, 'findOne', async () => null],
    [CommentPost, 'create', async values => {
    const row = { id: 'review-1', createdAt: timestamp, ...values };
    created.push(row);
    return row;
    }],
    [CPSS, 'create', async values => values],
    [User, 'findByPk', async id => ({ id, fullname: 'Khách A', role: 'traveler' })]
  ], async () => {
    const res = await invoke(tourController.postTourReview, {
      user: { id: 'customer-1', role: 'traveler' },
      body: { userId: 'customer-2', bookingId: 'booking-1', tourId: 'tour-1', rating: 5, text: 'Tốt' }
    });

    assert.equal(res.statusCode, 201);
    assert.equal(created.length, 1);
    assert.equal(created[0].user_id, 'customer-1');
    assert.equal(created[0].booking_id, 'booking-1');
  });
});

test('service review rejects ratings outside integer range 1 through 5', async () => {
  let writes = 0;
  await withPatched([
    [store, 'transaction', transactionStub()],
    [ServiceBooking, 'findByPk', async id => ({ id, user_id: 'customer-1', service_id: 'service-1', status: 'completed' })],
    [TourBooking, 'findByPk', async () => null],
    [GreenService, 'findByPk', async id => ({ id, rating: 4, bookings_count: 20 })],
    [CommentPost, 'findOne', async () => null],
    [CommentPost, 'create', async values => { writes++; return values; }],
    [CPGS, 'create', async values => values]
  ], async () => {
    const res = await invoke(serviceController.postServiceReview, {
      user: { id: 'customer-1', role: 'traveler' },
      body: { userId: 'customer-1', bookingId: 'booking-1', serviceId: 'service-1', rating: 6, text: 'Tốt' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(writes, 0);
  });
});

test('tour review rejects a completed booking owned by another customer', async () => {
  let writes = 0;
  await withPatched([
    [store, 'transaction', transactionStub()],
    [TourBooking, 'findByPk', async id => ({ id, user_id: 'customer-2', schedule_id: 'tour-1', status: 'completed' })],
    [ServiceBooking, 'findByPk', async () => null],
    [ScheduleSample, 'findByPk', async id => ({ id, rating: 5, votes_count: 1 })],
    [CommentPost, 'findOne', async () => null],
    [CommentPost, 'create', async values => { writes++; return values; }],
    [CPSS, 'create', async values => values]
  ], async () => {
    const res = await invoke(tourController.postTourReview, {
      user: { id: 'customer-1', role: 'traveler' },
      body: { userId: 'customer-1', bookingId: 'booking-1', tourId: 'tour-1', rating: 5, text: 'Tốt' }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(writes, 0);
  });
});

test('service review requires a completed booking for the exact service', async () => {
  let writes = 0;
  await withPatched([
    [store, 'transaction', transactionStub()],
    [ServiceBooking, 'findByPk', async id => ({ id, user_id: 'customer-1', service_id: 'service-1', status: 'completed' })],
    [TourBooking, 'findByPk', async () => null],
    [GreenService, 'findByPk', async id => ({ id, rating: 5, reviews_count: 1, bookings_count: 3 })],
    [CommentPost, 'findOne', async () => null],
    [CommentPost, 'create', async values => { writes++; return { id: 'review-2', ...values }; }],
    [CPGS, 'create', async values => values]
  ], async () => {
    const res = await invoke(serviceController.postServiceReview, {
      user: { id: 'customer-1', role: 'traveler' },
      body: { bookingId: 'booking-1', serviceId: 'service-other', rating: 5, text: 'Tốt' }
    });
    assert.equal(res.statusCode, 400);
    assert.equal(writes, 0);
  });
});

test('service review rejects a booking that is not completed', async () => {
  let writes = 0;
  await withPatched([
    [store, 'transaction', transactionStub()],
    [ServiceBooking, 'findByPk', async id => ({ id, user_id: 'customer-1', service_id: 'service-1', status: 'deposit' })],
    [TourBooking, 'findByPk', async () => null],
    [GreenService, 'findByPk', async id => ({ id, rating: null, reviews_count: 0, bookings_count: 3 })],
    [CommentPost, 'findOne', async () => null],
    [CommentPost, 'create', async values => { writes++; return values; }],
    [CPGS, 'create', async values => values]
  ], async () => {
    const res = await invoke(serviceController.postServiceReview, {
      user: { id: 'customer-1', role: 'traveler' },
      body: { bookingId: 'booking-1', serviceId: 'service-1', rating: 4, text: 'Tốt' }
    });
    assert.equal(res.statusCode, 400);
    assert.equal(writes, 0);
  });
});

test('service review rejects a booking already reviewed', async () => {
  let writes = 0;
  await withPatched([
    [store, 'transaction', transactionStub()],
    [ServiceBooking, 'findByPk', async id => ({ id, user_id: 'customer-1', service_id: 'service-1', status: 'completed' })],
    [TourBooking, 'findByPk', async () => null],
    [GreenService, 'findByPk', async id => ({ id, rating: 5, reviews_count: 1, bookings_count: 3 })],
    [CommentPost, 'findOne', async () => ({ id: 'existing-review', booking_id: 'booking-1' })],
    [CommentPost, 'create', async values => { writes++; return values; }],
    [CPGS, 'create', async values => values]
  ], async () => {
    const res = await invoke(serviceController.postServiceReview, {
      user: { id: 'customer-1', role: 'traveler' },
      body: { bookingId: 'booking-1', serviceId: 'service-1', rating: 4, text: 'Tốt' }
    });
    assert.equal(res.statusCode, 409);
    assert.equal(writes, 0);
  });
});

test('provider review list derives vendor ownership from authenticated user, not query providerId', async () => {
  let queriedUserId;
  await withPatched([
    [Vender, 'findOne', async ({ where }) => { queriedUserId = where.user_id; return null; }],
    [GreenService, 'findAll', async () => []],
    [Provider, 'findOne', async () => null],
    [ScheduleSample, 'findAll', async () => []],
    [CPGS, 'findAll', async () => []],
    [CPSS, 'findAll', async () => []],
    [CommentPost, 'findAll', async () => []],
    [User, 'findByPk', async id => ({ id, company_name: null })]
  ], async () => {
    const res = await invoke(reviewsController.getProviderReviews, {
      user: { id: 'provider-a', role: 'provider' },
      query: { providerId: 'provider-b' }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(queriedUserId, 'provider-a');
  });
});

test('provider review list returns owned tour reviews as well as service reviews', async () => {
  const review = { id: 'tour-review', user_id: 'customer-1', tour_id: 'tour-1', booking_id: 'tour-booking', rating: 5, text: 'Tốt', createdAt: new Date('2026-10-31T00:00:00Z'), parent_comment_id: null };
  await withPatched([
    [Vender, 'findOne', async () => null],
    [GreenService, 'findAll', async () => []],
    [Provider, 'findOne', async ({ where }) => where.user_id === 'provider-a' ? { id: 'provider-record-a', user_id: 'provider-a' } : null],
    [ScheduleSample, 'findAll', async ({ where }) => where.provider_id === 'provider-record-a' ? [{ id: 'tour-1', provider_id: 'provider-record-a' }] : []],
    [ScheduleSample, 'findByPk', async id => id === 'tour-1' ? { id, provider_id: 'provider-record-a' } : null],
    [Schedule, 'findByPk', async id => ({ id, tour_name: 'Owned tour' })],
    [CPGS, 'findAll', async () => []],
    [CPSS, 'findAll', async ({ where }) => where.schedule_sample_id === 'tour-1' ? [{ comment_id: review.id, schedule_sample_id: 'tour-1' }] : []],
    [CommentPost, 'findAll', async ({ where }) => Reflect.ownKeys(where).some(key => typeof key === 'symbol') ? [review] : []],
    [CommentPost, 'findOne', async () => null],
    [User, 'findByPk', async id => ({ id, fullname: 'Khách A', role: 'traveler' })],
    [TourBooking, 'findByPk', async id => ({ id, booking_date: '2026-10-20', guests: 2 })]
  ], async () => {
    const res = await invoke(reviewsController.getProviderReviews, {
      user: { id: 'provider-a', role: 'provider' },
      query: {}
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].type, 'tour');
    assert.equal(res.body[0].tour.id, 'tour-1');
  });
});

test('a traveler cannot list provider reviews', async () => {
  const res = await invoke(reviewsController.getProviderReviews, {
    user: { id: 'customer-1', role: 'traveler' },
    query: { providerId: 'provider-a' }
  });
  assert.equal(res.statusCode, 403);
});

test('provider cannot reply to a review for another provider service', async () => {
  let writes = 0;
  await withPatched([
    [CommentPost, 'findByPk', async id => ({ id, user_id: 'customer-1', service_id: 'service-b', parent_comment_id: null })],
    [CommentPost, 'findOne', async () => null],
    [CommentPost, 'findAll', async () => []],
    [CommentPost, 'create', async values => { writes++; return values; }],
    [Vender, 'findOne', async ({ where }) => where.user_id === 'provider-a' ? { id: 'vender-a', user_id: 'provider-a' } : null],
    [Vender, 'findByPk', async id => ({ id, user_id: id === 'vender-a' ? 'provider-a' : 'provider-b' })],
    [GreenService, 'findByPk', async () => ({ id: 'service-b', vender_id: 'vender-b' })],
    [CPSS, 'findAll', async () => []],
    [User, 'findByPk', async id => ({ id, role: 'provider', fullname: 'Provider A' })]
  ], async () => {
    const res = await invoke(reviewsController.replyToReview, {
      user: { id: 'provider-a', role: 'provider' },
      params: { commentId: 'review-b' },
      body: { text: 'Phản hồi' }
    });
    assert.equal(res.statusCode, 403, JSON.stringify(res.body));
    assert.equal(writes, 0);
  });
});

test('provider reply is saved as a child review for its owned service', async () => {
  let saved;
  await withPatched([
    [CommentPost, 'findByPk', async id => ({ id, user_id: 'customer-1', service_id: 'service-a', parent_comment_id: null })],
    [CommentPost, 'findAll', async () => []],
    [CommentPost, 'create', async values => { saved = values; return { id: values.id, createdAt: new Date(0), ...values }; }],
    [Vender, 'findByPk', async id => ({ id, user_id: 'provider-a' })],
    [GreenService, 'findByPk', async () => ({ id: 'service-a', vender_id: 'vender-a' })],
    [CPSS, 'findAll', async () => []],
    [User, 'findByPk', async id => ({ id, role: 'provider', fullname: 'Provider A' })]
  ], async () => {
    const res = await invoke(reviewsController.replyToReview, {
      user: { id: 'provider-a', role: 'provider' },
      params: { commentId: 'review-a' },
      body: { text: 'Cảm ơn bạn' }
    });
    assert.equal(res.statusCode, 201);
    assert.equal(saved.parent_comment_id, 'review-a');
    assert.equal(saved.service_id, 'service-a');
    assert.equal(saved.user_id, 'provider-a');
    assert.equal(res.body.reply.text, 'Cảm ơn bạn');
  });
});

test('customer can still reply to a public review without becoming its author', async () => {
  let saved;
  await withPatched([
    [CommentPost, 'findByPk', async id => ({ id, user_id: 'customer-2', service_id: 'service-a', parent_comment_id: null })],
    [CommentPost, 'create', async values => { saved = values; return { id: values.id, ...values }; }],
    [GreenService, 'findByPk', async id => ({ id })],
    [CPSS, 'findAll', async () => []],
    [User, 'findByPk', async id => ({ id, role: 'traveler', fullname: 'Customer A' })]
  ], async () => {
    const res = await invoke(reviewsController.replyToReview, {
      user: { id: 'customer-1', role: 'traveler' },
      params: { commentId: 'review-a' },
      body: { userId: 'customer-2', text: 'Thanks for sharing' }
    });
    assert.equal(res.statusCode, 201);
    assert.equal(saved.user_id, 'customer-1');
    assert.equal(saved.parent_comment_id, 'review-a');
  });
});

test('provider cannot bypass ownership checks through the tour comment reply route', async () => {
  let writes = 0;
  await withPatched([
    [CommentPost, 'findByPk', async () => ({ id: 'review-a', user_id: 'customer-a', tour_id: 'tour-a', parent_comment_id: null })],
    [CommentPost, 'create', async () => { writes++; return {}; }]
  ], async () => {
    const res = await invoke(tourController.postTourReview, {
      user: { id: 'provider-b', role: 'provider' },
      body: { parentCommentId: 'review-a', tourId: 'tour-a', text: 'Unauthorized' }
    });
    assert.equal(res.statusCode, 403);
    assert.equal(writes, 0);
  });
});

test('admin approval links a unique unlinked legacy provider profile to its account', async () => {
  const legacyProvider = { id: 'legacy-provider', user_id: null, save: async () => {} };
  const transaction = { commit: async () => {}, rollback: async () => {} };
  await withPatched([
    [store, 'transaction', async () => transaction],
    [User, 'findByPk', async id => ({ id, fullname: 'Provider A', company_name: 'Company A', save: async () => {} })],
    [Provider, 'findOne', async () => null],
    [Provider, 'findAll', async () => [legacyProvider]]
  ], async () => {
    const res = await invoke(partnerController.approveProvider, { body: { targetUserId: 'provider-a' } });
    assert.equal(res.statusCode, 200);
    assert.equal(legacyProvider.user_id, 'provider-a');
    assert.equal(legacyProvider.provider_status, 'active');
  });
});
