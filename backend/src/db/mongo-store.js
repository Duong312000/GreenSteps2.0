// MongoDB repositories preserve existing IDs, associations and API response shapes.
// This query vocabulary is internal: no SQL statements or SQL driver run here.
const { MongoClient } = require('mongodb');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { isDeepStrictEqual } = require('node:util');
const Op = Object.fromEntries(['or', 'and', 'in', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'like', 'iLike'].map(k => [k, Symbol(k)]));
const FieldTypes = Object.fromEntries(['TEXT', 'UUID', 'BOOLEAN', 'INTEGER', 'DOUBLE', 'DATE', 'DATEONLY', 'JSONB', 'VIRTUAL'].map(k => [k, k]));
FieldTypes.STRING = () => 'STRING';
FieldTypes.ENUM = (...values) => ({ enum: values });
FieldTypes.UUIDV4 = randomUUID;
FieldTypes.NOW = () => new Date();
const failure = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function filter(where = {}) {
  const result = {};
  for (const key of Reflect.ownKeys(where)) {
    const value = where[key];
    if (key === Op.or || key === Op.and) {
      result[key === Op.or ? '$or' : '$and'] = value.length ? value.map(filter) : [key === Op.or ? { _id: { $in: [] } } : {}];
      continue;
    }
    if (typeof key !== 'string' || key.startsWith('$') || key.includes('\0')) throw failure('Invalid query field');
    if (value === undefined) throw failure(`Undefined query value: ${key}`);
    if (Array.isArray(value)) { result[key] = { $in: value }; continue; }
    if (!value || typeof value !== 'object' || value instanceof Date) { result[key] = value; continue; }
    const expression = {};
    for (const operator of Reflect.ownKeys(value)) {
      const operand = value[operator];
      if (operator === Op.between) { expression.$gte = operand[0]; expression.$lte = operand[1]; }
      else if (operator === Op.like || operator === Op.iLike) {
        const pattern = String(operand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
        expression.$regex = `^${pattern}$`;
        if (operator === Op.iLike) expression.$options = 'i';
      } else {
        const name = Object.keys(Op).find(k => Op[k] === operator);
        if (!['in', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(name)) throw failure('Unsupported query operator');
        expression[`$${name}`] = operand;
      }
    }
    result[key] = expression;
  }
  return result;
}
function plural(name) {
  if (name === 'ScheduleActivity') return 'ScheduleActivities';
  if (name === 'CPSS' || name === 'CPGS') return `${name}es`;
  return `${name}s`;
}

class Record {
  constructor(model, data) {
    Object.defineProperties(this, {
      model: { value: model }, store: { value: model.store },
      original: { value: structuredClone(data), writable: true },
      dataValues: { get: () => this.toJSON() }
    });
    Object.assign(this, data);
    for (const [key, field] of Object.entries(model.fields)) {
      if (field.type === FieldTypes.VIRTUAL) Object.defineProperty(this, key, { enumerable: true, get: field.get });
    }
  }
  getDataValue(key) { return this[key]; }
  changed() { /* Nested JSON is compared on save. */ }
  toJSON() {
    const result = {};
    for (const [key, value] of Object.entries(this)) {
      if (key === '_id' || key === '_rev') continue;
      result[key] = value instanceof Record ? value.toJSON() : Array.isArray(value) ? value.map(v => v instanceof Record ? v.toJSON() : v) : value;
    }
    return result;
  }
  async save(options = {}) {
    const changes = {};
    for (const key of Object.keys(this.model.fields)) {
      if (this.model.fields[key].type === FieldTypes.VIRTUAL || this[key] === undefined) continue;
      if (!isDeepStrictEqual(this[key], this.original[key])) changes[key] = this[key];
    }
    if (!Object.keys(changes).length) return this;
    const update = this.model.prepare(changes, false);
    this.model.validate({ ...this.original, ...update });
    const query = { _id: this._id, _rev: this.original._rev ?? { $exists: false } };
    const result = await this.model.collection.updateOne(query, { $set: update, $inc: { _rev: 1 } }, this.store.options(options));
    if (!result.matchedCount) throw failure('Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.', 409);
    Object.assign(this, update, { _rev: (this.original._rev || 0) + 1 });
    this.original = { ...this.original, ...update, _rev: this._rev };
    return this;
  }
  async update(values, options) { Object.assign(this, values); return this.save(options); }
  async destroy(options = {}) { return this.model.destroy({ ...options, where: { id: this.id }, individualHooks: true }); }
}

class Repository {
  constructor(store, name, fields, settings) {
    Object.assign(this, { store, name, fields: { ...fields }, associations: [], hooks: {}, defaultScope: {} });
    this.tableName = settings.tableName || plural(name);
    this.collectionName = `${store.prefix}${this.tableName.toLowerCase()}`;
    this.timestamps = settings.underscored ? ['created_at', 'updated_at'] : ['createdAt', 'updatedAt'];
    for (const key of this.timestamps) this.fields[key] = { type: FieldTypes.DATE };
    if (!this.fields.id) this.fields.id = { type: FieldTypes.UUID, defaultValue: randomUUID };
    this.fields.id.allowNull = false;
  }
  get collection() { return this.store.db.collection(this.collectionName); }
  relation(kind, target, options) {
    this.associations.push({ kind, target, ...options, as: options.as || (['many', 'junction'].includes(kind) ? plural(target.name) : target.name) });
    if (kind === 'junction') {
      for (const key of [options.foreignKey, options.otherKey]) options.through.fields[key] = { type: FieldTypes.STRING };
      options.through.junctionKeys = [options.foreignKey, options.otherKey];
    } else {
      const owner = kind === 'belongs' ? this : target;
      owner.fields[options.foreignKey] ||= { type: FieldTypes.STRING };
    }
    if (kind === 'one') target.uniqueKeys = [...(target.uniqueKeys || []), options.foreignKey];
  }
  hasMany(target, options) { this.relation('many', target, options); }
  hasOne(target, options) { this.relation('one', target, options); }
  belongsTo(target, options) { this.relation('belongs', target, options); }
  belongsToMany(target, options) { this.relation('junction', target, options); }
  addHook(name, hook) { (this.hooks[name] ||= []).push(hook); }
  addScope(name, value) { if (name === 'defaultScope') this.defaultScope = value; }
  async hook(name, record, options) { for (const hook of this.hooks[name] || []) await hook(record, options); }
  prepare(values, create = true) {
    const data = {};
    for (const [key, field] of Object.entries(this.fields)) {
      if (field.type === FieldTypes.VIRTUAL) continue;
      let value = values[key];
      if (value === undefined && create && field.defaultValue !== undefined) value = typeof field.defaultValue === 'function' ? field.defaultValue() : structuredClone(field.defaultValue);
      if (value === undefined) continue;
      if (value !== null) {
        if (field.type === FieldTypes.DATE) value = new Date(value);
        if (field.type === FieldTypes.DATEONLY) value = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
        if (field.type === FieldTypes.DOUBLE || field.type === FieldTypes.INTEGER) value = Number(value);
      }
      data[key] = value;
    }
    if (create) data[this.timestamps[0]] ||= new Date();
    data[this.timestamps[1]] = new Date();
    return data;
  }
  validate(data) {
    for (const [key, field] of Object.entries(this.fields)) {
      const value = data[key];
      if (field.allowNull === false && value == null) throw failure(`${this.name}.${key} is required`);
      if (value == null) continue;
      if (field.type?.enum && !field.type.enum.includes(value)) throw failure(`${this.name}.${key} is invalid`);
      if ([FieldTypes.STRING, 'STRING', FieldTypes.TEXT, FieldTypes.UUID].includes(field.type) && typeof value !== 'string') throw failure(`${this.name}.${key} must be a string`);
      if (field.type === FieldTypes.BOOLEAN && typeof value !== 'boolean') throw failure(`${this.name}.${key} must be a boolean`);
      if ([FieldTypes.DOUBLE, FieldTypes.INTEGER].includes(field.type) && (!Number.isFinite(value) || (field.type === FieldTypes.INTEGER && !Number.isInteger(value)))) throw failure(`${this.name}.${key} must be numeric`);
      if (field.type === FieldTypes.DATE && Number.isNaN(value.getTime())) throw failure(`${this.name}.${key} must be a date`);
      if (field.validate?.min !== undefined && value < field.validate.min) throw failure(`${this.name}.${key} is below minimum`);
      if (field.validate?.minMagnitude !== undefined && Math.abs(value) < field.validate.minMagnitude) throw failure(`${this.name}.${key} is below minimum magnitude`);
      if (field.validate?.max !== undefined && value > field.validate.max) throw failure(`${this.name}.${key} is above maximum`);
    }
  }
  async create(values, options = {}) {
    await this.store.authenticate();
    const data = this.prepare(values);
    this.validate(data);
    Object.assign(data, { _id: String(data.id), _rev: 0 });
    await this.collection.insertOne(data, this.store.options(options));
    const record = new Record(this, data);
    await this.hook('afterCreate', record, options);
    return record;
  }
  async bulkCreate(rows, options = {}) {
    const result = [];
    for (const row of rows) result.push(await this.create(row, options));
    return result;
  }
  async findByPk(id, options = {}) { return id == null ? null : this.findOne({ ...options, where: { id } }); }
  async findOne(options = {}) { return (await this.findAll({ ...options, limit: 1 }))[0] || null; }
  async findAll(options = {}) {
    await this.store.authenticate();
    const query = filter(options.where);
    if (options.distinctField) return (await this.collection.distinct(options.distinctField, query, this.store.options(options))).map(value => ({ [options.distinctField]: value }));
    if (Array.isArray(options.attributes) && options.attributes.some(Array.isArray)) {
      const distinct = options.attributes.find(([expr]) => expr?.fn === 'DISTINCT');
      if (distinct) return (await this.collection.distinct(distinct[0].column, query, this.store.options(options))).map(value => ({ [distinct[1]]: value }));
      const group = { _id: null };
      for (const [expr, alias] of options.attributes) {
        if (expr.fn === 'AVG') group[alias] = { $avg: `$${expr.column}` };
        else if (expr.fn === 'COUNT') group[alias] = { $sum: 1 };
        else throw failure('Unsupported aggregation');
      }
      const [row] = await this.collection.aggregate([{ $match: query }, { $group: group }], this.store.options(options)).toArray();
      return [{ dataValues: row || {} }];
    }
    const cursor = this.collection.find(query, this.store.options(options));
    if (options.order) cursor.sort(Object.fromEntries(options.order.map(([key, direction]) => [key, String(direction).toUpperCase() === 'DESC' ? -1 : 1])));
    let rows = (await cursor.toArray()).map(data => new Record(this, this.normalizeRead(data)));
    // Batch associations before pagination: required children must filter parents.
    for (const spec of options.include || this.defaultScope.include || []) rows = await this.include(rows, spec, options);
    if (options.offset) rows = rows.slice(options.offset);
    if (options.limit !== undefined) rows = rows.slice(0, options.limit);
    if (Array.isArray(options.attributes)) {
      for (const row of rows) for (const key of Object.keys(row)) if (!options.attributes.includes(key) && !['_id', '_rev'].includes(key) && !this.associations.some(a => a.as === key)) delete row[key];
    } else if (options.attributes?.exclude) {
      for (const row of rows) for (const key of options.attributes.exclude) delete row[key];
    }
    return options.raw ? rows.map(row => row.toJSON()) : rows;
  }
  normalizeRead(data) {
    for (const [key, field] of Object.entries(this.fields)) if (field.type === FieldTypes.DATEONLY && data[key] instanceof Date) data[key] = data[key].toISOString().slice(0, 10);
    return data;
  }
  async include(rows, request, options) {
    if (!rows.length) return rows;
    const spec = request instanceof Repository ? { model: request } : request;
    const a = this.associations.find(a => a.target === spec.model && (!spec.as || a.as === spec.as));
    if (!a) throw failure(`Unknown association on ${this.name}`);
    const ids = rows.map(row => a.kind === 'belongs' ? row[a.foreignKey] : row.id).filter(v => v != null);
    let links, targetIds = ids;
    if (a.kind === 'junction') {
      links = await a.through.findAll({ where: { [a.foreignKey]: { [Op.in]: ids } }, transaction: options.transaction });
      targetIds = links.map(link => link[a.otherKey]);
    }
    const key = ['belongs', 'junction'].includes(a.kind) ? 'id' : a.foreignKey;
    // Keep join keys available even when the caller selects a subset of fields.
    const attributes = Array.isArray(spec.attributes) ? [...new Set([...spec.attributes, key])] : spec.attributes;
    const children = await a.target.findAll({ ...spec, attributes, where: { [Op.and]: [{ [key]: { [Op.in]: targetIds } }, spec.where || {}] }, transaction: options.transaction });
    const byKey = new Map();
    for (const child of children) { const list = byKey.get(child[key]) || []; list.push(child); byKey.set(child[key], list); }
    return rows.filter(row => {
      const matches = links ? links.filter(link => link[a.foreignKey] === row.id).flatMap(link => byKey.get(link[a.otherKey]) || []) : byKey.get(a.kind === 'belongs' ? row[a.foreignKey] : row.id) || [];
      row[a.as] = ['many', 'junction'].includes(a.kind) ? matches : matches[0] || null;
      return !(spec.required ?? Boolean(spec.where)) || matches.length > 0;
    });
  }
  async update(values, options = {}) {
    const rows = await this.findAll({ where: options.where, transaction: options.transaction });
    for (const row of rows) await row.update(values, options);
    return [rows.length];
  }
  async destroy(options = {}, visited = new Set()) {
    const rows = await this.findAll({ where: options.where, transaction: options.transaction, include: [] });
    for (const row of rows) {
      const identity = `${this.name}:${row.id}`;
      if (visited.has(identity)) continue;
      visited.add(identity);
      for (const a of this.associations.filter(a => a.kind !== 'belongs')) {
        const target = a.kind === 'junction' ? a.through : a.target;
        const where = { [a.foreignKey]: row.id };
        if (a.onDelete === 'RESTRICT' && await target.count({ where, transaction: options.transaction })) throw failure('Dữ liệu đang được sử dụng, không thể xóa.', 409);
        if (a.onDelete === 'CASCADE') await target.destroy({ where, transaction: options.transaction, individualHooks: options.individualHooks }, visited);
        if (a.onDelete === 'SET NULL') await target.update({ [a.foreignKey]: null }, { where, transaction: options.transaction });
      }
      await this.collection.deleteOne({ _id: row._id }, this.store.options(options));
      if (options.individualHooks) await this.hook('afterDestroy', row, options);
    }
    return rows.length;
  }
  async count(options = {}) { await this.store.authenticate(); return this.collection.countDocuments(filter(options.where), this.store.options(options)); }
  async ratingStats(where, options = {}) {
    await this.store.authenticate();
    const [row] = await this.collection.aggregate([{ $match: filter(where) }, { $group: { _id: null, avgRating: { $avg: '$rating' }, votesCount: { $sum: 1 } } }], this.store.options(options)).toArray();
    return [{ dataValues: row || {} }];
  }
  async sum(key, options = {}) {
    await this.store.authenticate();
    const [row] = await this.collection.aggregate([{ $match: filter(options.where) }, { $group: { _id: null, total: { $sum: `$${key}` } } }], this.store.options(options)).toArray();
    return row?.total || 0;
  }
  async upsert(values, options = {}) {
    const row = await this.findByPk(values.id, options);
    return row ? [await row.update(values, options), false] : [await this.create(values, options), true];
  }
  async findOrCreate(options) {
    const row = await this.findOne(options);
    if (row) return [row, false];
    try { return [await this.create({ ...options.defaults, ...options.where }, options), true]; }
    catch (error) {
      if (error.code !== 11000) throw error;
      return [await this.findOne(options), false];
    }
  }
}

class MongoStore {
  constructor(uri, { prefix = 'app_' } = {}) {
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    Object.assign(this, { db: this.client.db(), prefix, models: {}, context: new AsyncLocalStorage() });
  }
  define(name, fields, settings = {}) { return this.models[name] = new Repository(this, name, fields, settings); }
  async authenticate() {
    if (!this.connection) this.connection = this.client.connect().catch(error => { this.connection = null; throw error; });
    await this.connection;
  }
  options(options = {}) {
    const tx = options.transaction || this.context.getStore();
    if (tx?.finished) throw failure('Transaction is already finished', 409);
    return tx ? { session: tx.session } : {};
  }
  async sync() {
    await this.authenticate();
    const reviewModel = this.models.CommentPost;
    if (reviewModel?.fields.booking_id?.unique) {
      let indexes;
      try {
        indexes = await reviewModel.collection.listIndexes().toArray();
      } catch (error) {
        if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
        indexes = [];
      }
      const desiredIndex = indexes.find(index => index.key?.booking_id === 1
        && Object.keys(index.key).length === 1
        && index.unique === true
        && index.partialFilterExpression?.booking_id?.$type === 'string');
      if (!desiredIndex) {
        const duplicates = await reviewModel.collection.aggregate([
          { $match: { booking_id: { $type: 'string' } } },
          { $group: { _id: '$booking_id', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $limit: 10 }
        ]).toArray();
        if (duplicates.length) {
          const examples = duplicates.map(item => `${item._id} (${item.count} rows)`).join(', ');
          throw failure(`Cannot create unique CommentPost.booking_id index: duplicate booking_id values found: ${examples}`, 409);
        }

        // Replace only the legacy full, non-unique booking_id index. The duplicate
        // scan above runs first, and this changes index metadata without touching rows.
        const legacyIndex = indexes.find(index => index.name === 'booking_id_1'
          && index.key?.booking_id === 1
          && Object.keys(index.key).length === 1
          && index.unique !== true
          && !index.partialFilterExpression
          && !index.sparse
          && !index.expireAfterSeconds);
        if (legacyIndex) await reviewModel.collection.dropIndex(legacyIndex.name);
      }
    }
    for (const model of Object.values(this.models)) {
      await model.collection.createIndex({ id: 1 }, { unique: true, sparse: true });
      for (const [key, field] of Object.entries(model.fields)) {
        if (field.unique || model.uniqueKeys?.includes(key)) {
          const indexOptions = field.allowNull === true ? { unique: true, partialFilterExpression: { [key]: { $type: 'string' } } } : { unique: true, sparse: true };
          if (model === reviewModel && key === 'booking_id') indexOptions.name = 'booking_id_unique';
          await model.collection.createIndex({ [key]: 1 }, indexOptions);
        }
        else if (key.endsWith('_id')) await model.collection.createIndex({ [key]: 1 });
      }
      if (model.junctionKeys) await model.collection.createIndex(Object.fromEntries(model.junctionKeys.map(k => [k, 1])), { unique: true });
    }
  }
  async transaction(callback) {
    await this.authenticate();
    const hello = await this.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw failure('MongoDB cần replica set để xử lý giao dịch ví/booking. Xem backend/README.md.', 503);
    const session = this.client.startSession();
    const tx = {
      session, LOCK: { UPDATE: 'UPDATE' }, finished: false,
      async commit() {
        if (this.finished) return;
        for (let attempt = 0; ; attempt++) {
          try { await session.commitTransaction(); break; }
          catch (error) { if (attempt >= 2 || !error.hasErrorLabel?.('UnknownTransactionCommitResult')) throw error; }
        }
        this.finished = true;
        await session.endSession();
      },
      async rollback() {
        if (this.finished) return;
        try { if (session.inTransaction()) await session.abortTransaction(); } finally { this.finished = true; await session.endSession(); }
      }
    };
    session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    if (!callback) return tx;
    // Existing controllers may hold record instances and send email in callbacks.
    // Do not replay those side effects after a transient write conflict.
    try {
      const result = await this.context.run(tx, () => callback(tx));
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  async close() { await this.client.close(); this.connection = null; }
}
module.exports = { MongoStore, FieldTypes, Op, filter };
