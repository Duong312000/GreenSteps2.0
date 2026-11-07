const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ServiceBooking, GreenService } = require('../src/models');
const { lodgingPrice } = require('../src/services/lodging-pricing.service');
const { calculatePricing } = require('../src/services/booking-pricing.service');

test('lodging validates catalog data, overlapping inventory and room-night pricing', async () => {
  const original = ServiceBooking.findAll;
  const originalService = GreenService.findByPk;
  const service = { id: 'stay-test', type: 'lodging', current_data: {
    rooms: [{ id: 'studio', price_per_night: 500000, available_rooms: 3, capacity: 2 }]
  } };
  const request = { roomId: 'studio', roomCount: 2, bookingDate: '2026-12-30', checkOutDate: '2027-01-02', guests: 4 };
  try {
    ServiceBooking.findAll = async () => [];
    assert.equal((await lodgingPrice(service, request)).total, 3000000);
    GreenService.findByPk = async () => ({ ...service, cost: 1 });
    const quote = await calculatePricing({ type: 'service', targetId: service.id, guestCount: 4, ...request });
    assert.equal(quote.tourSubtotal, 3000000);
    assert.equal(quote.total, 2880000);
    assert.equal(quote.amountDueNow, 864000);
    await assert.rejects(lodgingPrice(service, { ...request, checkOutDate: '2026-12-30' }), /Ngày trả phòng/);
    await assert.rejects(lodgingPrice(service, { ...request, checkOutDate: '2027-02-30' }), /Ngày lưu trú/);
    await assert.rejects(lodgingPrice(service, { ...request, guests: 5 }), /sức chứa/);
    await assert.rejects(lodgingPrice(service, { ...request, roomId: 'missing' }), /không tồn tại/);
    await assert.rejects(lodgingPrice(service, { ...request, roomCount: 4 }), /Không còn đủ phòng/);
    ServiceBooking.findAll = async () => [{ room_id: 'studio', room_count: 2, status: 'confirmed', booking_date: '2026-12-31', check_out_date: '2027-01-03' }];
    await assert.rejects(lodgingPrice(service, request), /Không còn đủ phòng/);
    // Adjacent stays do not consume inventory for the requested dates.
    assert.equal((await lodgingPrice(service, { ...request, bookingDate: '2027-01-03', checkOutDate: '2027-01-04' })).total, 1000000);
    delete service.current_data.rooms[0].available_rooms;
    await assert.rejects(lodgingPrice(service, request), /chưa đầy đủ/);
  } finally {
    ServiceBooking.findAll = original;
    GreenService.findByPk = originalService;
  }
});
