'use strict';

/**
 * First-party behavioural telemetry.
 *
 * Storage is shaped for a 512 MB Atlas cluster:
 *  - one raw document per *view* (engagement heartbeats update it in place instead of appending),
 *  - impressions and searches are counted straight into daily aggregates (no raw rows),
 *  - raw views expire through a TTL index; only daily aggregates are kept long term.
 *
 * Ownership (`oid`) is always resolved on the server from the catalog. Clients can never
 * claim which provider an event belongs to.
 */

const NodeCache = require('node-cache');
const { store } = require('../config/db.config');
const { GreenService, Vender, Schedule, ScheduleSample, Provider, CommunityPost } = require('../models');

const clampInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const RAW_TTL_DAYS = clampInt(process.env.TELEMETRY_RAW_TTL_DAYS, 30, 7, 90);
const MAX_EVENTS_PER_BATCH = 50;
const MAX_ACTIVE_SECONDS = 30 * 60;
const BOUNCE_SECONDS = 2;
const VIEW_DEDUPE_MS = 30 * 60 * 1000;
const ROLLUP_STALE_MS = 10 * 60 * 1000;

const TARGET_TYPES = new Set(['tour', 'service', 'post', 'screen']);
const ACTIONS = ['book_click', 'gallery_open', 'map_open', 'policy_open', 'date_select', 'room_select', 'share', 'save', 'contact', 'review_open'];
const ACTION_SET = new Set(ACTIONS);
const SOURCES = new Set(['direct', 'home', 'listing', 'community', 'recommendation', 'search_engine', 'social', 'external', 'internal']);
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const SEARCH_SCOPES = new Set(['tours', 'services', 'community', 'global']);

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const TARGET_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;
const SCREEN_ID_PATTERN = /^[a-z0-9-]{1,48}$/;
const BOT_PATTERN = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|preview|slurp|facebookexternalhit/i;

const ownerCache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false, maxKeys: 20000 });

const collectionNames = () => ({
  events: `${store.prefix}interaction_events`,
  daily: `${store.prefix}metric_daily`,
  search: `${store.prefix}search_daily`,
  consent: `${store.prefix}consent_records`,
  meta: `${store.prefix}telemetry_meta`
});

async function collections() {
  await store.authenticate();
  const names = collectionNames();
  return {
    events: store.db.collection(names.events),
    daily: store.db.collection(names.daily),
    search: store.db.collection(names.search),
    consent: store.db.collection(names.consent),
    meta: store.db.collection(names.meta)
  };
}

let indexesReady = null;
function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const c = await collections();
      await Promise.all([
        c.events.createIndex({ ts: 1 }, { expireAfterSeconds: RAW_TTL_DAYS * 86400, name: 'ttl_ts' }),
        c.events.createIndex({ d: 1, tt: 1, tid: 1 }, { name: 'day_target' }),
        c.events.createIndex({ aid: 1, tid: 1, ts: -1 }, { name: 'visitor_target_recent' }),
        c.events.createIndex({ uid: 1, ts: -1 }, { name: 'user_recent', partialFilterExpression: { uid: { $type: 'string' } } }),
        c.daily.createIndex({ d: 1, tt: 1, tid: 1 }, { unique: true, name: 'day_target_unique' }),
        c.daily.createIndex({ oid: 1, d: 1 }, { name: 'owner_day', partialFilterExpression: { oid: { $type: 'string' } } }),
        c.search.createIndex({ d: 1, scope: 1, q: 1 }, { unique: true, name: 'day_scope_query_unique' }),
        c.consent.createIndex({ aid: 1, ts: -1 }, { name: 'visitor_recent' })
      ]);
    })().catch(error => { indexesReady = null; throw error; });
  }
  return indexesReady;
}

/** Calendar day in Vietnam time (UTC+7), e.g. "2026-11-19". */
function dayKey(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function isBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(String(userAgent));
}

function cleanId(value) {
  const text = String(value || '');
  return ID_PATTERN.test(text) ? text : null;
}

function cleanTarget(tt, tid) {
  if (!TARGET_TYPES.has(tt)) return null;
  const id = String(tid || '').trim();
  if (tt === 'screen' ? !SCREEN_ID_PATTERN.test(id) : !TARGET_ID_PATTERN.test(id)) return null;
  return { tt, tid: id };
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Normalises a search query and rejects anything that looks like personal data
 * (emails, phone numbers, long digit runs) so it is never stored.
 */
function normalizeQuery(raw) {
  const q = String(raw || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
  if (q.length < 2) return null;
  if (/@/.test(q) || /\d{6,}/.test(q.replace(/[\s.-]/g, ''))) return null;
  return q;
}

/** Parses JSON bodies and text/plain bodies sent by navigator.sendBeacon. */
function parseBody(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return null; }
  }
  return body && typeof body === 'object' ? body : null;
}

async function resolveOwner(tt, tid) {
  if (tt === 'screen') return { valid: true, oid: null };
  const cacheKey = `${tt}:${tid}`;
  const cached = ownerCache.get(cacheKey);
  if (cached) return cached;

  let result = { valid: false, oid: null };
  if (tt === 'service') {
    const service = await GreenService.findByPk(tid);
    if (service) {
      const vender = service.vender_id ? await Vender.findByPk(service.vender_id) : null;
      result = { valid: true, oid: vender?.user_id || null };
    }
  } else if (tt === 'tour') {
    const schedule = await Schedule.findByPk(tid);
    if (schedule) {
      const sample = await ScheduleSample.findByPk(tid);
      const provider = sample?.provider_id ? await Provider.findByPk(sample.provider_id) : null;
      result = { valid: true, oid: provider?.user_id || null };
    }
  } else if (tt === 'post') {
    const post = await CommunityPost.findByPk(tid);
    // Community posts belong to travellers, not providers: never exposed in provider analytics.
    if (post) result = { valid: true, oid: null };
  }
  ownerCache.set(cacheKey, result);
  return result;
}

const isDuplicateKey = error => error?.code === 11000;

/**
 * Accepts a batch from the browser.
 * Event shapes (short keys keep payloads small):
 *   { k: 'view',       vid, tt, tid, src?, rl?, pos? }
 *   { k: 'engage',     vid, act, scr }
 *   { k: 'action',     vid, name }
 *   { k: 'impression', tt, tid, rl?, pos? }
 *   { k: 'search',     scope, q, n }
 */
async function ingestBatch({ body, user, userAgent, now = new Date() }) {
  if (isBot(userAgent)) return { accepted: 0, dropped: 0, ignored: 'bot' };
  const payload = parseBody(body);
  if (!payload || !Array.isArray(payload.events)) {
    const error = new Error('Invalid telemetry payload.');
    error.statusCode = 400;
    throw error;
  }
  const aid = cleanId(payload.aid);
  const sid = cleanId(payload.sid);
  if (!aid || !sid) {
    const error = new Error('Missing visitor identifiers.');
    error.statusCode = 400;
    throw error;
  }

  await ensureIndexes();
  const c = await collections();
  const uid = user?.id ? String(user.id) : null;
  const device = DEVICES.has(payload.dev) ? payload.dev : 'desktop';
  const d = dayKey(now);
  const events = payload.events.slice(0, MAX_EVENTS_PER_BATCH);
  let accepted = 0;
  let dropped = payload.events.length - events.length;

  const impressionCounts = new Map();
  const searchCounts = new Map();

  for (const event of events) {
    try {
      if (!event || typeof event !== 'object') { dropped += 1; continue; }

      if (event.k === 'view') {
        const vid = cleanId(event.vid);
        const target = cleanTarget(event.tt, event.tid);
        if (!vid || !target) { dropped += 1; continue; }
        const owner = await resolveOwner(target.tt, target.tid);
        if (!owner.valid) { dropped += 1; continue; }
        const recent = await c.events.findOne(
          { aid, tid: target.tid, tt: target.tt, ts: { $gte: new Date(now.getTime() - VIEW_DEDUPE_MS) }, dup: { $ne: true } },
          { projection: { _id: 1 } }
        );
        const doc = {
          _id: vid, aid, sid, uid, tt: target.tt, tid: target.tid, oid: owner.oid,
          ts: now, d, act: 0, scr: 0,
          src: SOURCES.has(event.src) ? event.src : 'direct',
          dev: device,
          a: {}
        };
        if (typeof event.rl === 'string' && ID_PATTERN.test(event.rl)) doc.rl = event.rl;
        if (Number.isInteger(event.pos) && event.pos >= 0 && event.pos < 500) doc.pos = event.pos;
        if (recent) doc.dup = true;
        try { await c.events.insertOne(doc); } catch (error) { if (!isDuplicateKey(error)) throw error; }
        accepted += 1;
        continue;
      }

      if (event.k === 'engage') {
        const vid = cleanId(event.vid);
        if (!vid) { dropped += 1; continue; }
        await c.events.updateOne(
          { _id: vid, aid },
          { $max: { act: clampNumber(event.act, 0, MAX_ACTIVE_SECONDS), scr: clampNumber(event.scr, 0, 100) } }
        );
        accepted += 1;
        continue;
      }

      if (event.k === 'action') {
        const vid = cleanId(event.vid);
        if (!vid || !ACTION_SET.has(event.name)) { dropped += 1; continue; }
        await c.events.updateOne({ _id: vid, aid }, { $inc: { [`a.${event.name}`]: 1 } });
        accepted += 1;
        continue;
      }

      if (event.k === 'impression') {
        const target = cleanTarget(event.tt, event.tid);
        if (!target || target.tt === 'screen') { dropped += 1; continue; }
        const key = `${target.tt}\u0000${target.tid}`;
        impressionCounts.set(key, (impressionCounts.get(key) || 0) + 1);
        accepted += 1;
        continue;
      }

      if (event.k === 'search') {
        const q = normalizeQuery(event.q);
        const scope = SEARCH_SCOPES.has(event.scope) ? event.scope : 'global';
        if (!q) { dropped += 1; continue; }
        const key = `${scope}\u0000${q}`;
        const entry = searchCounts.get(key) || { scope, q, count: 0, zero: 0 };
        entry.count += 1;
        if (Number(event.n) === 0) entry.zero += 1;
        searchCounts.set(key, entry);
        accepted += 1;
        continue;
      }

      dropped += 1;
    } catch (error) {
      if (error?.statusCode) throw error;
      dropped += 1;
      console.warn('[telemetry] event skipped', { kind: event?.k, error: error?.message });
    }
  }

  if (impressionCounts.size) {
    const operations = [];
    for (const [key, count] of impressionCounts) {
      const [tt, tid] = key.split('\u0000');
      const owner = await resolveOwner(tt, tid);
      if (!owner.valid) continue;
      operations.push({
        updateOne: {
          filter: { d, tt, tid },
          update: { $inc: { imp: count }, $setOnInsert: { oid: owner.oid } },
          upsert: true
        }
      });
    }
    if (operations.length) await c.daily.bulkWrite(operations, { ordered: false });
  }

  if (searchCounts.size) {
    await c.search.bulkWrite([...searchCounts.values()].map(entry => ({
      updateOne: {
        filter: { d, scope: entry.scope, q: entry.q },
        update: { $inc: { count: entry.count, zero: entry.zero } },
        upsert: true
      }
    })), { ordered: false });
  }

  return { accepted, dropped };
}

async function recordConsent({ body, user, now = new Date() }) {
  const payload = parseBody(body) || {};
  const aid = cleanId(payload.aid);
  if (!aid) {
    const error = new Error('Missing visitor identifier.');
    error.statusCode = 400;
    throw error;
  }
  await ensureIndexes();
  const c = await collections();
  await c.consent.insertOne({
    aid,
    uid: user?.id ? String(user.id) : null,
    analytics: payload.analytics === true,
    personalization: payload.personalization === true,
    version: String(payload.version || '1').slice(0, 16),
    ts: now
  });
  return { recorded: true };
}

/** Aggregates raw views of one day into `metric_daily`. Impression counters are left untouched. */
async function rollupDay(d) {
  await ensureIndexes();
  const c = await collections();
  const actionSums = Object.fromEntries(ACTIONS.map(name => [`a_${name}`, { $sum: { $ifNull: [`$a.${name}`, 0] } }]));
  const rows = await c.events.aggregate([
    { $match: { d, dup: { $ne: true } } },
    {
      $group: {
        _id: { tt: '$tt', tid: '$tid' },
        oid: { $first: '$oid' },
        views: { $sum: 1 },
        visitors: { $addToSet: '$aid' },
        engaged: { $sum: { $cond: [{ $gte: ['$act', BOUNCE_SECONDS] }, 1, 0] } },
        act_sum: { $sum: { $cond: [{ $gte: ['$act', BOUNCE_SECONDS] }, '$act', 0] } },
        scroll_done: { $sum: { $cond: [{ $gte: ['$scr', 75] }, 1, 0] } },
        book_click_views: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$a.book_click', 0] }, 0] }, 1, 0] } },
        sources: { $push: '$src' },
        devices: { $push: '$dev' },
        ...actionSums
      }
    }
  ], { allowDiskUse: false }).toArray();

  const tally = values => values.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {});
  const rolledAt = new Date();
  const operations = rows.map(row => ({
    updateOne: {
      filter: { d, tt: row._id.tt, tid: row._id.tid },
      update: {
        $set: {
          oid: row.oid || null,
          views: row.views,
          visitors: row.visitors.length,
          engaged: row.engaged,
          bounces: row.views - row.engaged,
          act_sum: row.act_sum,
          scroll_done: row.scroll_done,
          book_click_views: row.book_click_views,
          actions: Object.fromEntries(ACTIONS.map(name => [name, row[`a_${name}`] || 0])),
          sources: tally(row.sources),
          devices: tally(row.devices),
          rolled_at: rolledAt
        }
      },
      upsert: true
    }
  }));
  if (operations.length) await c.daily.bulkWrite(operations, { ordered: false });
  await c.meta.updateOne({ _id: 'rollup' }, { $set: { [`days.${d}`]: rolledAt, last_run: rolledAt } }, { upsert: true });
  return { day: d, targets: operations.length };
}

/** Rolls up today and yesterday (yesterday finalises late heartbeats after midnight). */
async function runScheduledRollup(now = new Date()) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86400 * 1000));
  const results = [];
  results.push(await rollupDay(yesterday));
  results.push(await rollupDay(today));
  return results;
}

let rollupInFlight = null;
/**
 * Used by analytics endpoints so dashboards stay fresh on serverless hosts where
 * no background interval runs.
 */
async function ensureFreshRollup() {
  const c = await collections();
  const meta = await c.meta.findOne({ _id: 'rollup' });
  const last = meta?.last_run ? new Date(meta.last_run).getTime() : 0;
  if (Date.now() - last < ROLLUP_STALE_MS) return { fresh: true };
  if (!rollupInFlight) rollupInFlight = runScheduledRollup().finally(() => { rollupInFlight = null; });
  await rollupInFlight;
  return { fresh: false };
}

module.exports = {
  ingestBatch,
  recordConsent,
  rollupDay,
  runScheduledRollup,
  ensureFreshRollup,
  ensureIndexes,
  collectionNames,
  // exported for tests
  _internal: { dayKey, isBot, cleanId, cleanTarget, normalizeQuery, parseBody, clampNumber, resolveOwner, ACTIONS }
};
