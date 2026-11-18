const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ScheduleCustom, User } = require('../src/models');
const tourController = require('../src/controllers/tour.controller');
const notificationController = require('../src/controllers/notification.controller');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('legacy itinerary save cannot overwrite another account by sending user_id', async () => {
  const res = response();
  await withPatched(ScheduleCustom, 'findByPk', async () => ({ id: 'existing-itinerary', user_id: 'victim' }), async () => {
    await tourController.saveCustomItinerary({ user: { id: 'attacker' }, body: { id: 'existing-itinerary', user_id: 'victim', name: 'overwrite' } }, res, error => { throw error; });
  });
  assert.equal(res.statusCode, 403);
});

test('itinerary list and delete reject a different account ID', async () => {
  const listRes = response();
  await tourController.getUserCustomItineraries({ user: { id: 'account-a' }, params: { userId: 'account-b' } }, listRes, error => { throw error; });
  assert.equal(listRes.statusCode, 403);

  const deleteRes = response();
  await withPatched(ScheduleCustom, 'findByPk', async () => ({ id: 'private-trip', user_id: 'account-b' }), async () => {
    await tourController.deleteCustomItinerary({ user: { id: 'account-a' }, params: { id: 'private-trip' } }, deleteRes, error => { throw error; });
  });
  assert.equal(deleteRes.statusCode, 403);
});

test('collaboration invitation requires the itinerary owner and joining users must be invited', async () => {
  const inviteRes = response();
  await withPatched(ScheduleCustom, 'findByPk', async () => ({ id: 'private-trip', user_id: 'account-b', Schedule: { id: 'private-trip' } }), async () => {
    await tourController.inviteCollaborator({ user: { id: 'account-a' }, params: { id: 'private-trip' }, body: { emails: ['friend@example.com'] } }, inviteRes, error => { throw error; });
  });
  assert.equal(inviteRes.statusCode, 403);

  const joinRes = response();
  await withPatched(ScheduleCustom, 'findByPk', async () => ({ id: 'private-trip', user_id: 'account-b', companion_email: 'invited@example.com', Schedule: { id: 'private-trip' } }), async () =>
    withPatched(User, 'findByPk', async () => ({ id: 'account-a', email: 'attacker@example.com' }), async () => {
      await tourController.joinItinerary({ user: { id: 'account-a' }, params: { id: 'private-trip' }, body: { userId: 'account-b' } }, joinRes, error => { throw error; });
    })
  );
  assert.equal(joinRes.statusCode, 403);
});

test('notification endpoints reject cross-account path IDs before reading data', async () => {
  const res = response();
  await notificationController.getNotifications({ user: { id: 'account-a' }, params: { userId: 'account-b' } }, res, error => { throw error; });
  assert.equal(res.statusCode, 403);
  const clearRes = response();
  await notificationController.clearNotifications({ user: { id: 'account-a' }, params: { userId: 'account-b' } }, clearRes, error => { throw error; });
  assert.equal(clearRes.statusCode, 403);
});
