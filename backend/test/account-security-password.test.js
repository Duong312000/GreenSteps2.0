const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { User, SecurityAuditEvent } = require('../src/models');
const authController = require('../src/controllers/auth.controller');
const sessionService = require('../src/services/auth-session.service');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('password change verifies the old bcrypt hash, updates account audit fields, and revokes other sessions', async () => {
  const user = { id: 'owner', auth_methods: ['password'], password_hash: await bcrypt.hash('OldPassword123!', 4), async save() {} };
  let revokedArgs;
  let auditArgs;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await withPatched(User, 'findByPk', async id => { assert.equal(id, 'owner'); return user; }, async () =>
    withPatched(sessionService, 'revokeOtherSessions', async args => (revokedArgs = args, 1), async () =>
      withPatched(SecurityAuditEvent, 'create', async args => (auditArgs = args, args), async () => {
        await authController.changePassword({ user: { id: 'owner' }, authSession: { id: 'current-session' }, body: { userId: 'victim', oldPassword: 'OldPassword123!', newPassword: 'NewPassword456!' } }, res, error => { throw error; });
      })
    )
  );
  assert.equal(res.body.success, true);
  assert.equal(await bcrypt.compare('NewPassword456!', user.password_hash), true);
  assert.ok(user.password_changed_at instanceof Date);
  assert.ok(user.password_policy_checked_at instanceof Date);
  assert.deepEqual(revokedArgs, { userId: 'owner', currentSessionId: 'current-session', reason: 'password_changed' });
  assert.equal(auditArgs.user_id, 'owner');
});

test('OAuth-only account cannot treat a random provider password hash as a local password', async () => {
  const user = { id: 'oauth-owner', auth_methods: ['google'], password_hash: await bcrypt.hash('random-provider-secret', 4) };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await withPatched(User, 'findByPk', async () => user, async () => {
    await authController.changePassword({ user: { id: 'oauth-owner' }, body: { oldPassword: 'random-provider-secret', newPassword: 'NewPassword456!' } }, res, error => { throw error; });
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'PASSWORD_SETUP_REQUIRES_VERIFICATION');
});
