const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { AuthSession, SecurityAuditEvent, User } = require('../src/models');
const authController = require('../src/controllers/auth.controller');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('password login creates a registry-backed session and signs its ID into the JWT', async () => {
  const user = {
    id: 'login-user', username: 'login-user', role: 'traveler', fullname: 'Login User', is_verified: true,
    account_status: 'active', email: 'login@example.com', password_hash: await bcrypt.hash('GreenSteps123!', 4),
    async save() {}
  };
  let savedSession;
  let cookie;
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    cookie(name, value, options) { cookie = { name, value, options }; }
  };
  await withPatched(User, 'findByPk', async () => null, async () => withPatched(User, 'findOne', async () => user, async () =>
    withPatched(AuthSession, 'create', async value => (savedSession = value), async () =>
      withPatched(SecurityAuditEvent, 'create', async value => value, async () => {
        await authController.login({ body: { identifier: 'login-user', password: 'GreenSteps123!' }, headers: { 'user-agent': 'Mozilla/5.0 Chrome/130 Windows NT 10.0' }, ip: '127.0.0.1' }, res, error => { throw error; });
      })
    )
  ));
  assert.equal(res.body.success, true);
  assert.ok(savedSession.id);
  assert.equal(savedSession.user_id, user.id);
  assert.equal(savedSession.ip_address, '127.0.0.1');
  assert.equal(cookie.name, 'token');
  assert.equal(cookie.options.httpOnly, true);
  const claims = jwt.verify(res.body.token, JWT_SECRET);
  assert.equal(claims.sid, savedSession.id);
  assert.equal(claims.id, user.id);
});

test('failed password login records an account-scoped failure without storing the password', async () => {
  const user = {
    id: 'login-user', username: 'login-user', role: 'traveler', is_verified: true, account_status: 'active',
    email: 'login@example.com', password_hash: await bcrypt.hash('CorrectPassword123!', 4)
  };
  let auditEvent;
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await withPatched(User, 'findByPk', async () => null, async () => withPatched(User, 'findOne', async () => user, async () =>
    withPatched(SecurityAuditEvent, 'create', async value => (auditEvent = value), async () => {
      await authController.login({ body: { identifier: 'login-user', password: 'WrongPassword123!' }, headers: { 'user-agent': 'Test Browser' }, ip: '127.0.0.1' }, res, error => { throw error; });
      await new Promise(resolve => setImmediate(resolve));
    })
  ));
  assert.equal(res.statusCode, 401);
  assert.equal(auditEvent.event_type, 'login_failure');
  assert.equal(auditEvent.user_id, 'login-user');
  assert.equal(JSON.stringify(auditEvent).includes('WrongPassword123!'), false);
});
