const { Op } = require('../../src/db/mongo-store');

function createCatalogModels({ tours = [], services = [], activities = [] } = {}) {
  const schedules = tours.map(tour => ({
    id: tour.id,
    tour_name: tour.title || tour.tour_name || tour.name,
    destination: tour.destination,
    days: tour.days,
    carbon: tour.carbon,
    image_url: tour.image || tour.image_url,
    tour_description: tour.description,
    highlights: tour.highlights || []
  }));
  const scheduleById = new Map(schedules.map(schedule => [schedule.id, schedule]));
  const samples = tours.map(tour => ({ id: tour.id, cost: tour.cost, rating: tour.rating, votes_count: tour.votes_count }));

  return {
    Schedule: { collection: { collectionName: 'test_schedules' } },
    ScheduleSample: {
      async findAll() {
        return samples.map(sample => ({
          ...sample,
          Schedule: {
            ...scheduleById.get(sample.id),
            ScheduleActivities: activities.filter(activity => activity.schedule_id === sample.id)
          }
        }));
      },
      collection: {
        collectionName: 'test_schedulesamples',
        aggregate(pipeline) {
          const match = pipeline.find(stage => stage.$match)?.$match || {};
          let rows = samples.map(sample => ({ ...sample, schedule: scheduleById.get(sample.id) })).filter(row => row.schedule);
          const destination = match['schedule.destination'];
          if (destination) {
            const regex = new RegExp(destination.$regex, destination.$options);
            rows = rows.filter(row => regex.test(row.schedule.destination || ''));
          }
          if (match['schedule.days']) rows = rows.filter(row => row.schedule.days === match['schedule.days']);
          if (match.cost?.$lte !== undefined) rows = rows.filter(row => row.cost <= match.cost.$lte);
          rows.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)
            || (Number(b.votes_count) || 0) - (Number(a.votes_count) || 0)
            || (Number(a.cost) || 0) - (Number(b.cost) || 0));
          const skip = pipeline.find(stage => stage.$skip)?.$skip || 0;
          const limit = pipeline.find(stage => stage.$limit)?.$limit ?? rows.length;
          return { toArray: async () => rows.slice(skip, skip + limit) };
        }
      }
    },
    ScheduleActivity: {
      async findAll({ where = {} } = {}) {
        const ids = where.schedule_id?.[Op.in] || [];
        return activities.filter(activity => ids.includes(activity.schedule_id));
      }
    },
    GreenService: {
      async findAll(options = {}) {
        const where = options.where || {};
        let rows = services.filter(service => service.status === where.status);
        if (where['current_data.catalogHidden']?.[Op.ne] === true) rows = rows.filter(service => service.current_data?.catalogHidden !== true);
        if (where.type) rows = rows.filter(service => service.type === where.type);
        if (where.destination?.[Op.iLike]) {
          const value = where.destination[Op.iLike].replaceAll('%', '').toLocaleLowerCase();
          rows = rows.filter(service => String(service.destination).toLocaleLowerCase().includes(value));
        }
        if (where.destination?.[Op.regex]) {
          const expression = new RegExp(where.destination[Op.regex], 'i');
          rows = rows.filter(service => expression.test(String(service.destination || '')));
        }
        if (where.cost?.[Op.lte] !== undefined) rows = rows.filter(service => service.cost <= where.cost[Op.lte]);
        const offset = options.offset || 0;
        const limit = options.limit ?? rows.length;
        return rows.slice(offset, offset + limit).map(service => ({
          id: service.id, name_service: service.name || service.name_service, type: service.type,
          destination: service.destination, cost: service.cost, carbon: service.carbon,
          rating: service.rating, image_url: service.image_url || service.image,
          status: service.status, current_data: service.current_data
        }));
      }
    }
  };
}

module.exports = { createCatalogModels };
