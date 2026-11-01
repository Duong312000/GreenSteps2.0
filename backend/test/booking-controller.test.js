const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WalletTransaction } = require('../src/models');
const { expireBookingIfNeeded } = require('../src/controllers/booking.controller');

test('expired pending bookings are marked expired and pending ledger rows fail', async () => {
  const originalUpdate = WalletTransaction.update;
  const updates = [];
  WalletTransaction.update = async (...args) => { updates.push(args); };
  try {
    const booking = {
      status: 'pending',
      booking_status: 'new',
      payment_status: 'pending',
      escrow_status: 'none',
      payment_deadline: new Date(Date.now() - 1000),
      id: 'expired-test',
      async save() { this.saved = true; }
    };

    assert.equal(await expireBookingIfNeeded(booking), booking);
    assert.equal(booking.status, 'rejected');
    assert.equal(booking.booking_status, 'rejected');
    assert.equal(booking.payment_status, 'expired');
    assert.equal(booking.saved, true);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0][0], { status: 'failed' });
  } finally {
    WalletTransaction.update = originalUpdate;
  }
});

test('expiry checks leave paid, non-pending and unexpired bookings unchanged', async () => {
  const booking = {
    status: 'pending',
    payment_status: 'pending',
    payment_deadline: new Date(Date.now() + 60_000),
    async save() { throw new Error('must not save'); }
  };
  assert.equal(await expireBookingIfNeeded(booking), booking);
  assert.equal(booking.payment_status, 'pending');
  assert.equal(await expireBookingIfNeeded({ ...booking, status: 'deposit' }).then(row => row.status), 'deposit');
  assert.equal(await expireBookingIfNeeded({ ...booking, payment_deadline: null }).then(row => row.status), 'pending');
});
