require('../src/config/env');
const { store } = require('../src/models');
const { syncAllGooglePlacesPhotos } = require('../src/services/google-maps-photo-sync.service');

async function main() {
  await store.authenticate();
  console.log('Connected to MongoDB. Starting Google Places Photo sync...');
  const results = await syncAllGooglePlacesPhotos();
  console.log('\n--- SYNC SUMMARY ---');
  let successCount = 0;
  for (const r of results) {
    if (r.success) {
      successCount++;
      console.log(`[OK] ${r.name} -> ${r.imageUrl}`);
    } else {
      console.log(`[FAIL] ${r.name} -> ${r.error}`);
    }
  }
  console.log(`\nSuccessfully downloaded and saved ${successCount}/${results.length} authentic Google Maps photos!`);
  await store.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});

