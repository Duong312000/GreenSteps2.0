const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendBookingConfirmationEmail } = require('../src/services/email.service');

test('booking confirmation email is suppressed in test environments', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const sent = await sendBookingConfirmationEmail({
      to: 'customer@example.invalid', bookingId: 'test-booking', tourName: 'Test tour',
      bookingDate: '2026-11-12', guests: 1, depositAmount: 0, paymentMethod: 'test',
      lookupUrl: 'http://localhost/test'
    });
    assert.equal(sent, false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
