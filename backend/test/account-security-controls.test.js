const { test } = require('node:test');
const assert = require('node:assert/strict');
const { User, SecurityAuditEvent } = require('../src/models');
const authSessionService = require('../src/services/auth-session.service');
const controller = require('../src/controllers/account-security.controller');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

function response() {
  return { statusCode: 200, body: null, clearedCookie: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    clearCookie(name, options) { this.clearedCookie = { name, options }; }
  };
}

test('OAuth accounts can set a local password after a recent sign-in', async () => {
  const user = { id: 'oauth-password-user', email: 'oauth@example.com', auth_methods: ['google'], async save() {} };
  const res = response();
  await withPatched(User, 'findByPk', async () => user, async () =>
    withPatched(authSessionService, 'revokeOtherSessions', async () => 2, async () =>
      withPatched(SecurityAuditEvent, 'create', async event => event, async () => {
        await controller.setPassword({ user: { id: user.id }, authSession: { id: 'current', created_at: new Date() }, body: { password: 'StrongPassword123!', confirmPassword: 'StrongPassword123!' } }, res, error => { throw error; });
      })
    )
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(user.auth_methods.includes('password'));
  assert.notEqual(user.password_hash, 'StrongPassword123!');
});

test('revoking all devices invalidates every session and clears the current cookie', async () => {
  let revokedUserId;
  const res = response();
  await withPatched(authSessionService, 'revokeAllSessions', async options => (revokedUserId = options.userId, 3), async () =>
    withPatched(SecurityAuditEvent, 'create', async event => event, async () => {
      await controller.revokeAllSessions({ user: { id: 'account-owner' }, authSession: { id: 'current' }, body: {}, headers: {} }, res, error => { throw error; });
    })
  );
  assert.equal(revokedUserId, 'account-owner');
  assert.equal(res.body.revokedCount, 3);
  assert.equal(res.clearedCookie.name, 'token');
});
