const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthSession } = require('../src/models');
const sessionService = require('../src/services/auth-session.service');

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('createSession persists a random account-owned session with bounded expiry', async () => {
  let saved;
  await withPatched(AuthSession, 'create', async value => { saved = value; return value; }, async () => {
    const created = await sessionService.createSession({
      userId: 'user-1', userAgent: 'Mozilla/5.0 Chrome/130 Windows', ip: '127.0.0.1',
      now: new Date('2026-11-19T00:00:00.000Z')
    });
    assert.ok(created.id);
    assert.equal(created.user_id, 'user-1');
    assert.equal(created.expires_at.toISOString(), '2026-11-26T00:00:00.000Z');
    assert.equal(saved.id, created.id);
    assert.equal(saved.ip_address, '127.0.0.1');
    assert.match(saved.browser, /Chrome/);
  });
});

test('getActiveSession rejects missing, expired, revoked, and other-account sessions', async () => {
  const now = new Date('2026-11-19T00:00:00.000Z');
  const rows = new Map([
    ['active', { id: 'active', user_id: 'user-1', expires_at: new Date('2026-11-20'), revoked_at: null }],
    ['expired', { id: 'expired', user_id: 'user-1', expires_at: new Date('2026-11-18'), revoked_at: null }],
    ['revoked', { id: 'revoked', user_id: 'user-1', expires_at: new Date('2026-11-20'), revoked_at: now }],
    ['other', { id: 'other', user_id: 'user-2', expires_at: new Date('2026-11-20'), revoked_at: null }]
  ]);
  await withPatched(AuthSession, 'findByPk', async id => rows.get(id) || null, async () => {
    assert.equal((await sessionService.getActiveSession({ sessionId: 'active', userId: 'user-1', now })).id, 'active');
    assert.equal(await sessionService.getActiveSession({ sessionId: 'missing', userId: 'user-1', now }), null);
    assert.equal(await sessionService.getActiveSession({ sessionId: 'expired', userId: 'user-1', now }), null);
    assert.equal(await sessionService.getActiveSession({ sessionId: 'revoked', userId: 'user-1', now }), null);
    assert.equal(await sessionService.getActiveSession({ sessionId: 'other', userId: 'user-1', now }), null);
  });
});

test('revokeSession is owner-scoped and persists revocation time', async () => {
  const row = { id: 's-1', user_id: 'user-1', revoked_at: null, async save() { this.saved = true; } };
  await withPatched(AuthSession, 'findByPk', async () => row, async () => {
    assert.equal(await sessionService.revokeSession({ sessionId: 's-1', userId: 'user-2', now: new Date() }), false);
    assert.equal(row.revoked_at, null);
    assert.equal(await sessionService.revokeSession({ sessionId: 's-1', userId: 'user-1', now: new Date('2026-11-19') }), true);
    assert.equal(row.revoked_at.toISOString(), '2026-11-19T00:00:00.000Z');
    assert.equal(row.saved, true);
  });
});

test('listUserSessions returns only active sessions owned by the account and marks the current one', async () => {
  let query;
  const now = new Date('2026-11-19T00:00:00.000Z');
  await withPatched(AuthSession, 'findAll', async options => {
    query = options;
    return [
      { id: 'current', user_id: 'user-1', expires_at: new Date('2026-11-20'), revoked_at: null, createdAt: now, last_active_at: now, browser: 'Chrome', platform: 'Windows', ip_address: '192.0.2.1' },
      { id: 'expired', user_id: 'user-1', expires_at: new Date('2026-11-18'), revoked_at: null, createdAt: now, last_active_at: now },
      { id: 'revoked', user_id: 'user-1', expires_at: new Date('2026-11-20'), revoked_at: now, createdAt: now, last_active_at: now },
      { id: 'other-user', user_id: 'user-2', expires_at: new Date('2026-11-20'), revoked_at: null, createdAt: now, last_active_at: now }
    ];
  }, async () => {
    const sessions = await sessionService.listUserSessions({ userId: 'user-1', currentSessionId: 'current', now });
    assert.deepEqual(query.where, { user_id: 'user-1', revoked_at: null });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, 'current');
    assert.equal(sessions[0].isCurrent, true);
    assert.equal(sessions[0].ipAddress, '192.0.2.1');
    assert.equal('location' in sessions[0], false);
    assert.equal('ip_address' in sessions[0], false);
    assert.equal('user_agent' in sessions[0], false);
  });
});

test('revokeOtherSessions preserves current and revokes only active sessions for the same account', async () => {
  const now = new Date('2026-11-19T00:00:00.000Z');
  const rows = [
    { id: 'current', user_id: 'user-1', expires_at: new Date('2026-11-20'), revoked_at: null, async save() {} },
    { id: 'other', user_id: 'user-1', expires_at: new Date('2026-11-20'), revoked_at: null, async save() { this.saved = true; } },
    { id: 'expired', user_id: 'user-1', expires_at: new Date('2026-11-18'), revoked_at: null, async save() { this.saved = true; } },
    { id: 'foreign', user_id: 'user-2', expires_at: new Date('2026-11-20'), revoked_at: null, async save() { this.saved = true; } }
  ];
  await withPatched(AuthSession, 'findAll', async () => rows, async () => {
    const count = await sessionService.revokeOtherSessions({ userId: 'user-1', currentSessionId: 'current', now });
    assert.equal(count, 1);
    assert.equal(rows[0].revoked_at, null);
    assert.equal(rows[1].revoked_at, now);
    assert.equal(rows[2].revoked_at, null);
    assert.equal(rows[3].revoked_at, null);
  });
});

test('revokeAllSessions invalidates every active session for only the target account', async () => {
  const rows = ['a1', 'a2'].map(id => ({ id, user_id: 'a', revoked_at: null, async save() {} }))
    .concat([{ id: 'b1', user_id: 'b', revoked_at: null, async save() {} }]);
  await withPatched(AuthSession, 'findAll', async ({ where }) => rows.filter(row => row.user_id === where.user_id), async () => {
    const count = await sessionService.revokeAllSessions({ userId: 'a', reason: 'password_reset' });
    assert.equal(count, 2);
    assert.ok(rows[0].revoked_at);
    assert.ok(rows[1].revoked_at);
    assert.equal(rows[2].revoked_at, null);
  });
});
