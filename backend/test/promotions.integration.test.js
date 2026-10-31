// Real MongoDB + HTTP integration. Only uniquely named fixtures are removed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('../src/config/env');
const app = require('../src/app');
const {
  User,
  Vender,
  GreenService,
  PartnerCampaign: Campaign,
  store,
} = require('../src/models');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
const jwt = require('jsonwebtoken');

test('partner promotions: real Mongo persistence, CRUD, ownership, validation and history', async (t) => {
  const tag = 'promotion-test-' + randomUUID();
  const owner = tag + '-a',
    other = tag + '-b',
    traveler = tag + '-c';
  let server;
  const token = (id) =>
    jwt.sign({ id, role: 'provider' }, JWT_SECRET, { expiresIn: '5m' });
  try {
    await store.authenticate();
    for (const id of [owner, other, traveler]) {
      await User.create({
        id,
        username: id,
        email: id + '@example.invalid',
        password_hash: 'not-used',
        role: id === traveler ? 'traveler' : 'provider',
        is_verified: true,
      });
      await Vender.create({ id: 'v-' + id, user_id: id });
    }
    for (const id of [owner, other])
      await GreenService.create({
        id: 's-' + id,
        vender_id: 'v-' + id,
        name_service: 'Service ' + id,
        type: 'stay',
        cost: 500000,
        destination: 'Test',
        status: 'active',
      });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/partner/promotions`;
    async function api(method, path = '', body, id = owner) {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(id ? { Authorization: 'Bearer ' + token(id) } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, ...(await response.json()) };
    }
    const draft = (type) => ({
      name: 'Green weekend ' + type,
      type,
      service_id: 's-' + owner,
      start_at: new Date(Date.now() + 600000).toISOString(),
      end_at: new Date(Date.now() + 86400000).toISOString(),
      package: 'featured',
      budget: 150000,
      discount_type: 'percent',
      discount_value: 10,
      min_order: 100000,
      usage_limit: 10,
      code: 'T' + randomUUID().replace(/-/g, '').slice(0, 20),
    });
    assert.equal((await api('GET', '', null, null)).status, 401);
    assert.equal((await api('GET', '', null, traveler)).status, 403);
    assert.equal((await api('GET', '/options')).services.length, 1);
    const created = [];
    for (const type of ['promotion', 'flash_sale', 'voucher']) {
      const body = draft(type);
      const result = await api('POST', '', {
        ...body,
        user_id: other,
        used_count: 9,
        views: 999,
      });
      assert.equal(result.status, 201, JSON.stringify(result));
      const row = result.item;
      created.push(row);
      assert.equal(row.user_id, owner);
      assert.equal(row.used_count, 0);
      assert.equal(row.views, 0);
      assert.equal(
        (await Campaign.collection.findOne({ id: row.id })).name,
        body.name,
      );
      assert.equal((await api('GET', '/' + row.id)).item.name, body.name);
      for (const [method, path, payload] of [
        ['GET', '/' + row.id],
        ['GET', '/' + row.id + '/report'],
        ['PUT', '/' + row.id, body],
        ['PATCH', '/' + row.id + '/status', { status: 'paused', version: 0 }],
        ['DELETE', '/' + row.id, { version: 0 }],
      ]) {
        assert.equal((await api(method, path, payload, other)).status, 404);
      }
      assert.equal(
        (
          await api('PUT', '/' + row.id, {
            ...body,
            name: 'Updated ' + type,
            version: 0,
          })
        ).status,
        200,
      );
      assert.equal(
        (await api('PUT', '/' + row.id, { ...body, version: 0 })).status,
        409,
      );
      let current = (await api('GET', '/' + row.id)).item;
      assert.equal(current.name, 'Updated ' + type);
      assert.equal(
        (
          await api('PATCH', '/' + row.id + '/status', {
            status: 'paused',
            version: current.version,
          })
        ).status,
        200,
      );
      current = (await api('GET', '/' + row.id)).item;
      assert.equal(current.effective_status, 'paused');
      assert.equal(
        (
          await api('PATCH', '/' + row.id + '/status', {
            status: 'active',
            version: current.version,
          })
        ).status,
        200,
      );
      assert.equal(
        (await api('GET', '/' + row.id + '/report')).report.bookings,
        0,
      );
    }
    assert.equal((await api('GET', '?limit=2&page=1')).items.length, 2);
    assert.equal((await api('GET', '?limit=2&page=2')).items.length, 1);
    assert.equal((await api('GET', '?type=voucher')).total, 1);
    assert.equal((await api('GET', '?q=Updated')).total, 3);
    assert.equal((await api('GET', '?q=Service')).total, 3);
    assert.equal((await api('GET', '?status=scheduled')).total, 3);
    assert.equal((await api('GET', '?status=expired')).total, 0);
    assert.equal((await api('GET', '?status=active')).total, 0);
    assert.equal((await api('GET', '', null, other)).total, 0);
    assert.equal(
      (
        await api('POST', '', {
          ...draft('voucher'),
          code: created[2].code.toLowerCase(),
        })
      ).status,
      409,
    );
    for (const body of [
      { ...draft('promotion'), budget: 1 },
      { ...draft('flash_sale'), discount_value: 101 },
      { ...draft('voucher'), usage_limit: 0 },
      { ...draft('voucher'), usage_limit: 1.5 },
      { ...draft('voucher'), code: 'bad code' },
      { ...draft('promotion'), start_at: 'invalid' },
      {
        ...draft('flash_sale'),
        discount_type: 'fixed',
        discount_value: 600000,
      },
    ]) {
      assert.equal((await api('POST', '', body)).status, 400);
    }
    assert.equal(
      (
        await api('POST', '', {
          ...draft('promotion'),
          service_id: 's-' + other,
        })
      ).status,
      403,
    );
    // Transactions cannot be reset by client payloads. Consumed terms are immutable.
    const voucher = created[2];
    await Campaign.collection.updateOne(
      { id: voucher.id },
      { $set: { used_count: 2, bookings: 1 }, $inc: { _rev: 1 } },
    );
    let current = (await api('GET', '/' + voucher.id)).item;
    assert.equal(
      (await api('PUT', '/' + voucher.id, { ...current, discount_value: 20 }))
        .status,
      400,
    );
    assert.equal(
      (await api('PUT', '/' + voucher.id, { ...current, usage_limit: 1 }))
        .status,
      400,
    );
    assert.equal(
      (
        await api('PUT', '/' + voucher.id, {
          ...current,
          name: 'Valid update',
          used_count: 0,
        })
      ).status,
      200,
    );
    assert.equal((await api('GET', '/' + voucher.id)).item.used_count, 2);
    current = (await api('GET', '/' + voucher.id)).item;
    assert.equal(
      (await api('DELETE', '/' + voucher.id, { version: current.version }))
        .status,
      200,
    );
    const archived = await Campaign.collection.findOne({ id: voucher.id });
    assert.ok(archived.archived_at);
    assert.equal(archived.used_count, 2);
    assert.equal(archived.status, 'cancelled');
    assert.equal((await api('GET', '/' + voucher.id)).status, 404);
    current = (await api('GET', '/' + created[0].id)).item;
    assert.equal(
      (
        await api('PATCH', '/' + current.id + '/status', {
          status: 'cancelled',
          version: current.version,
        })
      ).status,
      200,
    );
    current = (await api('GET', '/' + current.id)).item;
    assert.equal(
      (
        await api('PATCH', '/' + current.id + '/status', {
          status: 'active',
          version: current.version,
        })
      ).status,
      409,
    );
    assert.equal((await api('GET', '?status=cancelled')).total, 1);
    assert.equal((await api('GET')).total, 2);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (store.db) {
      await Campaign.collection.deleteMany({
        user_id: { $in: [owner, other, traveler] },
      });
      await GreenService.collection.deleteMany({
        id: { $in: ['s-' + owner, 's-' + other] },
      });
      await Vender.collection.deleteMany({
        user_id: { $in: [owner, other, traveler] },
      });
      await User.collection.deleteMany({
        id: { $in: [owner, other, traveler] },
      });
    }
    await store.close();
  }
});
