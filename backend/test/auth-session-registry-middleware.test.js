const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { AuthSession, User } = require('../src/models');
const { authMiddleware, strictAuthMiddleware, JWT_SECRET } = require('../src/middlewares/auth.middleware');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

async function withPatched(target, key, value, run) {
  const original = target[key];
  target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('standard auth rejects request userId fallback when JWT is missing', async () => {
  let nextCalled = false;
  const res = response();
  await withPatched(User, 'findByPk', async () => ({ id: 'victim', username: 'victim', account_status: 'active' }), async () => {
    await authMiddleware({ headers: {}, cookies: {}, body: { userId: 'victim' } }, res, () => { nextCalled = true; });
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('standard auth rejects a legacy JWT without a session identifier', async () => {
  const token = jwt.sign({ id: 'user-1' }, JWT_SECRET);
  let nextCalled = false;
  const res = response();
  await withPatched(User, 'findByPk', async () => ({ id: 'user-1', username: 'user', role: 'traveler', account_status: 'active' }), async () => {
    await authMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, res, () => { nextCalled = true; });
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('strict auth rejects a validly signed JWT without an active session identifier', async () => {
  const token = jwt.sign({ id: 'user-1' }, JWT_SECRET);
  let nextCalled = false;
  const res = response();
  await withPatched(User, 'findByPk', async () => ({ id: 'user-1', username: 'user', role: 'traveler', account_status: 'active' }), async () => {
    await strictAuthMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, res, () => { nextCalled = true; });
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('standard auth accepts a JWT only when its session belongs to the same account', async () => {
  const token = jwt.sign({ id: 'user-1', sid: 'session-1' }, JWT_SECRET);
  let nextCalled = false;
  const session = { id: 'session-1', user_id: 'user-1', expires_at: new Date(Date.now() + 60_000), revoked_at: null, last_active_at: new Date() };
  const res = response();
  await withPatched(AuthSession, 'findByPk', async id => id === 'session-1' ? session : null, async () =>
    withPatched(User, 'findByPk', async () => ({ id: 'user-1', username: 'user', role: 'traveler', account_status: 'active' }), async () => {
      await authMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, res, () => { nextCalled = true; });
    })
  );
  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test('standard auth rejects a session owned by another account', async () => {
  const token = jwt.sign({ id: 'user-1', sid: 'session-2' }, JWT_SECRET);
  let nextCalled = false;
  const res = response();
  await withPatched(AuthSession, 'findByPk', async () => ({ id: 'session-2', user_id: 'user-2', expires_at: new Date(Date.now() + 60_000), revoked_at: null }), async () => {
    await authMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, res, () => { nextCalled = true; });
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('revoking a persisted session immediately invalidates its JWT', async () => {
  const token = jwt.sign({ id: 'user-1', sid: 'session-3' }, JWT_SECRET);
  let nextCalled = false;
  const res = response();
  await withPatched(AuthSession, 'findByPk', async () => ({
    id: 'session-3', user_id: 'user-1', expires_at: new Date(Date.now() + 60_000),
    revoked_at: new Date(), last_active_at: new Date()
  }), async () => {
    await authMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, res, () => { nextCalled = true; });
  });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});
