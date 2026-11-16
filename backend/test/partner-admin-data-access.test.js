const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const bookingController = require('../src/controllers/booking.controller');
const serviceController = require('../src/controllers/service.controller');
const changeRequestController = require('../src/controllers/change-request.controller');

function mockResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('provider booking list scopes to its own service and tour products and batch loads details', async () => {
  const saved = {
    venderFind: models.Vender.findOne,
    serviceFind: models.GreenService.findAll,
    serviceBookingFind: models.ServiceBooking.findAll,
    providerFind: models.Provider.findOne,
    sampleFind: models.ScheduleSample.findAll,
    tourBookingFind: models.TourBooking.findAll,
    scheduleFind: models.Schedule.findAll
  };
  let serviceDetailQueries = 0;
  let scheduleDetailQueries = 0;
  models.Vender.findOne = async () => ({ id: 'vendor-a' });
  models.GreenService.findAll = async options => {
    if (options.where.vender_id) return [{ id: 'service-a' }];
    serviceDetailQueries++;
    return [{ id: 'service-a', image_url: '/service-a.jpg', destination: 'Huế' }];
  };
  models.ServiceBooking.findAll = async () => [{
    id: 'booking-service-a', service_id: 'service-a', fullname: 'Customer',
    name_service: 'Huế stay', booking_date: '2026-11-12', value: 1000, status: 'completed'
  }];
  models.Provider.findOne = async () => ({ id: 'provider-record-a' });
  models.ScheduleSample.findAll = async () => [{ id: 'schedule-a', provider_id: 'provider-record-a' }];
  models.TourBooking.findAll = async () => [{
    id: 'booking-tour-a', schedule_id: 'schedule-a', fullname: 'Customer',
    tour_name: 'Huế tour', booking_date: '2026-11-13', value: 2000, status: 'deposit'
  }];
  models.Schedule.findAll = async () => {
    scheduleDetailQueries++;
    return [{ id: 'schedule-a', image_url: '/tour-a.jpg', destination: 'Huế' }];
  };
  try {
    const req = { user: { id: 'provider-user-a', role: 'provider' }, query: { providerId: 'provider-user-a' } };
    const res = mockResponse();
    await bookingController.getBookings(req, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.map(row => row.id), ['booking-service-a', 'booking-tour-a']);
    assert.equal(res.body.find(row => row.id === 'booking-service-a').destination, 'Huế');
    assert.equal(serviceDetailQueries, 1);
    assert.equal(scheduleDetailQueries, 1);
  } finally {
    models.Vender.findOne = saved.venderFind;
    models.GreenService.findAll = saved.serviceFind;
    models.ServiceBooking.findAll = saved.serviceBookingFind;
    models.Provider.findOne = saved.providerFind;
    models.ScheduleSample.findAll = saved.sampleFind;
    models.TourBooking.findAll = saved.tourBookingFind;
    models.Schedule.findAll = saved.scheduleFind;
  }
});

test('provider cannot request another provider booking or change-request data', async () => {
  const res = mockResponse();
  await bookingController.getBookings({
    user: { id: 'provider-user-a', role: 'provider' },
    query: { providerId: 'provider-user-b' }
  }, res, error => { throw error; });
  assert.equal(res.statusCode, 403);

  const changeRes = mockResponse();
  await changeRequestController.getChangeRequests({
    user: { id: 'provider-user-a', role: 'provider' },
    query: { providerId: 'provider-user-b' }
  }, changeRes, error => { throw error; });
  assert.equal(changeRes.statusCode, 403);
});

test('provider cannot list another provider services by changing the URL id', async () => {
  const res = mockResponse();
  await serviceController.getProviderServices({
    params: { providerId: 'provider-user-b' },
    user: { id: 'provider-user-a', role: 'provider' }
  }, res, error => { throw error; });
  assert.equal(res.statusCode, 403);
});
