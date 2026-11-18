const { test } = require('node:test');
const assert = require('node:assert/strict');
const emailService = require('../src/services/email.service');
let deliverEmail = async () => ({ accepted: ['user@example.com'] });
emailService.sendOtpEmail = args => deliverEmail(args);
const { AuthOtp } = require('../src/models/index');
const { createAndSendOtp } = require('../src/services/otp.service');

function stubOtpStorage(t) {
  const original = {
    findOne: AuthOtp.findOne,
    update: AuthOtp.update,
    create: AuthOtp.create
  };
  const record = { consumed_at: null, save: async () => { record.saved = true; } };
  AuthOtp.findOne = async () => null;
  AuthOtp.update = async () => [0];
  AuthOtp.create = async () => record;
  t.after(() => Object.assign(AuthOtp, original));
  return record;
}

test('password reset request waits for email delivery before reporting success', async t => {
  deliverEmail = async () => ({ accepted: ['user@example.com'] });
  stubOtpStorage(t);

  const result = await createAndSendOtp({ id: 'user-1', email: 'user@example.com' }, 'RESET_PASSWORD');

  assert.deepEqual(result, { queued: true, delivered: true });
});

test('password reset request rejects failed delivery and consumes the unsent OTP', async t => {
  deliverEmail = async () => { throw Object.assign(new Error('SMTP unavailable'), { code: 'SMTP_NOT_CONFIGURED' }); };
  const record = stubOtpStorage(t);

  await assert.rejects(
    createAndSendOtp({ id: 'user-1', email: 'user@example.com' }, 'RESET_PASSWORD'),
    error => error.code === 'SMTP_NOT_CONFIGURED'
  );
  assert.ok(record.consumed_at instanceof Date);
  assert.equal(record.saved, true);
});
