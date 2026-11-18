const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SecurityAuditEvent, User } = require('../src/models');
const emailService = require('../src/services/email.service');
const auditService = require('../src/services/security-audit.service');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('recordSecurityEvent stores request context but filters sensitive metadata', async () => {
  let saved;
  await withPatched(User, 'findByPk', async () => null, async () => withPatched(SecurityAuditEvent, 'create', async value => (saved = value), async () => {
    await auditService.recordSecurityEvent({
      userId: 'user-1', sessionId: 'session-1', type: 'password_changed', result: 'success',
      request: { ip: '127.0.0.1', headers: { 'user-agent': 'Chrome test' } },
      metadata: { method: 'local', token: 'must-not-store', password: 'must-not-store' }
    });
    assert.equal(saved.user_id, 'user-1');
    assert.equal(saved.session_id, 'session-1');
    assert.equal(saved.ip_address, '127.0.0.1');
    assert.equal(saved.user_agent, 'Chrome test');
    assert.deepEqual(saved.metadata, { method: 'local' });
    assert.equal('token' in saved.metadata, false);
  }));
});

test('enabled security email preference sends an alert for security events', async () => {
  let sent;
  await withPatched(User, 'findByPk', async () => ({ email: 'user@example.com', security_email_notifications: true }), async () =>
    withPatched(SecurityAuditEvent, 'create', async value => ({ ...value, created_at: new Date() }), async () =>
      withPatched(emailService, 'sendSecurityAlertEmail', async value => (sent = value), async () => {
        await auditService.recordSecurityEvent({ userId: 'user-1', type: 'login_success', result: 'success', request: { headers: { 'user-agent': 'Chrome' } } });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(sent.to, 'user@example.com');
        assert.equal(sent.eventType, 'login_success');
      })
    )
  );
});

test('listSecurityEvents scopes to account, sorts newest first, and clamps pagination', async () => {
  let options;
  let countWhere;
  await withPatched(SecurityAuditEvent, 'findAll', async value => (options = value, []), async () =>
    withPatched(SecurityAuditEvent, 'count', async value => (countWhere = value.where, 0), async () => {
      const result = await auditService.listSecurityEvents({ userId: 'user-1', page: 0, pageSize: 1000 });
      assert.deepEqual(options.where, { user_id: 'user-1' });
      assert.deepEqual(options.order, [['created_at', 'DESC']]);
      assert.equal(options.limit, 100);
      assert.equal(options.offset, 0);
      assert.deepEqual(countWhere, { user_id: 'user-1' });
      assert.equal(result.page, 1);
      assert.equal(result.pageSize, 100);
      assert.equal(result.total, 0);
    })
  );
});
