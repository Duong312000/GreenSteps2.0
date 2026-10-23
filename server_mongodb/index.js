// Both historical start commands use the same MongoDB API and environment.
const { app, start } = require('../backend/server');
if (require.main === module) start().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = app;
