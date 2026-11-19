const { test } = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const controller = require('../src/controllers/sepay-payment.controller');

test('SePay IPN stores the exact confirmed amount on the booking', async () => {
  const original = {
    attemptFindOne: models.SepayPaymentAttempt.findOne,
    attemptFindByPk: models.SepayPaymentAttempt.findByPk,
    attemptSave: null,
    serviceFindByPk: models.ServiceBooking.findByPk,
    tourFindByPk: models.TourBooking.findByPk,
    transaction: models.store.transaction,
    notificationCreate: models.Notification.create,
    secret: process.env.SEPAY_IPN_SECRET
  };
  const attempt = {
    id: 'attempt-1', booking_id: 'booking-1', order_invoice_number: 'invoice-1', amount: 200,
    status: 'pending', async save() {}
  };
  const booking = {
    id: 'booking-1', user_id: null, payment_method: 'sepay', status: 'pending', payment_status: 'pending',
    async save() { this.saved = true; }
  };
  let response;

  process.env.SEPAY_IPN_SECRET = 'test-secret';
  models.SepayPaymentAttempt.findOne = async options => options.where.order_invoice_number
    ? attempt
    : options.where.transaction_id ? null : attempt;
  models.SepayPaymentAttempt.findByPk = async () => attempt;
  models.ServiceBooking.findByPk = async () => booking;
  models.TourBooking.findByPk = async () => null;
  models.store.transaction = async callback => callback({});
  models.Notification.create = async () => {};

  try {
    await controller.ipn({
      body: {
        notification_type: 'ORDER_PAID',
        order: { order_invoice_number: 'invoice-1', order_amount: '200', order_currency: 'VND', order_status: 'CAPTURED' },
        transaction: { transaction_id: 'txn-1', transaction_amount: '200', transaction_currency: 'VND', transaction_status: 'APPROVED' }
      },
      get: () => 'test-secret'
    }, {
      status() { return this; },
      json(value) { response = value; return this; }
    }, error => { throw error; });

    assert.deepEqual(response, { success: true, settled: true });
    assert.equal(booking.payment_amount, 200);
    assert.equal(booking.payment_status, 'deposit_paid');
    assert.equal(booking.status, 'deposit');
    assert.equal(booking.saved, true);
  } finally {
    models.SepayPaymentAttempt.findOne = original.attemptFindOne;
    models.SepayPaymentAttempt.findByPk = original.attemptFindByPk;
    models.ServiceBooking.findByPk = original.serviceFindByPk;
    models.TourBooking.findByPk = original.tourFindByPk;
    models.store.transaction = original.transaction;
    models.Notification.create = original.notificationCreate;
    if (original.secret === undefined) delete process.env.SEPAY_IPN_SECRET;
    else process.env.SEPAY_IPN_SECRET = original.secret;
  }
});
