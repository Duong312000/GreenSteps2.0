// Start a separate local replica set; never change the existing MongoDB service.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
async function startLocalMongo() {
  const port = Number(process.env.LOCAL_MONGO_PORT || 27018);
  const data = path.resolve(__dirname, '../../tmp/mongodb-rs');
  fs.mkdirSync(data, { recursive: true });
  const binary = process.env.MONGOD_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe' : 'mongod');
  const uri = `mongodb://127.0.0.1:${port}/?directConnection=true`;
  async function connect() {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1000 });
    try { await client.connect(); return client; }
    catch (error) { await client.close(); return null; }
  }
  let client = await connect();
  if (!client) {
    const child = spawn(binary, ['--dbpath', data, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'rs0', '--logpath', path.join(data, 'mongod.log'), '--logappend'], { detached: true, windowsHide: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    for (let attempt = 0; attempt < 30 && !client; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      client = await connect();
    }
  }
  if (!client) throw new Error(`Cannot start mongod; inspect ${path.join(data, 'mongod.log')}`);
  try {
    const options = await client.db('admin').command({ getCmdLineOpts: 1 });
    if ((options.parsed.replication?.replSetName || options.parsed.replication?.replSet) !== 'rs0') throw new Error(`Port ${port} belongs to another MongoDB deployment`);
    try { await client.db('admin').command({ replSetGetStatus: 1 }); }
    catch (error) {
      if (error.code !== 94) throw error;
      await client.db('admin').command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) {
        console.log(`Local MongoDB ready: mongodb://127.0.0.1:${port}/GreenStepsDataMigrated?replicaSet=rs0`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Replica set did not elect a primary');
  } finally { await client.close(); }
}
if (require.main === module) startLocalMongo().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { startLocalMongo };
