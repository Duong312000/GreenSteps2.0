// Seed-only image assignments shared by initial seeding and the image refresh script.
// Customer APIs continue to read vehicle.images directly from MongoDB.
const shared = [
  'shared-mpv-white', 'shared-van-silver', 'shared-minibus-ivory',
  'shared-mpv-teal', 'shared-van-black', 'shared-minibus-green'
];
const asset = name => `/image/transport/${name}.jpg`;
function vehicleImages(type, index) {
  if (type === 'shared') return [asset(shared[index % shared.length])];
  if (type === 'bus') {
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
module.exports = { vehicleImages };
