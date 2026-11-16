const data = require('../src/data/national-geography.seed');
const { seedNationalCatalog } = require('../src/services/national-catalog-seed.service');

async function main() {
  const apply = process.argv.includes('--apply');
  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, adminAreas: data.adminAreas.length, regions: data.regions.length, destinations: data.destinations.length }));
    return;
  }
  if (process.env.GS_ALLOW_LOCAL_CATALOG_SEED !== '1') throw new Error('Set GS_ALLOW_LOCAL_CATALOG_SEED=1 to allow a local-only catalog seed.');
  const { store } = require('../src/config/db.config');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsDataMigrated';
  const host = new URL(uri).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Catalog seed writes are restricted to a local MongoDB host.');
  const models = require('../src/models');
  try {
    await store.authenticate();
    const result = await seedNationalCatalog(models, data, { dryRun: false });
    console.log(JSON.stringify(result));
  } finally { await store.close(); }
}

main().catch(() => { console.error('National catalog seed stopped. Check local configuration without printing credentials.'); process.exitCode = 1; });
