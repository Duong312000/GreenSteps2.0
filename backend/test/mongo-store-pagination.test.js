const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MongoStore, FieldTypes } = require('../src/db/mongo-store');

test('repository applies pagination and excluded-field projection in MongoDB before reading rows', async () => {
  const calls = { skip: null, limit: null, projection: null };
  const cursor = {
    sort() { return this; },
    skip(value) { calls.skip = value; return this; },
    limit(value) { calls.limit = value; return this; },
    project(value) { calls.projection = value; return this; },
    async toArray() { return [{ id: 'u1', username: 'mai' }]; }
  };
  const store = new MongoStore('mongodb://127.0.0.1:27017/test-pagination');
  store.db = { collection: () => ({ find: () => cursor }) };
  store.authenticate = async () => {};
  store.options = () => ({});
  const users = store.define('User', { id: { type: FieldTypes.STRING }, username: { type: FieldTypes.STRING }, password_hash: { type: FieldTypes.STRING } });

  await users.findAll({ order: [['createdAt', 'DESC']], limit: 10, offset: 20, attributes: { exclude: ['password_hash'] } });

  assert.equal(calls.skip, 20);
  assert.equal(calls.limit, 10);
  assert.deepEqual(calls.projection, { password_hash: 0 });
  await store.client.close();
});
