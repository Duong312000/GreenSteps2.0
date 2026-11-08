const { fail } = require('./models');

// Stable IDs include the trip ID for legacy trips, so another trip's stops
// can never accidentally be accepted as an endpoint.
function tripStops(trip) {
  if (trip.stops?.length) return validateStops(trip.stops, trip.departure_time, trip.arrival_time);
  const key = String(trip._id);
  return [
    { id: `${key}-start`, order: 0, name: trip.pickup_point || trip.route?.origin || 'Điểm đầu tuyến', address: '', estimated_time: new Date(trip.departure_time), allow_pickup: true, allow_dropoff: false },
    { id: `${key}-end`, order: 1, name: trip.dropoff_point || trip.route?.destination || 'Điểm cuối tuyến', address: '', estimated_time: new Date(trip.arrival_time), allow_pickup: false, allow_dropoff: true }
  ];
}

function validateStops(input, departure, arrival) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 40) throw fail('Lộ trình cần từ 2 đến 40 điểm dừng.');
  const seen = new Set();
  const stops = input.map(s => {
    if (!s || typeof s.id !== 'string' || !/^[\w-]{1,100}$/.test(s.id) || seen.has(s.id) || !Number.isInteger(s.order) || s.order < 0 || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 200 || typeof s.allow_pickup !== 'boolean' || typeof s.allow_dropoff !== 'boolean' || (s.address !== undefined && (typeof s.address !== 'string' || s.address.length > 500))) throw fail('Thông tin điểm dừng không hợp lệ.');
    seen.add(s.id);
    const time = new Date(s.estimated_time);
    if (!Number.isFinite(+time)) throw fail('Giờ điểm dừng không hợp lệ.');
    return { id: s.id, order: s.order, name: s.name.trim(), address: s.address || '', estimated_time: time, allow_pickup: s.allow_pickup, allow_dropoff: s.allow_dropoff };
  }).sort((a, b) => a.order - b.order);
  for (let i = 0; i < stops.length; i++) {
    if (+stops[i].estimated_time < +new Date(departure) || +stops[i].estimated_time > +new Date(arrival) || (i && (stops[i].order === stops[i-1].order || +stops[i].estimated_time <= +stops[i-1].estimated_time))) throw fail('Thứ tự hoặc giờ điểm dừng không khớp lịch trình.');
  }
  if (!stops.some((s, i) => s.allow_pickup && stops.slice(i+1).some(d => d.allow_dropoff))) throw fail('Lộ trình cần có cặp điểm đón và trả hợp lệ.');
  return stops;
}

function selectStops(trip, pickupId, dropoffId) {
  const stops = tripStops(trip);
  // Older clients may omit both IDs only for a legacy two-endpoint trip.
  if (!trip.stops?.length && pickupId === undefined && dropoffId === undefined) {
    pickupId = stops[0].id; dropoffId = stops[1].id;
  }
  const pickup = stops.find(s => s.id === pickupId);
  const dropoff = stops.find(s => s.id === dropoffId);
  if (!pickup?.allow_pickup || !dropoff?.allow_dropoff || pickup.order >= dropoff.order) throw fail('Chọn điểm đón và điểm trả hợp lệ thuộc chuyến xe; điểm trả phải nằm sau điểm đón.');
  return { pickup, dropoff };
}

module.exports = { tripStops, validateStops, selectStops };
