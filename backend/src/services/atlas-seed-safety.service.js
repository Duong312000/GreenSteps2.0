const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function seedError(code) {
  return Object.assign(new Error('Atlas seed preflight failed.'), { code });
}

function validateAtlasSeedTarget({ uri, databaseName, collectionPrefix, roles, allowApply, allowAtlasAdmin, backupRestoreVerified, isRemote } = {}) {
  let target;
  try { target = new URL(uri); }
  catch {
    const scheme = typeof uri === 'string' ? uri.match(/^(mongodb(?:\+srv)?:)\/\//i)?.[1].toLowerCase() : null;
    if (!scheme || isRemote !== true) throw seedError('ATLAS_SEED_URI_INVALID');
    target = { protocol: scheme, hostname: '', pathname: '' };
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(target.protocol)) throw seedError('ATLAS_SEED_URI_INVALID');
  if (isRemote === false || (isRemote !== true && LOOPBACK_HOSTS.has(target.hostname.toLowerCase()))) throw seedError('ATLAS_SEED_REMOTE_REQUIRED');
  const uriDatabaseName = target.pathname ? decodeURIComponent(target.pathname.replace(/^\//, '')) : databaseName;
  if (databaseName !== 'GreenStepsData' || uriDatabaseName !== 'GreenStepsData') throw seedError('ATLAS_SEED_DATABASE_MISMATCH');
  if (collectionPrefix !== 'app_') throw seedError('ATLAS_SEED_PREFIX_MISMATCH');
  if (allowApply !== true) throw seedError('ATLAS_SEED_APPLY_NOT_AUTHORIZED');
  if (backupRestoreVerified !== true) throw seedError('ATLAS_BACKUP_RESTORE_NOT_VERIFIED');

  const authenticatedRoles = Array.isArray(roles) ? roles : [];
  const scopedReadWrite = authenticatedRoles.length === 1
    && authenticatedRoles[0].role === 'readWrite'
    && authenticatedRoles[0].db === 'GreenStepsData';
  if (scopedReadWrite) return { accessMode: 'database_read_write' };

  const explicitlyAllowedAtlasAdmin = allowAtlasAdmin === true
    && authenticatedRoles.length === 1
    && authenticatedRoles[0].role === 'atlasAdmin'
    && authenticatedRoles[0].db === 'admin';
  if (explicitlyAllowedAtlasAdmin) return { accessMode: 'atlas_admin_explicit_override' };
  throw seedError('ATLAS_SEED_ROLE_NOT_SCOPED');
}

module.exports = { validateAtlasSeedTarget };
