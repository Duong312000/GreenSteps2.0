const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OperationsAssignment, ServiceBooking, TourBooking, Provider, ScheduleSample } = require('../src/models');
const operationsController = require('../src/controllers/operations.controller');

function response() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

async function withPatched(entries, run) {
  const originals = entries.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, value] of entries) target[key] = value;
  try { await run(); }
  finally { for (const [target, key, value] of originals.reverse()) target[key] = value; }
}

async function invoke(req) {
  const res = response();
  await operationsController.updateAssignmentStatus(req, res, error => res.status(error.statusCode || 500).json({ message: error.message }));
  return res;
}

test('provider cannot update an operations assignment for another provider tour', async () => {
  let writes = 0;
  await withPatched([
    [OperationsAssignment, 'findOne', async () => null],
    [OperationsAssignment, 'create', async values => { writes++; return values; }],
    [ServiceBooking, 'findByPk', async () => null],
    [TourBooking, 'findByPk', async () => ({ id: 'tour-booking-b', schedule_id: 'tour-b' })],
    [Provider, 'findOne', async () => ({ id: 'provider-record-a' })],
    [ScheduleSample, 'findByPk', async () => ({ id: 'tour-b', provider_id: 'provider-record-b' })]
  ], async () => {
    const res = await invoke({ user: { id: 'provider-a', role: 'provider' }, params: { bookingId: 'tour-booking-b' }, body: { status: 'ongoing' } });
    assert.equal(res.statusCode, 403);
    assert.equal(writes, 0);
  });
});

test('operations status cannot complete a tour before its use date', async () => {
  let writes = 0;
  const booking = { id: 'tour-booking-a', schedule_id: 'tour-a', booking_date: '2999-12-31', status: 'deposit', booking_status: 'accepted', payment_status: 'deposit_paid', operation_status: 'ongoing', async save() { writes++; } };
  await withPatched([
    [OperationsAssignment, 'findOne', async () => null],
    [OperationsAssignment, 'create', async values => { writes++; return values; }],
    [ServiceBooking, 'findByPk', async () => null],
    [TourBooking, 'findByPk', async () => booking],
    [Provider, 'findOne', async () => ({ id: 'provider-record-a' })],
    [ScheduleSample, 'findByPk', async () => ({ id: 'tour-a', provider_id: 'provider-record-a' })]
  ], async () => {
    const res = await invoke({ user: { id: 'provider-a', role: 'provider' }, params: { bookingId: booking.id }, body: { status: 'completed' } });
    assert.equal(res.statusCode, 409);
    assert.equal(writes, 0);
    assert.equal(booking.operation_status, 'ongoing');
  });
});
