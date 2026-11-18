const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/passkey.service');
const { AuthPasskey, AuthWebAuthnChallenge, User } = require('../src/models');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('registration options bind a one-time challenge to the authenticated account', async () => {
  process.env.WEBAUTHN_RP_ID = 'localhost';
  process.env.WEBAUTHN_ORIGIN = 'http://localhost:4200';
  let challenge;
  await withPatched(AuthPasskey, 'findAll', async () => [], async () =>
    withPatched(AuthWebAuthnChallenge, 'create', async attrs => (challenge = attrs), async () => {
      const result = await service.beginRegistration({ id: 'user-passkey', username: 'traveler', email: 'user@example.com' });
      assert.equal(result.options.rp.id, 'localhost');
      assert.equal(result.options.authenticatorSelection.residentKey, 'required');
      assert.ok(result.options.challenge);
      assert.equal(challenge.user_id, 'user-passkey');
      assert.equal(challenge.purpose, 'registration');
      assert.equal(challenge.challenge, result.options.challenge);
    })
  );
});

test('passkey listing and deletion are scoped to account ownership', async () => {
  const rows = [{ id: 'pk-a', user_id: 'a', name: 'Laptop', credential_id: 'secret-id', public_key: 'secret-key', counter: 1, created_at: new Date(), last_used_at: null }];
  let deletedWhere;
  await withPatched(AuthPasskey, 'findAll', async ({ where }) => rows.filter(row => row.user_id === where.user_id), async () => {
    assert.deepEqual(await service.listPasskeys('b'), []);
    assert.equal((await service.listPasskeys('a')).length, 1);
  });
  await withPatched(User, 'findByPk', async () => null, async () => withPatched(AuthPasskey, 'findByPk', async () => rows[0], async () =>
    withPatched(AuthPasskey, 'findAll', async () => [], async () =>
    withPatched(AuthPasskey, 'destroy', async ({ where }) => (deletedWhere = where), async () => {
      assert.equal(await service.deletePasskey({ userId: 'b', passkeyId: 'pk-a' }), false);
      assert.equal(deletedWhere, undefined);
      assert.equal(await service.deletePasskey({ userId: 'a', passkeyId: 'pk-a' }), true);
      assert.deepEqual(deletedWhere, { id: 'pk-a', user_id: 'a' });
    }))
  ));
});

test('production passkeys fail closed until RP ID and origin are configured', () => {
  const previousEnv = { mode: process.env.NODE_ENV, id: process.env.WEBAUTHN_RP_ID, origin: process.env.WEBAUTHN_ORIGIN };
  process.env.NODE_ENV = 'production';
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGIN;
  try { assert.throws(() => service.relyingParty(), error => error.code === 'WEBAUTHN_CONFIG_MISSING'); }
  finally {
    if (previousEnv.mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv.mode;
    if (previousEnv.id === undefined) delete process.env.WEBAUTHN_RP_ID; else process.env.WEBAUTHN_RP_ID = previousEnv.id;
    if (previousEnv.origin === undefined) delete process.env.WEBAUTHN_ORIGIN; else process.env.WEBAUTHN_ORIGIN = previousEnv.origin;
  }
});
