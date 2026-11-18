'use strict';

/**
 * Behavioral & Semantic Hybrid Recommendation Engine
 *
 * Designed for a 512 MB Atlas cluster:
 *  - Zero heavy runtime dependencies: uses a deterministic 128-dim Vietnamese-aware
 *    n-gram & token bi-encoder vector combined with structured destination/tag/category affinity.
 *  - Reads real behavioural signals from `interaction_events` (active dwell time, scroll depth,
 *    booking intent clicks), `Favorite`, `SavedCommunityItem`, `TourBooking`, `ServiceBooking`,
 *    and `User.last_interest`.
 *  - Community feed strictly keeps newest posts first, then blends behavioural recommendations
 *    with human-readable explanations (no tour cards injected).
 */

const { store } = require('../config/db.config');
const {
  User,
  BadgeUser,
  Favorite,
  SavedCommunityItem,
  TourBooking,
  ServiceBooking,
  CommunityPost,
  GreenService,
  Schedule,
  ScheduleSample,
  BadgeService,
  BadgeSchedule,
  Vender
} = require('../models');
const telemetry = require('./telemetry.service');
const ecoScore = require('./eco-score.service');

const VECTOR_DIM = 128;
const HALF_LIFE_MS = 14 * 86400 * 1000;
const FRESH_COMMUNITY_WINDOW_MS = 48 * 3600 * 1000;

const STOP_WORDS = new Set([
  'và', 'của', 'các', 'những', 'một', 'trong', 'cho', 'với', 'được', 'là', 'có',
  'tại', 'từ', 'đến', 'này', 'khi', 'như', 'về', 'theo', 'trên', 'hay', 'hoặc'
]);

function normalizeText(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const words = clean.split(' ').filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  const features = [...words];
  for (let i = 0; i < words.length - 1; i += 1) {
    features.push(`${words[i]}_${words[i + 1]}`);
  }
  return features;
}

function fnv1aHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Projects Vietnamese text + structured metadata into an L2-normalised 128-dim vector.
 */
function embedText({ text = '', destination = '', tags = [], category = '' }) {
  const vec = new Float32Array(VECTOR_DIM);
  const addToken = (tok, weight) => {
    const h = fnv1aHash(tok);
    const idx = h % VECTOR_DIM;
    const sign = (h & 0x100) ? 1 : -1;
    vec[idx] += sign * weight;
  };

  if (destination) {
    const destNorm = normalizeText(destination);
    addToken(`dest:${destNorm}`, 3.5);
    for (const t of tokenize(destNorm)) addToken(`dest_tok:${t}`, 2.0);
  }
  if (category) {
    addToken(`cat:${normalizeText(category)}`, 2.2);
  }
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const cleanTag = normalizeText(String(tag).replace(/^#/, ''));
      if (cleanTag) addToken(`tag:${cleanTag}`, 2.5);
    }
  }
  for (const tok of tokenize(text)) {
    addToken(tok, 1.0);
  }

  let normSq = 0;
  for (let i = 0; i < VECTOR_DIM; i += 1) normSq += vec[i] * vec[i];
  if (normSq > 0) {
    const inv = 1 / Math.sqrt(normSq);
    for (let i = 0; i < VECTOR_DIM; i += 1) vec[i] *= inv;
  }
  return vec;
}

function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i += 1) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

function parseHashtags(raw) {
  if (Array.isArray(raw)) return raw.map(t => String(t).replace(/^#/, '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(/[\s,;]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
  }
  return [];
}

/**
 * Builds a user interest profile from behavioural telemetry + saves/favorites + bookings.
 */
async function buildUserProfile({ userId = null, anonId = null, now = new Date() }) {
  await store.authenticate();
  const profileVec = new Float32Array(VECTOR_DIM);
  const destinationWeights = new Map();
  const tagWeights = new Map();
  const seenPostIds = new Set();
  const interactedTargetIds = new Set();

  const bumpMap = (map, key, label, weight) => {
    if (!key) return;
    const prev = map.get(key) || { label, weight: 0 };
    prev.weight += weight;
    map.set(key, prev);
  };

  const accumulateItem = ({ text, destination, tags, category, weight }) => {
    if (weight === 0) return;
    const itemVec = embedText({ text, destination, tags, category });
    for (let i = 0; i < VECTOR_DIM; i += 1) {
      profileVec[i] += itemVec[i] * weight;
    }
    if (destination && weight > 0) {
      bumpMap(destinationWeights, normalizeText(destination), destination, weight);
    }
    if (Array.isArray(tags) && weight > 0) {
      for (const tag of tags) {
        const clean = normalizeText(tag);
        if (clean) bumpMap(tagWeights, clean, String(tag).replace(/^#/, ''), weight);
      }
    }
  };

  // 1. Explicit user profile & badges
  if (userId) {
    const [user, userBadges, favorites, savedItems, tourBookings, serviceBookings] = await Promise.all([
      User.findByPk(userId),
      BadgeUser.findAll({ where: { user_id: userId } }),
      Favorite.findAll({ where: { user_id: userId }, limit: 30 }),
      SavedCommunityItem.findAll({ where: { user_id: userId }, limit: 30 }),
      TourBooking.findAll({ where: { user_id: userId }, limit: 15 }),
      ServiceBooking.findAll({ where: { user_id: userId }, limit: 15 })
    ]);

    if (user?.last_interest) {
      accumulateItem({
        text: user.last_interest,
        destination: user.last_interest,
        tags: userBadges.map(b => b.badge_name),
        weight: 3.0
      });
    }

    for (const fav of favorites) {
      interactedTargetIds.add(`${fav.target_type}:${fav.target_id}`);
      accumulateItem({
        text: fav.title || fav.destination || '',
        destination: fav.destination || '',
        category: fav.target_type,
        weight: 4.0
      });
    }

    for (const saved of savedItems) {
      interactedTargetIds.add(`${saved.item_type}:${saved.item_id}`);
    }

    for (const tb of tourBookings) {
      interactedTargetIds.add(`tour:${tb.schedule_id}`);
      accumulateItem({
        text: tb.tour_name || '',
        destination: '',
        category: 'tour',
        weight: 6.0
      });
    }

    for (const sb of serviceBookings) {
      interactedTargetIds.add(`service:${sb.service_id}`);
      accumulateItem({
        text: sb.name_service || '',
        destination: '',
        category: 'service',
        weight: 6.0
      });
    }
  }

  // 2. Behavioural telemetry events (dwell time, scroll depth, booking clicks)
  const eventFilter = {};
  if (userId && anonId) {
    eventFilter.$or = [{ uid: String(userId) }, { aid: String(anonId) }];
  } else if (userId) {
    eventFilter.uid = String(userId);
  } else if (anonId) {
    eventFilter.aid = String(anonId);
  }

  if (Object.keys(eventFilter).length > 0) {
    const eventsCol = store.db.collection(telemetry.collectionNames().events);
    const recentEvents = await eventsCol
      .find(eventFilter)
      .sort({ ts: -1 })
      .limit(60)
      .toArray();

    if (recentEvents.length > 0) {
      const serviceIds = [...new Set(recentEvents.filter(e => e.tt === 'service').map(e => e.tid))];
      const tourIds = [...new Set(recentEvents.filter(e => e.tt === 'tour').map(e => e.tid))];
      const postIds = [...new Set(recentEvents.filter(e => e.tt === 'post').map(e => e.tid))];

      const [services, schedules, posts] = await Promise.all([
        serviceIds.length ? GreenService.findAll({ where: { id: serviceIds } }) : [],
        tourIds.length ? Schedule.findAll({ where: { id: tourIds } }) : [],
        postIds.length ? CommunityPost.findAll({ where: { id: postIds } }) : []
      ]);

      const serviceMap = new Map(services.map(s => [s.id, s]));
      const scheduleMap = new Map(schedules.map(s => [s.id, s]));
      const postMap = new Map(posts.map(p => [p.id, p]));

      for (const ev of recentEvents) {
        const ageMs = Math.max(0, now.getTime() - new Date(ev.ts || now).getTime());
        const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);
        const act = Number(ev.act || 0);
        const scr = Number(ev.scr || 0);
        const bookClick = Number(ev.a?.book_click || 0) > 0;

        let baseWeight = 0.8;
        if (bookClick) baseWeight = 5.0;
        else if (act >= 45 || scr >= 75) baseWeight = 3.5;
        else if (act >= 10 || scr >= 40) baseWeight = 1.8;
        else if (act > 0 && act < 2) baseWeight = -0.5;

        const weight = baseWeight * decay;

        if (ev.tt === 'service' && serviceMap.has(ev.tid)) {
          const s = serviceMap.get(ev.tid);
          accumulateItem({
            text: `${s.name_service} ${s.destination} ${s.type}`,
            destination: s.destination,
            category: s.type,
            weight
          });
        } else if (ev.tt === 'tour' && scheduleMap.has(ev.tid)) {
          const t = scheduleMap.get(ev.tid);
          accumulateItem({
            text: `${t.tour_name} ${t.destination} ${t.style || ''} ${t.tour_description || ''}`,
            destination: t.destination,
            category: 'tour',
            weight
          });
        } else if (ev.tt === 'post' && postMap.has(ev.tid)) {
          seenPostIds.add(ev.tid);
          const p = postMap.get(ev.tid);
          accumulateItem({
            text: `${p.text || ''} ${p.tour_name || ''}`,
            destination: p.destination || p.location || '',
            tags: parseHashtags(p.hashtags),
            category: 'post',
            weight
          });
        }
      }
    }
  }

  let normSq = 0;
  for (let i = 0; i < VECTOR_DIM; i += 1) normSq += profileVec[i] * profileVec[i];
  const hasSignal = normSq > 1e-6;
  if (hasSignal) {
    const inv = 1 / Math.sqrt(normSq);
    for (let i = 0; i < VECTOR_DIM; i += 1) profileVec[i] *= inv;
  }

  const topDestinations = [...destinationWeights.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(d => d.label);

  const topTags = [...tagWeights.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(t => t.label);

  return {
    hasSignal,
    vector: profileVec,
    topDestinations,
    topTags,
    seenPostIds,
    interactedTargetIds
  };
}

/**
 * Diversifies a scored list using Maximal Marginal Relevance (MMR) so a single destination
 * or provider does not monopolize the top slots.
 */
function diversifyList(scoredItems, limit = 8) {
  const selected = [];
  const destCount = new Map();
  const ownerCount = new Map();

  for (const entry of scoredItems) {
    if (selected.length >= limit) break;
    const destKey = normalizeText(entry.destination || '');
    const ownerKey = String(entry.ownerId || '');
    const dCnt = destKey ? (destCount.get(destKey) || 0) : 0;
    const oCnt = ownerKey ? (ownerCount.get(ownerKey) || 0) : 0;

    if (dCnt >= 3 || (ownerKey && oCnt >= 2)) continue;
    selected.push(entry);
    if (destKey) destCount.set(destKey, dCnt + 1);
    if (ownerKey) ownerCount.set(ownerKey, oCnt + 1);
  }

  if (selected.length < limit) {
    for (const entry of scoredItems) {
      if (selected.length >= limit) break;
      if (!selected.includes(entry)) selected.push(entry);
    }
  }
  return selected;
}

/**
 * Ranks community posts:
 *  - Strictly places recent posts (newest first) at the top.
 *  - Ranks remaining posts by behavioral & tag/destination affinity + engagement quality.
 *  - Never injects tour cards into community posts.
 */
async function rankCommunityPosts({ posts, userId = null, anonId = null, now = new Date() }) {
  if (!Array.isArray(posts) || posts.length <= 1) return posts;
  const profile = await buildUserProfile({ userId, anonId, now });

  const freshBucket = [];
  const discoveryBucket = [];

  for (const post of posts) {
    const createdAtMs = new Date(post.createdAt || post.created_at || now).getTime();
    const ageMs = Math.max(0, now.getTime() - createdAtMs);
    const tags = parseHashtags(post.hashtags);
    const dest = post.destination || post.location || '';

    const itemVec = embedText({
      text: `${post.text || ''} ${post.tour_name || ''}`,
      destination: dest,
      tags,
      category: 'post'
    });

    const sim = profile.hasSignal ? cosineSimilarity(profile.vector, itemVec) : 0;
    const likes = Number(post.likes_count ?? post.likes ?? 0);
    const engagementScore = Math.min(1, Math.log1p(Math.max(0, likes)) / Math.log1p(50));
    const recencyScore = Math.pow(0.5, ageMs / (7 * 86400 * 1000));

    let reason = null;
    if (dest && profile.topDestinations.some(d => normalizeText(d) === normalizeText(dest))) {
      reason = `Liên quan đến ${dest} bạn từng xem`;
    } else if (tags.length && profile.topTags.some(t => tags.map(normalizeText).includes(normalizeText(t)))) {
      reason = 'Cùng chủ đề sinh thái bạn quan tâm';
    } else if (likes >= 5) {
      reason = 'Được cộng đồng du lịch xanh quan tâm';
    }

    const enriched = {
      ...post,
      recommendReason: reason
    };

    // Priority 1: Fresh posts stay in newest-first order at the top of the feed
    if (ageMs <= FRESH_COMMUNITY_WINDOW_MS) {
      freshBucket.push({ post: enriched, createdAtMs });
    } else {
      const rankScore = 0.55 * sim + 0.25 * engagementScore + 0.20 * recencyScore;
      discoveryBucket.push({ post: enriched, rankScore, createdAtMs });
    }
  }

  freshBucket.sort((a, b) => b.createdAtMs - a.createdAtMs);
  discoveryBucket.sort((a, b) => b.rankScore - a.rankScore || b.createdAtMs - a.createdAtMs);

  // Ensure at least the 3 newest posts are always first even if all posts in DB are older than 48h
  if (freshBucket.length === 0 && discoveryBucket.length > 0) {
    const byNewest = [...discoveryBucket].sort((a, b) => b.createdAtMs - a.createdAtMs);
    const pinnedNewest = byNewest.slice(0, Math.min(3, byNewest.length));
    const pinnedSet = new Set(pinnedNewest);
    const remaining = discoveryBucket.filter(entry => !pinnedSet.has(entry));
    return [...pinnedNewest.map(e => e.post), ...remaining.map(e => e.post)];
  }

  return [
    ...freshBucket.map(e => e.post),
    ...discoveryBucket.map(e => e.post)
  ];
}

/**
 * Recommends services for a traveler with human-readable explanations and Eco-Score boost.
 */
async function recommendServices({ userId = null, anonId = null, limit = 8 }) {
  await store.authenticate();
  const profile = await buildUserProfile({ userId, anonId });
  const allServices = await GreenService.findAll({ where: { status: 'active' } });
  const visibleServices = allServices.filter(s => !s.current_data?.catalogHidden);

  const [allBadges, allVenders] = await Promise.all([
    BadgeService.findAll(),
    Vender.findAll()
  ]);

  const badgesByService = new Map();
  for (const b of allBadges) {
    const list = badgesByService.get(b.service_id) || [];
    list.push(b.badge_name);
    badgesByService.set(b.service_id, list);
  }
  const venderMap = new Map(allVenders.map(v => [v.id, v]));

  const scored = [];
  for (const s of visibleServices) {
    const badges = badgesByService.get(s.id) || [];
    const eco = ecoScore.calculateAssessment({ item: s, kind: 'service', badges });
    const itemVec = embedText({
      text: `${s.name_service} ${s.destination} ${s.type} ${badges.join(' ')}`,
      destination: s.destination,
      tags: badges,
      category: s.type
    });

    const sim = profile.hasSignal ? cosineSimilarity(profile.vector, itemVec) : 0;
    const ratingScore = Math.min(1, Number(s.rating || 4.2) / 5);
    const popScore = Math.min(1, Math.log1p(Number(s.bookings_count || 0) + Number(s.views_count || 0)) / Math.log1p(200));
    const destMatch = profile.topDestinations.some(d => normalizeText(s.destination).includes(normalizeText(d))) ? 0.35 : 0;

    const totalScore =
      0.40 * Math.min(1, sim + destMatch) +
      0.25 * (0.6 * ratingScore + 0.4 * popScore) +
      0.25 * eco.recommendBoost +
      0.10 * (s.is_partner ? 1 : 0.5);

    let recommendReason = `${eco.tierLabel} • ${eco.impactLine}`;
    if (destMatch > 0) {
      recommendReason = `Phù hợp với mối quan tâm về ${s.destination} của bạn`;
    } else if (eco.tier === 'excellent') {
      recommendReason = `Đạt chuẩn ${eco.tierLabel}, giảm khoảng ${eco.co2SavedKg} kg CO₂`;
    } else if (Number(s.rating || 0) >= 4.6) {
      recommendReason = 'Được du khách đánh giá cao về trải nghiệm bền vững';
    }

    const vender = venderMap.get(s.vender_id);
    scored.push({
      score: totalScore,
      destination: s.destination,
      ownerId: vender?.user_id || s.vender_id,
      service: s,
      badges,
      vender,
      eco,
      recommendReason
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return diversifyList(scored, limit);
}

/**
 * Recommends preset tours for a traveler with human-readable explanations and Eco-Score boost.
 */
async function recommendTours({ userId = null, anonId = null, limit = 8 }) {
  await store.authenticate();
  const profile = await buildUserProfile({ userId, anonId });
  const samples = await ScheduleSample.findAll({ include: [{ model: Schedule }] });
  const allBadges = await BadgeSchedule.findAll();

  const badgesBySchedule = new Map();
  for (const b of allBadges) {
    const list = badgesBySchedule.get(b.schedule_id) || [];
    list.push(b.badge_name);
    badgesBySchedule.set(b.schedule_id, list);
  }

  const scored = [];
  for (const sample of samples) {
    if (!sample.Schedule) continue;
    const sch = sample.Schedule;
    if (sch.catalog_status === 'hidden') continue;

    const badges = badgesBySchedule.get(sch.id) || [];
    const eco = ecoScore.calculateAssessment({ item: sch, kind: 'tour', badges });
    const itemVec = embedText({
      text: `${sch.tour_name} ${sch.destination} ${sch.style || ''} ${sch.tour_description || ''} ${badges.join(' ')}`,
      destination: sch.destination,
      tags: badges,
      category: 'tour'
    });

    const sim = profile.hasSignal ? cosineSimilarity(profile.vector, itemVec) : 0;
    const ratingScore = Math.min(1, Number(sample.rating || 4.3) / 5);
    const votesScore = Math.min(1, Math.log1p(Number(sample.votes_count || sch.votes_count || 0)) / Math.log1p(100));
    const destMatch = profile.topDestinations.some(d => normalizeText(sch.destination).includes(normalizeText(d))) ? 0.35 : 0;

    const totalScore =
      0.45 * Math.min(1, sim + destMatch) +
      0.25 * (0.65 * ratingScore + 0.35 * votesScore) +
      0.20 * eco.recommendBoost +
      0.10;

    let recommendReason = `${eco.tierLabel} • ${eco.impactLine}`;
    if (destMatch > 0) {
      recommendReason = `Gợi ý theo điểm đến ${sch.destination} bạn đã xem`;
    } else if (eco.tier === 'excellent') {
      recommendReason = `Hành trình ${eco.tierLabel}, tiết kiệm khoảng ${eco.co2SavedKg} kg CO₂`;
    } else if (Number(sample.rating || 0) >= 4.6) {
      recommendReason = 'Lịch trình được nhiều du khách yêu thích và lưu lại';
    }

    scored.push({
      score: totalScore,
      destination: sch.destination,
      ownerId: sample.provider_id,
      sample,
      schedule: sch,
      badges,
      eco,
      recommendReason
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return diversifyList(scored, limit);
}

module.exports = {
  buildUserProfile,
  rankCommunityPosts,
  recommendServices,
  recommendTours,
  _internal: { embedText, cosineSimilarity, tokenize }
};
