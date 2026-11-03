const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendOtpEmailInBackground } = require('../src/services/otp.service');

test('OTP delivery does not write the code to logs and reports successful delivery', async () => {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const delivered = await sendOtpEmailInBackground(
      { to: 'user@example.com', otp: '123456', purpose: 'RESET_PASSWORD' },
      { sendOtp: async () => ({ accepted: ['user@example.com'] }), throwOnFailure: true }
    );
    assert.equal(delivered, true);
    assert.equal(logs.join('\n').includes('123456'), false);
  } finally { console.log = originalLog; }
});

test('strict OTP delivery rejects when the email provider reports failure', async () => {
  await assert.rejects(
    sendOtpEmailInBackground(
      { to: 'user@example.com', otp: '654321', purpose: 'RESET_PASSWORD' },
      { sendOtp: async () => { throw Object.assign(new Error('SMTP unavailable'), { code: 'SMTP_DOWN' }); }, throwOnFailure: true }
    ),
    /SMTP unavailable/
  );
});
