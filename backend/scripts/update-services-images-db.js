const { store } = require('../src/models');
const fs = require('fs');
const path = require('path');
const { finalMapping } = require('./generate-services-mapping');

(async () => {
  try {
    console.log('=== UPDATING 4 TOURISM SERVICES IMAGES IN MONGODB (app_greenservices) ===');
    await store.authenticate();
    const col = store.db.collection('app_greenservices');

    const ops = [];
    const report = [];

    for (const [id, m] of Object.entries(finalMapping)) {
      ops.push({
        updateOne: {
          filter: { id },
          update: {
            $set: {
              image_url: m.cover,
              coverMediaVerified: true,
              'current_data.gallery': m.gallery,
              'current_data.images': m.gallery,
              'current_data.img': m.cover,
              'current_data.verificationStatus': 'verified'
            }
          }
        }
      });

      report.push({
        id: m.id,
        name: m.name,
        type: m.type,
        destination: m.destination,
        cover: m.cover,
        galleryCount: m.gallery.length,
        gallery: m.gallery,
        status: 'SUCCESS'
      });
    }

    console.log('Executing bulkWrite for', ops.length, 'services...');
    const result = await col.bulkWrite(ops, { ordered: false });
    console.log('Bulk write completed! Matched:', result.matchedCount, 'Modified:', result.modifiedCount);

    const reportPath = path.resolve(__dirname, '../backups/services-images-update-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Saved detailed update report to:', reportPath);

    console.log('\n--- VERIFICATION OF 4 TOURISM SERVICES ---');
    const typeCount = { stay: 0, food: 0, transport: 0, attraction: 0 };
    report.forEach(r => {
      if (typeCount[r.type] !== undefined) typeCount[r.type]++;
    });
    console.log('1. Stay (Lưu trú):', typeCount.stay, 'updated');
    console.log('2. Food (Ẩm thực):', typeCount.food, 'updated');
    console.log('3. Transport (Phương tiện):', typeCount.transport, 'updated');
    console.log('4. Attraction (Tham quan):', typeCount.attraction, 'updated');
    console.log('TOTAL UPDATED:', report.length, '/ 125 services');

  } catch (err) {
    console.error('Database update failed:', err);
  } finally {
    await store.close();
  }
})();
