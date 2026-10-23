const { store } = require('../src/models');
(async () => {
  try { await store.sync(); console.log('MongoDB collections and indexes ready.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await store.close(); }
})();
