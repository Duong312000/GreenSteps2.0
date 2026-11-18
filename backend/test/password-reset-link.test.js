const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthOtp, User } = require('../src/models');
const otpService = require('../src/services/otp.service');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('password reset email links use a hashed, expiring, one-time token', async () => {
  const user = { id: 'reset-link-user', email: 'reset@example.com' };
  const record = { id: 'otp-row', reset_token_consumed_at: null, consumed_at: null, save: async function () {} };
  let lookupCalls = 0;
  await withPatched(AuthOtp, 'findOne', async () => (lookupCalls++, null), async () =>
    withPatched(AuthOtp, 'update', async () => [0], async () =>
      withPatched(AuthOtp, 'create', async values => Object.assign(record, values), async () => {
        const issued = await otpService.createPasswordResetLink(user);
        assert.equal(typeof issued.token, 'string');
        assert.notEqual(record.reset_token_hash, issued.token);
        assert.ok(record.reset_token_expires_at.getTime() > Date.now());
        assert.equal(record.purpose, 'RESET_PASSWORD');
      })
    )
  );
  assert.equal(lookupCalls, 1);
});
