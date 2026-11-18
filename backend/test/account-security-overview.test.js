const { test } = require('node:test');
const assert = require('node:assert/strict');
const { User, AuthPasskey } = require('../src/models');
const authSessionService = require('../src/services/auth-session.service');
const securityService = require('../src/services/account-security.service');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('overview calculates from persisted account measures and does not infer hash strength', async () => {
  const user = {
    id: 'user-1', email: 'user@example.com', is_verified: true, account_status: 'active',
    password_hash: 'bcrypt-hash', auth_methods: ['password'], password_policy_checked_at: null,
    password_changed_at: null, totp_enabled_at: new Date(), security_email_notifications: false, phone: '0900000000'
  };
  await withPatched(User, 'findByPk', async () => user, async () =>
    withPatched(AuthPasskey, 'findAll', async () => [], async () =>
    withPatched(authSessionService, 'listUserSessions', async () => [{ id: 'sid', isCurrent: true }], async () => {
      const overview = await securityService.getSecurityOverview({ userId: 'user-1', currentSessionId: 'sid' });
      assert.equal(overview.measures.emailVerified.enabled, true);
      assert.equal(overview.measures.localPassword.configured, true);
      assert.equal(overview.measures.localPassword.strength, 'unknown');
      assert.equal(Object.hasOwn(overview.measures, 'mfa'), false);
      assert.equal(overview.measures.recoveryPhone.verified, false);
      assert.equal(overview.measures.securityEmailNotifications.enabled, false);
      assert.equal(overview.sessions.length, 1);
      assert.equal(overview.score, 67);
      assert.equal(overview.recommendations.some(item => item.action === 'setup_mfa'), false);
    }))
  );
});

test('overview excludes local-password penalty for an OAuth-only account', async () => {
  const user = {
    id: 'oauth-user', email: 'oauth@example.com', is_verified: true, account_status: 'active',
    auth_methods: ['google'], password_hash: 'random-password-hash', totp_enabled_at: null,
    security_email_notifications: true
  };
  await withPatched(User, 'findByPk', async () => user, async () =>
    withPatched(AuthPasskey, 'findAll', async () => [], async () =>
    withPatched(authSessionService, 'listUserSessions', async () => [], async () => {
      const overview = await securityService.getSecurityOverview({ userId: 'oauth-user', currentSessionId: null });
      assert.equal(overview.measures.localPassword.applicable, false);
      assert.equal(overview.measures.primaryAuthentication.provider, 'google');
      assert.ok(overview.score <= 100 && overview.score >= 0);
    }))
  );
});
