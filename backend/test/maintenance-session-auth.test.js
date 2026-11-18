const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { AuthSession, User } = require('../src/models');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
const { isAdminAllowed } = require('../src/middlewares/maintenance');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('maintenance admin bypass rejects revoked session tokens', async () => {
  const token = jwt.sign({ id: 'admin-1', sid: 'session-1', role: 'admin' }, JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  await withPatched(AuthSession, 'findByPk', async () => ({ id: 'session-1', user_id: 'admin-1', expires_at: new Date(Date.now() + 60_000), revoked_at: new Date() }), async () =>
    withPatched(User, 'findByPk', async () => ({ id: 'admin-1', role: 'admin', account_status: 'active' }), async () => {
      assert.equal(await isAdminAllowed(req, { adminBypass: true }), false);
    })
  );
});

test('maintenance admin bypass requires an active session and current admin role', async () => {
  const token = jwt.sign({ id: 'admin-1', sid: 'session-1', role: 'admin' }, JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  await withPatched(AuthSession, 'findByPk', async () => ({ id: 'session-1', user_id: 'admin-1', expires_at: new Date(Date.now() + 60_000), revoked_at: null }), async () =>
    withPatched(User, 'findByPk', async () => ({ id: 'admin-1', role: 'traveler', account_status: 'active' }), async () => {
      assert.equal(await isAdminAllowed(req, { adminBypass: true }), false);
    })
  );
});
