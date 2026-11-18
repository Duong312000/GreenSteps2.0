'use strict';

/**
 * Role-Scoped Behavioral Analytics Service (NCC vs Admin)
 *
 * Security & RBAC guarantee:
 *  - Providers (`role === 'provider'`) are strictly locked to their own `user.id` and the
 *    `GreenService` / `ScheduleSample` items they own. Any `providerId` parameter sent by a
 *    provider client is ignored.
 *  - Admins (`role === 'admin'`) can inspect platform-wide aggregates or inspect a specific
 *    provider (which is recorded in `AdminAuditLog`).
 */

const { store } = require('../config/db.config');
const {
  User,
  Vender,
  Provider,
  GreenService,
  Schedule,
  ScheduleSample,
  ServiceBooking,
  TourBooking,
  AdminAuditLog,
  Op
} = require('../models');
const telemetry = require('./telemetry.service');
const ecoScore = require('./eco-score.service');

const SOURCE_LABELS = {
  direct: 'Truy cập trực tiếp',
  home: 'Trang chủ',
  listing: 'Danh mục khám phá',
  community: 'Cộng đồng du lịch xanh',
  recommendation: 'Gợi ý cá nhân hóa',
  search_engine: 'Công cụ tìm kiếm',
  social: 'Mạng xã hội',
  external: 'Liên kết ngoài',
  internal: 'Điều hướng nội bộ'
};

function resolveDateWindow(fromDate, toDate, defaultDays = 30) {
  const now = new Date();
  const end = toDate && /^\d{4}-\d{2}-\d{2}$/.test(String(toDate))
    ? String(toDate)
    : telemetry._internal.dayKey(now);
  const startMs = new Date(`${end}T00:00:00Z`).getTime() - (defaultDays - 1) * 86400 * 1000;
  const start = fromDate && /^\d{4}-\d{2}-\d{2}$/.test(String(fromDate))
    ? String(fromDate)
    : new Date(startMs).toISOString().slice(0, 10);
  return { start, end };
}

function dailyCollection() {
  return store.db.collection(telemetry.collectionNames().daily);
}

function searchCollection() {
  return store.db.collection(telemetry.collectionNames().search);
}

/**
 * Resolves all catalog items (services and preset tours) owned by a provider user.
 */
async function resolveProviderOwnedCatalog(ownerUserId) {
  const [vender, provider] = await Promise.all([
    Vender.findOne({ where: { user_id: ownerUserId } }),
    Provider.findOne({ where: { user_id: ownerUserId } })
  ]);

  const services = vender
    ? await GreenService.findAll({ where: { vender_id: vender.id } })
    : [];

  let tours = [];
  if (provider) {
    const samples = await ScheduleSample.findAll({
      where: { provider_id: provider.id },
      include: [{ model: Schedule }]
    });
    tours = samples.map(s => ({
      id: s.id,
      name: s.Schedule?.tour_name || s.id,
      destination: s.Schedule?.destination || '',
      cost: s.cost,
      rating: s.rating,
      carbon: s.Schedule?.carbon || 0,
      days: s.Schedule?.days || 1
    }));
  }

  const catalogMap = new Map();
  for (const s of services) {
    catalogMap.set(`service:${s.id}`, {
      targetType: 'service',
      targetId: s.id,
      name: s.name_service,
      destination: s.destination,
      category: s.type,
      cost: s.cost,
      rating: s.rating,
      viewsCountFallback: Number(s.views_count || 0),
      rawItem: s
    });
  }
  for (const t of tours) {
    catalogMap.set(`tour:${t.id}`, {
      targetType: 'tour',
      targetId: t.id,
      name: t.name,
      destination: t.destination,
      category: 'tour',
      cost: t.cost,
      rating: t.rating,
      viewsCountFallback: 0,
      rawItem: t
    });
  }

  return { vender, provider, services, tours, catalogMap };
}

function buildActionableSuggestion(itemMetrics) {
  if (itemMetrics.views < 5) {
    return 'Dịch vụ mới có ít lượt tiếp cận. Hãy cập nhật tiêu chí xanh và hình ảnh bìa rõ nét để được ưu tiên đề xuất.';
  }
  if (itemMetrics.avgActiveSeconds < 20) {
    return 'Khách rời trang khá nhanh (dưới 20 giây). Nên bổ sung lịch trình chi tiết và hình ảnh thực tế để giữ chân người xem.';
  }
  if (itemMetrics.scrollCompletionPct < 35) {
    return 'Ít khách cuộn hết trang. Hãy đưa các điểm nổi bật và cam kết sinh thái lên phần đầu mô tả.';
  }
  if (itemMetrics.bookClickRatePct < 2 && itemMetrics.views >= 20) {
    return 'Khách đọc kỹ nhưng ít bấm đặt chỗ. Hãy kiểm tra lại mức giá, chính sách hủy linh hoạt hoặc ưu đãi đi kèm.';
  }
  return 'Hiệu quả tương tác tốt. Duy trì chất lượng dịch vụ và phản hồi đánh giá của du khách.';
}

/**
 * Scoped analytics strictly for a single provider (NCC).
 */
async function getProviderAnalytics({ requestUser, queryProviderId, fromDate, toDate }) {
  await store.authenticate();
  await telemetry.ensureFreshRollup();

  // RBAC enforcement: only Admin can inspect another providerId. Providers are locked to their own ID.
  let targetOwnerId = String(requestUser.id);
  if (requestUser.role === 'admin' && queryProviderId && String(queryProviderId) !== String(requestUser.id)) {
    targetOwnerId = String(queryProviderId);
    await AdminAuditLog.create({
      actor_id: requestUser.id,
      target_user_id: targetOwnerId,
      action: 'VIEW_PROVIDER_ANALYTICS',
      reason: 'Quản trị viên xem báo cáo hiệu quả hoạt động của đối tác',
      previous_state: null,
      new_state: { fromDate: fromDate || null, toDate: toDate || null },
      result: 'success'
    });
  }

  const window = resolveDateWindow(fromDate, toDate, 30);
  const owned = await resolveProviderOwnedCatalog(targetOwnerId);
  const targetIds = [...owned.catalogMap.values()].map(item => item.targetId);

  const matchFilter = targetIds.length > 0
    ? {
        d: { $gte: window.start, $lte: window.end },
        $or: [
          { oid: targetOwnerId },
          { tid: { $in: targetIds } }
        ]
      }
    : { d: { $gte: window.start, $lte: window.end }, oid: targetOwnerId };

  const dailyRows = await dailyCollection().find(matchFilter).sort({ d: 1 }).toArray();

  // Fetch completed/deposited bookings for this provider's services & tours in the date window
  const serviceIds = owned.services.map(s => s.id);
  const tourIds = owned.tours.map(t => t.id);

  const [serviceBookings, tourBookings] = await Promise.all([
    serviceIds.length > 0
      ? ServiceBooking.findAll({
          where: {
            service_id: { [Op.in]: serviceIds },
            status: { [Op.in]: ['deposit', 'completed'] },
            booking_date: { [Op.between]: [window.start, window.end] }
          }
        })
      : [],
    tourIds.length > 0
      ? TourBooking.findAll({
          where: {
            schedule_id: { [Op.in]: tourIds },
            status: { [Op.in]: ['deposit', 'completed'] },
            booking_date: { [Op.between]: [window.start, window.end] }
          }
        })
      : []
  ]);

  const bookingsByTarget = new Map();
  let totalBookings = 0;
  let totalRevenue = 0;

  for (const b of serviceBookings) {
    const key = `service:${b.service_id}`;
    const entry = bookingsByTarget.get(key) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(b.value || 0);
    bookingsByTarget.set(key, entry);
    totalBookings += 1;
    totalRevenue += Number(b.value || 0);
  }
  for (const b of tourBookings) {
    const key = `tour:${b.schedule_id}`;
    const entry = bookingsByTarget.get(key) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(b.value || 0);
    bookingsByTarget.set(key, entry);
    totalBookings += 1;
    totalRevenue += Number(b.value || 0);
  }

  let totalImpressions = 0;
  let totalViews = 0;
  let totalEngagedViews = 0;
  let totalActiveSeconds = 0;
  let totalScrollDone = 0;
  let totalBookClicks = 0;
  const sourceCounts = {};
  const byDay = new Map();
  const byTarget = new Map();

  for (const [key, meta] of owned.catalogMap.entries()) {
    byTarget.set(key, {
      targetType: meta.targetType,
      targetId: meta.targetId,
      name: meta.name,
      destination: meta.destination,
      category: meta.category,
      impressions: 0,
      views: 0,
      engagedViews: 0,
      activeSecondsSum: 0,
      scrollDone: 0,
      bookClicks: 0,
      bookings: bookingsByTarget.get(key)?.count || 0,
      revenue: bookingsByTarget.get(key)?.revenue || 0
    });
  }

  for (const row of dailyRows) {
    const key = `${row.tt}:${row.tid}`;
    // Double check ownership so no unowned target ever leaks
    if (!owned.catalogMap.has(key) && String(row.oid || '') !== targetOwnerId) continue;

    const imp = Number(row.imp || 0);
    const views = Number(row.views || 0);
    const engaged = Number(row.engaged || 0);
    const actSum = Number(row.act_sum || 0);
    const scrollDone = Number(row.scroll_done || 0);
    const bookClicks = Number(row.book_click_views || row.actions?.book_click || 0);

    totalImpressions += imp;
    totalViews += views;
    totalEngagedViews += engaged;
    totalActiveSeconds += actSum;
    totalScrollDone += scrollDone;
    totalBookClicks += bookClicks;

    if (row.sources && typeof row.sources === 'object') {
      for (const [src, cnt] of Object.entries(row.sources)) {
        sourceCounts[src] = (sourceCounts[src] || 0) + Number(cnt || 0);
      }
    }

    const dayEntry = byDay.get(row.d) || { date: row.d, views: 0, engagedViews: 0, activeSecondsSum: 0, bookClicks: 0 };
    dayEntry.views += views;
    dayEntry.engagedViews += engaged;
    dayEntry.activeSecondsSum += actSum;
    dayEntry.bookClicks += bookClicks;
    byDay.set(row.d, dayEntry);

    const itemEntry = byTarget.get(key);
    if (itemEntry) {
      itemEntry.impressions += imp;
      itemEntry.views += views;
      itemEntry.engagedViews += engaged;
      itemEntry.activeSecondsSum += actSum;
      itemEntry.scrollDone += scrollDone;
      itemEntry.bookClicks += bookClicks;
    }
  }

  const avgActiveSeconds = totalEngagedViews > 0
    ? Math.round(totalActiveSeconds / totalEngagedViews)
    : 0;
  const scrollCompletionPct = totalViews > 0
    ? Math.round((totalScrollDone / totalViews) * 1000) / 10
    : 0;
  const bookClickRatePct = totalViews > 0
    ? Math.round((totalBookClicks / totalViews) * 1000) / 10
    : 0;

  const items = [];
  for (const [key, entry] of byTarget.entries()) {
    const meta = owned.catalogMap.get(key);
    const eco = meta?.rawItem
      ? ecoScore.calculateAssessment({ item: meta.rawItem, kind: entry.targetType })
      : null;

    const itemAvgSeconds = entry.engagedViews > 0
      ? Math.round(entry.activeSecondsSum / entry.engagedViews)
      : 0;
    const itemScrollPct = entry.views > 0
      ? Math.round((entry.scrollDone / entry.views) * 1000) / 10
      : 0;
    const itemBookClickPct = entry.views > 0
      ? Math.round((entry.bookClicks / entry.views) * 1000) / 10
      : 0;

    const formatted = {
      targetType: entry.targetType,
      targetId: entry.targetId,
      name: entry.name,
      destination: entry.destination,
      category: entry.category,
      impressions: entry.impressions,
      views: entry.views,
      avgActiveSeconds: itemAvgSeconds,
      scrollCompletionPct: itemScrollPct,
      bookClicks: entry.bookClicks,
      bookClickRatePct: itemBookClickPct,
      bookings: entry.bookings,
      revenue: entry.revenue,
      ecoTierLabel: eco?.tierLabel || 'Đạt chuẩn xanh',
      co2SavedKg: eco?.co2SavedKg || 0,
      suggestion: ''
    };
    formatted.suggestion = buildActionableSuggestion(formatted);
    items.push(formatted);
  }

  items.sort((a, b) => b.views - a.views || b.bookings - a.bookings);

  const trafficSources = Object.entries(sourceCounts)
    .map(([source, count]) => ({
      source,
      label: SOURCE_LABELS[source] || 'Nguồn khác',
      views: count,
      sharePct: totalViews > 0 ? Math.round((count / totalViews) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.views - a.views);

  const dailySeries = [...byDay.values()].map(d => ({
    date: d.date,
    views: d.views,
    avgActiveSeconds: d.engagedViews > 0 ? Math.round(d.activeSecondsSum / d.engagedViews) : 0,
    bookClicks: d.bookClicks
  }));

  const summaryHeadline = totalViews > 0
    ? `Các dịch vụ của bạn ghi nhận ${totalViews.toLocaleString('vi-VN')} lượt xem, thời gian đọc trung bình ${avgActiveSeconds} giây và ${totalBookings} đơn đặt thành công.`
    : 'Chưa có lượt xem mới trong khoảng thời gian này. Khi khách hàng xem dịch vụ của bạn, thời gian đọc và tỷ lệ chuyển đổi sẽ hiển thị tại đây.';

  return {
    scope: 'provider',
    ownerUserId: targetOwnerId,
    providerName: owned.vender?.name_provider || owned.provider?.name_provider || 'Đối tác GreenSteps',
    period: { fromDate: window.start, toDate: window.end },
    summaryHeadline,
    totals: {
      ownedItemsCount: items.length,
      impressions: totalImpressions,
      views: totalViews,
      avgActiveSeconds,
      scrollCompletionPct,
      bookClicks: totalBookClicks,
      bookClickRatePct,
      bookings: totalBookings,
      revenue: totalRevenue
    },
    items,
    trafficSources,
    dailySeries
  };
}

/**
 * Platform-wide analytics exclusively for Admin (`role === 'admin'`).
 */
async function getAdminAnalytics({ fromDate, toDate }) {
  await store.authenticate();
  await telemetry.ensureFreshRollup();

  const window = resolveDateWindow(fromDate, toDate, 30);

  const [dailyRows, searchRows, services, schedules, venders, users] = await Promise.all([
    dailyCollection().find({ d: { $gte: window.start, $lte: window.end } }).toArray(),
    searchCollection().find({ d: { $gte: window.start, $lte: window.end } }).toArray(),
    GreenService.findAll(),
    Schedule.findAll(),
    Vender.findAll(),
    User.findAll({ attributes: ['id', 'fullname', 'username', 'company_name', 'role'] })
  ]);

  const serviceById = new Map(services.map(s => [s.id, s]));
  const scheduleById = new Map(schedules.map(s => [s.id, s]));
  const venderByUserId = new Map(venders.filter(v => v.user_id).map(v => [v.user_id, v]));
  const userById = new Map(users.map(u => [u.id, u]));

  let totalImpressions = 0;
  let totalViews = 0;
  let totalEngagedViews = 0;
  let totalActiveSeconds = 0;
  let totalScrollDone = 0;
  let totalBookClicks = 0;

  const targetStats = new Map();
  const providerStats = new Map();
  const byDay = new Map();

  for (const row of dailyRows) {
    const imp = Number(row.imp || 0);
    const views = Number(row.views || 0);
    const engaged = Number(row.engaged || 0);
    const actSum = Number(row.act_sum || 0);
    const scrollDone = Number(row.scroll_done || 0);
    const bookClicks = Number(row.book_click_views || row.actions?.book_click || 0);

    totalImpressions += imp;
    totalViews += views;
    totalEngagedViews += engaged;
    totalActiveSeconds += actSum;
    totalScrollDone += scrollDone;
    totalBookClicks += bookClicks;

    const dayEntry = byDay.get(row.d) || { date: row.d, views: 0, engagedViews: 0, activeSecondsSum: 0, bookClicks: 0 };
    dayEntry.views += views;
    dayEntry.engagedViews += engaged;
    dayEntry.activeSecondsSum += actSum;
    dayEntry.bookClicks += bookClicks;
    byDay.set(row.d, dayEntry);

    if (row.tt === 'service' || row.tt === 'tour') {
      const key = `${row.tt}:${row.tid}`;
      const item = row.tt === 'service' ? serviceById.get(row.tid) : scheduleById.get(row.tid);
      const tEntry = targetStats.get(key) || {
        targetType: row.tt,
        targetId: row.tid,
        name: item?.name_service || item?.tour_name || row.tid,
        destination: item?.destination || '',
        ownerUserId: row.oid || null,
        impressions: 0,
        views: 0,
        engagedViews: 0,
        activeSecondsSum: 0,
        scrollDone: 0,
        bookClicks: 0
      };
      tEntry.impressions += imp;
      tEntry.views += views;
      tEntry.engagedViews += engaged;
      tEntry.activeSecondsSum += actSum;
      tEntry.scrollDone += scrollDone;
      tEntry.bookClicks += bookClicks;
      targetStats.set(key, tEntry);
    }

    if (row.oid) {
      const pEntry = providerStats.get(row.oid) || {
        ownerUserId: row.oid,
        providerName: venderByUserId.get(row.oid)?.name_provider || userById.get(row.oid)?.company_name || userById.get(row.oid)?.fullname || row.oid,
        views: 0,
        engagedViews: 0,
        activeSecondsSum: 0,
        bookClicks: 0
      };
      pEntry.views += views;
      pEntry.engagedViews += engaged;
      pEntry.activeSecondsSum += actSum;
      pEntry.bookClicks += bookClicks;
      providerStats.set(row.oid, pEntry);
    }
  }

  const topItems = [...targetStats.values()]
    .map(item => ({
      targetType: item.targetType,
      targetId: item.targetId,
      name: item.name,
      destination: item.destination,
      impressions: item.impressions,
      views: item.views,
      avgActiveSeconds: item.engagedViews > 0 ? Math.round(item.activeSecondsSum / item.engagedViews) : 0,
      scrollCompletionPct: item.views > 0 ? Math.round((item.scrollDone / item.views) * 1000) / 10 : 0,
      bookClicks: item.bookClicks
    }))
    .sort((a, b) => b.views - a.views || b.avgActiveSeconds - a.avgActiveSeconds)
    .slice(0, 15);

  const providerLeaderboard = [...providerStats.values()]
    .map(p => ({
      ownerUserId: p.ownerUserId,
      providerName: p.providerName,
      views: p.views,
      avgActiveSeconds: p.engagedViews > 0 ? Math.round(p.activeSecondsSum / p.engagedViews) : 0,
      bookClicks: p.bookClicks,
      bookClickRatePct: p.views > 0 ? Math.round((p.bookClicks / p.views) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.views - a.views);

  // Aggregate search queries & zero-result queries
  const searchMap = new Map();
  for (const row of searchRows) {
    const key = `${row.scope}:${row.q}`;
    const entry = searchMap.get(key) || { scope: row.scope, query: row.q, count: 0, zeroResultsCount: 0 };
    entry.count += Number(row.count || 0);
    entry.zeroResultsCount += Number(row.zero || 0);
    searchMap.set(key, entry);
  }
  const allSearches = [...searchMap.values()].sort((a, b) => b.count - a.count);
  const topSearches = allSearches.slice(0, 10);
  const zeroResultSearches = allSearches.filter(s => s.zeroResultsCount > 0).slice(0, 10);

  const avgActiveSeconds = totalEngagedViews > 0
    ? Math.round(totalActiveSeconds / totalEngagedViews)
    : 0;
  const scrollCompletionPct = totalViews > 0
    ? Math.round((totalScrollDone / totalViews) * 1000) / 10
    : 0;
  const bookClickRatePct = totalViews > 0
    ? Math.round((totalBookClicks / totalViews) * 1000) / 10
    : 0;

  return {
    scope: 'admin_platform',
    period: { fromDate: window.start, toDate: window.end },
    summaryHeadline: `Toàn sàn ghi nhận ${totalViews.toLocaleString('vi-VN')} lượt xem nội dung, thời gian tương tác thực tế trung bình ${avgActiveSeconds} giây.`,
    totals: {
      impressions: totalImpressions,
      views: totalViews,
      avgActiveSeconds,
      scrollCompletionPct,
      bookClicks: totalBookClicks,
      bookClickRatePct
    },
    topItems,
    providerLeaderboard,
    topSearches,
    zeroResultSearches,
    dailySeries: [...byDay.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        views: d.views,
        avgActiveSeconds: d.engagedViews > 0 ? Math.round(d.activeSecondsSum / d.engagedViews) : 0,
        bookClicks: d.bookClicks
      }))
  };
}

module.exports = {
  getProviderAnalytics,
  getAdminAnalytics,
  resolveProviderOwnedCatalog
};
