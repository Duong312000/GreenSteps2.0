const { test } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../src/services/catalog-presentation.service');
const models = require('../src/models');
const bookingController = require('../src/controllers/booking.controller');

test('unbookable editorial, demo, and unverified tours cannot be quoted or booked', () => {
  assert.equal(typeof catalog.assertTourBookable, 'function');
  for (const catalog_status of ['demo', 'editorial', 'draft', 'paused', 'verified']) {
    assert.throws(
      () => catalog.assertTourBookable({ id: 'demo-tour', catalog_status }),
      error => error.statusCode === 409 && error.code === 'TOUR_NOT_BOOKABLE'
    );
  }
  assert.throws(() => catalog.assertTourBookable({ id: 'personal', catalog_status: 'personal' }), error => error.code === 'TOUR_NOT_BOOKABLE');
});

test('legacy tours retain compatibility and only explicitly bookable tours pass the status gate', () => {
  assert.equal(typeof catalog.assertTourBookable, 'function');
  assert.doesNotThrow(() => catalog.assertTourBookable({ id: 'existing-tour' }));
  assert.doesNotThrow(() => catalog.assertTourBookable({ id: 'verified-tour', catalog_status: 'bookable' }));
  assert.doesNotThrow(() => catalog.assertTourBookable({ id: 'personal', catalog_status: 'personal' }, { allowPersonal: true }));
});

test('new schedules default to editorial while preparing legacy records does not backfill a status', () => {
  assert.equal(models.Schedule.prepare({ id: 'new-tour' }, true).catalog_status, 'editorial');
  assert.equal(models.Schedule.prepare({ id: 'legacy-tour' }, false).catalog_status, undefined);
});

test('tour quotes reject demo records before reading prices', async () => {
  const original = models.Schedule.findByPk;
  models.Schedule.findByPk = async () => ({ id: 'demo-tour', catalog_status: 'demo' });
  try {
    await assert.rejects(
      require('../src/services/booking-pricing.service').calculatePricing({ type: 'tour', targetId: 'demo-tour', guestCount: 1 }),
      error => error.statusCode === 409 && error.code === 'TOUR_NOT_BOOKABLE'
    );
  } finally {
    models.Schedule.findByPk = original;
  }
});

test('booking quote API forwards the non-bookable status for a demo tour', async () => {
  const original = models.Schedule.findByPk;
  models.Schedule.findByPk = async () => ({ id: 'demo-tour', catalog_status: 'demo' });
  let nextError;
  try {
    await bookingController.quoteBooking({ body: { type: 'tour', targetId: 'demo-tour', guests: 1 } }, {}, error => { nextError = error; });
    assert.equal(nextError?.code, 'TOUR_NOT_BOOKABLE');
    assert.equal(nextError?.statusCode, 409);
  } finally {
    models.Schedule.findByPk = original;
  }
});

test('booking creation rejects a demo tour before any guest/account or payment side effect', async () => {
  const original = models.Schedule.findByPk;
  models.Schedule.findByPk = async () => ({ id: 'demo-tour', catalog_status: 'editorial' });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextError;
  try {
    await bookingController.createBooking({ body: { type: 'tour', targetId: 'demo-tour', guests: 2, paymentMethod: 'bank_transfer' } }, res, error => { nextError = error; });
    assert.equal(nextError?.code, 'TOUR_NOT_BOOKABLE');
    assert.equal(nextError?.statusCode, 409);
  } finally {
    models.Schedule.findByPk = original;
  }
});

test('an editorial demo cannot bypass the booking gate through the itinerary type', async () => {
  const originals = {
    schedule: models.Schedule.findByPk,
    sampleByPk: models.ScheduleSample.findByPk,
    customByPk: models.ScheduleCustom.findByPk,
    sample: models.ScheduleSample.findOne
  };
  const sentinel = new Error('legacy itinerary lookup reached');
  models.Schedule.findByPk = async () => ({ id: 'demo-tour', catalog_status: 'demo' });
  models.ScheduleSample.findByPk = async () => ({ id: 'demo-tour' });
  models.ScheduleCustom.findByPk = async () => null;
  models.ScheduleSample.findOne = async () => { throw sentinel; };
  let nextError;
  try {
    await bookingController.createBooking({ body: { type: 'itinerary', targetId: 'demo-tour', guests: 2, paymentMethod: 'bank_transfer' } }, {}, error => { nextError = error; });
    assert.equal(nextError?.code, 'TOUR_NOT_BOOKABLE');
  } finally {
    models.Schedule.findByPk = originals.schedule;
    models.ScheduleSample.findByPk = originals.sampleByPk;
    models.ScheduleCustom.findByPk = originals.customByPk;
    models.ScheduleSample.findOne = originals.sample;
  }
});

test('personal custom itinerary records keep their existing checkout flow', async () => {
  const originals = {
    schedule: models.Schedule.findByPk,
    sampleByPk: models.ScheduleSample.findByPk,
    customByPk: models.ScheduleCustom.findByPk,
    sample: models.ScheduleSample.findOne
  };
  const sentinel = new Error('custom itinerary processing reached');
  models.Schedule.findByPk = async () => ({ id: 'iti_personal', catalog_status: 'personal' });
  models.ScheduleSample.findByPk = async () => null;
  models.ScheduleCustom.findByPk = async () => ({ id: 'iti_personal' });
  models.ScheduleSample.findOne = async () => { throw sentinel; };
  let nextError;
  try {
    await bookingController.createBooking({ body: { type: 'itinerary', targetId: 'iti_personal', guests: 1, paymentMethod: 'bank_transfer' } }, {}, error => { nextError = error; });
    assert.equal(nextError, sentinel);
  } finally {
    models.Schedule.findByPk = originals.schedule;
    models.ScheduleSample.findByPk = originals.sampleByPk;
    models.ScheduleCustom.findByPk = originals.customByPk;
    models.ScheduleSample.findOne = originals.sample;
  }
});

test('sandbox payment simulation rejects a demo tour before changing its booking', async () => {
  const originals = {
    serviceBooking: models.ServiceBooking.findByPk,
    tourBooking: models.TourBooking.findByPk,
    schedule: models.Schedule.findByPk,
    scheduleCustom: models.ScheduleCustom.findByPk,
    scheduleSample: models.ScheduleSample.findByPk
  };
  const booking = { id: 'booking-2', schedule_id: 'demo-tour', payment_method: 'bank_transfer', status: 'pending' };
  models.ServiceBooking.findByPk = async () => null;
  models.TourBooking.findByPk = async () => booking;
  models.Schedule.findByPk = async () => ({ id: 'demo-tour', catalog_status: 'demo' });
  models.ScheduleCustom.findByPk = async () => null;
  models.ScheduleSample.findByPk = async () => ({ id: 'demo-tour' });
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  let nextError;
  try {
    await bookingController.simulateBookingPayment({
      socket: { remoteAddress: '127.0.0.1' }, params: { id: booking.id }
    }, { status() { return this; }, json() { return this; } }, error => { nextError = error; });
    assert.equal(nextError?.code, 'TOUR_NOT_BOOKABLE');
    assert.equal(booking.status, 'pending');
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    models.ServiceBooking.findByPk = originals.serviceBooking;
    models.TourBooking.findByPk = originals.tourBooking;
    models.Schedule.findByPk = originals.schedule;
    models.ScheduleCustom.findByPk = originals.scheduleCustom;
    models.ScheduleSample.findByPk = originals.scheduleSample;
  }
});
