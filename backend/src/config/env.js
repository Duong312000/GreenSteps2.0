const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../../server_mongodb/.env'), quiet: true });

// Optional process-local DNS override for networks that return EBADRESP for Atlas SRV.
// This does not change the OS resolver or rewrite the MongoDB URI/credentials.
const dnsServers = process.env.MONGODB_DNS_SERVERS;
if (dnsServers?.trim()) {
  const servers = dnsServers.split(',').map(server => server.trim()).filter(Boolean);
  try { require('node:dns').setServers(servers); }
  catch { throw new Error('MONGODB_DNS_SERVERS must contain valid DNS server IP addresses.'); }
}
