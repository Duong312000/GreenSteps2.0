const { store } = require('../src/models');
(async () => {
  try {
    await store.sync();
    await require('../src/services/favorites.service').ensureSchema();
    await require('../src/transport/models').init();
    await require('../src/services/booking-pricing.service').ensureDefaultBookingAddons();
    console.log('MongoDB collections, validators and indexes ready.');
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await store.close(); }
})();
