// Keep the existing backend entrypoint, but run the MongoDB implementation.
// The MongoDB app loads its environment from server_mongodb/.env.
const path = require('path');

process.chdir(path.resolve(__dirname, '..', 'server_mongodb'));
require('../server_mongodb/index.js');
