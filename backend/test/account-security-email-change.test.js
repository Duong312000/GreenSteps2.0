const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { User, EmailChangeVerification } = require('../src/models');
const emailService = require('../src/services/email.service');
const audit = require('../src/services/security-audit.service');
const controller = require('../src/controllers/account-security.controller');

async function patch(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

function res() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

test('email change requires a recent OAuth session, mails a code, and only changes email after verification', async () => {
  const user = { id: 'email-owner', email: 'old@example.com', auth_methods: ['google'], is_verified: false, async save() {} };
  let sentCode = '';
  const pending = { user_id: user.id, pending_email: 'new@example.com', attempt_count: 0, expires_at: new Date(Date.now() + 60000), async save() {} };
  await patch(User, 'findByPk', async () => user, async () =>
    await patch(User, 'findOne', async () => null, async () =>
      await patch(EmailChangeVerification, 'findOne', async () => null, async () =>
        await patch(EmailChangeVerification, 'update', async () => {}, async () =>
          await patch(EmailChangeVerification, 'create', async input => (Object.assign(pending, input), pending), async () =>
            await patch(emailService, 'sendEmailChangeVerification', async input => { sentCode = input.code; }, async () => {
              const requestResponse = res();
              await controller.requestEmailChange({ user: { id: user.id }, authSession: { created_at: new Date() }, body: { email: pending.pending_email } }, requestResponse, error => { throw error; });
              assert.equal(requestResponse.statusCode, 200);
              assert.equal(sentCode.length, 6);
              assert.notEqual(pending.code_hash, sentCode);

              await patch(EmailChangeVerification, 'findOne', async () => pending, async () =>
                await patch(audit, 'recordSecurityEvent', async () => {}, async () => {
                  const confirmResponse = res();
                  await controller.confirmEmailChange({ user: { id: user.id }, authSession: { id: 'session' }, body: { code: sentCode } }, confirmResponse, error => { throw error; });
                  assert.equal(confirmResponse.body.email, 'new@example.com');
                  assert.equal(user.email, 'new@example.com');
                  assert.equal(user.is_verified, true);
                  assert.ok(pending.consumed_at instanceof Date);
                })
              );
            })
          )
        )
      )
    )
  );
  assert.equal(pending.code_hash, crypto.createHash('sha256').update(sentCode).digest('hex'));
});
