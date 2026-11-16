require('./src/config/env');
const app = require('./src/app');
const { store } = require('./src/models');
const bookingController = require('./src/controllers/booking.controller');

async function start() {
  const port = process.env.PORT || 5055;
  const server = app.listen(port, () => console.log(`GreenSteps MongoDB API: http://localhost:${port}/api`));
  let expirySweep;
  let expirySweepDatabaseUnavailable = false;
  const shutdown = () => {
    if (expirySweep) clearInterval(expirySweep);
    server.close(async () => { await store.close(); process.exit(0); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  let databaseReady = false;
  let connectionCheck;
  const checkDatabaseConnection = () => {
    if (connectionCheck) return connectionCheck;
    connectionCheck = store.authenticate()
      .then(() => store.db.command({ ping: 1 }))
      .then(() => {
        if (!databaseReady) console.info('MongoDB ready.');
        databaseReady = true;
      })
      .catch(error => {
        databaseReady = false;
        console.warn('[DB] Background connection unavailable', {
          error: error?.name || 'MongoError',
          code: error?.code || error?.cause?.code || 'n/a',
          timestamp: new Date().toISOString()
        });
      })
      .finally(() => { connectionCheck = null; });
    return connectionCheck;
  };
  const runExpirySweep = () => {
    if (!databaseReady) return;
    bookingController.expirePendingBookings().then(() => {
      if (expirySweepDatabaseUnavailable) console.info('Booking expiry sweep resumed after MongoDB reconnected.');
      expirySweepDatabaseUnavailable = false;
    }, error => {
      if (require('./src/middlewares/errorHandler').isDatabaseUnavailable(error)) {
        if (!expirySweepDatabaseUnavailable) console.warn('Booking expiry sweep paused until MongoDB is reachable.');
        expirySweepDatabaseUnavailable = true;
        databaseReady = false;
        return;
      }
      console.error('Booking expiry sweep failed:', error.message);
    });
  };

  // Index and validator setup is an explicit one-time operation (`npm run db:init`).
  // Keeping it out of API startup avoids serial createIndexes/collMod commands
  // saturating Atlas while real page requests are already being served.
  void checkDatabaseConnection().then(runExpirySweep);
  expirySweep = setInterval(() => {
    if (databaseReady) runExpirySweep();
    else void checkDatabaseConnection().then(runExpirySweep);
  }, 30_000);
  expirySweep.unref();
  return server;
}
if (require.main === module) start().catch(error => {
  console.error('MongoDB startup failed:', error.message);
  process.exitCode = 1;
  store.close();
});
module.exports = { app, start };
