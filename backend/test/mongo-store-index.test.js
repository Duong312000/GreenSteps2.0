const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MongoStore, FieldTypes } = require('../src/db/mongo-store');

test('sync reports duplicate review booking IDs before attempting a unique index', async () => {
  const store = new MongoStore('mongodb://127.0.0.1:27018/test');
  let indexAttempts = 0;
  try {
    store.authenticate = async () => {};
    const review = store.define('CommentPost', {
      id: { type: FieldTypes.STRING, primaryKey: true },
      booking_id: { type: FieldTypes.STRING, unique: true, allowNull: true }
    });
    const collection = {
      listIndexes: () => ({ toArray: async () => [{ name: '_id_', key: { _id: 1 } }, { name: 'booking_id_1', key: { booking_id: 1 } }] }),
      aggregate(pipeline) {
      assert.deepEqual(pipeline[0], { $match: { booking_id: { $type: 'string' } } });
      return { toArray: async () => [{ _id: 'booking-duplicate', count: 2 }] };
      },
      createIndex: async () => { indexAttempts++; }
    };
    store.db = { collection: () => collection };

    await assert.rejects(store.sync(), /duplicate booking_id values.*booking-duplicate/i);
    assert.equal(indexAttempts, 0);
  } finally {
    await store.close();
  }
});

test('sync replaces a legacy non-unique booking index only after confirming there are no duplicates', async () => {
  const store = new MongoStore('mongodb://127.0.0.1:27018/test');
  const actions = [];
  try {
    store.authenticate = async () => {};
    const review = store.define('CommentPost', {
      id: { type: FieldTypes.STRING, primaryKey: true },
      booking_id: { type: FieldTypes.STRING, unique: true, allowNull: true }
    });
    const collection = {
      aggregate() {
        actions.push('check-duplicates');
        return { toArray: async () => [] };
      },
      listIndexes() {
        return { toArray: async () => [
          { name: '_id_', key: { _id: 1 } },
          { name: 'booking_id_1', key: { booking_id: 1 }, unique: false }
        ] };
      },
      dropIndex: async name => { actions.push(`drop:${name}`); },
      createIndex: async (keys, options) => { actions.push({ create: keys, options }); }
    };
    store.db = { collection: () => collection };

    await store.sync();
    assert.ok(actions.indexOf('check-duplicates') < actions.indexOf('drop:booking_id_1'));
    const uniqueIndex = actions.find(action => typeof action === 'object' && action.options?.unique && action.create.booking_id === 1);
    assert.deepEqual(uniqueIndex.create, { booking_id: 1 });
  } finally {
    await store.close();
  }
});

test('sync does not remove an old booking index when duplicate booking IDs exist', async () => {
  const store = new MongoStore('mongodb://127.0.0.1:27018/test');
  let dropped = false;
  try {
    store.authenticate = async () => {};
    const review = store.define('CommentPost', {
      id: { type: FieldTypes.STRING, primaryKey: true },
      booking_id: { type: FieldTypes.STRING, unique: true, allowNull: true }
    });
    store.db = { collection: () => ({
      listIndexes: () => ({ toArray: async () => [{ name: '_id_', key: { _id: 1 } }, { name: 'booking_id_1', key: { booking_id: 1 } }] }),
      aggregate: () => ({ toArray: async () => [{ _id: 'duplicate-booking', count: 2 }] }),
      listIndexes: () => ({ toArray: async () => [{ name: '_id_', key: { _id: 1 } }, { name: 'booking_id_1', key: { booking_id: 1 } }] }),
      dropIndex: async () => { dropped = true; },
      createIndex: async () => {}
    }) };

    await assert.rejects(store.sync(), /duplicate booking_id values.*duplicate-booking/i);
    assert.equal(dropped, false);
  } finally {
    await store.close();
  }
});

test('sync treats a not-yet-created review collection as having no indexes', async () => {
  const store = new MongoStore('mongodb://127.0.0.1:27019/test');
  let createdIndexes = 0;
  try {
    store.authenticate = async () => {};
    store.define('CommentPost', {
      id: { type: FieldTypes.STRING, primaryKey: true },
      booking_id: { type: FieldTypes.STRING, unique: true, allowNull: true }
    });
    store.db = { collection: () => ({
      listIndexes() {
        const error = new Error('ns does not exist');
        error.code = 26;
        error.codeName = 'NamespaceNotFound';
        throw error;
      },
      aggregate: () => ({ toArray: async () => [] }),
      createIndex: async () => { createdIndexes++; }
    }) };

    await store.sync();
    assert.equal(createdIndexes, 2);
  } finally {
    await store.close();
  }
});
