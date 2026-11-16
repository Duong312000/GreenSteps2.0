require('../src/config/env');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EJSON } = require('bson');
const { store } = require('../src/config/db.config');
const models = require('../src/models');
const geography = require('../src/data/national-geography.seed');
const { demoTours } = require('../src/data/demo-tours.seed');
const { seedNationalCatalog, seedDemoTours } = require('../src/services/national-catalog-seed.service');
const { validateAtlasSeedTarget } = require('../src/services/atlas-seed-safety.service');

const BACKUP_DIR = process.env.GS_ATLAS_BACKUP_DIR || 'D:/Web2/tmp/gs-atlas-logical-backup-20261112';
const RESTORE_URI = 'mongodb://127.0.0.1:27019/?replicaSet=gsRestoreRs';
const RESTORE_DB = 'GreenStepsRestoreCheck';
const apply = process.argv.includes('--apply');
const verifyRerun = process.argv.includes('--verify-rerun');
const protectedPattern = /user|booking|payment|wallet|ledger/i;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const ejson = value => EJSON.stringify(value, { relaxed: false });

function fail(code) { throw Object.assign(new Error('Atlas catalog seed preflight failed.'), { code }); }

async function checksumCollection(collection) {
  const hash = crypto.createHash('sha256');
  for await (const doc of collection.find({}).sort({ _id: 1 }).batchSize(250)) {
    hash.update(ejson(doc));
    hash.update('\n');
  }
  return hash.digest('hex');
}

async function verifyBackupRestore() {
  const manifestPath = path.join(BACKUP_DIR, 'manifest.ejson');
  if (!fs.existsSync(manifestPath)) fail('ATLAS_BACKUP_MANIFEST_MISSING');
  const manifest = EJSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.database !== 'GreenStepsData' || manifest.collectionCount !== 79) fail('ATLAS_BACKUP_MANIFEST_MISMATCH');

  const { MongoClient } = require('mongodb');
  const client = new MongoClient(RESTORE_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(RESTORE_DB);
    for (const item of manifest.collections) {
      const collection = db.collection(item.name);
      if (await collection.countDocuments({}) !== item.count) fail('ATLAS_BACKUP_RESTORE_COUNT_MISMATCH');
      if ((await collection.listIndexes().toArray()).length !== item.indexes.length) fail('ATLAS_BACKUP_RESTORE_INDEX_MISMATCH');
      if (await checksumCollection(collection) !== item.sha256) fail('ATLAS_BACKUP_RESTORE_CHECKSUM_MISMATCH');
    }
    return manifest;
  } finally { await client.close().catch(() => {}); }
}

async function verifyIndexes(model, requiredFields) {
  const indexes = await model.collection.listIndexes().toArray();
  for (const field of requiredFields) {
    if (!indexes.some(index => index.unique === true && index.key?.[field] === 1)) fail(`UNIQUE_INDEX_MISSING_${model.collectionName}_${field}`);
  }
}

function assertUniqueSeedValues(records, fields, entityType) {
  for (const field of fields) {
    const values = records.map(row => row[field]).filter(value => value !== undefined && value !== null);
    if (new Set(values).size !== values.length) fail(`DUPLICATE_SEED_VALUE_${entityType}_${field}`);
  }
}

async function inspectSeedGroup({ model, records, entityType, uniqueFields = [] }) {
  if (!model.collectionName.startsWith('app_')) fail('SEED_COLLECTION_PREFIX_MISMATCH');
  const indexFields = ['id', ...uniqueFields.filter(field => field !== 'id')];
  await verifyIndexes(model, indexFields);
  assertUniqueSeedValues(records, indexFields, entityType);
  let missing = 0;
  const conflicts = [];
  for (const record of records) {
    const existing = await model.collection.findOne({ id: record.id }, { projection: { id: 1, slug: 1, code: 1, name: 1 } });
    if (existing) {
      const identityMatches = ['slug', 'code', 'name'].every(key => record[key] === undefined || existing[key] === record[key]);
      if (!identityMatches) conflicts.push({ field: 'id', value: record.id });
    } else missing++;
    for (const field of uniqueFields) {
      if (record[field] === undefined || record[field] === null) continue;
      const owner = await model.collection.findOne({ [field]: record[field] }, { projection: { id: 1 } });
      if (owner && owner.id !== record.id) conflicts.push({ field, value: record[field] });
    }
  }
  if (conflicts.length) fail(`SEED_ID_OR_SLUG_CONFLICT_${entityType}`);
  return { entityType, collection: model.collectionName, input: records.length, missing, totalBefore: await model.count() };
}

async function verifyProtectedData(db, manifest, allowedCollections) {
  const before = new Map(manifest.collections.map(item => [item.name, item]));
  const protectedRows = [];
  for (const item of manifest.collections) {
    if (!protectedPattern.test(item.name) || allowedCollections.has(item.name)) continue;
    const collection = db.collection(item.name);
    const count = await collection.countDocuments({});
    const digest = await checksumCollection(collection);
    if (count !== item.count || digest !== item.sha256) protectedRows.push(item.name);
  }
  const namesAfter = (await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name);
  const unexpected = namesAfter.filter(name => !before.has(name) && !allowedCollections.has(name));
  if (protectedRows.length || unexpected.length) fail('PROTECTED_DATA_CHANGED');
  return { protectedCollectionsChecked: manifest.collections.filter(item => protectedPattern.test(item.name)).length, unchanged: true };
}

async function main() {
  const manifest = await verifyBackupRestore();
  await store.authenticate();
  const status = await store.db.admin().command({ connectionStatus: 1 });
  const connectedAddresses = [...store.client.topology.description.servers.keys()];
  const loopback = address => /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::\d+)?$/i.test(address);
  const isRemote = connectedAddresses.length > 0 && connectedAddresses.every(address => !loopback(address));
  const access = validateAtlasSeedTarget({
    uri: process.env.MONGODB_URI,
    databaseName: store.db.databaseName,
    collectionPrefix: store.prefix,
    roles: status.authInfo?.authenticatedUserRoles,
    allowApply: process.env.GS_ALLOW_ATLAS_SEED === '1',
    allowAtlasAdmin: process.env.GS_ALLOW_ATLAS_ADMIN_SEED === '1',
    backupRestoreVerified: true,
    isRemote
  });
  if (process.env.GS_ALLOW_ATLAS_SEED !== '1') fail('ATLAS_SEED_APPLY_NOT_AUTHORIZED');

  const groups = [
    { model: models.AdminArea, records: geography.adminAreas, entityType: 'admin_area', uniqueFields: ['code'] },
    { model: models.Region, records: geography.regions, entityType: 'region', uniqueFields: ['slug'] },
    { model: models.Destination, records: geography.destinations, entityType: 'destination', uniqueFields: ['slug'] },
    { model: models.Schedule, records: demoTours.map(({ itinerary, ...schedule }) => schedule), entityType: 'schedule' },
    { model: models.ScheduleActivity, records: demoTours.flatMap(tour => tour.itinerary), entityType: 'schedule_activity' }
  ];

  const actualCollections = (await store.db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name).sort();
  const backupCollections = manifest.collections.map(item => item.name).sort();
  if (JSON.stringify(actualCollections) !== JSON.stringify(backupCollections)) fail('ATLAS_COLLECTION_SET_CHANGED_SINCE_BACKUP');
  if (!verifyRerun) {
    for (const item of manifest.collections) {
      const collection = store.db.collection(item.name);
      if (await collection.countDocuments({}) !== item.count || await checksumCollection(collection) !== item.sha256) fail('ATLAS_DATA_CHANGED_SINCE_BACKUP');
    }
  }

  const summaries = [];
  for (const group of groups) summaries.push(await inspectSeedGroup(group));
  const sampleCountBefore = await models.ScheduleSample.count();
  const auditCountBefore = await models.AdminConfigAuditLog.count();
  const planned = await seedNationalCatalog(models, geography, { dryRun: true });
  const demoPlan = await seedDemoTours(models, demoTours, { dryRun: true });
  const missingTotal = summaries.reduce((sum, item) => sum + item.missing, 0);
  if (missingTotal > 96) fail('UNEXPECTED_SEED_DOCUMENT_COUNT');

  if (!apply && !verifyRerun) {
    process.stdout.write(JSON.stringify({ status: 'DRY_RUN', database: store.db.databaseName, prefix: store.prefix, accessMode: access.accessMode, backupRestore: 'PASS', collections: summaries, nationalCatalog: planned, demo: demoPlan, schedulePriceRecordsBefore: sampleCountBefore }) + '\n');
    return;
  }

  const inserted = [];
  const options = {
    dryRun: false,
    batchSize: 25,
    auditModel: models.AdminConfigAuditLog,
    store,
    actorId: 'system:atlas-national-catalog-seed',
    onCreated: record => inserted.push(record.id)
  };
  try {
    const catalogResult = await seedNationalCatalog(models, geography, options);
    const demoResult = await seedDemoTours(models, demoTours, options);
    const insertedAtEndOfFirstPass = inserted.length;
    const retryCatalog = await seedNationalCatalog(models, geography, options);
    const retryDemo = await seedDemoTours(models, demoTours, options);
    if (inserted.length !== insertedAtEndOfFirstPass || insertedAtEndOfFirstPass !== missingTotal) fail('SEED_IDEMPOTENCY_FAILED');

    const actualCounts = {};
    for (const item of summaries) {
      const total = await itemModelCount(groups, item.collection);
      const expected = item.totalBefore + item.missing;
      actualCounts[item.collection] = total;
      if (total !== expected) fail(`POST_SEED_COUNT_MISMATCH_${item.collection}`);
    }
    if (await models.ScheduleSample.count() !== sampleCountBefore) fail('UNEXPECTED_PRICE_RECORD_CHANGE');
    if (await models.AdminConfigAuditLog.count() - auditCountBefore !== insertedAtEndOfFirstPass) fail('AUDIT_RECORD_COUNT_MISMATCH');

    for (const group of groups) {
      for (const record of group.records) {
        const saved = await group.model.findByPk(record.id);
        if (!saved) fail(`SEEDED_DOCUMENT_MISSING_${group.entityType}`);
        for (const key of Object.keys(record)) {
          if (JSON.stringify(saved[key]) !== JSON.stringify(record[key])) fail(`SEEDED_DOCUMENT_MISMATCH_${group.entityType}`);
        }
      }
    }
    const auditIds = inserted.map(id => `catalog_seed_${sha(`${groups.find(group => group.records.some(record => record.id === id))?.entityType || 'catalog_record'}:${id}`).slice(0, 24)}`);
    if (auditIds.length !== insertedAtEndOfFirstPass) fail('AUDIT_ID_VERIFICATION_FAILED');
    for (const id of auditIds) if (!await models.AdminConfigAuditLog.findByPk(id)) fail('AUDIT_RECORD_MISSING');

    const targetCollections = new Set(groups.map(group => group.model.collectionName));
    targetCollections.add(models.AdminConfigAuditLog.collectionName);
    const protected = await verifyProtectedData(store.db, manifest, targetCollections);
    process.stdout.write(JSON.stringify({ status: verifyRerun ? 'IDEMPOTENCY_PASS' : 'APPLIED', database: store.db.databaseName, prefix: store.prefix, accessMode: access.accessMode, backupRestore: 'PASS', insertedDocuments: insertedAtEndOfFirstPass, insertedIds: inserted, auditRecords: insertedAtEndOfFirstPass, counts: actualCounts, priceRecordsCreated: 0, secondRunCreated: 0, protectedData: protected, catalogResult, demoResult, retryCatalog, retryDemo }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 'STOPPED', code: error.code || error.codeName || error.name || 'Error', committedDocumentIds: inserted }) + '\n');
    process.exitCode = 1;
  }
}

async function itemModelCount(groups, collectionName) {
  return groups.find(group => group.model.collectionName === collectionName).model.count();
}

main().catch(error => {
  process.stdout.write(JSON.stringify({ status: 'BLOCKED', code: error.code || error.codeName || error.name || 'Error' }) + '\n');
  process.exitCode = 1;
}).finally(async () => { await store.close().catch(() => {}); });
