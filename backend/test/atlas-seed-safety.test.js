const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAtlasSeedTarget } = require('../src/services/atlas-seed-safety.service');

const valid = overrides => validateAtlasSeedTarget({
  uri: 'mongodb+srv://example.invalid/GreenStepsData',
  databaseName: 'GreenStepsData',
  collectionPrefix: 'app_',
  roles: [{ role: 'readWrite', db: 'GreenStepsData' }],
  allowApply: true,
  backupRestoreVerified: true,
  allowAtlasAdmin: false,
  ...overrides
});

test('Atlas seed accepts the target database with only its scoped readWrite role', () => {
  assert.equal(valid().accessMode, 'database_read_write');
});

test('Atlas seed rejects atlasAdmin unless the operator explicitly enables the exception', () => {
  const input = { roles: [{ role: 'atlasAdmin', db: 'admin' }] };
  assert.throws(() => valid(input), error => error.code === 'ATLAS_SEED_ROLE_NOT_SCOPED');
  assert.equal(valid({ ...input, allowAtlasAdmin: true }).accessMode, 'atlas_admin_explicit_override');
});

test('Atlas seed rejects the wrong database, collection prefix, and local hosts', () => {
  assert.throws(() => valid({ databaseName: 'GreenStepsDataMigrated' }), error => error.code === 'ATLAS_SEED_DATABASE_MISMATCH');
  assert.throws(() => valid({ collectionPrefix: '' }), error => error.code === 'ATLAS_SEED_PREFIX_MISMATCH');
  assert.throws(() => valid({ uri: 'mongodb://127.0.0.1:27017/GreenStepsData' }), error => error.code === 'ATLAS_SEED_REMOTE_REQUIRED');
});

test('Atlas seed requires a separate explicit apply flag before writes', () => {
  assert.throws(() => valid({ allowApply: false }), error => error.code === 'ATLAS_SEED_APPLY_NOT_AUTHORIZED');
});

test('Atlas seed refuses production writes until a backup restore has been verified', () => {
  assert.throws(() => valid({ backupRestoreVerified: false }), error => error.code === 'ATLAS_BACKUP_RESTORE_NOT_VERIFIED');
});
