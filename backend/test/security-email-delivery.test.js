const { test } = require('node:test');
const assert = require('node:assert/strict');
const emailService = require('../src/services/email.service');

test('password reset and email change messages use the configured Gmail API delivery path', async () => {
  const oldUrl = process.env.GMAIL_API_URL;
  const oldFetch = global.fetch;
  const sent = [];
  process.env.GMAIL_API_URL = 'https://mail.example.test/send';
  global.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return { ok: true, async json() { return { success: true }; } };
  };
  try {
    await emailService.sendPasswordResetEmail({ to: 'account@example.com', resetUrl: 'https://greensteps.test/reset-password?token=secret' });
    await emailService.sendEmailChangeVerification({ to: 'new@example.com', code: '123456' });
    assert.equal(sent.length, 2);
    assert.equal(sent[0].body.to, 'account@example.com');
    assert.match(sent[0].body.html, /reset-password/);
    assert.equal(sent[1].body.to, 'new@example.com');
    assert.match(sent[1].body.text, /123456/);
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.GMAIL_API_URL;
    else process.env.GMAIL_API_URL = oldUrl;
  }
});
