const { randomUUID } = require('node:crypto');
const M = require('./models');
const { tripStops, selectStops, validateStops } = require('./stops');
const { col, fail, id, num, integer, date, interval, active, emissions, rentalPrice, transaction, validate } = M;
const literal = v => { if (typeof v !== 'string' || v.length > 150) throw fail('Từ khóa không hợp lệ.'); return { $regex: v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }; };
const page = q => ({ page: integer(q.page, 1, 1, 100000), limit: integer(q.limit, 12, 1, 100) });
const join = (from, field, as) => [{ $lookup: { from: `transport_${from}`, localField: field, foreignField: '_id', as } }, { $unwind: `$${as}` }];
function pipeline(kind, listing = false) {
 const vehicleJoin = listing ? [
  { $lookup: { from:'transport_vehicles',localField:'vehicle_id',foreignField:'_id',pipeline:[{ $project:{ images:0,image_sources:0 } }],as:'vehicle' } },
  { $unwind:'$vehicle' }
 ] : join('vehicles','vehicle_id','vehicle');
 const stages = [...join('partners','partner_id','partner'), ...vehicleJoin, { $match: { 'partner.status': 'active', 'vehicle.status': 'active' } }];
 if (kind === 'trips') stages.push(...join('routes','route_id','route'), { $match: { 'route.status': 'active' } }, { $lookup: { from: 'transport_emission_factors', localField: 'vehicle.fuel_type', foreignField: 'fuel_type', as: 'factors' } }, { $set: { factor: { $first: '$factors' }, duration_minutes: { $divide: [{ $subtract: ['$arrival_time','$departure_time'] },60000] } } }, { $set: { estimated_co2e: { $divide: [{ $multiply: ['$route.distance_km', '$factor.vehicle_kg_per_km'] }, '$allocated_passengers'] } } });
 return stages;
}
function publicItem(row, kind) {
 const { phone, email, external_booking_url, is_seed_data, seed_key, ...partner } = row.partner || {};
 const out = { ...row, partner };
 delete out.factors; delete out.factor; delete out.seed_key; delete out.reservation_version;
 if (kind === 'trips') {
  out.sustainability = emissions(row.route.distance_km, row.factor, row.allocated_passengers);
  out.stops = tripStops(row);
 }
 out.booking_notice = 'Tiếp tục để chọn phương thức thanh toán. Với dịch vụ nội bộ GreenSteps, không trừ tiền thật hoặc gửi đặt chỗ đến nhà vận chuyển bên ngoài.';
 return out;
}
async function search(kind, q) {
 const paging = page(q), match = { status: 'active' }, filters = {};
 if (kind === 'trips') {
  if (q.type && !['shared','bus'].includes(q.type)) throw fail('Loại chuyến không hợp lệ.');
  match.transport_type = q.type || 'shared';
  match.departure_time = { $gt: new Date() };
  if (q.date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) throw fail('Ngày không hợp lệ.'); const start = date(`${q.date}T00:00:00+07:00`); match.departure_time = { $gte: new Date(Math.max(start.getTime(), Date.now())), $lt: new Date(+start + 86400000) }; }
  match.available_seats = { $gte: Math.max(integer(q.passengers,1),integer(q.minSeats,1)) };
  if (q.origin) filters['route.origin'] = literal(q.origin);
  if (q.destination) filters['route.destination'] = literal(q.destination);
  if (q.departurePeriod) {
   const ranges = { morning:[5,12], afternoon:[12,18], evening:[18,24], night:[0,5] };
   const r = ranges[q.departurePeriod]; if (!r) throw fail('Khung giờ không hợp lệ.');
   filters.$expr = { $and: [{ $gte: [{ $hour: { date:'$departure_time',timezone:'Asia/Ho_Chi_Minh' } },r[0]] }, { $lt: [{ $hour: { date:'$departure_time',timezone:'Asia/Ho_Chi_Minh' } },r[1]] }] };
  }
 } else {
  if (q.location) match.pickup_location = literal(q.location);
  if (q.vehicleType) filters['vehicle.vehicle_type'] = q.vehicleType;
  if (!!q.pickupDate !== !!q.returnDate) throw fail('Cần nhập cả thời gian nhận và trả xe.');
 }
 if (q.fuelType) { if (!['petrol','diesel','electric','human'].includes(q.fuelType)) throw fail('Năng lượng không hợp lệ.'); filters['vehicle.fuel_type'] = q.fuelType; }
 if (q.vehicleType) filters['vehicle.vehicle_type'] = q.vehicleType;
 if (q.minSeats && kind === 'rentals') filters['vehicle.capacity'] = { $gte: integer(q.minSeats,1) };
 const priceField = kind === 'trips' ? 'price_per_person' : 'price_per_day';
 if (q.minPrice || q.maxPrice) match[priceField] = { $gte: num(q.minPrice,0), $lte: num(q.maxPrice,1e10) };
 const stages = [{ $match: match }, ...pipeline(kind,true), { $match: filters }];
 if (q.lowEmission === 'true' && kind === 'trips') stages.push({ $match: { $expr: { $lt: ['$estimated_co2e',{ $multiply: ['$route.distance_km','$factor.baseline_kg_per_km'] }] } } });
 if (kind === 'rentals' && q.pickupDate) {
  const { start,end } = interval(q.pickupDate,q.returnDate);
  stages.push({ $lookup: { from: 'transport_bookings', let: { v:'$vehicle_id' }, pipeline: [{ $match: { booking_status: { $in:active }, rental_start: { $lt:end }, rental_end: { $gt:start }, $expr: { $eq:['$vehicle_id','$$v'] } } }], as:'overlaps' } }, { $match: { overlaps: { $size:0 } } }, { $unset:'overlaps' });
 }
 const sorts = { price:[priceField,1], price_desc:[priceField,-1], departure:['departure_time',1], duration:['duration_minutes',1], co2:['estimated_co2e',1] };
 if (q.sortBy && !sorts[q.sortBy]) throw fail('Sắp xếp không hợp lệ.');
 const [key, direction] = sorts[q.sortBy] || sorts[kind === 'trips' ? 'departure':'price'];
 // Keep image payloads out of the blocking sort and count. Fetch a single cover
 // only for the current page; the detail endpoint still returns the full gallery.
 const coverStages = [
  { $lookup: { from:'transport_vehicles',localField:'vehicle_id',foreignField:'_id',pipeline:[{ $project:{ _id:0,images:{ $slice:[{ $ifNull:['$images',[]] },1] } } }],as:'cover' } },
  { $set:{ 'vehicle.images':{ $ifNull:[{ $arrayElemAt:['$cover.images',0] },[]] } } },
  { $unset:'cover' }
 ];
 stages.push({ $facet: { data:[{ $sort:{ [key]:direction,_id:1 } },{ $skip:(paging.page-1)*paging.limit },{ $limit:paging.limit },...coverStages],count:[{ $count:'total' }] } });
 const [result] = await col(kind).aggregate(stages).toArray();
 return { data:result.data.map(x => publicItem(x,kind)), total:result.count[0]?.total || 0, ...paging };
}
async function detail(kind, value, q = {}) {
 const [row] = await col(kind).aggregate([{ $match: { _id:id(value),status:'active' } }, ...pipeline(kind)]).toArray();
 if (!row) throw fail('Dịch vụ đã ngừng hoạt động hoặc không còn tồn tại.',404);
 const out = publicItem(row,kind);
 out.available = kind === 'trips' ? row.available_seats > 0 && row.departure_time > new Date() : true;
 if (kind === 'rentals' && (q.pickupDate || q.returnDate)) {
  const { start,end } = interval(q.pickupDate,q.returnDate);
  out.available = !await col('bookings').findOne({ vehicle_id:row.vehicle_id,booking_status: { $in:active },rental_start: { $lt:end },rental_end: { $gt:start } });
  out.quote = { total_price:rentalPrice(row,start,end),deposit:row.deposit,rental_start:start,rental_end:end };
 }
 return out;
}
async function lockRelated(service, session) {
 for (const [name,key] of [['partners','partner_id'],['vehicles','vehicle_id']]) {
  if (!(await col(name).findOneAndUpdate({ _id:service[key],status:'active' },{ $inc: { reservation_version:1 } },{ session,returnDocument:'after' }))) throw fail('Phương tiện hoặc đối tác đang ngừng hoạt động.',409);
 }
 if (service.route_id && !(await col('routes').findOneAndUpdate({ _id:service.route_id,status:'active' },{ $inc:{ reservation_version:1 } },{ session }))) throw fail('Tuyến đường ngừng hoạt động.',409);
}
async function book(user, body) {
 if (!!body.trip_id === !!body.rental_id) throw fail('Chọn một chuyến xe hoặc xe thuê.');
 const kind = body.trip_id ? 'trips':'rentals', serviceId = id(body.trip_id || body.rental_id);
 const userRecord = await M.store.models.User.collection.findOne({ id:user.id });
 if (!userRecord) throw fail('Tài khoản không tồn tại.',401);
 return transaction(async session => {
  const service = await col(kind).findOne({ _id:serviceId,status:'active' },{ session });
  if (!service) throw fail('Dịch vụ không khả dụng.',409);
  await lockRelated(service,session);
  const booking = { _id:new (require('mongodb').ObjectId)(),user_id:user.id,partner_id:service.partner_id,vehicle_id:service.vehicle_id,booking_type:kind === 'trips' ? service.transport_type:'rental',booking_status:'PENDING',payment_status:'UNPAID',is_seed_data:!!service.is_seed_data,booking_code:`GS-T-${randomUUID().slice(0,12).toUpperCase()}`,cancellation_hours:service.cancellation_hours,createdAt:new Date(),updatedAt:new Date() };
  if (kind === 'trips') {
   const count = integer(body.passenger_count,1,1,100);
   const { pickup, dropoff } = selectStops(service, body.pickup_stop_id, body.dropoff_stop_id);
   if (service.departure_time <= new Date()) throw fail('Chuyến xe đã khởi hành.',409);
   const result = await col('trips').updateOne({ _id:serviceId,status:'active',available_seats: { $gte:count } },{ $inc: { available_seats:-count },$set: { updatedAt:new Date() } },{ session });
   if (!result.modifiedCount) throw fail('Không đủ chỗ. Vui lòng chọn chuyến khác.',409);
   Object.assign(booking,{ trip_id:serviceId,passenger_count:count,pickup_stop_id:pickup.id,dropoff_stop_id:dropoff.id,pickup_stop:pickup,dropoff_stop:dropoff,service_start:pickup.estimated_time,service_end:dropoff.estimated_time,cancellation_start:service.departure_time,total_price:service.price_per_person*count });
  } else {
   const { start,end } = interval(body.rental_start,body.rental_end);
   if (await col('bookings').findOne({ vehicle_id:service.vehicle_id,booking_status: { $in:active },rental_start: { $lt:end },rental_end: { $gt:start } },{ session })) throw fail('Xe đã có người đặt trong khoảng thời gian này.',409);
   Object.assign(booking,{ rental_id:serviceId,rental_start:start,rental_end:end,service_start:start,service_end:end,total_price:rentalPrice(service,start,end),deposit:service.deposit });
  }
  await col('bookings').insertOne(booking,{ session });
  return booking;
 });
}
async function changeStatus(value, user, target, admin = false) {
 if (!['CANCELLED','FAILED','CONFIRMED','COMPLETED'].includes(target)) throw fail('Trạng thái không hợp lệ.');
 return transaction(async session => {
  const b = await col('bookings').findOne({ _id:id(value),...(!admin ? { user_id:user.id }:{}) },{ session });
  if (!b) throw fail('Không tìm thấy đặt chỗ.',404);
  if (b.booking_status === target) return b;
  const allowed = { PENDING:['CONFIRMED','CANCELLED','FAILED'],CONFIRMED:['CANCELLED','COMPLETED'] };
  if (!allowed[b.booking_status]?.includes(target) || (!admin && target !== 'CANCELLED')) throw fail('Không thể chuyển trạng thái.',409);
  if (target === 'COMPLETED' && new Date() < (b.service_end || b.rental_end || b.service_start)) throw fail('Dịch vụ chưa kết thúc.',409);
  if (!admin && +(b.cancellation_start || b.service_start) - Date.now() < b.cancellation_hours*3600000) throw fail('Đã quá thời hạn hủy.',409);
  // Serializes cancellations and reservations for the same vehicle, across API processes.
  await col('vehicles').updateOne({ _id:b.vehicle_id },{ $inc:{ reservation_version:1 } },{ session });
  if (['CANCELLED','FAILED'].includes(target) && b.trip_id) await col('trips').updateOne({ _id:b.trip_id },{ $inc:{ available_seats:b.passenger_count },$set:{ updatedAt:new Date() } },{ session });
  const update = { booking_status:target,updatedAt:new Date() };
  if (['CANCELLED','FAILED'].includes(target) && b.payment_status === 'SIMULATED_PAID') {
   Object.assign(update,{ payment_status:'SIMULATED_REFUNDED',refunded_at:new Date() });
  }
  await col('bookings').updateOne({ _id:b._id },{ $set:update },{ session });
  return { ...b,...update };
 });
}
async function pay(value, user, body) {
 if (!['wallet','card','bank'].includes(body.payment_method)) throw fail('Phương thức thanh toán không hợp lệ.');
 if (body.accepted_terms !== true) throw fail('Vui lòng đồng ý điều kiện thanh toán.');
 return transaction(async session => {
  const b = await col('bookings').findOne({ _id:id(value),user_id:user.id },{ session });
  if (!b) throw fail('Không tìm thấy đặt chỗ.',404);
  if (b.payment_status === 'SIMULATED_PAID' && ['CONFIRMED','COMPLETED'].includes(b.booking_status)) return b;
  if (!active.includes(b.booking_status)) throw fail('Đơn đã kết thúc hoặc bị hủy, không thể thanh toán.',409);
  if (!b.is_seed_data) throw fail('Thanh toán cho dịch vụ này chưa được cấu hình.',503);
  if (b.service_start <= new Date()) throw fail('Đã quá giờ khởi hành hoặc nhận xe.',409);
  const service = await col(b.trip_id ? 'trips':'rentals').findOne({ _id:b.trip_id || b.rental_id,status:'active' },{ session });
  if (!service) throw fail('Dịch vụ không còn hoạt động. Bạn có thể hủy đơn để trả chỗ.',409);
  if (b.trip_id && service.departure_time <= new Date()) throw fail('Chuyến xe đã khởi hành.',409);
  await lockRelated(service,session);
  // Only internal settlement is supported for seed services. Never call the
  // wallet ledger, a bank/QR provider, a card gateway, SMS or carrier APIs here.
  const update = { booking_status:'CONFIRMED',payment_status:'SIMULATED_PAID',payment_mode:'internal',payment_method:body.payment_method,payment_amount:b.total_price,payment_reference:`GS-TP-${randomUUID().toUpperCase()}`,paid_at:new Date(),updatedAt:new Date() };
  await col('bookings').updateOne({ _id:b._id },{ $set:update },{ session });
  return { ...b,...update };
 });
}
async function bookingList(user, q, admin = false) {
 const paging = page(q), match = admin ? {} : { user_id:user.id };
 if (q.status) { if (!['PENDING','CONFIRMED','CANCELLED','FAILED','COMPLETED'].includes(q.status)) throw fail('Trạng thái không hợp lệ.'); match.booking_status=q.status; }
 if (q.search) match.booking_code=literal(q.search);
 const [data,total] = await Promise.all([col('bookings').find(match).sort({ createdAt:-1 }).skip((paging.page-1)*paging.limit).limit(paging.limit).toArray(),col('bookings').countDocuments(match)]);
 return { data:await Promise.all(data.map(enrichBooking)),total,...paging };
}
async function enrichBooking(b) {
 const [partner,vehicle,trip,rental] = await Promise.all([col('partners').findOne({ _id:b.partner_id },{ projection:{ name:1,logo:1 } }),col('vehicles').findOne({ _id:b.vehicle_id },{ projection:{ name:1,images:1 } }),b.trip_id ? col('trips').findOne({ _id:b.trip_id }):null,b.rental_id ? col('rentals').findOne({ _id:b.rental_id }):null]);
 return { ...b,partner,vehicle,trip,rental,can_pay:active.includes(b.booking_status) && ['UNPAID','NOT_REQUIRED'].includes(b.payment_status) && b.service_start > new Date() && (!trip || trip.departure_time > new Date()),can_cancel:active.includes(b.booking_status) && +(b.cancellation_start || b.service_start)-Date.now() >= b.cancellation_hours*3600000,notice:b.payment_status === 'SIMULATED_PAID' ? 'Đã hoàn tất thanh toán trong GreenSteps. Không trừ tiền thật và không phát sinh đặt chỗ với nhà vận chuyển bên ngoài.' : b.payment_status === 'SIMULATED_REFUNDED' ? 'Đã hủy đơn và hoàn tác thanh toán nội bộ. Không có giao dịch tiền thật.' : 'Chỗ đã được giữ để bạn tiếp tục thanh toán. Không cần Admin duyệt; dịch vụ nội bộ không trừ tiền thật.' };
}
async function adminSave(name,value,body) {
 if (['bookings'].includes(name)) throw fail('Dùng API chuyển trạng thái booking.');
 if (!M.names.includes(name)) throw fail('Không tìm thấy tài nguyên.',404);
 const data = validate(name,body,!!value);
 return transaction(async session => {
  const existing = value ? await col(name).findOne({ _id:id(value) },{ session }):null;
  if (value && !existing) throw fail('Không tìm thấy dữ liệu.',404);
  const row = { ...existing,...data,updatedAt:new Date() };
  if (!value) Object.assign(row,{ _id:new (require('mongodb').ObjectId)(),createdAt:new Date() });
  if (existing?.is_seed_data && data.is_seed_data === false) throw fail('Không thể bỏ đánh dấu dữ liệu nội bộ.');
  if (row.partner_id) {
   const p = await col('partners').findOne({ _id:row.partner_id },{ session }); if (!p) throw fail('Đối tác không tồn tại.'); if (p.is_seed_data) row.is_seed_data=true;
  }
  if (row.vehicle_id) {
   const v = await col('vehicles').findOne({ _id:row.vehicle_id },{ session }); if (!v || !v.partner_id.equals(row.partner_id)) throw fail('Phương tiện không thuộc đối tác.');
   if (v.transport_type !== (name === 'rentals' ? 'rental':row.transport_type)) throw fail('Loại phương tiện không phù hợp.');
   if (v.is_seed_data) row.is_seed_data=true;
   if (row.total_seats > v.capacity) throw fail('Số ghế vượt sức chứa phương tiện.');
  }
  if (name === 'trips') {
   if (!await col('routes').findOne({ _id:row.route_id },{ session })) throw fail('Tuyến đường không tồn tại.');
   if (row.arrival_time <= row.departure_time || row.available_seats > row.total_seats || row.allocated_passengers > row.total_seats) throw fail('Lịch trình hoặc số ghế không hợp lệ.');
   if (row.stops) row.stops = validateStops(row.stops, row.departure_time, row.arrival_time);
  }
  if (existing && ['trips','rentals','vehicles'].includes(name)) {
   const key = name === 'trips' ? 'trip_id':name === 'rentals' ? 'rental_id':'vehicle_id';
   const held = await col('bookings').find({ [key]:existing._id,booking_status:{ $in:active } },{ session }).toArray();
   if (held.length) {
    const mutable = ['status','price_per_person','price_per_hour','price_per_day','total_seats'];
    if (Object.keys(data).some(k => !mutable.includes(k) && JSON.stringify(data[k]) !== JSON.stringify(existing[k]))) throw fail('Dịch vụ đang có đặt chỗ; chỉ cập nhật trạng thái, giá hoặc tổng ghế.',409);
    if (name === 'trips') { const reserved = existing.total_seats-existing.available_seats; if (row.total_seats < reserved) throw fail('Không thể giảm ghế dưới số đã giữ.',409); row.available_seats=row.total_seats-reserved; }
   }
  }
  if (value) await col(name).replaceOne({ _id:row._id },row,{ session }); else await col(name).insertOne(row,{ session });
  return row;
 });
}
module.exports = { search,detail,book,pay,changeStatus,bookingList,enrichBooking,adminSave,literal,page,publicItem };

