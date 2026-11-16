const { test } = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');

let controller;
try { controller = require('../src/controllers/admin-settings.controller'); } catch { controller = null; }

function response() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function invoke(handler, req) {
  const res = response();
  await handler(req, res, error => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  return res;
}

function repository(initial = []) {
  const rows = new Map(initial.map(row => [row.id, { ...row }]));
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && '$in' in value) return value.$in.includes(row[key]);
    return row[key] === value;
  });
  const repo = {
    rows,
    async findAll(options = {}) {
      let result = [...rows.values()].filter(row => matches(row, options.where));
      if (options.order) {
        const [key, direction] = options.order[0];
        result.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'DESC' ? -1 : 1));
      }
      if (options.offset) result = result.slice(options.offset);
      if (options.limit !== undefined) result = result.slice(0, options.limit);
      return result;
    },
    async findByPk(id) {
      const row = rows.get(id);
      if (!row) return null;
      return {
        ...row,
        async update(values) { Object.assign(row, values); Object.assign(this, values); return this; },
        async save() { rows.set(id, row); return this; }
      };
    },
    async create(value) {
      if (rows.has(value.id)) throw new Error('duplicate id');
      const row = { ...value };
      rows.set(row.id, row);
      return row;
    },
    async count(options = {}) { return [...rows.values()].filter(row => matches(row, options.where)).length; },
    async update(values, options = {}) {
      let count = 0;
      for (const row of rows.values()) if (matches(row, options.where)) { Object.assign(row, values); count++; }
      return [count];
    }
  };
  repo.collection = {
    async updateOne(filter, update) {
      const row = rows.get(filter.id);
      if (!row || row.version !== filter.version) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(row, update.$set || {});
      for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = Number(row[key] || 0) + amount;
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };
  repo.snapshot = () => new Map([...rows].map(([id, row]) => [id, { ...row }]));
  repo.restore = snapshot => { rows.clear(); for (const [id, row] of snapshot) rows.set(id, row); };
  return repo;
}

function harness({ settings = { id: 'booking_pricing', discount_percent: 0, service_fee_vnd: 0, service_fee_per_guest: false, deposit_percent: 0, collect_deposit_for: [], version: 2 }, services = [], categories = [], addons = [] } = {}) {
  const ServiceCategory = repository(categories);
  const GreenService = repository(services);
  const BookingSetting = repository([settings]);
  const BookingAddon = repository(addons);
  const AdminConfigAuditLog = repository();
  const serviceCategoryService = {
    async ensureServiceCategories() { return ServiceCategory.findAll(); },
    async countServicesByCategory() { return Object.fromEntries([...ServiceCategory.rows.keys()].map(id => [id, 0])); }
  };
  const pricingService = {
    async getBookingPricingSettings() { return BookingSetting.findByPk('booking_pricing'); }
  };
  const repositories = [ServiceCategory, GreenService, BookingSetting, BookingAddon, AdminConfigAuditLog];
  const store = {
    transactions: 0,
    options() { return {}; },
    async transaction(callback) {
      this.transactions++;
      const snapshots = repositories.map(repo => repo.snapshot());
      try { return await callback({}); }
      catch (error) { repositories.forEach((repo, index) => repo.restore(snapshots[index])); throw error; }
    }
  };
  const instance = controller?.createAdminSettingsController({ ServiceCategory, GreenService, BookingSetting, BookingAddon, AdminConfigAuditLog, serviceCategoryService, pricingService, store });
  return { instance, ServiceCategory, GreenService, BookingSetting, BookingAddon, AdminConfigAuditLog, store };
}

test('Admin settings controller exposes category, booking, add-on, and audit handlers', () => {
  assert.ok(controller, 'admin-settings.controller.js should exist');
  const instance = harness().instance;
  for (const name of ['listCategories', 'createCategory', 'updateCategory', 'archiveCategory', 'getBookingSettings', 'updateBookingPricing', 'createAddon', 'updateAddon', 'listAudit']) {
    assert.equal(typeof instance[name], 'function', `${name} should be exported`);
  }
});

test('non-admin cannot read or mutate settings', async () => {
  const h = harness();
  const read = await invoke(h.instance.getBookingSettings, { user: { id: 'provider-1', role: 'provider' }, query: {} });
  const write = await invoke(h.instance.updateBookingPricing, { user: { id: 'provider-1', role: 'provider' }, body: { expectedVersion: 2, reason: 'test' } });
  assert.equal(read.statusCode, 403);
  assert.equal(write.statusCode, 403);
  assert.equal(h.store.transactions, 0);
});

test('pricing update rejects a stale version and returns the current settings without auditing', async () => {
  const h = harness();
  const res = await invoke(h.instance.updateBookingPricing, {
    user: { id: 'admin-1', role: 'admin' },
    body: { expectedVersion: 1, discount_percent: 5, reason: 'Update offer' }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CONFIG_VERSION_CONFLICT');
  assert.equal(res.body.settings.version, 2);
  assert.equal(h.AdminConfigAuditLog.rows.size, 0);
  assert.equal(h.BookingSetting.rows.get('booking_pricing').discount_percent, 0);
});

test('successful pricing update increments version and audits exact actor and before/after values', async () => {
  const h = harness();
  const res = await invoke(h.instance.updateBookingPricing, {
    user: { id: 'admin-9', role: 'admin' },
    body: { expectedVersion: 2, discount_percent: 5, service_fee_vnd: 25_000, reason: 'Approved seasonal policy' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.settings.version, 3);
  assert.equal(res.body.settings.discount_percent, 5);
  assert.equal(res.body.settings.service_fee_vnd, 25_000);
  assert.equal(h.AdminConfigAuditLog.rows.size, 1);
  const audit = [...h.AdminConfigAuditLog.rows.values()][0];
  assert.equal(audit.actor_id, 'admin-9');
  assert.ok(Number.isFinite(new Date(audit.createdAt).getTime()));
  assert.equal(audit.previous_state.version, 2);
  assert.equal(audit.previous_state.discount_percent, 0);
  assert.equal(audit.new_state.version, 3);
  assert.equal(audit.new_state.discount_percent, 5);
  assert.equal(audit.reason, 'Approved seasonal policy');
});

test('pricing update rolls back when audit insert fails', async () => {
  const h = harness();
  const originalCreate = h.AdminConfigAuditLog.create;
  h.AdminConfigAuditLog.create = async () => { throw new Error('audit unavailable'); };
  const res = await invoke(h.instance.updateBookingPricing, {
    user: { id: 'admin-1', role: 'admin' },
    body: { expectedVersion: 2, discount_percent: 8, reason: 'Set policy' }
  });
  h.AdminConfigAuditLog.create = originalCreate;
  assert.equal(res.statusCode, 500);
  assert.equal(h.BookingSetting.rows.get('booking_pricing').version, 2);
  assert.equal(h.BookingSetting.rows.get('booking_pricing').discount_percent, 0);
});

test('category cannot be archived while an active service still uses it', async () => {
  const h = harness({
    categories: [{ id: 'cat-food', name: 'Ăn uống', active: true, sort_order: 1 }],
    services: [{ id: 'service-1', category_id: 'cat-food', status: 'active', current_data: { category: 'Ăn uống' } }]
  });
  const res = await invoke(h.instance.archiveCategory, {
    user: { id: 'admin-1', role: 'admin' }, params: { id: 'cat-food' }, body: { reason: 'Retire category' }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(h.ServiceCategory.rows.get('cat-food').active, true);
  assert.equal(h.AdminConfigAuditLog.rows.size, 0);
});

test('add-on creation persists VND integer and writes an audit record', async () => {
  const h = harness();
  const res = await invoke(h.instance.createAddon, {
    user: { id: 'admin-2', role: 'admin' },
    body: { id: 'bike', name: 'Bike', unit_price: 75_000, active: true, reason: 'Add transport option' }
  });
  assert.equal(res.statusCode, 201);
  assert.equal(h.BookingAddon.rows.get('bike').unit_price, 75_000);
  assert.equal([...h.AdminConfigAuditLog.rows.values()][0].actor_id, 'admin-2');
});
