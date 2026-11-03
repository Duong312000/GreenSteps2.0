const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('../src/config/env');

test('phase 1 demo wallet: isolation, permissions, pending settlement, holds, transfers and durable ledger', { skip: !process.env.TEST_MONGODB_URI, timeout: 60000 }, async () => {
  const database = `WalletDemoTest_${randomUUID().replaceAll('-', '')}`;
  const uri = new URL(process.env.TEST_MONGODB_URI); uri.pathname = `/${database}`;
  process.env.MONGODB_URI = uri.toString();
  process.env.NODE_ENV = 'test';
  process.env.WALLET_DEMO_ENABLED = 'true';
  process.env.WALLET_DEMO_USER_IDS = 'demo-alice,demo-bob';
  process.env.WALLET_DEMO_ALL_USERS = 'false';
  process.env.WALLET_DEMO_SELF_SETTLE = 'false';
  const { store, User, Wallet, WalletTransaction, WalletLedger } = require('../src/models');
  const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
  const jwt = require('jsonwebtoken');
  let server, connected = false;
  try {
    await store.sync(); connected = true;
    for (const [id, role, phone] of [['demo-alice', 'traveler', '0900000001'], ['demo-bob', 'traveler', '0900000002'], ['real-user', 'traveler', '0900000003'], ['demo-admin', 'admin', '0900000004']]) {
      await User.create({ id, role, phone, fullname: id, username: id, email: `${id}@example.invalid`, password_hash: 'test-only' });
      await Wallet.create({ id: `wallet-${id}`, user_id: id, balance: 123456, reserved_balance: 1000, green_points: 700, tier_points: 900, tier_history_synced: true });
    }
    const app = require('../src/app'); server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    async function request(path, method = 'GET', body, actor = 'demo-alice', key = randomUUID()) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/wallet${path}`, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(actor ? { Authorization: `Bearer ${jwt.sign({ id: actor, role: actor === 'demo-admin' ? 'admin' : 'traveler' }, JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    }
    const overview = async (actor = 'demo-alice') => (await request('/overview', 'GET', null, actor)).body;
    const settle = (id, status = 'SUCCESS', actor = 'demo-admin') => request(`/demo/admin/transactions/${id}/settle`, 'POST', { status }, actor);
    assert.equal((await request('/demo/deposits', 'POST', { amount: 100000, method: 'demo_bank' }, null)).status, 401);
    assert.equal((await request('/demo/deposits', 'POST', { amount: 100000, method: 'demo_bank' }, 'real-user')).status, 403);
    process.env.WALLET_DEMO_ENABLED = 'false';
    assert.equal((await request('/demo/deposits', 'POST', { amount: 100000, method: 'demo_bank' })).status, 403);
    process.env.WALLET_DEMO_ENABLED = 'true'; process.env.NODE_ENV = 'production';
    assert.equal((await request('/demo/deposits', 'POST', { amount: 100000, method: 'demo_bank' })).status, 403);
    process.env.NODE_ENV = 'test';
    delete process.env.NODE_ENV;
    assert.equal((await request('/demo/deposits', 'POST', { amount: 100000, method: 'demo_bank' })).status, 403);
    process.env.NODE_ENV = 'test';
    for (const amount of [-10000, 0, 9999, 10000.5, 20000001, '50000']) assert.equal((await request('/demo/deposits', 'POST', { amount, method: 'demo_bank' })).status, 400);
    const key = randomUUID();
    const deposit = await request('/demo/deposits', 'POST', { amount: 1000000, method: 'demo_bank', userId: 'real-user', balance: 999999 }, 'demo-alice', key);
    assert.equal(deposit.status, 202); assert.equal(deposit.body.transaction.status, 'PENDING');
    const id = deposit.body.transaction.id;
    assert.equal((await overview()).demo.balance, 0);
    assert.equal((await request('/demo/deposits', 'POST', { amount: 1000000, method: 'demo_bank' }, 'demo-alice', key)).body.transaction.id, id);
    assert.equal((await request('/demo/deposits', 'POST', { amount: 50000, method: 'demo_bank' }, 'demo-alice', key)).status, 409);
    assert.equal((await request(`/demo/transactions/${id}`, 'GET', null, 'demo-bob')).status, 404);
    assert.equal((await settle(id, 'SUCCESS', 'demo-alice')).status, 403);
    const forgedRole = await fetch(`http://127.0.0.1:${server.address().port}/api/wallet/demo/admin/transactions/${id}/settle`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: 'demo-alice', role: 'admin' }, JWT_SECRET)}` }, body: JSON.stringify({ status: 'SUCCESS' }) });
    assert.equal(forgedRole.status, 403, 'stored role must also be admin');
    assert.equal((await settle(id)).status, 200); assert.equal((await settle(id)).status, 200);
    assert.equal((await settle(id, 'FAILED')).status, 409);
    assert.equal((await overview()).demo.balance, 1000000);
    assert.equal((await request(`/demo/transactions/${id}`)).body.ledger.length, 1);
    const failed = (await request('/demo/deposits', 'POST', { amount: 50000, method: 'demo_card' })).body.transaction;
    assert.equal((await settle(failed.id, 'FAILED')).body.transaction.status, 'FAILED');
    const cancelled = (await request('/demo/deposits', 'POST', { amount: 50000, method: 'demo_card' })).body.transaction;
    assert.equal((await request(`/demo/transactions/${cancelled.id}/cancel`, 'POST', { status: 'SUCCESS' })).body.transaction.status, 'CANCELLED');
    assert.equal((await overview()).demo.balance, 1000000);
    const bank = (await request('/demo/banks', 'POST', { label: 'My demo bank' })).body.bank;
    assert.ok(bank.demo_reference.startsWith('DEMO-')); assert.equal(bank.is_demo, true);
    assert.equal((await request('/demo/withdrawals', 'POST', { amount: 200000, bankId: bank.id }, 'demo-bob')).status, 400);
    const withdrawKey = randomUUID();
    const withdrawal = (await request('/demo/withdrawals', 'POST', { amount: 200000, bankId: bank.id }, 'demo-alice', withdrawKey)).body.transaction;
    await request('/demo/withdrawals', 'POST', { amount: 200000, bankId: bank.id }, 'demo-alice', withdrawKey);
    let state = await overview(); assert.equal(state.demo.balance, 1000000); assert.equal(state.demo.held, 200000); assert.equal(state.demo.available_balance, 800000);
    const competing = await Promise.all([request('/demo/withdrawals', 'POST', { amount: 700000, bankId: bank.id }), request('/demo/withdrawals', 'POST', { amount: 700000, bankId: bank.id })]);
    assert.equal(competing.filter(r => r.status === 202).length, 1);
    const held = competing.find(r => r.status === 202).body.transaction;
    assert.equal((await request(`/demo/transactions/${held.id}/cancel`, 'POST', {}, 'demo-bob')).status, 404);
    await request(`/demo/transactions/${held.id}/cancel`, 'POST', {});
    assert.equal((await overview()).demo.held, 200000);
    await settle(withdrawal.id, 'FAILED'); await settle(withdrawal.id, 'FAILED');
    state = await overview(); assert.equal(state.demo.held, 0); assert.equal(state.demo.balance, 1000000);
    const paid = (await request('/demo/withdrawals', 'POST', { amount: 50000, bankId: bank.id })).body.transaction;
    await settle(paid.id); assert.equal((await overview()).demo.balance, 950000);
    const target = (await request('/demo/recipient?q=0900000002')).body.recipient;
    assert.deepEqual(Object.keys(target).sort(), ['id', 'name']); assert.equal(target.id, 'demo-bob');
    await User.update({ phone: '0900000002' }, { where: { id: 'real-user' } });
    assert.equal((await request('/demo/recipient?q=0900000002')).status, 400, 'ambiguous phone must not pick an arbitrary recipient');
    assert.equal((await request('/demo/recipient?q=demo-bob')).body.recipient.id, 'demo-bob');
    assert.equal((await request('/demo/recipient?q=real-user')).status, 404);
    assert.equal((await request('/demo/transfers', 'POST', { amount: 10000, recipientId: 'demo-alice' })).status, 400);
    const transferKey = randomUUID();
    const transferPayload = { amount: 200000, recipientId: target.id, note: 'Demo transfer' };
    const transferred = await request('/demo/transfers', 'POST', transferPayload, 'demo-alice', transferKey);
    assert.equal(transferred.body.transaction.status, 'SUCCESS');
    await request('/demo/transfers', 'POST', transferPayload, 'demo-alice', transferKey);
    assert.equal((await overview()).demo.balance, 750000); assert.equal((await overview('demo-bob')).demo.balance, 200000);
    assert.equal((await request('/demo/transfers', 'POST', { amount: 800000, recipientId: target.id })).status, 409);
    const concurrentTransfers = await Promise.all([request('/demo/transfers', 'POST', { amount: 500000, recipientId: target.id }), request('/demo/transfers', 'POST', { amount: 500000, recipientId: target.id })]);
    assert.equal(concurrentTransfers.filter(r => r.status === 200).length, 1);
    assert.equal((await overview()).demo.balance, 250000); assert.equal((await overview('demo-bob')).demo.balance, 700000);
    assert.equal((await request('/demo/admin/pending')).status, 403);
    assert.equal((await request('/demo/transactions?page=-1')).status, 400);
    const history = (await request('/demo/transactions')).body;
    assert.ok(history.transactions.every(tx => tx.mode === 'demo' && tx.wallet_id === 'wallet-demo-alice'));
    assert.equal((await request('/demo/transactions', 'GET', null, 'demo-bob')).body.transactions.filter(tx => tx.type === 'transfer_in').length, 2);
    const pending = (await request('/demo/withdrawals', 'POST', { amount: 10000, bankId: bank.id })).body.transaction;
    const attempts = await Promise.all([settle(pending.id), settle(pending.id)]);
    assert.ok(attempts.some(r => r.status === 200)); await settle(pending.id);
    for (const userId of ['demo-alice', 'demo-bob', 'real-user', 'demo-admin']) {
      const wallet = await Wallet.findOne({ where: { user_id: userId } });
      assert.equal(wallet.balance, 123456); assert.equal(wallet.reserved_balance, 1000); assert.equal(wallet.green_points, 700); assert.equal(wallet.tier_points, 900);
      const ledger = await WalletLedger.findAll({ where: { wallet_id: wallet.id } });
      assert.equal(ledger.reduce((sum, row) => sum + row.delta_balance, 0), wallet.demo_balance || 0);
      assert.equal(ledger.reduce((sum, row) => sum + row.delta_held, 0), wallet.demo_held || 0);
      assert.ok((wallet.demo_balance || 0) >= (wallet.demo_held || 0) && (wallet.demo_held || 0) >= 0);
      if (['real-user', 'demo-admin'].includes(userId)) { assert.equal(wallet.demo_balance, undefined); assert.equal(wallet.demo_held, undefined); }
    }
    // Read through a separate MongoDB client, proving this survives page/process-local state.
    const { MongoClient } = require('mongodb'); const reader = new MongoClient(uri.toString());
    try { await reader.connect(); const persisted = await reader.db().collection(Wallet.collectionName).findOne({ user_id: 'demo-alice' }); assert.equal(persisted.demo_balance, 240000); } finally { await reader.close(); }
    assert.equal(await WalletLedger.count({ where: { transaction_id: id } }), 1);
    assert.equal(await WalletTransaction.count({ where: { id: transferred.body.transaction.id } }), 1);
    // Explicit all-user sandbox: owners may simulate their own pending requests only.
    process.env.WALLET_DEMO_ALL_USERS = 'true'; process.env.WALLET_DEMO_SELF_SETTLE = 'true';
    const openMode = await overview('real-user');
    assert.equal(openMode.demo.account_enabled, true); assert.equal(openMode.demo.can_simulate, true);
    const sandboxDeposit = (await request('/demo/deposits', 'POST', { amount: 50000, method: 'demo_bank' }, 'real-user')).body.transaction;
    assert.equal((await overview('real-user')).demo.balance, 0);
    const simulate = (actor, status = 'SUCCESS') => request(`/demo/transactions/${sandboxDeposit.id}/simulate`, 'POST', { status }, actor);
    assert.equal((await simulate('demo-bob')).status, 404);
    process.env.WALLET_DEMO_SELF_SETTLE = 'false'; assert.equal((await simulate('real-user')).status, 403);
    process.env.WALLET_DEMO_SELF_SETTLE = 'true'; process.env.NODE_ENV = 'production'; assert.equal((await simulate('real-user')).status, 403);
    process.env.NODE_ENV = 'test';
    assert.equal((await simulate('real-user')).body.transaction.status, 'SUCCESS');
    assert.equal((await simulate('real-user')).status, 200); assert.equal((await simulate('real-user', 'FAILED')).status, 409);
    assert.equal((await overview('real-user')).demo.balance, 50000);
    assert.equal((await Wallet.findByPk('wallet-real-user')).balance, 123456);
    assert.equal(await WalletLedger.count({ where: { transaction_id: sandboxDeposit.id } }), 1);
  } finally {
    if (server) await new Promise(r => server.close(r));
    if (connected && store.db.databaseName === database) await store.db.dropDatabase();
    await store.close();
  }
});
