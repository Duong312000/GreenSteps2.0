const { test } = require('node:test');
const assert = require('node:assert/strict');
const sessionService = require('../src/services/auth-session.service');
const securityAudit = require('../src/services/security-audit.service');
const controller = require('../src/controllers/account-security.controller');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

test('session list is scoped to the authenticated user and marks current session', async () => {
  const sessions = [{ id: 'session-1', isCurrent: true, platform: 'Windows', browser: 'Chrome' }];
  let query;
  await withPatched(sessionService, 'listUserSessions', async options => (query = options, sessions), async () => {
    const res = response();
    await controller.listSessions({ user: { id: 'account-1' }, authSession: { id: 'session-1' } }, res, error => { throw error; });
    assert.equal(query.userId, 'account-1');
    assert.equal(query.currentSessionId, 'session-1');
    assert.deepEqual(res.body.sessions, sessions);
  });
});

test('revoking a session uses the authenticated account as owner and records the action', async () => {
  let revokeArgs;
  let eventArgs;
  await withPatched(sessionService, 'revokeSession', async args => (revokeArgs = args, true), async () =>
    withPatched(securityAudit, 'recordSecurityEvent', async args => (eventArgs = args), async () => {
      const res = response();
      await controller.revokeSession({ user: { id: 'account-1' }, authSession: { id: 'current' }, params: { sessionId: 'target-session' }, ip: '127.0.0.1' }, res, error => { throw error; });
      assert.equal(revokeArgs.userId, 'account-1');
      assert.equal(revokeArgs.sessionId, 'target-session');
      assert.equal(res.body.success, true);
      assert.equal(eventArgs.userId, 'account-1');
      assert.equal(eventArgs.type, 'session_revoked');
    })
  );
});

test('revoke others preserves authenticated current session and reports actual count', async () => {
  let revokeArgs;
  await withPatched(sessionService, 'revokeOtherSessions', async args => (revokeArgs = args, 2), async () =>
    withPatched(securityAudit, 'recordSecurityEvent', async () => {}, async () => {
      const res = response();
      await controller.revokeOtherSessions({ user: { id: 'account-1' }, authSession: { id: 'current' } }, res, error => { throw error; });
      assert.deepEqual(revokeArgs, { userId: 'account-1', currentSessionId: 'current' });
      assert.equal(res.body.revokedCount, 2);
    })
  );
});
