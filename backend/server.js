require('./src/config/env');
const app = require('./src/app');
const { store } = require('./src/models');

async function start() {
  await store.authenticate();
  await store.sync();
  const port = process.env.PORT || 5055;
  const server = app.listen(port, () => console.log(`GreenSteps MongoDB API: http://localhost:${port}/api`));
  const shutdown = () => server.close(async () => { await store.close(); process.exit(0); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}
if (require.main === module) start().catch(error => {
  console.error('MongoDB startup failed:', error.message);
  process.exitCode = 1;
  store.close();
});
module.exports = { app, start };
