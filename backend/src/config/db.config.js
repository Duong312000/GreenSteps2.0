require('./env');
const { MongoStore } = require('../db/mongo-store');
const store = new MongoStore(
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsDataMigrated',
  { prefix: process.env.MONGODB_COLLECTION_PREFIX || 'app_' }
);
module.exports = { store };
