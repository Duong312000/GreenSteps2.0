const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { User } = require('../src/models');
const { authMiddleware, JWT_SECRET } = require('../src/middlewares/auth.middleware');
const authController = require('../src/controllers/auth.controller');
const bcrypt = require('bcrypt');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

async function withPatched(target, key, value, run) {
  const original = target[key]; target[key] = value;
  try { await run(); } finally { target[key] = original; }
}

test('authentication immediately rejects a token when its account has been suspended', async () => {
  const token = jwt.sign({ id: 'user-1', role: 'traveler' }, JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = response(); let nextCalled = false;
  await withPatched(User, 'findByPk', async () => ({ id: 'user-1', role: 'traveler', account_status: 'suspended' }), async () => {
    await authMiddleware(req, res, () => { nextCalled = true; });
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'AccountDisabled');
  assert.equal(nextCalled, false);
});

test('authentication refreshes the role from MongoDB instead of trusting an old admin token', async () => {
  const token = jwt.sign({ id: 'user-1', role: 'admin' }, JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = response(); let nextCalled = false;
  await withPatched(User, 'findByPk', async () => ({ id: 'user-1', username: 'mai', fullname: 'Mai', role: 'traveler', account_status: 'active' }), async () => {
    await authMiddleware(req, res, () => { nextCalled = true; });
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'traveler');
});

test('authentication projects only fields required for authorization and request context', async () => {
  const token = jwt.sign({ id: 'user-1', role: 'admin' }, JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = response(); let options;
  await withPatched(User, 'findByPk', async (_id, queryOptions) => {
    options = queryOptions;
    return { id: 'user-1', username: 'mai', fullname: 'Mai', role: 'admin', account_status: 'active' };
  }, async () => { await authMiddleware(req, res, () => {}); });
  assert.deepEqual(options.attributes, ['id', 'username', 'fullname', 'role', 'account_status']);
});

test('login rejects a suspended account even when its password is correct', async () => {
  const user = { id: 'user-2', username: 'mai', role: 'traveler', is_verified: true, account_status: 'suspended', password_hash: await bcrypt.hash('GoodPass123!', 4) };
  const original = User.findOne;
  User.findOne = async () => user;
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, cookie() {} };
  try { await authController.login({ body: { identifier: 'mai', password: 'GoodPass123!' } }, res, error => { throw error; }); }
  finally { User.findOne = original; }
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'ACCOUNT_DISABLED');
});

test('successful login persists last_login_at before returning an authentication token', async () => {
  const user = { id: 'user-3', username: 'linh', role: 'traveler', is_verified: true, account_status: 'active', password_hash: await bcrypt.hash('GoodPass123!', 4), async save() { this.saved = true; } };
  const original = User.findOne;
  User.findOne = async () => user;
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, cookie() {} };
  try { await authController.login({ body: { identifier: 'linh', password: 'GoodPass123!' } }, res, error => { throw error; }); }
  finally { User.findOne = original; }
  assert.equal(res.body.success, true);
  assert.equal(user.saved, true);
  assert.ok(user.last_login_at instanceof Date);
});

test('legacy account without account_status can still log in and persist its last login', async () => {
  const store = User.store;
  const originalDb = store.db;
  const originalAuthenticate = store.authenticate;
  const saved = [];
  const legacyUser = {
    _id: 'user-legacy', _rev: 0, id: 'user-legacy', username: 'duong',
    role: 'traveler', is_verified: true,
    email: 'duong@example.com', password_hash: await bcrypt.hash('123456', 4)
  };
  const collection = {
    find: () => ({ sort() { return this; }, project() { return this; }, limit() { return this; }, async toArray() { return [{ ...legacyUser }]; } }),
    async updateOne(query, update) {
      saved.push(update.$set);
      Object.assign(legacyUser, update.$set);
      return { matchedCount: 1 };
    }
  };
  store.authenticate = async () => {};
  store.db = { collection: () => collection };
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, cookie() {} };
  try {
    await authController.login({ body: { identifier: 'duong', password: '123456' } }, res, error => { throw error; });
  } finally {
    store.db = originalDb;
    store.authenticate = originalAuthenticate;
  }
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(saved[0].last_login_at instanceof Date);
});
