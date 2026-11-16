require('../src/config/env');
const { store } = require('../src/config/db.config');
const models = require('../src/models');
const { demoTours } = require('../src/data/demo-tours.seed');
const { enrichDemoTours, DEMO_TOUR_ID_ALLOWLIST } = require('../src/services/demo-tour-enrichment-migration.service');

const SAFE_STOP_MESSAGES = new Set([
  'Explicit enrichment apply environment flag is required.',
  'Remote target database or collection prefix does not match the reviewed catalog.',
  'Remote enrichment requires a dedicated readWrite role on GreenStepsData.',
  'Remote apply needs the explicit production flag, runtime approval flags, and a verified Atlas snapshot.',
  'Local apply needs GS_ALLOW_LOCAL_DEMO_TOUR_ENRICHMENT=1.'
]);
const apply = process.argv.includes('--apply');
const allowProduction = process.argv.includes('--allow-production');
const isLoopback = host => {
  const value = String(host || '').toLowerCase();
  const match = value.match(/^\[?(.+?)\]?:\d+$/);
  return ['localhost', '127.0.0.1', '::1'].includes(match?.[1] || value);
};

async function main() {
  if (apply && process.env.GS_ALLOW_DEMO_TOUR_ENRICHMENT !== '1') throw new Error('Explicit enrichment apply environment flag is required.');
  await store.authenticate();
  const databaseName = store.db.databaseName;
  const remoteAddresses = [...store.client.topology.description.servers.keys()].filter(address => !isLoopback(address));
  const isRemote = remoteAddresses.length > 0;
  if (isRemote && (databaseName !== 'GreenStepsData' || store.prefix !== 'app_')) throw new Error('Remote target database or collection prefix does not match the reviewed catalog.');
  if (isRemote) {
    const status = await store.db.admin().command({ connectionStatus: 1 });
    const roles = status.authInfo?.authenticatedUserRoles || [];
    const leastPrivilegeRole = roles.length === 1 && roles[0].role === 'readWrite' && roles[0].db === 'GreenStepsData';
    if (!leastPrivilegeRole) throw new Error('Remote enrichment requires a dedicated readWrite role on GreenStepsData.');
  }
  if (apply && isRemote && (!allowProduction || process.env.GS_ALLOW_PRODUCTION_DEMO_TOUR_ENRICHMENT !== '1' || process.env.GS_ATLAS_SNAPSHOT_VERIFIED !== '1')) {
    throw new Error('Remote apply needs the explicit production flag, runtime approval flags, and a verified Atlas snapshot.');
  }
  if (apply && !isRemote && process.env.GS_ALLOW_LOCAL_DEMO_TOUR_ENRICHMENT !== '1') {
    throw new Error('Local apply needs GS_ALLOW_LOCAL_DEMO_TOUR_ENRICHMENT=1.');
  }
  const result = await enrichDemoTours({ models, store, tours: demoTours, allowlist: DEMO_TOUR_ID_ALLOWLIST, apply });
  process.stdout.write(`${JSON.stringify({ database: databaseName, remote: isRemote, ...result }, null, 2)}\n`);
  if (result.conflicts.length) process.exitCode = 2;
}

main().catch(error => {
  const message = SAFE_STOP_MESSAGES.has(error?.message)
    ? `Demo tour enrichment stopped: ${error.message}\n`
    : 'Demo tour enrichment stopped. No secrets or connection details were printed.\n';
  process.stderr.write(message);
  process.exitCode = 1;
}).finally(async () => {
  await store.close().catch(() => {});
});
