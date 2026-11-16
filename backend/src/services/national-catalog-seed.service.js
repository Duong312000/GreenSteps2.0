const { createHash } = require('node:crypto');

async function seedRecords(model, records, {
  dryRun = true,
  batchSize = 25,
  auditModel,
  entityType = 'catalog_record',
  actorId = 'system:national-catalog-seed',
  onCreated,
  store
} = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new TypeError('Seed batch size must be between 1 and 100.');
  if (!dryRun && auditModel && !store) throw new TypeError('Audited seed inserts require a transactional store.');
  const summary = { created: 0, preserved: 0, unchanged: 0 };
  for (let offset = 0; offset < records.length; offset += batchSize) {
    for (const record of records.slice(offset, offset + batchSize)) {
      const current = await model.findByPk(record.id);
      if (!current) {
        summary.created++;
        if (!dryRun) {
          const insert = async transaction => {
            const transactionOptions = transaction ? { transaction } : {};
            await model.create(record, transactionOptions);
            if (auditModel) {
              const digest = createHash('sha256').update(`${entityType}:${record.id}`).digest('hex').slice(0, 24);
              const newState = Object.fromEntries(['id', 'name', 'code', 'slug'].filter(key => record[key] !== undefined).map(key => [key, record[key]]));
              await auditModel.create({
                id: `catalog_seed_${digest}`,
                actor_id: actorId,
                action: 'national_catalog.seed.insert',
                target_type: entityType,
                target_id: record.id,
                reason: 'Insert-only national expansion seed; pre-existing records are preserved.',
                previous_state: null,
                new_state: newState,
                config_version: 1
              }, transactionOptions);
            }
          };
          if (store) await store.transaction(insert);
          else await insert(null);
          if (onCreated) await onCreated(record);
        }
        continue;
      }
      const currentJson = typeof current.toJSON === 'function' ? current.toJSON() : current;
      const changed = Object.keys(record).some(key => JSON.stringify(currentJson[key]) !== JSON.stringify(record[key]));
      if (!changed) { summary.unchanged++; continue; }
      summary.preserved++;
    }
  }
  return summary;
}

async function seedNationalCatalog(models, data, options = {}) {
  const adminAreas = await seedRecords(models.AdminArea, data.adminAreas, { ...options, entityType: 'admin_area' });
  const regions = await seedRecords(models.Region, data.regions, { ...options, entityType: 'region' });
  const destinations = await seedRecords(models.Destination, data.destinations, { ...options, entityType: 'destination' });
  return { adminAreas, regions, destinations, dryRun: options.dryRun !== false };
}

async function seedDemoTours(models, demoTours, options = {}) {
  const schedules = demoTours.map(({ itinerary, ...schedule }) => schedule);
  const activities = demoTours.flatMap(tour => tour.itinerary);
  return {
    schedules: await seedRecords(models.Schedule, schedules, { ...options, entityType: 'schedule' }),
    activities: await seedRecords(models.ScheduleActivity, activities, { ...options, entityType: 'schedule_activity' }),
    priceRecordsCreated: 0,
    dryRun: options.dryRun !== false
  };
}

module.exports = { seedRecords, seedNationalCatalog, seedDemoTours };
