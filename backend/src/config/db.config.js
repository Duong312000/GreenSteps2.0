require('./env');
const { MongoStore } = require('../db/mongo-store');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsDataMigrated';

const store = new MongoStore(
  mongoUri,
  { prefix: process.env.MONGODB_COLLECTION_PREFIX || 'app_' }
);
module.exports = { store };
