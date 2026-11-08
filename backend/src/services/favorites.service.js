const { createHash } = require('node:crypto');
const { store, Favorite, Schedule, ScheduleSample, ScheduleCustom, UserSchedule, GreenService } = require('../models');
const types = ['tour', 'service', 'itinerary', 'place', 'transport_trip', 'transport_rental'];
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
function identity(type, targetId) {
  if (!types.includes(type) || typeof targetId !== 'string' || !targetId.trim() || targetId.length > 240 || /[\x00-\x1f]/.test(targetId)) throw fail('Đối tượng yêu thích không hợp lệ.');
  return { type, targetId };
}
const key = (userId, type, targetId) => createHash('sha256').update(JSON.stringify([userId, type, targetId])).digest('hex');
const text = (v, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
function imageUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return '';
  if (/^https?:\/\//i.test(value) || /^\/?(?:image|images|uploads)\/[a-z\d_./% -]+$/i.test(value)) return value;
  return '';
}
function placeSnapshot(body) {
  const name = text(body.name || body.title);
  if (!name) throw fail('Cần tên địa điểm để lưu yêu thích.');
  const coordinate = (value, limit) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) throw fail('Tọa độ địa điểm không hợp lệ.');
    return value;
  };
  const lat = coordinate(body.lat, 90), lng = coordinate(body.lng, 180);
  return { name, destination: text(body.destination), image: imageUrl(body.image || body.img), price: number(body.cost ?? body.price), price_unit: 'tham khảo', lat, lng, place_type: text(body.type || body.place_type, 30), available: true, url: null,
    map_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat !== null && lng !== null ? `${lat},${lng}` : name)}` };
}
async function resolve(type, targetId, userId, body = {}) {
  identity(type, targetId);
  if (type === 'place') return placeSnapshot(body);
  if (type === 'service') {
    const service = await GreenService.findByPk(targetId);
    if (!service || service.current_data?.catalogHidden || (service.status && !['active', 'approved'].includes(service.status))) throw fail('Dịch vụ không còn khả dụng.', 404);
    return { name: service.name_service, destination: service.destination, image: imageUrl(service.image_url || service.current_data?.img), price: service.current_data?.priceStatus === 'on_request' ? null : number(service.cost), price_unit: service.current_data?.priceStatus === 'reference' ? 'tham khảo' : '', place_type: service.type === 'stay' ? 'lodging' : service.type === 'food' ? 'dining' : service.type, lat: service.current_data?.lat, lng: service.current_data?.lng, available: true, url: `/services/${encodeURIComponent(targetId)}` };
  }
  if (type === 'tour' || type === 'itinerary') {
    const [entity, schedule] = await Promise.all([
      (type === 'tour' ? ScheduleSample : ScheduleCustom).findByPk(targetId), Schedule.findByPk(targetId)
    ]);
    if (!entity || !schedule) throw fail('Tour hoặc lịch trình không còn tồn tại.', 404);
    if (type === 'itinerary' && entity.user_id !== userId && !await UserSchedule.findOne({ where: { schedule_id: targetId, user_id: userId } })) throw fail('Bạn không có quyền xem lịch trình này.', 404);
    return { name: schedule.tour_name, destination: schedule.destination, image: imageUrl(schedule.image_url), price: number(type === 'tour' ? entity.cost : entity.total_cost), price_unit: type === 'tour' ? '/ người' : 'dự kiến', days: schedule.days, available: true, url: `/${type === 'tour' ? 'tours' : 'schedule'}/${encodeURIComponent(targetId)}` };
  }
  const detail = await require('../transport/service').detail(type === 'transport_trip' ? 'trips' : 'rentals', targetId);
  return { name: detail.vehicle.name, destination: detail.route ? `${detail.route.origin} → ${detail.route.destination}` : detail.pickup_location,
    image: imageUrl(detail.vehicle.images?.[0]), price: number(detail.price_per_person ?? detail.price_per_day), price_unit: type === 'transport_trip' ? '/ người' : '/ ngày',
    available: detail.available, url: `/transport/${type === 'transport_trip' ? 'trips' : 'rentals'}/${targetId}` };
}
async function hydrate(row) {
  try {
    const live = await resolve(row.target_type, row.target_id, row.user_id, row.snapshot);
    return { id: row.id, target_type: row.target_type, target_id: row.target_id, createdAt: row.createdAt, ...live };
  } catch (error) {
    if (![400, 404].includes(error.statusCode || error.status)) throw error;
    return { id: row.id, target_type: row.target_type, target_id: row.target_id, createdAt: row.createdAt, ...row.snapshot, available: false, url: null, map_url: null };
  }
}
async function save(userId, type, targetId, body = {}) {
  const snapshot = await resolve(type, targetId, userId, type === 'place' ? body : {});
  const id = key(userId, type, targetId), now = new Date();
  const row = { _id: id, id, user_id: userId, target_type: type, target_id: targetId, snapshot, createdAt: now, updatedAt: now, _rev: 0 };
  Favorite.validate(row);
  try { await Favorite.collection.updateOne({ _id: id }, { $setOnInsert: row }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  return hydrate(await Favorite.collection.findOne({ _id: id, user_id: userId }));
}
async function remove(userId, type, targetId) {
  identity(type, targetId);
  await Favorite.collection.deleteOne({ _id: key(userId, type, targetId), user_id: userId });
}
async function list(userId, query = {}) {
  const page = Number(query.page || 1), limit = Number(query.limit || 30);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw fail('Phân trang không hợp lệ.');
  const filter = { user_id: userId };
  if (query.type) { identity(query.type, 'filter'); filter.target_type = query.type; }
  const [rows, total] = await Promise.all([
    Favorite.collection.find(filter).sort({ createdAt: -1, id: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
    Favorite.collection.countDocuments(filter)
  ]);
  return { data: await Promise.all(rows.map(hydrate)), page, limit, total };
}
async function ensureSchema() {
  await store.authenticate();
  const name = Favorite.collection.collectionName;
  const validator = { $jsonSchema: { bsonType:'object', required:['id','user_id','target_type','target_id','snapshot','createdAt','updatedAt'], properties: {
    _id:{bsonType:'string'},id:{bsonType:'string'},user_id:{bsonType:'string',minLength:1},
    target_type:{enum:types},target_id:{bsonType:'string',minLength:1,maxLength:240},snapshot:{bsonType:'object'},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'}
  } } };
  if (!await store.db.listCollections({name}).hasNext()) await store.db.createCollection(name,{validator});
  else await store.db.command({collMod:name,validator,validationLevel:'strict'});
  await Favorite.collection.createIndex({user_id:1,target_type:1,target_id:1},{unique:true});
  await Favorite.collection.createIndex({user_id:1,createdAt:-1});
}
module.exports = { types, identity, key, placeSnapshot, resolve, save, remove, list, ensureSchema };
