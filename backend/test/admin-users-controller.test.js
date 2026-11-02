const { test } = require('node:test');
const assert = require('node:assert/strict');
const { User, AdminAuditLog, store } = require('../src/models');
const otpService = require('../src/services/otp.service');

let controller;
try { controller = require('../src/controllers/admin-users.controller'); } catch { controller = null; }

function response() {
  return { statusCode: 200, body: undefined, headers: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader(name, value) { this.headers[name] = value; } };
}

async function withPatched(entries, run) {
  const originals = entries.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, value] of entries) target[key] = value;
  try { await run(); }
  finally { for (const [target, key, value] of originals.reverse()) target[key] = value; }
}

async function invoke(handler, req) {
  const res = response();
  await handler(req, res, error => res.status(error.statusCode || 500).json({ message: error.message }));
  return res;
}

test('admin user controller exposes real list, stats, detail and account action handlers', () => {
  assert.ok(controller, 'admin-users.controller.js should exist');
  for (const method of ['listUsers', 'getStats', 'getUser', 'suspendUser', 'unsuspendUser', 'deactivateUser', 'reactivateUser', 'changeRole']) {
    assert.equal(typeof controller[method], 'function', `${method} should be exported`);
  }
});

test('user list uses server-side filters and never returns password hashes', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let listQuery;
  let countQuery;
  const realCollection = User.store.db.collection;
  await withPatched([
    [User, 'findAll', async options => { listQuery = options; return [{ id: 'u1', fullname: 'Mai', email: 'mai@example.com' }]; }],
    [User, 'count', async options => { countQuery = options; return 1; }],
    [User.store.db, 'collection', name => name === 'app_servicebookings' ? { aggregate: () => ({ toArray: async () => [{ _id: 'u1', count: 3 }] }) } : realCollection.call(User.store.db, name)]
  ], async () => {
    const res = await invoke(controller.listUsers, {
      user: { id: 'admin-1', role: 'admin' },
      query: { search: 'mai', role: 'traveler', status: 'active', page: '2', limit: '10', sort: 'createdAt', order: 'desc' }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.pagination.page, 2);
    assert.equal(res.body.pagination.total, 1);
    assert.deepEqual(listQuery.attributes, [
      'id', 'username', 'fullname', 'email', 'phone', 'role', 'is_verified',
      'account_status', 'last_login_at', 'avatarUrl', 'createdAt'
    ]);
    assert.deepEqual(listQuery.where, countQuery.where);
    assert.equal(listQuery.limit, 10);
    assert.equal(listQuery.offset, 10);
    assert.equal(listQuery.order[0][0], 'createdAt');
    assert.equal(res.body.data[0].bookingCount, 3);
  });
});

test('User model defines the observed last-login sort index without duplicating it', () => {
  const lastLoginIndexes = User.indexes.filter(index => index.key?.last_login_at === 1);
  assert.equal(lastLoginIndexes.length, 1);
  assert.equal(lastLoginIndexes[0].options?.name, 'last_login_at_1');
});

test('user statistics are calculated in one Mongo aggregation instead of five collection scans', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let aggregateCalls = 0;
  let countCalls = 0;
  const statsRow = { total: 5, active: 3, suspended: 1, deactivated: 1, unverified: 2 };
  const realCollection = User.store.db.collection;
  await withPatched([
    [User, 'count', async () => { countCalls++; return 0; }],
    [User.store.db, 'collection', name => name === User.collectionName ? {
      aggregate(pipeline) {
        aggregateCalls++;
        assert.equal(pipeline.length, 1);
        assert.ok(pipeline[0].$group);
        return { toArray: async () => [statsRow] };
      }
    } : realCollection.call(User.store.db, name)]
  ], async () => {
    const res = await invoke(controller.getStats, { user: { id: 'admin-1', role: 'admin' }, query: {} });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.stats.total, 5);
    assert.equal(res.body.stats.active, 3);
    assert.equal(res.body.stats.suspended, 1);
    assert.equal(res.body.stats.deactivated, 1);
    assert.equal(res.body.stats.unverified, 2);
    assert.equal(aggregateCalls, 1);
    assert.equal(countCalls, 0);
  });
});

test('non-admin cannot list users', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let reads = 0;
  await withPatched([[User, 'findAll', async () => { reads++; return []; }]], async () => {
    const res = await invoke(controller.listUsers, { user: { id: 'provider-1', role: 'provider' }, query: {} });
    assert.equal(res.statusCode, 403);
    assert.equal(reads, 0);
  });
});

test('admin cannot suspend their own account and no account write occurs', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let reads = 0;
  let writes = 0;
  await withPatched([
    [User, 'findByPk', async () => { reads++; return { id: 'admin-1', role: 'admin', account_status: 'active' }; }],
    [User, 'update', async () => { writes++; }]
  ], async () => {
    const res = await invoke(controller.suspendUser, { user: { id: 'admin-1', role: 'admin' }, params: { id: 'admin-1' }, body: { reason: 'review' } });
    assert.equal(res.statusCode, 409);
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  });
});

test('admin cannot grant administrator privileges through role management', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let saves = 0;
  const target = { id: 'traveler-2', role: 'traveler', async save() { saves++; } };
  await withPatched([[User, 'findByPk', async () => target]], async () => {
    const res = await invoke(controller.changeRole, { user: { id: 'admin-1', role: 'admin' }, params: { id: target.id }, body: { role: 'admin', reason: 'promotion' } });
    assert.equal(res.statusCode, 403);
    assert.equal(saves, 0);
  });
});

test('profile editing rejects impossible calendar dates before writing', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let saves = 0;
  const target = { id: 'traveler-2', role: 'traveler', fullname: 'Mai', email: 'mai@example.com', async save() { saves++; } };
  await withPatched([
    [User, 'findByPk', async () => target],
    [store, 'transaction', async callback => callback({ id: 'date-transaction' })],
    [AdminAuditLog, 'create', async values => values]
  ], async () => {
    const res = await invoke(controller.updateUser, {
      user: { id: 'admin-1', role: 'admin' }, params: { id: target.id },
      body: { dob: '2026-02-30', reason: 'Correct profile date' }
    });
    assert.equal(res.statusCode, 400);
    assert.equal(saves, 0);
  });
});

test('suspension and its audit record are saved in the same transaction', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  const target = { id: 'traveler-2', role: 'traveler', account_status: 'active', fullname: 'Mai', email: 'mai@example.com', async save(options) { this.saveTransaction = options.transaction; } };
  const audit = { createTransaction: null };
  const transaction = { id: 'test-transaction' };
  await withPatched([
    [User, 'findByPk', async () => target],
    [store, 'transaction', async callback => callback(transaction)],
    [AdminAuditLog, 'create', async (values, options) => { audit.values = values; audit.createTransaction = options.transaction; return values; }]
  ], async () => {
    const res = await invoke(controller.suspendUser, { user: { id: 'admin-1', role: 'admin' }, params: { id: target.id }, body: { reason: 'policy review' } });
    assert.equal(res.statusCode, 200);
    assert.equal(target.account_status, 'suspended');
    assert.equal(target.account_status_reason, 'policy review');
    assert.equal(target.saveTransaction, transaction);
    assert.equal(audit.createTransaction, transaction);
    assert.equal(audit.values.actor_id, 'admin-1');
    assert.equal(audit.values.target_user_id, 'traveler-2');
    assert.equal(audit.values.action, 'user.suspend');
  });
});

test('user creation never returns a password and reports OTP delivery failure accurately', async t => {
  if (!controller) return t.skip('controller is not implemented yet');
  let createdUser;
  const auditRows = [];
  await withPatched([
    [User, 'findOne', async () => null],
    [User, 'create', async values => { createdUser = { ...values }; return createdUser; }],
    [store, 'transaction', async callback => callback({ id: 'create-transaction' })],
    [AdminAuditLog, 'create', async values => { auditRows.push(values); return values; }],
    [otpService, 'createAndSendOtp', async () => { throw Object.assign(new Error('email unavailable'), { code: 'SMTP_DOWN' }); }]
  ], async () => {
    const res = await invoke(controller.createUser, {
      user: { id: 'admin-1', role: 'admin' },
      body: { fullname: 'Mai Nguyen', email: 'mai@example.com', phone: '0900000000', role: 'traveler', reason: 'Support request' }
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.inviteQueued, false);
    assert.equal(res.body.user.email, 'mai@example.com');
    assert.equal(Object.hasOwn(res.body.user, 'password_hash'), false);
    assert.equal(typeof createdUser.password_hash, 'string');
    assert.equal(Object.hasOwn(createdUser, 'password'), false);
    assert.equal(auditRows.some(row => row.action === 'user.invite_failed' && row.result === 'failure'), true);
  });
});
