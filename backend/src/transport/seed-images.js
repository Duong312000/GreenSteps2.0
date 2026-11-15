// Seed-only image assignments shared by initial seeding and the image refresh script.
// Customer APIs continue to read vehicle.images directly from MongoDB.
const shared = [
  'shared-mpv-white', 'shared-van-silver', 'shared-minibus-ivory',
  'shared-mpv-teal', 'shared-van-black', 'shared-minibus-green'
];
const asset = name => `/image/transport/${name}.jpg`;
const BUS_DEMO_INDICES = [0, 1, 3, 4];
const BUS_GALLERY_VERSION = 'curated-bus-base64-v2';
const busAssets = { 0: 'shared-minibus-ivory', 1: 'bus-coach-white', 3: 'bus-coach-green', 4: 'shared-minibus-green' };
function busDemoCover(index) {
  const file = asset(busAssets[index] || 'bus-coach-white');
  const bytes = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../../my-app/public', file.slice(1)));
  if (bytes.length > 1000000 || bytes[0] !== 255 || bytes[1] !== 216) throw new Error(`Invalid bus JPEG: ${file}`);
  return { image: 'data:image/jpeg;base64,' + bytes.toString('base64'), source: {
    title: 'Ảnh minh họa phương tiện GreenSteps', asset_path: file, author: 'OpenAI image_gen',
    license: 'Generated illustration', modifications: 'Ảnh minh họa, không phải ảnh xác nhận của nhà xe.', illustrative: true,
  } };
}
function vehicleImages(type, index) {
  if (type === 'shared') return [asset(shared[index % shared.length])];
  if (type === 'bus') {
    if (BUS_DEMO_INDICES.includes(index)) return [busDemoCover(index).image];
    if (index % 4 === 0) return [asset(Math.floor(index / 4) % 2 ? 'shared-minibus-green' : 'shared-minibus-ivory')];
    return [asset(index % 2 ? 'bus-coach-white' : 'bus-coach-green')];
  }
  if (type === 'rental') return [[
    asset('shared-mpv-teal'),
    '/image/services/transport_electric_car.png',
    asset('rental-motorbike'),
    asset('rental-electric-motorbike'),
    '/image/services/transport_green_bike.png',
    '/image/services/transport_green_bike.png'
  ][index % 6]];
  throw new Error('Unknown seed transport type');
}
module.exports = { vehicleImages, busDemoCover, BUS_DEMO_INDICES, BUS_GALLERY_VERSION };
