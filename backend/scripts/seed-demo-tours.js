const { demoTours } = require('../src/data/demo-tours.seed');
const { seedDemoTours } = require('../src/services/national-catalog-seed.service');

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ dryRun: true, destinationCount: 6, tourCount: demoTours.length, priceRecords: 0, bookingEnabled: false }));
    return;
  }
  if (process.env.GS_ALLOW_LOCAL_CATALOG_SEED !== '1') throw new Error();
  const { store } = require('../src/config/db.config');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsDataMigrated';
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(uri).hostname)) throw new Error();
  const models = require('../src/models');
  try {
    await store.authenticate();
    console.log(JSON.stringify(await seedDemoTours(models, demoTours, { dryRun: false })));
  } finally { await store.close(); }
}

main().catch(() => { console.error('Demo tour seed stopped. Check local configuration without printing credentials.'); process.exitCode = 1; });
