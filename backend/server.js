require('./src/config/env');
const app = require('./src/app');
const { store } = require('./src/models');
const bookingController = require('./src/controllers/booking.controller');
const { ensureDefaultBookingAddons } = require('./src/services/booking-pricing.service');

async function start() {
  const port = process.env.PORT || 5055;
  const server = app.listen(port, () => console.log(`GreenSteps MongoDB API: http://localhost:${port}/api`));
  let expirySweep;
  const shutdown = () => {
    if (expirySweep) clearInterval(expirySweep);
    server.close(async () => { await store.close(); process.exit(0); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    // Bind the web service before contacting Atlas or building indexes. On a
    // cold start, hosting platforms need the HTTP port to open promptly; API
    // requests will report database unavailability until this initialization
    // completes, rather than leaving the service with no listener at all.
    await store.authenticate();
    await store.sync();
    await require('./src/transport/models').init();
    await ensureDefaultBookingAddons();
    expirySweep = setInterval(() => {
      bookingController.expirePendingBookings().catch(error => {
        console.error('Booking expiry sweep failed:', error.message);
      });
    }, 30_000);
    expirySweep.unref();
    await bookingController.expirePendingBookings();
    console.log('MongoDB ready.');
  } catch (error) {
    await new Promise(resolve => server.close(resolve));
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
    throw error;
  }
  return server;
}
if (require.main === module) start().catch(error => {
  console.error('MongoDB startup failed:', error.message);
  process.exitCode = 1;
  store.close();
});
module.exports = { app, start };
