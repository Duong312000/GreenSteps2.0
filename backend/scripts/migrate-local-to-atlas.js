// One-time, non-destructive copy of every collection from the local Mongo URI
// in server_mongodb/.env into the Atlas URI in backend/.env. Empty collections
// initialized by the backend are allowed; populated Atlas collections are not.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

const localEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../server_mongodb/.env'), 'utf8'));
const atlasEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8'));
if (!localEnv.MONGODB_URI || !atlasEnv.MONGODB_URI)
  throw new Error('Both local and Atlas MONGODB_URI values are required.');

const source = new MongoClient(localEnv.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const target = new MongoClient(atlasEnv.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const indexOptions = [
  'unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'collation',
  'weights', 'default_language', 'language_override', 'wildcardProjection',
  '2dsphereIndexVersion', 'bits', 'min', 'max', 'bucketSize', 'hidden',
];

async function migrate() {
  try {
    await source.connect();
    await target.connect();
    const sourceDb = source.db();
    const targetDb = target.db();
    if (sourceDb.databaseName === targetDb.databaseName &&
        sourceDb.client.options.srvHost === targetDb.client.options.srvHost)
      throw new Error('Source and target appear to be the same database.');

    const existing = await targetDb.listCollections({}, { nameOnly: true }).toArray();
    for (const item of existing) {
      const count = await targetDb.collection(item.name).countDocuments();
      if (count)
        throw new Error(`Atlas collection ${item.name} already contains data; refusing to overwrite.`);
    }
    const existingNames = new Set(existing.map((item) => item.name));

    const collections = (await sourceDb.listCollections({}, { nameOnly: false }).toArray())
      .filter((item) => item.type === 'collection' && !item.name.startsWith('system.'));
    const copied = [];
    for (const item of collections) {
      const from = sourceDb.collection(item.name);
      const to = targetDb.collection(item.name);
      let destinationIndexes = [];
      if (existingNames.has(item.name)) {
        destinationIndexes = await to.listIndexes().toArray();
      }
      const destinationIndexesByName = new Map(destinationIndexes.map((index) => [index.name, index]));
      const indexes = (await from.listIndexes().toArray())
        .filter((index) => index.name !== '_id_')
        .filter((index) => {
          const current = destinationIndexesByName.get(index.name);
          if (!current) return true;
          if (JSON.stringify(current.key) !== JSON.stringify(index.key) ||
              Boolean(current.unique) !== Boolean(index.unique) ||
              Boolean(current.sparse) !== Boolean(index.sparse))
            throw new Error(`Atlas index ${item.name}.${index.name} conflicts with the local index.`);
          return false;
        })
        .map((index) => {
          const spec = { key: index.key, name: index.name };
          for (const key of indexOptions)
            if (index[key] !== undefined) spec[key] = index[key];
          return spec;
        });
      if (indexes.length) await to.createIndexes(indexes);

      const documents = await from.find({}).toArray();
      if (documents.length) await to.insertMany(documents, { ordered: true });
      const destinationCount = await to.countDocuments();
      if (destinationCount !== documents.length)
        throw new Error(`Verification count mismatch for ${item.name}.`);
      copied.push({ collection: item.name, count: destinationCount });
    }

    console.log(JSON.stringify({
      database: targetDb.databaseName,
      collections: copied.length,
      documents: copied.reduce((sum, item) => sum + item.count, 0),
      details: copied,
    }));
  } finally {
    await Promise.allSettled([source.close(), target.close()]);
  }
}

migrate().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
});
