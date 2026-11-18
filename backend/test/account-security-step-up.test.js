const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { User } = require('../src/models');
const controller = require('../src/controllers/account-security.controller');
const passkeyService = require('../src/services/passkey.service');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('passkey registration uses the current password even when the account has legacy MFA data', async () => {
  const user = { id: 'user-a', auth_methods: ['password'], password_hash: await bcrypt.hash('Password123!', 4), totp_enabled_at: new Date() };
  let began = false;
  const res = response();
  await withPatched(User, 'findByPk', async () => user, async () =>
    withPatched(passkeyService, 'beginRegistration', async () => (began = true, { options: {}, challengeId: 'challenge' }), async () => {
      await controller.beginPasskeyRegistration({ user: { id: 'user-a' }, authSession: { id: 'sid' }, body: {} }, res, error => { throw error; });
    })
  );
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'STEP_UP_REQUIRED');
  assert.equal(began, false);
});

test('recent OAuth session can register a passkey, while an old OAuth session must sign in again', async () => {
  const user = { id: 'oauth-user', auth_methods: ['google'] };
  let calls = 0;
  await withPatched(User, 'findByPk', async () => user, async () =>
    withPatched(passkeyService, 'beginRegistration', async () => (calls += 1, { options: { challenge: 'abc' }, challengeId: 'challenge' }), async () => {
      const recentRes = response();
      await controller.beginPasskeyRegistration({ user: { id: user.id }, authSession: { id: 'sid', created_at: new Date() }, body: {} }, recentRes, error => { throw error; });
      assert.equal(recentRes.body.success, true);
      const oldRes = response();
      await controller.beginPasskeyRegistration({ user: { id: user.id }, authSession: { id: 'sid', created_at: new Date(Date.now() - 10 * 60 * 1000) }, body: {} }, oldRes, error => { throw error; });
      assert.equal(oldRes.statusCode, 401);
      assert.equal(calls, 1);
    })
  );
});
