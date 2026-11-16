// Preview by default; --apply stores distinct base64 covers and reduces only seed data.
require('../src/config/env');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { store, col } = require('../src/transport/models');
const { busDemoCover, BUS_DEMO_INDICES, BUS_GALLERY_VERSION } = require('../src/transport/seed-images');
const { search } = require('../src/transport/service');

async function main() {
  try {
    await store.authenticate();
    const vehicles = await col('vehicles').find({ is_seed_data: true, transport_type: 'bus', seed_key: /^greensteps-transport-v1:bus-vehicle-\d+$/ }).toArray();
    const booked = await col('bookings').find({ vehicle_id: { $in: vehicles.map(vehicle => vehicle._id) }, booking_status: { $in: ['PENDING', 'CONFIRMED'] } }, { projection: { vehicle_id: 1, trip_id: 1 } }).toArray();
    const protectedVehicles = new Set(booked.map(booking => String(booking.vehicle_id)));
    const protectedTrips = new Set(booked.map(booking => String(booking.trip_id)));
    const covers = BUS_DEMO_INDICES.map(index => busDemoCover(index));
    assert.equal(new Set(covers.map(cover => createHash('sha256').update(cover.image).digest('hex'))).size, BUS_DEMO_INDICES.length);
    const retained = vehicles.filter(vehicle => BUS_DEMO_INDICES.includes(Number(vehicle.seed_key.split('-').pop())) || protectedVehicles.has(String(vehicle._id)));
    assert.ok(BUS_DEMO_INDICES.every(index => retained.some(vehicle => vehicle.seed_key.endsWith(`vehicle-${index}`))), 'Missing selected demo buses.');
    const retainedIds = new Set(retained.map(vehicle => String(vehicle._id)));
    const trips = await col('trips').find({ is_seed_data: true, transport_type: 'bus', vehicle_id: { $in: vehicles.map(vehicle => vehicle._id) }, departure_time: { $gt: new Date() }, status: 'active' }).sort({ departure_time: 1, _id: 1 }).toArray();
    const keepTrips = new Set(protectedTrips);
    for (const vehicle of retained) {
      const next = trips.find(trip => String(trip.vehicle_id) === String(vehicle._id) && trip.available_seats > 0);
      if (next) keepTrips.add(String(next._id));
    }
    const hiddenTrips = trips.filter(trip => !keepTrips.has(String(trip._id)));
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', seedVehiclesBefore: vehicles.length,
      retainedVehicles: retained.length, hideFutureTrips: hiddenTrips.length, protectedBookings: booked.length, uniqueBase64Covers: covers.length }));
    if (!process.argv.includes('--apply')) return;
    const backups = store.db.collection('transport_catalog_backups');
    for (const [kind, rows] of [['vehicles', vehicles], ['trips', hiddenTrips]]) for (const row of rows) {
      await backups.updateOne({ _id: `${BUS_GALLERY_VERSION}:${kind}:${row._id}` }, { $setOnInsert: { kind, record: row, savedAt: new Date() } }, { upsert: true });
    }
    await store.transaction(async () => {
      const options = store.options();
      for (const vehicle of vehicles) {
        const index = Number(vehicle.seed_key.split('-').pop());
        const cover = BUS_DEMO_INDICES.includes(index) ? busDemoCover(index) : null;
        await col('vehicles').updateOne({ _id: vehicle._id, is_seed_data: true }, { $set: {
          ...(!retainedIds.has(String(vehicle._id)) ? { status: 'suspended' } : {}),
          ...(cover ? { images: [cover.image], image_sources: [cover.source], gallery_version: BUS_GALLERY_VERSION } : {}),
          updatedAt: new Date(),
        } }, options);
      }
      if (hiddenTrips.length) await col('trips').updateMany({ _id: { $in: hiddenTrips.map(trip => trip._id) }, is_seed_data: true, status: 'active' }, { $set: { status: 'suspended', updatedAt: new Date() } }, options);
    });
    const result = await search('trips', { type: 'bus', passengers: '1', sortBy: 'departure' });
    const selected = result.data.filter(trip => BUS_DEMO_INDICES.some(index => vehicles.find(vehicle => vehicle.seed_key.endsWith(`vehicle-${index}`))?._id.equals(trip.vehicle_id)));
    assert.ok(selected.every(trip => trip.vehicle.images[0].startsWith('data:image/jpeg;base64,')));
    assert.equal(new Set(selected.map(trip => createHash('sha256').update(trip.vehicle.images[0]).digest('hex'))).size, selected.length);
    console.log(JSON.stringify({ verified: true, publicTrips: result.total, distinctSelectedCovers: selected.length }));
  } finally { await store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
