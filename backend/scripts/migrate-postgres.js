// Read-only PostgreSQL snapshot -> MongoDB. Default is dry run. --apply inserts
// missing rows only; reruns never overwrite live MongoDB edits or delete data.
require('../src/config/env');
const { Client, types } = require('pg');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { MongoClient } = require('mongodb');
const fs = require('node:fs');
const path = require('node:path');
const { store } = require('../src/models');
types.setTypeParser(1082, value => value); // Preserve DATE without timezone shifts.
const quote = value => '"' + value.replaceAll('"', '""') + '"';

function identity(row, keys) {
  if (!keys.length) throw new Error('Migration requires a primary key');
  if (keys.length === 1 && keys[0] === 'id') return String(row.id);
  return createHash('sha256').update(JSON.stringify(keys.map(key => [key, row[key]]))).digest('hex');
}
function convert(row, columns, primaryKeys) {
  const result = { ...row };
  for (const col of columns) {
    const value = result[col.column_name];
    if (value === null || value === undefined) continue;
    if (['numeric', 'decimal', 'double precision', 'real', 'integer', 'smallint'].includes(col.data_type)) {
      result[col.column_name] = Number(value);
      if (!Number.isFinite(result[col.column_name])) throw new Error(`Invalid number in ${col.column_name}`);
    }
    // Keep BIGINT strings when they exceed JS precision.
    if (col.data_type === 'bigint' && Number.isSafeInteger(Number(value))) result[col.column_name] = Number(value);
  }
  result._id = identity(result, primaryKeys);
  result.id ??= result._id;
  result._rev = 0;
  return result;
}

async function migrate({ apply = false, sourceMongo = false } = {}) {
  if (!sourceMongo && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env for migration');
  const pg = sourceMongo ? null : new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    ssl: process.env.PGSSL === 'false' ? false : {
      rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false',
      ...(process.env.PGSSL_CA_FILE ? { ca: fs.readFileSync(path.resolve(process.env.PGSSL_CA_FILE), 'utf8') } : {})
    }
  });
  const archive = sourceMongo ? new MongoClient(process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsDataMigrated') : null;
  const report = { startedAt: new Date().toISOString(), mode: apply ? 'apply' : 'dry-run', source: sourceMongo ? 'local-postgres-archive' : 'postgresql', database: store.db.databaseName, tables: [] };
  try {
    await store.authenticate();
    if (archive) await archive.connect();
    const archiveDb = archive?.db();
    const sourceCollections = archiveDb ? await archiveDb.listCollections({}, { nameOnly: true }).toArray() : [];
    if (pg) {
      await pg.connect();
      await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    }
    const tables = pg ? (await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")).rows.map(row => row.table_name)
      : sourceCollections.map(c => c.name).filter(n => n.startsWith('postgres_')).map(n => n.slice(9));
    if (!tables.length) throw new Error('No source tables found');
    for (const table of tables) {
      const model = Object.values(store.models).find(m => m.tableName.toLowerCase() === table.toLowerCase());
      const targetName = model?.collectionName || `${store.prefix}${table.toLowerCase()}`;
      if (!targetName.startsWith(store.prefix) || targetName === `postgres_${table.toLowerCase()}`) throw new Error('Source and target must be different collections');
      const target = store.db.collection(targetName);
      let keys, columns;
      if (pg) {
        columns = (await pg.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table])).rows;
        keys = (await pg.query(`SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position`, [table])).rows.map(r => r.column_name);
        if (!keys.length) throw new Error(`Table ${table} has no primary key; migrate it explicitly before cutover`);
      }
      const count = pg ? Number((await pg.query(`SELECT COUNT(*) AS count FROM public.${quote(table)}`)).rows[0].count) : await archiveDb.collection(`postgres_${table}`).countDocuments();
      const entry = { table, collection: targetName, source: count, inserted: 0, existing: 0, verified: 0 };
      let offset = 0;
      const cursor = sourceMongo ? archiveDb.collection(`postgres_${table}`).find({}) : null;
      while (true) {
        let rows;
        if (pg) rows = (await pg.query(`SELECT * FROM public.${quote(table)} ORDER BY ${keys.map(quote).join(', ')} LIMIT 500 OFFSET $1`, [offset])).rows.map(row => convert(row, columns, keys));
        else {
          rows = [];
          while (rows.length < 500 && await cursor.hasNext()) {
            const row = await cursor.next();
            rows.push({ ...row, _id: String(row._id), id: row.id ?? String(row._id), _rev: 0 });
          }
        }
        if (!rows.length) break;
        const ids = rows.map(row => row._id);
        const existing = await target.countDocuments({ _id: { $in: ids } });
        entry.existing += existing;
        if (apply) {
          const result = await target.bulkWrite(rows.map(row => ({ updateOne: { filter: { _id: row._id }, update: { $setOnInsert: row }, upsert: true } })), { ordered: true });
          entry.inserted += result.upsertedCount;
          const saved = await target.find({ _id: { $in: ids } }).toArray();
          const byId = new Map(saved.map(row => [row._id, row]));
          for (const row of rows) {
            const actual = byId.get(row._id);
            if (!actual) throw new Error(`ID verification failed for ${table}`);
            for (const key of Object.keys(row)) {
              if (key !== '_rev' && !isDeepStrictEqual(row[key], actual[key])) throw new Error(`Content verification failed for ${table}.${key}; existing MongoDB data was preserved`);
            }
          }
          entry.verified += saved.length;
        }
        offset += rows.length;
      }
      if (offset !== count) throw new Error(`Snapshot count mismatch for ${table}`);
      report.tables.push(entry);
      console.log(`${table} -> ${targetName}: source=${count}, existing=${entry.existing}, inserted=${entry.inserted}, verified=${entry.verified}`);
    }
    if (pg) await pg.query('COMMIT');
    if (apply) await store.sync();
    report.completedAt = new Date().toISOString();
    const reportPath = path.resolve(__dirname, '../../tmp/migration-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`${apply ? 'Migration complete' : 'Dry run complete (no database writes)'}. Report: ${reportPath}`);
    return report;
  } finally {
    if (pg) await pg.end();
    if (archive) await archive.close();
    await store.close();
  }
}
if (require.main === module) migrate({ apply: process.argv.includes('--apply'), sourceMongo: process.argv.includes('--source-mongo') }).catch(error => {
  // Never log connection strings or query parameters containing account data.
  console.error('Migration failed:', error.code || error.name, error.message);
  process.exitCode = 1;
});
module.exports = { migrate, convert, identity };
