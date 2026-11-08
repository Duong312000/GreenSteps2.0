const { ServiceBooking } = require('../models');

function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid('Ngày lưu trú không hợp lệ.');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw invalid('Ngày lưu trú không hợp lệ.');
  return time;
}

// Room prices and inventory are always read from the catalog, never from the client.
async function lodgingPrice(service, { roomId, roomCount, bookingDate, checkOutDate, guests }) {
  if (!['stay', 'lodging'].includes(service.type)) throw invalid('Dịch vụ này không hỗ trợ đặt phòng.');
  const rooms = service.current_data?.rooms;
  const room = Array.isArray(rooms) ? rooms.find(item => item.id === roomId) : null;
  if (!room || !roomId) throw invalid('Loại phòng không tồn tại hoặc chưa được công bố.');
  const nights = (calendarDate(checkOutDate) - calendarDate(bookingDate)) / 86400000;
  if (!Number.isSafeInteger(nights) || nights < 1) throw invalid('Ngày trả phòng phải sau ngày nhận phòng.');
  if (!Number.isSafeInteger(roomCount) || roomCount < 1) throw invalid('Số lượng phòng không hợp lệ.');
  if (!Number.isSafeInteger(room.price_per_night) || room.price_per_night < 0
      || !Number.isSafeInteger(room.available_rooms) || room.available_rooms < 0
      || !Number.isSafeInteger(room.capacity) || room.capacity < 1) throw invalid('Thông tin giá, sức chứa hoặc số lượng phòng chưa đầy đủ.');
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > room.capacity * roomCount) throw invalid('Số khách vượt quá sức chứa phòng đã chọn.');
  const bookings = await ServiceBooking.findAll({ where: { service_id: service.id } });
  const reserved = bookings.filter(booking => booking.room_id === roomId
    && ['pending', 'deposit', 'confirmed', 'completed'].includes(booking.status)
    && !['expired', 'failed', 'cancelled'].includes(booking.payment_status)
    && (!booking.payment_deadline || Date.parse(booking.payment_deadline) > Date.now() || booking.payment_status !== 'pending')
    && booking.booking_date < checkOutDate && booking.check_out_date > bookingDate
  ).reduce((sum, booking) => sum + Number(booking.room_count || 0), 0);
  if (roomCount > room.available_rooms - reserved) throw invalid('Không còn đủ phòng trong khoảng ngày đã chọn. Vui lòng chọn lại.');
  const total = room.price_per_night * roomCount * nights;
  if (!Number.isSafeInteger(total)) throw invalid('Tổng tiền phòng không hợp lệ.');
  return { total, nights, room, roomCount };
}

module.exports = { lodgingPrice };
