const { Op } = require('../db/mongo-store');
const { randomUUID } = require('node:crypto');
const { sendItineraryInviteEmail } = require('../services/email.service');
const { createBookingReview, createReply } = require('../services/review.service');
const { providerOwnsReviewTarget } = require('./reviews.controller');
const { searchTours } = require('../services/tour-search.service');
const { providerForUser } = require('../services/provider-identity.service');
const {
  store,
  Schedule,
  Destination,
  ScheduleSample,
  ScheduleCustom,
  ScheduleActivity,
  BadgeSchedule,
  BadgeUser,
  Badge,
  User,
  CommentPost,
  CPSS,
  Wallet,
  Provider,
  Notification,
  UserSchedule
} = require('../models/index');

// High-speed in-memory cache for tours & tour details
const tourCache = new Map();
function getCachedTour(key) {
  const item = tourCache.get(key);
  if (item && item.expiresAt > Date.now()) return item.data;
  tourCache.delete(key);
  return null;
}
function setCachedTour(key, data, ttlMs = 180000) {
  tourCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}


// Helper: Format activities from Schedule into days array
function formatActivitiesIntoDays(schedule, activities) {
  const days = schedule.days || 1;
  const data = Array.from({ length: days }, () => []);
  (activities || []).forEach(act => {
    const dIdx = act.day_number - 1;
    if (dIdx >= 0 && dIdx < days) {
      data[dIdx].push({
        id: act.id,
        time: act.time,
        title: act.activity_name || act.name || act.title || '[Địa điểm tự do]',
        name: act.activity_name || act.name || act.title || '[Địa điểm tự do]',
        cost: act.cost !== undefined ? Number(act.cost) : (act.activity_cost !== undefined ? Number(act.activity_cost) : undefined),
        carbon: act.carbon !== undefined ? Number(act.carbon) : undefined,
        icon: act.icon || (act.type === 'lodging' ? 'bi-house-door-fill' : (act.type === 'dining' ? 'bi-cup-hot-fill' : (act.type === 'transport' ? 'bi-scooter' : 'bi-tree-fill'))),
        type: act.type || 'attraction',
        img: act.img || act.image || act.photo || null,
        is_shared: act.is_shared !== undefined ? act.is_shared : false,
        description: act.editorial_note || act.description || '',
        address: act.address || '',
        lat: act.lat !== undefined ? Number(act.lat) : (act.coordinates ? parseFloat(act.coordinates.split(',')[0]) : null),
        lng: act.lng !== undefined ? Number(act.lng) : (act.coordinates ? parseFloat(act.coordinates.split(',')[1]) : null)
      });
    }
  });
  return data;
}

// Helper: Format a ScheduleSample+Schedule row into a rich tour response object
function formatTourResponse(sample, schedule, badges, activities, vouchers) {
  const isEditorial = ['demo', 'editorial'].includes(String(schedule?.catalog_status || '').toLowerCase());
  const resolvedCost = !isEditorial && sample?.cost !== '' && Number.isSafeInteger(Number(sample?.cost)) && sample?.cost !== null && sample?.cost !== undefined && sample.cost >= 0
    ? Number(sample.cost)
    : !isEditorial && schedule?.price !== '' && Number.isSafeInteger(Number(schedule?.price)) && schedule?.price !== null && schedule?.price !== undefined && schedule.price >= 0
      ? Number(schedule.price)
      : !isEditorial && schedule?.cost !== '' && Number.isSafeInteger(Number(schedule?.cost)) && schedule?.cost !== null && schedule?.cost !== undefined && schedule.cost >= 0
        ? Number(schedule.cost)
        : undefined;

  const resolvedOldCost = !isEditorial && Number.isFinite(Number(sample?.old_cost)) && sample.old_cost > 0
    ? Number(sample.old_cost)
    : !isEditorial && Number.isFinite(Number(schedule?.old_price)) && schedule.old_price > 0
      ? Number(schedule.old_price)
      : undefined;

  const resolvedCarbon = Number.isFinite(Number(schedule?.carbon)) && schedule.carbon > 0
    ? Number(schedule.carbon)
    : Number.isFinite(Number(sample?.carbon)) && sample.carbon > 0
      ? Number(sample.carbon)
      : undefined;

  const resolvedRating = !isEditorial && Number.isFinite(Number(sample?.rating)) && sample.rating > 0
    ? Number(sample.rating)
    : !isEditorial && Number.isFinite(Number(schedule?.rating)) && schedule.rating > 0
      ? Number(schedule.rating)
      : undefined;

  const resolvedVotes = !isEditorial && Number.isFinite(Number(sample?.votes_count)) && sample.votes_count > 0
    ? Number(sample.votes_count)
    : !isEditorial && Number.isFinite(Number(schedule?.votes_count)) && schedule.votes_count > 0
      ? Number(schedule.votes_count)
      : undefined;

  const effectiveVouchers = (Array.isArray(vouchers) && vouchers.length > 0)
    ? vouchers
    : (Array.isArray(schedule?.vouchers) && schedule.vouchers.length > 0)
      ? schedule.vouchers
      : [];

  const effectiveGuarantees = (Array.isArray(schedule?.guarantees) && schedule.guarantees.length > 0)
    ? schedule.guarantees
    : [];

  const effectivePolicy = (Array.isArray(schedule?.policy) && schedule.policy.length > 0)
    ? schedule.policy
    : [];

  return {
    id: sample?.id || schedule?.id,
    title: schedule?.tour_name || schedule?.name || 'Tour Du Lịch Sinh Thái GreenSteps',
    destination: schedule?.destination || 'Việt Nam',
    days: schedule?.days || schedule?.duration_days || 1,
    cost: resolvedCost,
    oldCost: resolvedOldCost,
    carbon: resolvedCarbon,
    image: schedule?.image_url,
    coverMediaVerified: schedule?.coverMediaVerified === true,
    coverMediaVariants: schedule?.coverMediaVariants || [],
    description: schedule?.tour_description || schedule?.description || 'Trải nghiệm du lịch sinh thái bản địa, bền vững và thân thiện với môi trường.',
    rating: resolvedRating,
    votes_count: resolvedVotes,
    tags: Array.isArray(badges) ? badges : [],
    gallery: (Array.isArray(schedule?.gallery) && schedule.gallery.length > 0)
      ? schedule.gallery
      : (schedule?.image_url ? [schedule.image_url] : []),
    photoMetadata: schedule?.photo_metadata || [],
    responsibleTravel: schedule?.responsible_travel || '',
    practicalNotes: schedule?.practical_notes || '',
    editorialItineraryNotice: schedule?.editorial_itinerary_notice || '',
    highlights: Array.isArray(schedule?.highlights) ? schedule.highlights : [],
    styleExplanation: schedule?.style_explanation || '',
    fitnessIsEstimate: schedule?.fitness_is_estimate === true,
    fitnessExplanation: schedule?.fitness_explanation || '',
    included: Array.isArray(schedule?.included) ? schedule.included : [],
    excluded: Array.isArray(schedule?.excluded) ? schedule.excluded : [],
    policy: effectivePolicy,
    guarantees: effectiveGuarantees,
    style: schedule?.style || 'Gia đình / Eco Travel',
    type: schedule?.type || (schedule?.style && schedule.style.includes('Nghỉ dưỡng') ? 'Nghỉ dưỡng' : schedule?.style && schedule.style.includes('Gia đình') ? 'Gia đình' : schedule?.style && schedule.style.includes('Tiết kiệm') ? 'Tiết kiệm' : 'Trải nghiệm'),
    group_size: schedule?.group_size || 'Nhóm nhỏ thân mật (4-10 khách)',
    fitness_level: schedule?.fitness_level || 'Nhẹ nhàng',
    maxCapacity: schedule?.max_capacity || 10,
    max_capacity: schedule?.max_capacity || 10,
    catalog_status: schedule?.catalog_status || 'active',
    is_demo: isEditorial,
    bookingEnabled: !isEditorial && resolvedCost !== undefined,
    priceStatus: sample?.priceStatus || (resolvedCost !== undefined ? 'verified' : 'unconfirmed'),
    vouchers: effectiveVouchers,
    data: activities ? formatActivitiesIntoDays(schedule, activities) : undefined
  };
}
exports.formatTourResponse = formatTourResponse;
const bcrypt = require('bcrypt');

// --- Server-Side In-Memory SWR Cache & Custom Itinerary Hot Cache ---
const presetToursCache = { data: null, expiresAt: 0, refreshing: false };
const destinationsCache = { data: null, items: null, expiresAt: 0, refreshing: false };
const customItineraryCache = new Map(); // id -> { data, cachedAt }
const PRESET_TOURS_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL with SWR
const DESTINATIONS_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

async function fetchAllPresetToursFromDb() {
  const samples = await ScheduleSample.findAll({
    where: {},
    readPreference: 'primaryPreferred',
    include: [
      {
        model: Schedule,
        include: [{
          model: ScheduleActivity,
          order: [['day_number', 'ASC'], ['time', 'ASC']]
        }]
      }
    ]
  });

  const sampleIds = samples.map(s => s.id);
  const allBadges = sampleIds.length > 0
    ? await BadgeSchedule.findAll({ where: { schedule_id: { [Op.in]: sampleIds } } })
    : [];
  const badgeMap = {};
  allBadges.forEach(bs => {
    if (!badgeMap[bs.schedule_id]) badgeMap[bs.schedule_id] = [];
    badgeMap[bs.schedule_id].push(bs.badge_name);
  });

  return samples
    .filter(s => s.Schedule)
    .map(s => formatTourResponse(
      s,
      s.Schedule,
      badgeMap[s.id] || [],
      s.Schedule.ScheduleActivities
    ));
}

function applyTourPaginationAndSummary(tours, query = {}) {
  let list = tours;
  const offset = Number(query.offset) || 0;
  const limit = Number(query.limit) || 0;
  if (offset > 0 || limit > 0) {
    list = limit > 0 ? list.slice(offset, offset + limit) : list.slice(offset);
  }
  if (query.summary === '1' || query.summary === 'true') {
    return list.map(t => ({ ...t, data: undefined }));
  }
  return list;
}

exports.invalidateTourCaches = () => {
  presetToursCache.expiresAt = 0;
  destinationsCache.expiresAt = 0;
};

// Warm up cache in background shortly after server starts


// 1. Get All Preset Tours (SWR In-Memory Cache + Above-the-Fold Progressive Slice)
exports.getPresetTours = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const now = Date.now();
      if (presetToursCache.data) {
        if (now > presetToursCache.expiresAt && !presetToursCache.refreshing) {
          presetToursCache.refreshing = true;
          fetchAllPresetToursFromDb().then(fresh => {
            presetToursCache.data = fresh;
            presetToursCache.expiresAt = Date.now() + PRESET_TOURS_TTL_MS;
          }).catch(() => {}).finally(() => {
            presetToursCache.refreshing = false;
          });
        }
        return res.json(applyTourPaginationAndSummary(presetToursCache.data, req.query));
      }

      const tours = await fetchAllPresetToursFromDb();
      presetToursCache.data = tours;
      presetToursCache.expiresAt = now + PRESET_TOURS_TTL_MS;
      return res.json(applyTourPaginationAndSummary(tours, req.query));
    }

    const provider = await providerForUser(userId);
    if (!provider) return res.json([]);
    const whereClause = { provider_id: provider.id };

    const samples = await ScheduleSample.findAll({
      where: whereClause,
      include: [
        {
          model: Schedule,
          include: [{
            model: ScheduleActivity,
            order: [['day_number', 'ASC'], ['time', 'ASC']]
          }]
        }
      ]
    });

    const sampleIds = samples.map(s => s.id);
    const allBadges = sampleIds.length > 0
      ? await BadgeSchedule.findAll({ where: { schedule_id: { [Op.in]: sampleIds } } })
      : [];
    const badgeMap = {};
    allBadges.forEach(bs => {
      if (!badgeMap[bs.schedule_id]) badgeMap[bs.schedule_id] = [];
      badgeMap[bs.schedule_id].push(bs.badge_name);
    });

    const tours = samples
      .filter(s => s.Schedule)
      .map(s => formatTourResponse(
        s,
        s.Schedule,
        badgeMap[s.id] || [],
        s.Schedule.ScheduleActivities
      ));

    res.json(applyTourPaginationAndSummary(tours, req.query));
  } catch (error) {
    next(error);
  }
};

exports.searchTours = async (req, res, next) => {
  try {
    const result = await searchTours({
      models: { Schedule, ScheduleSample, ScheduleActivity, BadgeSchedule, Destination },
      query: req.query
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
};

// 2. Get Single Preset Tour (Eager Loading — single query)
exports.getPresetTourById = async (req, res, next) => {
  console.log("[TourController] getPresetTourById called, id:", req.params.id);
  const { id } = req.params;
  try {
    const s = await ScheduleSample.findByPk(id, {
      include: [{
        model: Schedule,
        include: [{ model: ScheduleActivity }]
      }]
    });
    if (!s || !s.Schedule) {
      // First check GreenService if id starts with service prefix
      if (id.startsWith('SRV_') || id.startsWith('GGP_') || id.startsWith('srv_') || id.startsWith('ser_')) {
        const { GreenService } = require('../models/index');
        const srv = await GreenService.findByPk(id);
        if (srv) {
          const srvCost = srv.cost === null || srv.cost === undefined ? undefined : Number(srv.cost);
          return res.json({
            id: srv.id,
            title: srv.name || srv.name_service || 'Dịch vụ sinh thái GreenSteps',
            destination: srv.destination || 'Việt Nam',
            days: 1,
            cost: srvCost,
            oldCost: srv.oldCost === null || srv.oldCost === undefined ? srv.current_data?.oldCost : Number(srv.oldCost),
            carbon: Number(srv.carbon) > 0 ? Number(srv.carbon) : undefined,
            image: srv.image_url,
            gallery: (srv.current_data?.gallery && srv.current_data.gallery.length) ? srv.current_data.gallery : (srv.image_url ? [srv.image_url] : []),
            description: srv.current_data?.shortDesc || srv.current_data?.description || srv.description || 'Dịch vụ sinh thái đạt chuẩn GreenSteps.',
            rating: Number(srv.rating) > 0 ? Number(srv.rating) : undefined,
            votes_count: Number(srv.reviews_count) > 0 ? Number(srv.reviews_count) : undefined,
            tags: Array.isArray(srv.badges) ? srv.badges : [],
            highlights: Array.isArray(srv.current_data?.highlights) ? srv.current_data.highlights : [],
            guarantees: srv.current_data?.guarantees || [],
            policy: srv.current_data?.policy || [],
            vouchers: srv.current_data?.vouchers || [],
            is_demo: false,
            bookingEnabled: srv.current_data?.bookingEnabled !== false && (Number.isSafeInteger(srvCost) || (Array.isArray(srv.current_data?.rooms) && srv.current_data.rooms.length > 0)),
            priceStatus: srv.priceStatus || (Number.isSafeInteger(srvCost) ? 'verified' : 'unconfirmed'),
            isService: true
          });
        }
      }

      const editorial = await Schedule.findByPk(id, { include: [{ model: ScheduleActivity }] });
      if (editorial) {
        return res.json(formatTourResponse(
          { id: editorial.id },
          editorial,
          [],
          editorial.ScheduleActivities || [],
          []
        ));
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy tour du lịch này!' });
    }

    const badgeSchedules = await BadgeSchedule.findAll({ where: { schedule_id: id } });
    const badges = badgeSchedules.map(bs => bs.badge_name);

    // Fetch active vouchers dynamically from MongoDB Atlas (partner campaigns & vouchers)
    let vouchers = [];
    try {
      await store.authenticate();
      if (store.db) {
        const rawCampaigns = await store.db.collection('app_partnercampaigns').find({
          type: 'voucher',
          status: 'active'
        }).limit(6).toArray();
        vouchers = rawCampaigns.filter(c => c.code).map(c => ({
          code: c.code,
          title: c.name || (c.discount_type === 'percent' ? `Giảm ${c.discount_value}%` : `Giảm ${(c.discount_value || 0).toLocaleString('vi-VN')}đ`),
          discount_type: c.discount_type || 'percent',
          discount_value: c.discount_value || 10,
          min_order_value: c.min_order_value || 0,
          max_discount: c.max_discount || 0,
          expires_at: c.end_date || c.expires_at,
          description: c.description || `Mã ưu đãi ${c.code} áp dụng cho trải nghiệm du lịch xanh.`
        }));
      }
    } catch (ve) {
      console.warn('Vouchers query error:', ve.message);
    }

    const result = formatTourResponse(
      s,
      s.Schedule,
      badges,
      s.Schedule.ScheduleActivities,
      vouchers
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 3. Get Personalized Tour Recommendations (Eager Loading)
exports.getRecommendations = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.params.userId && String(req.params.userId) !== String(userId)) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const recommendationService = require('../services/recommendation.service');
    const anonId = req.query.aid || req.headers['x-visitor-id'] || null;
    const limit = Math.min(12, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
    const entries = await recommendationService.recommendTours({
      userId: userId && userId !== 'guest' ? userId : (req.user?.id || null),
      anonId,
      limit
    });

    const tours = entries.map(({ sample, schedule, badges, eco, recommendReason }) => ({
      ...formatTourResponse(sample, schedule, badges),
      recommendReason,
      ecoTier: eco?.tier || 'standard',
      ecoTierLabel: eco?.tierLabel || 'Đạt chuẩn xanh',
      ecoImpactLine: eco?.impactLine || '',
      ecoHighlights: eco?.highlights || []
    }));

    res.json(tours);
  } catch (error) {
    next(error);
  }
};

// 4. Custom Itineraries: Save or Update Itinerary (calculates carbon footprint)
exports.saveCustomItinerary = async (req, res, next) => {
  if (req.body?.source === 'ai') return exports.createAiItinerary(req, res, next);
  return persistCustomItinerary(req, res, next, req.body);
};

async function persistCustomItinerary(req, res, next, payload, { aiGenerated = false } = {}) {
  const { id, name, destination, days, totalCost, daysData, status, deposit_deadline, start_date, end_date, companion_email, imageUrl, image_url } = payload;
  const user_id = req.user?.id;
  if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const existingOwnerRecord = id ? await ScheduleCustom.findByPk(id) : null;
    if (existingOwnerRecord && String(existingOwnerRecord.user_id) !== String(user_id)) return res.status(403).json({ success: false, error: 'Forbidden' });
    // Sum carbon emissions from activities
    let computedCarbon = 0;
    if (daysData && daysData.length > 0) {
      daysData.forEach(day => {
        day.forEach(act => {
          computedCarbon += parseFloat(act.carbon || 0);
        });
      });
    }

    // Immediately write-through to customItineraryCache so shared links on any IP resolve in 1ms
    customItineraryCache.set(id, {
      data: {
        id,
        name: name || 'Lịch trình tự thiết kế',
        user_id,
        destination: destination || 'Việt Nam',
        days: days || (Array.isArray(daysData) ? daysData.length : 1),
        totalCost: totalCost || 0,
        totalCarbon: computedCarbon,
        daysData: Array.isArray(daysData) ? daysData : [],
        status: status || 'draft',
        deposit_deadline: deposit_deadline || null,
        start_date: start_date || null,
        end_date: end_date || null,
        companion_email: companion_email || null,
        imageUrl: imageUrl || image_url || null,
        collaborators: []
      },
      cachedAt: Date.now()
    });

    // 1. Ensure user exists
    let userExists = await User.findByPk(user_id);
    if (!userExists) {
      const hashedPwd = await bcrypt.hash('123456', 10);
      await User.create({
        id: user_id,
        username: `recovered_${user_id}`,
        password_hash: hashedPwd,
        fullname: 'Khách hàng phục hồi',
        email: `${user_id}@greensteps.vn`,
        role: 'traveler'
      });
    }

    const [existingSchedule, existingSample, existingCustom] = await Promise.all([
      Schedule.findByPk(id),
      ScheduleSample.findByPk(id),
      ScheduleCustom.findByPk(id)
    ]);

    const isItinerary = String(id).startsWith('iti_');
    const catalogStatus = isItinerary
      ? 'personal'
      : (!existingSample && (existingCustom || !existingSchedule)
        ? 'personal'
        : existingSchedule?.catalog_status);

    await Schedule.upsert({
      id: id,
      tour_name: name,
      destination: destination,
      days: days,
      discount: 0,
      carbon: computedCarbon,
      image_url: (imageUrl && imageUrl !== 'image/Viet Nam.png') ? imageUrl : (image_url && image_url !== 'image/Viet Nam.png' ? image_url : null),
      tour_description: `Hành trình tự thiết kế đi ${destination}`,
      ...(catalogStatus !== undefined ? { catalog_status: catalogStatus } : {})
    });

    // Check current status if exists to create notification
    const statusChanged = existingCustom && existingCustom.status !== status;

    await ScheduleCustom.upsert({
      id: id,
      user_id: user_id,
      total_cost: totalCost,
      ...(status ? { status } : {}),
      ...(deposit_deadline !== undefined ? { deposit_deadline } : {}),
      ...(start_date !== undefined ? { start_date } : {}),
      ...(end_date !== undefined ? { end_date } : {}),
      ...(companion_email !== undefined ? { companion_email } : {})
    });

    // Create UserSchedule junction if not exist
    await UserSchedule.findOrCreate({
      where: { user_id: user_id, schedule_id: id }
    });

    // Create notifications on status change
    if (statusChanged || (!existingCustom && status)) {
      if (status === 'deposited') {
        await Notification.create({
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: user_id,
          title: 'Đặt cọc thành công',
          message: `Bạn đã hoàn tất đặt cọc cho chuyến đi ${destination || 'của bạn'}. Lịch trình hiện tại đã được khóa.`,
          type: 'itinerary',
          link: `/schedule/${id}`,
          reference_id: id,
          read: false
        });
      } else if (status === 'cancelled') {
        await Notification.create({
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: user_id,
          title: 'Đã hủy đặt cọc',
          message: `Lịch trình chuyến đi ${destination || 'của bạn'} đã được hủy thành công. Số tiền cọc đã được hoàn trả về ví của bạn.`,
          type: 'itinerary',
          link: `/schedule/${id}`,
          reference_id: id,
          read: false
        });
      }
    } else if (!existingCustom) {
      // Initial creation notification
      await Notification.create({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: user_id,
        title: 'Hành trình mới',
        message: `Lịch trình tự thiết kế đi ${destination || 'điểm đến mới'} đã được khởi tạo thành công!`,
        type: 'itinerary',
        link: `/schedule/${id}`,
        reference_id: id,
        read: false
      });
    }

    // Destroy old activities
    await ScheduleActivity.destroy({ where: { schedule_id: id } });

    // Save new activities
    const activitiesToSave = [];
    if (daysData && daysData.length > 0) {
      // Query green services at this destination to auto-link service_id by name if not provided
      const { GreenService } = require('../models/index');
      const services = await GreenService.findAll({ where: { destination }, attributes: ['id', 'name_service'], include: [] });
      const serviceMap = {};
      services.forEach(s => {
        serviceMap[s.name_service.toLowerCase().trim()] = s.id;
      });

      daysData.forEach((day, dIdx) => {
        day.forEach((act, aIdx) => {
          const actId = `act_${id}_${dIdx + 1}_${aIdx + 1}_${Math.random().toString(36).substring(2, 7)}`;
          const actName = act.name || act.title || '[Địa điểm tự do]';
          const nameKey = actName.toLowerCase().trim();
          const serviceId = aiGenerated ? (act.service_id || null) : (act.service_id || act.serviceId || serviceMap[nameKey] || null);

          activitiesToSave.push({
            id: actId,
            schedule_id: id,
            day_number: dIdx + 1,
            time: act.time || '08:00',
            activity_name: actName,
            activity_cost: act.cost || 0,
            carbon: act.carbon || 0,
            coordinates: act.lat && act.lng ? `${act.lat}, ${act.lng}` : null,
            service_id: serviceId
          });
        });
      });
      await ScheduleActivity.bulkCreate(activitiesToSave);
    }

    res.json({ success: true, itineraryId: id, id, message: 'Đã lưu lịch trình thành công và đồng bộ carbon!' });
  } catch (error) {
    next(error);
  }
}

exports.createAiItinerary = async (req, res, next) => {
  const userId = req.user?.id;
  const body = req.body || {};
  const destination = typeof body.destination === 'string' ? body.destination.trim().slice(0, 100) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const daysData = body.daysData;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

  if (!userId) return res.status(401).json({ success: false, message: 'Đăng nhập để lưu lịch trình vào tài khoản của bạn.' });
  if (!destination || !Array.isArray(daysData) || !daysData.length || daysData.length > 14 || daysData.some(day => !Array.isArray(day) || day.length > 12)) {
    return res.status(400).json({ success: false, message: 'Dữ liệu lịch trình AI chưa hợp lệ.' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.' });
    const services = await require('../models/index').GreenService.findAll({ where: { status: 'active' } });
    const servicesById = new Map(services.map(service => [service.id, service]));
    const canonicalDays = daysData.map(day => day.map(activity => {
      const activityName = typeof activity?.name === 'string' ? activity.name.trim().slice(0, 140) : '';
      if (!activityName) return null;
      const id = typeof activity.serviceId === 'string' ? activity.serviceId : typeof activity.service_id === 'string' ? activity.service_id : '';
      const service = id ? servicesById.get(id) : null;
      if (service) {
        return {
          name: service.name_service, time: typeof activity.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(activity.time) ? activity.time : '08:00',
          cost: Number(service.cost) || 0, carbon: Number(service.carbon) || 0, service_id: service.id
        };
      }
      return {
        name: activityName, time: typeof activity.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(activity.time) ? activity.time : '08:00',
        cost: 0, carbon: 0
      };
    }).filter(Boolean));
    if (!canonicalDays.some(day => day.length)) return res.status(400).json({ success: false, message: 'Lịch trình cần có ít nhất một hoạt động.' });

    const totalCost = canonicalDays.flat().reduce((sum, activity) => sum + activity.cost, 0);
    const id = `iti_${randomUUID()}`;
    const payload = {
      id, name: name || `Hành trình khám phá ${destination}`, user_id: userId, destination,
      days: canonicalDays.length, totalCost, daysData: canonicalDays, status: 'draft',
      start_date: validDate(body.startDate), end_date: validDate(body.endDate),
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.slice(0, 500) : null
    };
    return persistCustomItinerary(req, res, next, payload, { aiGenerated: true });
  } catch (error) {
    next(error);
  }
};

// 5. Get All Custom Itineraries for a User (Eager Loading — single query)
exports.getUserCustomItineraries = async (req, res, next) => {
  const { userId } = req.params;
  if (!req.user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (String(userId) !== String(req.user.id)) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const userSchedules = await UserSchedule.findAll({
      where: { user_id: userId }
    });
    const scheduleIds = userSchedules.map(us => us.schedule_id);

    const customs = await ScheduleCustom.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { id: { [Op.in]: scheduleIds } }
        ]
      },
      include: [{
        model: Schedule,
        include: [{ model: ScheduleActivity }]
      }]
    });

    const result = customs
      .filter(c => c.Schedule)
      .map(c => ({
        id: c.id,
        name: c.Schedule.tour_name,
        destination: c.Schedule.destination || 'Việt Nam',
        days: c.Schedule.days,
        totalCost: c.total_cost,
        totalCarbon: c.Schedule.carbon,
        daysData: formatActivitiesIntoDays(c.Schedule, c.Schedule.ScheduleActivities),
        status: c.status || 'draft',
        deposit_deadline: c.deposit_deadline || null,
        start_date: c.start_date || null,
        end_date: c.end_date || null,
        companion_email: c.companion_email || null,
        imageUrl: c.Schedule.image_url
      }));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 6. Get Single Custom Itinerary (Hot RAM Cache + Parallel Eager Loading + Sample Fallback)
exports.getCustomItineraryById = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const cleanId = String(id).replace(/^iti_/, '');
    let c = await ScheduleCustom.findByPk(id, {
      include: [{
        model: Schedule,
        include: [{ model: ScheduleActivity }]
      }]
    });
    if (!c) {
      c = await ScheduleCustom.findByPk(`iti_${cleanId}`, {
        include: [{
          model: Schedule,
          include: [{ model: ScheduleActivity }]
        }]
      });
    }
    if (!c) {
      c = await ScheduleCustom.findByPk(cleanId, {
        include: [{
          model: Schedule,
          include: [{ model: ScheduleActivity }]
        }]
      });
    }

    const actualId = c ? c.id : id;
    const userSchedules = await UserSchedule.findAll({ where: { schedule_id: actualId } });
    if (c && String(c.user_id) !== String(req.user.id) && !userSchedules.some(item => String(item.user_id) === String(req.user.id))) return res.status(403).json({ success: false, error: 'Forbidden' });

    if (!c || !c.Schedule) {
      // Fallback: if someone shared a preset/sample tour ID on /schedule/:id
      const fallbackSchedule = await Schedule.findByPk(id, {
        include: [{ model: ScheduleActivity }]
      });
      if (fallbackSchedule) {
        const sample = await ScheduleSample.findByPk(id);
        const fallbackPayload = {
          id: fallbackSchedule.id,
          name: fallbackSchedule.tour_name,
          destination: fallbackSchedule.destination || 'Việt Nam',
          days: fallbackSchedule.days,
          totalCost: sample ? sample.cost : 0,
          totalCarbon: fallbackSchedule.carbon,
          daysData: formatActivitiesIntoDays(fallbackSchedule, fallbackSchedule.ScheduleActivities),
          status: 'draft',
          deposit_deadline: null,
          start_date: null,
          end_date: null,
          companion_email: null,
          imageUrl: fallbackSchedule.image_url,
          collaborators: []
        };
        return res.json(fallbackPayload);
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình!' });
    }

    const collaboratorIds = [...new Set([c.user_id, ...userSchedules.map(us => us.user_id)].filter(Boolean))];
    const collaborators = collaboratorIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: collaboratorIds } },
          attributes: ['id', 'username', 'fullname', 'avatarUrl', 'email']
        })
      : [];

    const responseData = {
      id: c.id,
      name: c.Schedule.tour_name,
      user_id: c.user_id,
      destination: c.Schedule.destination || 'Việt Nam',
      days: c.Schedule.days,
      totalCost: c.total_cost,
      totalCarbon: c.Schedule.carbon,
      daysData: formatActivitiesIntoDays(c.Schedule, c.Schedule.ScheduleActivities),
      status: c.status || 'draft',
      deposit_deadline: c.deposit_deadline || null,
      start_date: c.start_date || null,
      end_date: c.end_date || null,
      companion_email: c.companion_email || null,
      imageUrl: c.Schedule.image_url,
      collaborators: collaborators.map(u => ({
        id: u.id,
        username: u.username,
        fullname: u.fullname || u.username,
        avatarUrl: u.avatarUrl || u.avatar_url || '',
        email: u.email
      }))
    };

    customItineraryCache.set(id, { data: responseData, cachedAt: Date.now() });
    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

// 7. Delete Custom Itinerary
exports.deleteCustomItinerary = async (req, res, next) => {
  const { id } = req.params;
  if (!req.user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
  customItineraryCache.delete(id);
  try {
    const owned = await ScheduleCustom.findByPk(id);
    if (!owned) return res.status(404).json({ success: false, error: 'Not found' });
    if (String(owned.user_id) !== String(req.user.id)) return res.status(403).json({ success: false, error: 'Forbidden' });
    await ScheduleActivity.destroy({ where: { schedule_id: id } });
    await UserSchedule.destroy({ where: { schedule_id: id } });
    await ScheduleCustom.destroy({ where: { id } });
    await Schedule.destroy({ where: { id } });

    res.json({ success: true, message: 'Đã xóa lịch trình thành công!' });
  } catch (error) {
    next(error);
  }
};

// 8. Get Distinct Destinations List (SWR Cached + Parallelized)
exports.getDestinations = async (req, res, next) => {
  try {
    const now = Date.now();
    if (destinationsCache.data && destinationsCache.items && now < destinationsCache.expiresAt) {
      if (req.query.page || req.query.pageSize || req.query.format === 'catalog') {
        return res.json({
          success: true,
          items: destinationsCache.items,
          total: destinationsCache.items.length,
          page: Number(req.query.page) || 1,
          pageSize: Number(req.query.pageSize) || destinationsCache.items.length,
          totalPages: 1
        });
      }
      return res.json(destinationsCache.data);
    }

    const [dbDests, schedules] = await Promise.all([
      Destination.findAll().catch(() => []),
      Schedule.findAll({ distinctField: 'destination' }).catch(() => [])
    ]);
    const scheduleDests = schedules.map(s => s.destination).filter(Boolean);

    // Merge destinations, normalizing en-dash (–) to hyphen (-) for clean deduplication
    const map = new Map();
    [...dbDests.map(d => d.name), ...scheduleDests].forEach(rawName => {
      if (!rawName) return;
      const cleanKey = String(rawName).replace(/\u2013|\u2014/g, '-').trim().toLowerCase();
      if (!map.has(cleanKey)) {
        map.set(cleanKey, String(rawName).replace(/\u2013|\u2014/g, '-').trim());
      }
    });
    const uniqueDests = Array.from(map.values());

    const items = uniqueDests.map(name => {
      const cleanKey = name.toLowerCase();
      const matched = dbDests.find(d => String(d.name || '').replace(/\u2013|\u2014/g, '-').trim().toLowerCase() === cleanKey);
      return {
        id: matched ? matched.id : `dest_${cleanKey.replace(/\s+/g, '-')}`,
        slug: matched ? matched.slug : cleanKey.replace(/\s+/g, '-'),
        name: name,
        regionId: matched ? matched.regionId : null,
        image_url: matched ? matched.image_url : null,
        description: matched ? matched.description : null
      };
    });

    destinationsCache.data = uniqueDests;
    destinationsCache.items = items;
    destinationsCache.expiresAt = now + DESTINATIONS_TTL_MS;

    if (req.query.page || req.query.pageSize || req.query.format === 'catalog') {
      return res.json({
        success: true,
        items,
        total: items.length,
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || items.length,
        totalPages: 1
      });
    }

    res.json(uniqueDests);
  } catch (error) {
    next(error);
  }
};

exports.getDestinationBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cleanSlug = String(slug || '').replace(/\u2013|\u2014/g, '-').trim().toLowerCase();
    const dest = await Destination.findOne({
      where: {
        [Op.or]: [
          { slug: cleanSlug },
          { id: slug },
          { name: slug }
        ]
      }
    });
    if (!dest) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm đến!' });
    }
    res.json({ success: true, item: dest });
  } catch (error) {
    next(error);
  }
};

// 9. Post Tour Review
exports.postTourReview = async (req, res, next) => {
  const { tourId, rating, text, parentCommentId } = req.body;
  const userId = req.user?.id;
  try {
    if (!userId) return res.status(401).json({ success: false, message: 'Đăng nhập để gửi đánh giá.' });
    if (parentCommentId) {
      if (req.user?.role === 'provider' && !await providerOwnsReviewTarget(userId, parentCommentId, tourId)) {
        return res.status(403).json({ success: false, message: 'Tour does not belong to this provider.' });
      }
      const comment = await createReply({ type: 'tour', targetId: tourId, parentCommentId, userId, text });
      const user = await User.findByPk(userId);
      return res.status(201).json({
        success: true,
        comment: {
          id: comment.id,
          user: user ? {
            id: user.id,
            fullname: user.fullname,
            role: user.role,
            avatar: user.avatarUrl || user.avatar || (user.fullname || 'U').charAt(0).toUpperCase(),
            avatarUrl: user.avatarUrl || ''
          } : null,
          rating: null,
          text: comment.text,
          parentCommentId: comment.parent_comment_id,
          likesCount: 0,
          createdAt: comment.createdAt,
          replies: []
        }
      });
    }

    const result = await createBookingReview({
      type: 'tour',
      bookingId: req.body.bookingId,
      targetId: tourId,
      rating,
      text,
      userId,
      role: req.user.role
    });
    const user = await User.findByPk(userId);
    const storedComment = result.comment.toJSON ? result.comment.toJSON() : { ...result.comment };
    const comment = {
      ...storedComment,
      user: user ? {
        id: user.id,
        fullname: user.fullname,
        role: user.role,
        avatar: user.avatarUrl || (user.fullname || 'U').charAt(0).toUpperCase(),
        avatarUrl: user.avatarUrl || ''
      } : null,
      parentCommentId: null,
      likesCount: 0,
      replies: []
    };
    res.status(201).json({
      success: true,
      review: comment,
      comment,
      bookingId: result.booking ? result.booking.id : null,
      type: 'tour',
      targetId: result.target.id,
      rating: result.rating,
      votes_count: result.reviews_count,
      reviews_count: result.reviews_count
    });
  } catch (error) {
    next(error);
  }
};
// 10. Get Tour Reviews
exports.getTourReviews = async (req, res, next) => {
  const { tourId } = req.params;
  try {
    const cpssList = await CPSS.findAll({ where: { schedule_sample_id: tourId } });
    const commentIds = cpssList.map(c => c.comment_id);

    const comments = await CommentPost.findAll({
      where: {
        [Op.or]: [
          { tour_id: tourId },
          { id: { [Op.in]: commentIds } }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    const commentMap = {};
    const commentTree = [];

    for (let c of comments) {
      const user = await User.findByPk(c.user_id);
      const cJson = {
        id: c.id,
        bookingId: c.booking_id || null,
        verified: !!(c.booking_id || c.is_verified),
        user: user ? {
          id: user.id,
          fullname: user.fullname,
          role: user.role,
          avatar: user.avatarUrl || user.fullname?.charAt(0).toUpperCase() || 'U',
          avatarUrl: user.avatarUrl || ''
        } : { fullname: 'Người dùng ẩn danh', avatar: 'U', avatarUrl: '' },
        rating: c.rating,
        text: c.text,
        parentCommentId: c.parent_comment_id,
        likesCount: c.likes_count || 0,
        createdAt: c.createdAt,
        replies: []
      };
      commentMap[c.id] = cJson;
    }

    for (let c of Object.values(commentMap)) {
      if (c.parentCommentId && commentMap[c.parentCommentId]) {
        commentMap[c.parentCommentId].replies.push(c);
      } else {
        commentTree.push(c);
      }
    }

    // Sort root reviews newest first
    commentTree.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(commentTree);
  } catch (error) {
    next(error);
  }
};

// 10b. Like / React helpful to Tour Review
exports.likeComment = async (req, res, next) => {
  const { commentId } = req.params;
  try {
    const comment = await CommentPost.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Bình luận không tồn tại!' });
    }

    comment.likes_count = (comment.likes_count || 0) + 1;
    await comment.save();

    res.json({ success: true, likes: comment.likes_count });
  } catch (error) {
    next(error);
  }
};


exports.cloneItinerary = async (req, res, next) => {
  const { id } = req.params;
  const newUserId = req.user?.id;
  if (!newUserId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const base = await Schedule.findByPk(id);
    if (!base) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình gốc để sao chép!' });
    }

    const custom = await ScheduleCustom.findByPk(id);
    const activities = await ScheduleActivity.findAll({ where: { schedule_id: id } });

    const newId = 'iti_' + Date.now();

    // Create Base Schedule
    await Schedule.create({
      id: newId,
      tour_name: `Bản sao - ${base.tour_name}`,
      destination: base.destination,
      days: base.days,
      discount: base.discount,
      carbon: base.carbon,
      image_url: base.image_url,
      tour_description: base.tour_description,
      catalog_status: 'personal'
    });

    // Create ScheduleCustom for new user
    await ScheduleCustom.create({
      id: newId,
      user_id: newUserId,
      total_cost: custom ? custom.total_cost : 0,
      status: 'draft',
      deposit_deadline: null,
      start_date: custom ? custom.start_date : null,
      end_date: custom ? custom.end_date : null,
      companion_email: null
    });

    // Create UserSchedule junction
    await UserSchedule.create({
      user_id: newUserId,
      schedule_id: newId
    });

    // Copy Activities
    const newActivities = activities.map((act, idx) => {
      return {
        id: `act_${newId}_${act.day_number}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
        schedule_id: newId,
        day_number: act.day_number,
        time: act.time,
        activity_name: act.activity_name,
        activity_cost: act.activity_cost,
        carbon: act.carbon,
        coordinates: act.coordinates,
        service_id: act.service_id
      };
    });

    if (newActivities.length > 0) {
      await ScheduleActivity.bulkCreate(newActivities);
    }

    // Trigger Notifications
    await Notification.create({
      id: `notif_${Date.now()}_b_${Math.random().toString(36).substring(2, 7)}`,
      user_id: newUserId,
      title: 'Sao chép thành công',
      message: `Đã tham khảo & sao chép lịch trình "${base.tour_name}" thành công!`,
      type: 'itinerary',
      link: `/schedule/${newId}`,
      reference_id: newId,
      read: false
    });

    if (custom && custom.user_id && custom.user_id !== newUserId) {
      const clonerUser = await User.findByPk(newUserId);
      const clonerName = clonerUser ? clonerUser.fullname : 'Một người dùng';
      await Notification.create({
        id: `notif_${Date.now()}_a_${Math.random().toString(36).substring(2, 7)}`,
        user_id: custom.user_id,
        title: 'Lịch trình được tham khảo',
        message: `${clonerName} đã tham khảo & sao chép lịch trình "${base.tour_name}" của bạn!`,
        type: 'itinerary',
        link: `/schedule/${base.id}`,
        reference_id: base.id,
        read: false
      });
    }

    res.json({ success: true, message: 'Đã sao chép lịch trình thành công!', newItineraryId: newId });
  } catch (error) {
    next(error);
  }
};

// 8. Invite Friends/Collaborators to Custom Itinerary
exports.inviteCollaborator = async (req, res, next) => {
  const { id } = req.params;
  const { emails, inviteUrl } = req.body;

  try {
    const c = await ScheduleCustom.findByPk(id, {
      include: [{ model: Schedule }]
    });
    if (!c || !c.Schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình!' });
    }

    if (String(c.user_id) !== String(req.user?.id)) return res.status(403).json({ success: false, error: 'Forbidden' });

    const emailList = typeof emails === 'string'
      ? emails.split(',').map(e => e.trim()).filter(e => e.length > 0)
      : (Array.isArray(emails) ? emails : []);

    if (emailList.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách email hợp lệ!' });
    }

    c.companion_email = emailList.join(', ');
    await c.save();

    let successCount = 0;
    for (const email of emailList) {
      const emailSent = await sendItineraryInviteEmail({
        to: email,
        itineraryName: c.Schedule.tour_name,
        inviteUrl: inviteUrl
      });
      if (emailSent) successCount++;
    }

    if (successCount > 0) {
      res.json({ success: true, message: `Đã gửi thành công ${successCount}/${emailList.length} thư mời!` });
    } else {
      res.status(500).json({ success: false, message: 'Gửi email lời mời thất bại. Vui lòng kiểm tra lại địa chỉ email hoặc thử lại!' });
    }
  } catch (error) {
    next(error);
  }
};

// 9. Join Custom Itinerary (for invited friends)
exports.joinItinerary = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const cleanId = (id || '').replace('iti_', '');
    let c = await ScheduleCustom.findByPk(id, {
      include: [{ model: Schedule }]
    });
    if (!c) c = await ScheduleCustom.findByPk(`iti_${cleanId}`, { include: [{ model: Schedule }] });
    if (!c) c = await ScheduleCustom.findByPk(cleanId, { include: [{ model: Schedule }] });
    if (!c) {
      const s = await Schedule.findByPk(id) || await Schedule.findByPk(`iti_${cleanId}`) || await Schedule.findByPk(cleanId);
      if (s) {
        c = { id: s.id, user_id: s.user_id || userId, Schedule: s, name: s.tour_name };
      }
    }

    if (!c) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình!' });
    }

    const joiningUser = await User.findByPk(userId);
    const invitedEmails = String(c.companion_email || '').split(',').map(value => value.trim().toLowerCase());
    if (String(c.user_id) !== String(userId) && !invitedEmails.includes(String(joiningUser?.email || '').toLowerCase())) return res.status(403).json({ success: false, error: 'Forbidden' });

    const actualScheduleId = c.id;
    await UserSchedule.findOrCreate({
      where: { user_id: userId, schedule_id: actualScheduleId }
    });

    customItineraryCache.delete(actualScheduleId);
    customItineraryCache.delete(id);
    customItineraryCache.delete(`iti_${cleanId}`);
    customItineraryCache.delete(cleanId);

    const userSchedules = await UserSchedule.findAll({ where: { schedule_id: actualScheduleId } });
    const collaboratorIds = [...new Set([c.user_id, ...userSchedules.map(us => us.user_id)].filter(Boolean))];
    const collaborators = collaboratorIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: collaboratorIds } },
          attributes: ['id', 'username', 'fullname', 'avatarUrl', 'email']
        })
      : [];

    const joinedUser = await User.findByPk(userId);
    if (joinedUser && c.user_id !== userId) {
      await Notification.create({
        id: `notif_${Date.now()}_join_${Math.random().toString(36).substring(2, 7)}`,
        user_id: c.user_id,
        title: 'Đồng hành mới',
        message: `${joinedUser.fullname || joinedUser.username} đã chấp nhận lời mời và tham gia lập lịch trình "${c.Schedule?.tour_name || c.name || 'Lịch trình tự thiết kế'}" cùng bạn!`,
        type: 'itinerary',
        link: `/schedule/${actualScheduleId}`,
        reference_id: actualScheduleId,
        read: false
      });
    }

    res.json({
      success: true,
      message: 'Bạn đã tham gia lịch trình thành công!',
      collaborators: collaborators.map(u => ({
        id: u.id,
        username: u.username,
        fullname: u.fullname || u.username,
        avatarUrl: u.avatarUrl || u.avatar_url || '',
        email: u.email
      }))
    });
  } catch (error) {
    next(error);
  }
};
