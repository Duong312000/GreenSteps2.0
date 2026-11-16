const { test } = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middlewares/errorHandler');
const { redactSensitiveText } = errorHandler;

test('credential redaction consumes quoted values that contain whitespace', () => {
  const safe = redactSensitiveText('request failed password="two word secret" token=\'token with spaces\'');
  assert.doesNotMatch(safe, /two word secret|token with spaces/);
  assert.match(safe, /password=\[REDACTED\]/);
  assert.match(safe, /token=\[REDACTED\]/);
});

test('SEC-002: credential redaction covers Atlas URI credentials, webhook headers and bearer tokens', () => {
  const unsafe = 'mongodb+srv://fixture-user:fixture-db-secret@cluster.example/GreenSteps; x-webhook-secret="fixture-webhook-secret" Authorization: Bearer fixture-bearer-token';
  const safe = redactSensitiveText(unsafe);
  assert.doesNotMatch(safe, /fixture-db-secret|fixture-webhook-secret|fixture-bearer-token/);
  assert.match(safe, /mongodb\+srv:\/\/\[REDACTED\]@/);
  assert.match(safe, /x-webhook-secret=\[REDACTED\]/i);
  assert.match(safe, /Authorization=\[REDACTED\]/i);
});

test('error handler removes secrets from logs and sends generic production 500 response', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousLog = console.error;
  let logged = '';
  let response;
  process.env.NODE_ENV = 'production';
  console.error = value => { logged = value; };
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { response = body; return this; } };
  try {
    errorHandler(new Error('Mongo failed password=hunter2 token=abc123'), {}, res, () => {});
  } finally {
    console.error = previousLog;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(response.message, 'Có lỗi hệ thống xảy ra, vui lòng thử lại sau.');
  assert.equal('stack' in response, false);
  assert.doesNotMatch(logged, /hunter2|abc123/);
  assert.match(logged, /\[REDACTED\]/);
});
