const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSecurityOperationsService } = require('../src/services/security-operations.service');
const { SystemEventLog } = require('../src/models');

test('system events remove credential fields and receive a 90-day retention expiry', async () => {
  let saved;
  const now = new Date('2026-11-04T00:00:00.000Z');
  const service = createSecurityOperationsService({
    SystemEventLog: { create: async event => { saved = event; return event; } },
    now: () => now
  });
  await service.recordSystemEvent({
    kind: 'error', action: 'api.error', message: 'Bearer abc123 token=still-secret', endpoint: '/api/admin/users/:id',
    metadata: { apiKey: 'do-not-store', count: 2, nested: { password: 'do-not-store', safe: 'kept' } }
  });
  assert.equal(saved.kind, 'error');
  assert.equal(saved.message, 'Bearer [REDACTED] token=[REDACTED]');
  assert.deepEqual(saved.metadata, { count: 2, nested: { safe: 'kept' } });
  assert.equal(saved.expires_at.toISOString(), '2027-02-02T00:00:00.000Z');
});

test('system event model has query indexes and a TTL expiry index', () => {
  assert.ok(SystemEventLog.indexes.some(index => index.key.kind === 1 && index.key.createdAt === -1));
  const expiry = SystemEventLog.indexes.find(index => index.key.expires_at === 1);
  assert.equal(expiry.options.expireAfterSeconds, 0);
});
