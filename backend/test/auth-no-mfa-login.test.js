const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { User, AuthOtp, AuthMfaChallenge, SecurityAuditEvent } = require('../src/models');
const authController = require('../src/controllers/auth.controller');
const authTokenService = require('../src/services/auth-token.service');
const googleAuth = require('../src/services/google-auth.service');
const facebookAuth = require('../src/services/facebook-auth.service');
const passkeyService = require('../src/services/passkey.service');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

const existingUser = {
  id: 'legacy-mfa-user', username: 'legacy-mfa-user', email: 'legacy@example.com',
  role: 'traveler', fullname: 'Legacy MFA User', is_verified: true,
  account_status: 'active', totp_enabled_at: new Date(),
  async save() {}
};

async function expectDirectLogin(login, req) {
  let cookieToken;
  let issuedMethod;
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value) { if (name === 'token') cookieToken = value; }
  };
  await withPatched(AuthMfaChallenge, 'create', async () => { throw new Error('Login must not create an MFA challenge.'); }, async () =>
    withPatched(authTokenService, 'issueAuthenticatedSession', async (_user, _req, method) => { issuedMethod = method; return 'session-token'; }, async () =>
      withPatched(authTokenService, 'setAuthCookie', (response, token) => response.cookie('token', token), async () =>
        withPatched(SecurityAuditEvent, 'create', async value => value, async () => login(req, res, error => { throw error; }))
      )
    )
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.mfaRequired, undefined);
  assert.equal(res.body.token, 'session-token');
  assert.equal(cookieToken, 'session-token');
  assert.ok(issuedMethod);
}

test('password login immediately issues a session for accounts with legacy MFA enabled', async () => {
  const passwordHash = await bcrypt.hash('CorrectPassword123!', 4);
  const user = { ...existingUser, password_hash: passwordHash };
  await withPatched(User, 'findOne', async () => user, async () =>
    expectDirectLogin(authController.login, {
      body: { identifier: user.username, password: 'CorrectPassword123!' },
      headers: {}, ip: '127.0.0.1'
    })
  );
});

test('Google, Facebook, passkey, and email OTP login issue sessions without MFA challenges', async () => {
  await withPatched(googleAuth, 'verifyGoogleAccessToken', async () => ({ email: existingUser.email, fullname: existingUser.fullname }), async () =>
    withPatched(User, 'findOne', async () => existingUser, async () =>
      expectDirectLogin(authController.googleLogin, { body: { accessToken: 'google-token' }, headers: {}, ip: '127.0.0.1' })
    )
  );
  await withPatched(facebookAuth, 'verifyFacebookAccessToken', async () => ({ email: existingUser.email, fullname: existingUser.fullname, facebookId: 'fb-id' }), async () =>
    withPatched(User, 'findOne', async () => existingUser, async () =>
      expectDirectLogin(authController.facebookLogin, { body: { accessToken: 'facebook-token' }, headers: {}, ip: '127.0.0.1' })
    )
  );
  await withPatched(passkeyService, 'finishAuthentication', async () => ({ ok: true, user: existingUser }), async () =>
    expectDirectLogin(authController.verifyPasskeyAuthentication, { body: { challengeId: 'passkey-challenge', response: {} }, headers: {}, ip: '127.0.0.1' })
  );

  const otp = '123456';
  const otpHash = `sha256:${crypto.createHmac('sha256', JWT_SECRET).update(otp).digest('hex')}`;
  const latestOtp = { expires_at: new Date(Date.now() + 60_000), otp_hash: otpHash, attempt_count: 0, consumed_at: null, async save() {} };
  await withPatched(User, 'findOne', async () => existingUser, async () =>
    withPatched(AuthOtp, 'findOne', async () => latestOtp, async () =>
      expectDirectLogin(authController.verifyCheckoutOtp, { body: { email: existingUser.email, otp }, headers: {}, ip: '127.0.0.1' })
    )
  );
});

test('authentication routes no longer expose MFA verification or setup endpoints', () => {
  const authRoutes = require('../src/routes/auth.routes');
  const securityRoutes = require('../src/routes/account-security.routes');
  const hasMfaRoute = router => router.stack.some(layer => layer.route?.path?.includes('/mfa/'));
  assert.equal(hasMfaRoute(authRoutes), false);
  assert.equal(hasMfaRoute(securityRoutes), false);
});

test('profile queries never return legacy MFA secrets after the feature is removed', async () => {
  let queryOptions;
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await withPatched(User, 'findByPk', async (_id, options) => { queryOptions = options; return { id: existingUser.id }; }, async () =>
    authController.getProfile({ user: { id: existingUser.id }, params: {} }, res, error => { throw error; })
  );
  assert.equal(res.statusCode, 200);
  assert.ok(queryOptions.attributes.exclude.includes('totp_secret_encrypted'));
  assert.ok(queryOptions.attributes.exclude.includes('recovery_code_hashes'));
});
