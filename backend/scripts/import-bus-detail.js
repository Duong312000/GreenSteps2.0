// Run without --apply to preview. Scope: existing GreenSteps bus demo data only.
require('../src/config/env');
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient, BSON: { EJSON } } = require('mongodb');
const { tripStops, validateStops } = require('../src/transport/stops');
const imageTitles = ['Toyota Coaster EX XZB70.jpg', 'Toyota Coaster GX XZB70 interior rear.jpg', 'Toyota Coaster GX XZB70 interior.jpg', 'Toyota Coaster EX XZB70 rear.jpg'];
const cache = path.resolve(__dirname, '../../tmp/bus-detail');
const strip = s => String(s || '').replace(/<[^>]*>/g, '').trim();
async function get(url) {
 const r = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'GreenStepsTravel/1.0 (demo bus gallery)' } });
 if (!r.ok) throw new Error(`Image source returned HTTP ${r.status}`);
 return r;
}
async function download() {
 fs.mkdirSync(cache, { recursive: true });
 const sources = [];
 for (const [i, title] of imageTitles.entries()) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.search = new URLSearchParams({ action: 'query', format: 'json', titles: `File:${title}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '960' });
  const json = await (await get(api)).json();
  const info = Object.values(json.query.pages)[0].imageinfo?.[0];
  if (!info) throw new Error(`Missing source: ${title}`);
  const meta = info.extmetadata;
  if (meta.LicenseShortName?.value !== 'CC0') throw new Error(`Expected CC0 source: ${title}`);
  const response = await get(info.thumburl || info.url);
  if (!response.headers.get('content-type')?.startsWith('image/jpeg')) throw new Error('Expected JPEG');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 1100000 || buffer[0] !== 255 || buffer[1] !== 216) throw new Error('Invalid/oversized image');
  fs.writeFileSync(path.join(cache, `bus-${i}.jpg`), buffer);
  sources.push({ title, page_url: info.descriptionurl, download_url: info.thumburl || info.url, author: strip(meta.Artist?.value), license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', modifications: 'Wikimedia thumbnail; displayed cropped in gallery', illustrative: true });
 }
 fs.writeFileSync(path.join(cache, 'image-sources.json'), JSON.stringify(sources, null, 2));
 console.log(JSON.stringify({ downloaded: sources.length, cache }));
}
async function migrate(apply = false) {
 const sources = JSON.parse(fs.readFileSync(path.join(cache, 'image-sources.json'), 'utf8'));
 const images = sources.map((_, i) => `data:image/jpeg;base64,${fs.readFileSync(path.join(cache, `bus-${i}.jpg`)).toString('base64')}`);
 const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
 try {
  await client.connect(); const db = client.db();
  const vehicles = await db.collection('transport_vehicles').find({ is_seed_data: true, transport_type: 'bus', seed_key: /^greensteps-transport-v1:bus-vehicle-\d+$/ }).toArray();
  const trips = await db.collection('transport_trips').find({ is_seed_data: true, transport_type: 'bus', stops: { $exists: false }, vehicle_id: { $in: vehicles.map(v => v._id) } }).toArray();
  const changes = [];
  for (const trip of trips) {
   if (await db.collection('transport_bookings').findOne({ trip_id: trip._id, booking_status: { $in: ['PENDING','CONFIRMED'] } })) continue;
   const route = await db.collection('transport_routes').findOne({ _id: trip.route_id });
   let stops = tripStops({ ...trip, route });
   if (route?.origin === 'Đà Nẵng' && route?.destination === 'Hội An') {
    const start = +trip.departure_time, duration = +trip.arrival_time - start;
    const names = ['Trung tâm Đà Nẵng', 'Cầu Rồng', 'Ngũ Hành Sơn', 'Trung tâm Hội An'];
    const addresses = ['Hải Châu, Đà Nẵng', 'Đường Trần Hưng Đạo, Sơn Trà, Đà Nẵng', 'Đường Lê Văn Hiến, Ngũ Hành Sơn, Đà Nẵng', 'Đường Trần Hưng Đạo, Hội An'];
    stops = names.map((name, i) => ({ id: `${trip._id}-stop-${i}`, order: i, name, address: addresses[i], estimated_time: new Date(start + Math.round([0,10/55,30/55,1][i] * duration / 60000) * 60000), allow_pickup: i < 3, allow_dropoff: i > 0 }));
   }
   changes.push({ trip, stops: validateStops(stops, trip.departure_time, trip.arrival_time) });
  }
  const pendingVehicles = vehicles.filter(v => v.gallery_version !== 'commons-bus-v1');
  if (apply && (pendingVehicles.length || changes.length)) {
   const backup = path.join(cache, `atlas-before-${Date.now()}.json`);
   fs.writeFileSync(backup, EJSON.stringify({ database: db.databaseName, vehicles: pendingVehicles, trips: changes.map(c => c.trip) }, null, 2));
   for (const v of pendingVehicles) await db.collection('transport_vehicles').updateOne({ _id: v._id, images: v.images }, { $set: { images, image_sources: sources, gallery_version: 'commons-bus-v1', updatedAt: new Date() } });
   for (const c of changes) await db.collection('transport_trips').updateOne({ _id: c.trip._id, stops: { $exists: false } }, { $set: { stops: c.stops, stops_source: 'greensteps-demo-v1', updatedAt: new Date() } });
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', database: db.databaseName, busVehicles: vehicles.length, galleries: pendingVehicles.length, tripsWithNewStops: changes.length, imageCount: images.length, base64CharsPerVehicle: images.reduce((n, s) => n+s.length,0) }));
 } finally { await client.close(); }
}
if (require.main === module) (process.argv.includes('--download') ? download() : migrate(process.argv.includes('--apply'))).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { migrate };
