const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op, filter } = require('../src/db/mongo-store');
const { identity, convert } = require('../scripts/migrate-postgres');

test('queries escape search text, preserve ranges/nulls and reject Mongo operator injection', () => {
  const query = filter({ [Op.or]: [{ destination: { [Op.iLike]: '%Đà Lạt (x).*%' } }, { user_id: null }], createdAt: { [Op.between]: [1, 2] }, id: { [Op.in]: [] } });
  assert.deepEqual(query.createdAt, { $gte: 1, $lte: 2 });
  const regex = new RegExp(query.$or[0].destination.$regex, 'i');
  assert.equal(regex.test('Tour ĐÀ LẠT (x).* hôm nay'), true);
  assert.equal(regex.test('Tour Đà Lạt xanything hôm nay'), false);
  assert.throws(() => filter({ username: { $ne: null } }), /Unsupported/);
  assert.throws(() => filter({ $where: 'code' }), /Invalid/);
});

test('migration preserves IDs, hashes composite keys and keeps DATE and JSON intact', () => {
  const row = { id: 'UG123', cost: '1234.50', date: '2026-10-24', details: { friends: ['a'] } };
  const result = convert(row, [{ column_name: 'cost', data_type: 'numeric' }], ['id']);
  assert.equal(result._id, 'UG123');
  assert.equal(result.cost, 1234.5);
  assert.equal(result.date, row.date);
  assert.deepEqual(result.details, row.details);
  assert.equal(identity({ a: 'x', b: 'y' }, ['a', 'b']), identity({ b: 'y', a: 'x' }, ['a', 'b']));
  assert.notEqual(identity({ a: 'x', b: 'y' }, ['a', 'b']), identity({ a: 'y', b: 'x' }, ['a', 'b']));
  assert.throws(() => identity(row, []), /primary key/);
});
