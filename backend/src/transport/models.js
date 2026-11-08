const { ObjectId } = require('mongodb');
const { store } = require('../config/db.config');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const id = value => { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw fail('ID không hợp lệ.'); return new ObjectId(value); };
const num = (v, fallback, min = 0, max = 1e10) => { if (v === undefined || v === '') return fallback; const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw fail('Giá trị số không hợp lệ.'); return n; };
const integer = (v, fallback, min = 1, max = 100) => { const n = num(v, fallback, min, max); if (!Number.isInteger(n)) throw fail('Cần nhập số nguyên.'); return n; };
const date = v => { const d = new Date(v); if (!v || !Number.isFinite(d.getTime())) throw fail('Ngày giờ không hợp lệ.'); return d; };
const interval = (a, b) => { const start = date(a), end = date(b); if (start <= new Date() || end <= start || end - start > 90 * 86400000) throw fail('Khoảng thuê phải ở tương lai, tối đa 90 ngày.'); return { start, end }; };
const names = ['partners', 'vehicles', 'routes', 'trips', 'rentals', 'bookings', 'emission_factors'];
const col = name => { if (!names.includes(name)) throw fail('Không tìm thấy tài nguyên.', 404); return store.db.collection(`transport_${name}`); };
const active = ['PENDING', 'CONFIRMED'];
const props = {
 partners: { name: 'string', logo: 'string', description: 'string', phone: 'string', email: 'string', status: ['active','suspended','deleted'], booking_mode: ['internal'], external_booking_url: [''], is_seed_data: 'bool' },
 vehicles: { partner_id: 'objectId', name: 'string', vehicle_type: ['car','electric_car','motorbike','electric_motorbike','bicycle','electric_bicycle','minibus','coach'], transport_type: ['shared','bus','rental'], capacity: 'number', fuel_type: ['petrol','diesel','electric','human'], amenities: 'array', images: 'array', status: ['active','suspended','deleted'], is_seed_data: 'bool' },
 routes: { origin: 'string', destination: 'string', distance_km: 'number', estimated_duration: 'number', status: ['active','suspended','deleted'] },
 trips: { partner_id: 'objectId', vehicle_id: 'objectId', route_id: 'objectId', transport_type: ['shared','bus'], departure_time: 'date', arrival_time: 'date', total_seats: 'number', available_seats: 'number', price_per_person: 'number', currency: ['VND'], status: ['active','suspended','deleted'], allocated_passengers: 'number', pickup_point: 'string', dropoff_point: 'string', baggage_policy: 'string', cancellation_hours: 'number', is_seed_data: 'bool' },
 rentals: { partner_id: 'objectId', vehicle_id: 'objectId', pickup_location: 'string', price_per_hour: 'number', price_per_day: 'number', deposit: 'number', rental_conditions: 'string', cancellation_hours: 'number', status: ['active','suspended','deleted'], is_seed_data: 'bool' },
 bookings: { user_id: 'string', vehicle_id: 'objectId', partner_id: 'objectId', trip_id: 'objectId', rental_id: 'objectId', booking_type: ['shared','bus','rental'], passenger_count: 'number', rental_start: 'date', rental_end: 'date', service_start: 'date', service_end: 'date', total_price: 'number', booking_status: ['PENDING','CONFIRMED','CANCELLED','COMPLETED','FAILED'], payment_status: ['NOT_REQUIRED','UNPAID','SIMULATED_PAID','SIMULATED_REFUNDED'], payment_method: ['wallet','card','bank'], payment_mode: ['internal'], payment_amount: 'number', payment_reference: 'string', paid_at: 'date', refunded_at: 'date', booking_code: 'string', is_seed_data: 'bool', cancellation_hours: 'number' },
 emission_factors: { fuel_type: ['petrol','diesel','electric','human'], vehicle_kg_per_km: 'number', baseline_kg_per_km: 'number', scope: 'string', source: 'string' }
};
const required = {
 partners: ['name','status','booking_mode','is_seed_data'], vehicles: ['partner_id','name','vehicle_type','transport_type','capacity','fuel_type','status','images','amenities','is_seed_data'], routes: ['origin','destination','distance_km','estimated_duration','status'], trips: ['partner_id','vehicle_id','route_id','transport_type','departure_time','arrival_time','total_seats','available_seats','price_per_person','currency','status','allocated_passengers','cancellation_hours','is_seed_data'], rentals: ['partner_id','vehicle_id','pickup_location','price_per_hour','price_per_day','deposit','rental_conditions','cancellation_hours','status','is_seed_data'], bookings: ['user_id','vehicle_id','partner_id','booking_type','service_start','total_price','booking_status','payment_status','booking_code','is_seed_data','cancellation_hours'], emission_factors: ['fuel_type','vehicle_kg_per_km','baseline_kg_per_km','scope','source']
};
props.trips.stops = 'stops';
Object.assign(props.bookings, { pickup_stop_id: 'string', dropoff_stop_id: 'string', pickup_stop: 'stop_snapshot', dropoff_stop: 'stop_snapshot', cancellation_start: 'date' });
const stopSchema = { bsonType: 'object', required: ['id','order','name','estimated_time','allow_pickup','allow_dropoff'], properties: {
 id: { bsonType: 'string' }, order: { bsonType: ['int','double','long'], minimum: 0 }, name: { bsonType: 'string' }, address: { bsonType: 'string' }, estimated_time: { bsonType: 'date' }, allow_pickup: { bsonType: 'bool' }, allow_dropoff: { bsonType: 'bool' }
} };
async function init() {
 await store.authenticate();
 for (const name of names) {
  const properties = Object.fromEntries(Object.entries(props[name]).map(([key,t]) => [key, Array.isArray(t) ? { enum: t } : t === 'number' ? { bsonType: ['int','double','long','decimal'], minimum: 0 } : t === 'array' ? { bsonType: 'array', items: { bsonType: 'string' } } : { bsonType: t }]));
  if (name === 'trips') properties.stops = { bsonType: 'array', minItems: 2, maxItems: 40, items: stopSchema };
  if (name === 'bookings') { properties.pickup_stop = stopSchema; properties.dropoff_stop = stopSchema; }
  const validator = { $jsonSchema: { bsonType: 'object', required: required[name], properties } };
  if (!(await store.db.listCollections({ name: `transport_${name}` }).hasNext())) await store.db.createCollection(`transport_${name}`, { validator });
  else await store.db.command({ collMod: `transport_${name}`, validator, validationLevel: 'strict' });
  await col(name).createIndex({ seed_key: 1 }, { unique: true, sparse: true });
 }
 await col('trips').createIndex({ transport_type: 1, status: 1, departure_time: 1, available_seats: 1 });
 await col('routes').createIndex({ origin: 1, destination: 1 });
 await col('rentals').createIndex({ status: 1, pickup_location: 1 });
 await col('rentals').createIndex({ vehicle_id: 1 }, { unique: true });
 await col('bookings').createIndex({ booking_code: 1 }, { unique: true });
 await col('bookings').createIndex({ user_id: 1, createdAt: -1 });
 await col('bookings').createIndex({ vehicle_id: 1, booking_status: 1, rental_start: 1, rental_end: 1 });
 await col('emission_factors').createIndex({ fuel_type: 1 }, { unique: true });
}
function validate(name, input, partial = false) {
 const out = {};
 for (const [key,t] of Object.entries(props[name] || {})) {
  if (input[key] === undefined) { if (!partial && required[name].includes(key)) throw fail(`Thiếu trường ${key}.`); continue; }
  let v = input[key];
  if (Array.isArray(t)) { if (!t.includes(v)) throw fail(`${key} không hợp lệ.`); }
  else if (t === 'objectId') v = id(v);
  else if (t === 'date') v = date(v);
  else if (t === 'number') v = num(v, undefined);
  else if (t === 'bool') { if (typeof v !== 'boolean') throw fail(`${key} không hợp lệ.`); }
  else if (t === 'stops') { if (!Array.isArray(v) || v.length < 2 || v.length > 40) throw fail('Lộ trình cần từ 2 đến 40 điểm dừng.'); }
  else if (key === 'images') { if (!Array.isArray(v) || v.length > 6 || v.some(x => typeof x !== 'string' || x.length > 1500000 || !(x.startsWith('/') || /^https:\/\//.test(x) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(x)))) throw fail('Ảnh xe không hợp lệ hoặc quá lớn.'); }
  else if (t === 'array') { if (!Array.isArray(v) || v.length > 30 || v.some(x => typeof x !== 'string' || x.length > 500)) throw fail(`${key} không hợp lệ.`); }
  else if (typeof v !== 'string' || v.length > 3000 || !v.trim()) throw fail(`${key} không hợp lệ.`);
  out[key] = v;
 }
 for (const k of ['capacity','total_seats','available_seats','allocated_passengers']) if (out[k] !== undefined && (!Number.isInteger(out[k]) || out[k] > 100 || (k !== 'available_seats' && out[k] < 1))) throw fail(`${k} không hợp lệ.`);
 return out;
}
function emissions(distance, factor, allocation = 1) {
 if (!factor) return null;
 const co2 = distance * factor.vehicle_kg_per_km / allocation;
 const baseline = distance * factor.baseline_kg_per_km;
 return { co2e_per_person: +co2.toFixed(3), baseline_co2e: +baseline.toFixed(3), reduction_kg: +(baseline - co2).toFixed(3), reduction_percent: baseline ? +((baseline - co2) / baseline * 100).toFixed(1) : null, distance_km: distance, allocated_passengers: allocation, scope: factor.scope, source: factor.source };
}
function rentalPrice(rental, start, end) {
 const hours = Math.ceil((end - start) / 3600000);
 if (hours <= 0) throw fail('Khoảng thuê không hợp lệ.');
 const days = Math.floor(hours / 24), rest = hours % 24;
 return days * rental.price_per_day + Math.min(rest * rental.price_per_hour, rest ? rental.price_per_day : 0);
}
// Native session retry is safe: this module has no network, payment or messaging side effects.
async function transaction(fn) {
 await store.authenticate();
 const hello = await store.db.admin().command({ hello: 1 });
 if (!hello.setName && hello.msg !== 'isdbgrid') throw fail('MongoDB cần replica set để đặt dịch vụ an toàn.', 503);
 const session = store.client.startSession();
 try { return await session.withTransaction(() => fn(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
 finally { await session.endSession(); }
}
module.exports = { store, col, names, props, required, fail, id, num, integer, date, interval, active, init, validate, emissions, rentalPrice, transaction };
