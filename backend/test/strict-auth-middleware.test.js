const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { strictAuthMiddleware, JWT_SECRET } = require('../src/middlewares/auth.middleware');
const { User } = require('../src/models');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('strict auth rejects legacy body userId fallback on catalog administration routes', async () => {
  let nextCalled = false;
  const res = response();
  await strictAuthMiddleware({ headers: {}, cookies: {}, body: { userId: 'admin-1' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('strict auth loads role from the authenticated account and ignores token-provided role', async () => {
  const original = User.findByPk;
  User.findByPk = async () => ({ id: 'user-1', role: 'provider', account_status: 'active' });
  const token = jwt.sign({ id: 'user-1', role: 'admin' }, JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {}, body: { userId: 'other-user' } };
  let nextCalled = false;
  try {
    await strictAuthMiddleware(req, response(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.role, 'provider');
  } finally { User.findByPk = original; }
});
