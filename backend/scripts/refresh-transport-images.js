require('../src/config/env');
const { store, col } = require('../src/transport/models');
const { vehicleImages } = require('../src/transport/seed-images');
const fs = require('node:fs');
const path = require('node:path');
async function refreshImages(apply = false) {
  await store.authenticate();
  const vehicles = await col('vehicles').find({
    is_seed_data: true,
    seed_key: /^greensteps-transport-v1:(shared|bus|rental)-vehicle-\d+$/
  }).toArray();
  let changed = 0, skipped = 0;
  for (const vehicle of vehicles) {
    if (vehicle.gallery_version === 'commons-bus-v1') { skipped++; continue; }
    const [, type, index] = vehicle.seed_key.match(/:(shared|bus|rental)-vehicle-(\d+)$/);
    const images = vehicleImages(type, Number(index));
    for (const image of images) {
      const localPath = path.resolve(__dirname, '../../my-app/public', image.slice(1));
      if (!fs.existsSync(localPath)) throw new Error(`Missing transport image: ${image}`);
    }
    if (JSON.stringify(images) === JSON.stringify(vehicle.images)) continue;
    if (apply) {
      const result = await col('vehicles').updateOne(
        { _id: vehicle._id, is_seed_data: true, images: vehicle.images },
        { $set: { images, updatedAt: new Date() } }
      );
      if (result.modifiedCount) changed++; else skipped++;
    } else changed++;
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', matched: vehicles.length, changed, skipped }, null, 2));
}
if (require.main === module) refreshImages(process.argv.includes('--apply'))
  .catch(error => { console.error('Transport images:', error.message); process.exitCode = 1; })
  .finally(() => store.close());
module.exports = { refreshImages };
