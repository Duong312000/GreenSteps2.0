require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsData';
const TARGET_DB = process.env.PUBLIC_SEED_DB || 'GreenStepsDemo';
const seedPath = path.join(__dirname, '..', 'data', 'public_catalog_seed.json');

function reviveId(value) {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)
    ? new ObjectId(value)
    : undefined;
}

function prepare(collection, documents) {
  return documents.map(document => {
    const copy = { ...document, _id: reviveId(document._id) };
    if (collection === 'schedules') {
      copy.activities = (document.activities || []).map(activity => ({
        ...activity,
        _id: reviveId(activity._id) || new ObjectId(),
        service_id: reviveId(activity.service_id)
      }));
    }
    if (collection === 'badges') {
      copy.awards = (document.awards || []).map(award => ({ ...award, target_id: reviveId(award.target_id) }));
    }
    if (collection === 'adcampaigns') copy.service_id = reviveId(document.service_id);
    return copy;
  });
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    const db = client.db(TARGET_DB);
    const existing = await db.listCollections({}, { nameOnly: true }).toArray();
    if (existing.length) {
      throw new Error(`Database ${TARGET_DB} is not empty. Refusing to overwrite existing data.`);
    }

    const counts = {};
    for (const [collection, documents] of Object.entries(seed.collections)) {
      const prepared = prepare(collection, documents);
      if (prepared.length) await db.collection(collection).insertMany(prepared, { ordered: true });
      counts[collection] = prepared.length;
    }
    await db.collection('_seed_metadata').insertOne({
      kind: 'sanitized public catalogue',
      imported_at: new Date(),
      collections: counts
    });
    console.log(`Loaded sanitized public catalogue into ${TARGET_DB}: ${JSON.stringify(counts)}`);
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error('Public seed import failed:', error.message);
  process.exitCode = 1;
});
