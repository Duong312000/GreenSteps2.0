'use strict';

/**
 * Eco-Scoring Engine (Hệ thống Chấm Điểm Xanh & Minh Chứng Bền Vững)
 *
 * Computes a transparent sustainability assessment across 5 dimensions:
 *  1. Di chuyển phát thải thấp (30đ)
 *  2. Lưu trú & vận hành bền vững (25đ)
 *  3. Hoạt động bảo tồn & quy mô nhóm (20đ)
 *  4. Kinh tế & ẩm thực bản địa (15đ)
 *  5. Minh chứng được xác thực & phản hồi du khách (10đ)
 *
 * Self-declared criteria count for 60% of their weight until evidence is verified by Admin.
 * Public responses expose human-readable tiers, CO2 reduction estimates, and clear reasons
 * rather than raw internal numbers.
 */

const { store } = require('../config/db.config');
const { GreenService, Vender, Schedule, ScheduleSample, Provider, BadgeService, BadgeSchedule, AdminAuditLog } = require('../models');

// Baseline conventional emission per guest-day (kg CO2e) based on DEFRA/IPCC travel averages
const BASELINE_CO2_PER_DAY_KG = {
  tour: 18.5,
  stay: 14.0,
  transport: 22.0,
  food: 6.5,
  attraction: 8.0
};

const CRITERIA_CATALOG = {
  low_carbon_transport: { group: 'transport', maxPoints: 30, label: 'Phương tiện di chuyển phát thải thấp (tàu hỏa, xe điện, đi bộ, xe đạp)' },
  no_single_use_plastic: { group: 'stay', maxPoints: 10, label: 'Không sử dụng đồ nhựa dùng một lần' },
  renewable_energy: { group: 'stay', maxPoints: 8, label: 'Sử dụng năng lượng mặt trời hoặc thiết bị tiết kiệm điện' },
  water_waste_treatment: { group: 'stay', maxPoints: 7, label: 'Thu gom, phân loại rác và xử lý nước thải tại nguồn' },
  conservation_activity: { group: 'activity', maxPoints: 12, label: 'Hoạt động gắn với bảo tồn thiên nhiên, không để lại dấu chân' },
  small_group_limit: { group: 'activity', maxPoints: 8, label: 'Giới hạn quy mô nhóm nhỏ để giảm áp lực lên hệ sinh thái' },
  local_workforce: { group: 'local', maxPoints: 8, label: 'Sử dụng hướng dẫn viên và nhân sự người địa phương' },
  local_organic_food: { group: 'local', maxPoints: 7, label: 'Thực phẩm bản địa theo mùa, giảm vận chuyển đường dài' }
};

function assessmentCollection() {
  return store.db.collection(`${store.prefix}green_assessments`);
}

function historyCollection() {
  return store.db.collection(`${store.prefix}green_score_history`);
}

/**
 * Infers baseline criteria from an existing service or schedule document when a provider
 * has not yet submitted an explicit checklist.
 */
function inferCriteriaFromItem(item, kind, badges = []) {
  const text = [
    item?.name_service,
    item?.tour_name,
    item?.tour_description,
    item?.responsible_travel,
    item?.style,
    item?.style_explanation,
    JSON.stringify(item?.highlights || []),
    JSON.stringify(item?.included || []),
    JSON.stringify(item?.current_data?.description || ''),
    ...badges
  ].filter(Boolean).join(' ').toLowerCase();

  const criteria = {};
  if (/tàu hỏa|xe đạp|đi bộ|trekking|xe điện|điện|chèo|kayak|metro|buýt điện/.test(text) || Number(item?.carbon || 0) >= 3) {
    criteria.low_carbon_transport = true;
  }
  if (/không nhựa|hạn chế nhựa|chai thủy tinh|tái sử dụng|zero waste|rác thải nhựa/.test(text) || badges.length > 0) {
    criteria.no_single_use_plastic = true;
  }
  if (/mặt trời|năng lượng tái tạo|tiết kiệm điện|sinh thái|eco|xanh/.test(text)) {
    criteria.renewable_energy = true;
  }
  if (/phân loại rác|xử lý nước|tái chế|thu gom rác/.test(text)) {
    criteria.water_waste_treatment = true;
  }
  if (/bảo tồn|trồng cây|rừng|vườn quốc gia|thiên nhiên|sinh thái|trekking/.test(text) || kind === 'tour') {
    criteria.conservation_activity = true;
  }
  const maxCap = Number(item?.max_capacity || 12);
  if (maxCap <= 15 || /nhóm nhỏ|tối đa 1[0-5]/.test(text)) {
    criteria.small_group_limit = true;
  }
  if (/bản địa|địa phương|đồng bào|làng nghề|cộng đồng/.test(text) || item?.is_partner !== false) {
    criteria.local_workforce = true;
  }
  if (/hữu cơ|organic|ẩm thực địa phương|nông sản|mùa nào thức nấy|chay/.test(text) || item?.type === 'food') {
    criteria.local_organic_food = true;
  }
  return criteria;
}

function resolveTier(totalScore) {
  if (totalScore >= 85) {
    return {
      tier: 'excellent',
      tierLabel: 'Xanh xuất sắc',
      rewardMultiplier: 1.5,
      recommendBoost: 1.0
    };
  }
  if (totalScore >= 70) {
    return {
      tier: 'good',
      tierLabel: 'Xanh tốt',
      rewardMultiplier: 1.2,
      recommendBoost: 0.75
    };
  }
  if (totalScore >= 50) {
    return {
      tier: 'standard',
      tierLabel: 'Đạt chuẩn xanh',
      rewardMultiplier: 1.0,
      recommendBoost: 0.45
    };
  }
  return {
    tier: 'improving',
    tierLabel: 'Đang hoàn thiện tiêu chuẩn xanh',
    rewardMultiplier: 1.0,
    recommendBoost: 0.1
  };
}

/**
 * Evaluates green score, CO2 saved, human-readable highlights, and provider improvement tips.
 */
function calculateAssessment({ item, kind = 'service', savedAssessment = null, badges = [] }) {
  const inferred = inferCriteriaFromItem(item, kind, badges);
  const declared = savedAssessment?.criteria && typeof savedAssessment.criteria === 'object'
    ? { ...inferred, ...savedAssessment.criteria }
    : inferred;

  const verificationStatus = savedAssessment?.verification_status || (badges.length > 0 ? 'verified' : 'self_declared');
  const hasEvidence = Array.isArray(savedAssessment?.evidence_urls) && savedAssessment.evidence_urls.length > 0;
  // Verified criteria receive 100% weight; self-declared with evidence pending receive 75%; bare self-declared receive 65%.
  const reliabilityFactor = verificationStatus === 'verified' ? 1.0 : (hasEvidence ? 0.75 : 0.65);

  const breakdown = { transport: 0, stay: 0, activity: 0, local: 0, verification: 0 };
  const activeHighlights = [];
  const missingCriteria = [];

  for (const [key, meta] of Object.entries(CRITERIA_CATALOG)) {
    if (declared[key]) {
      const earned = Math.round(meta.maxPoints * reliabilityFactor * 10) / 10;
      breakdown[meta.group] = Math.round((breakdown[meta.group] + earned) * 10) / 10;
      activeHighlights.push(meta.label);
    } else {
      missingCriteria.push({ key, ...meta });
    }
  }

  // Dimension 5: Verification & traveler confirmation (max 10 points)
  if (verificationStatus === 'verified') {
    breakdown.verification += 6;
  } else if (hasEvidence) {
    breakdown.verification += 3;
  }
  const rating = Number(item?.rating || 0);
  const reviewsCount = Number(item?.reviews_count || item?.votes_count || 0);
  if (rating >= 4.5 && reviewsCount >= 1) {
    breakdown.verification += 4;
  } else if (rating >= 4.0) {
    breakdown.verification += 2;
  }

  const rawTotal = breakdown.transport + breakdown.stay + breakdown.activity + breakdown.local + breakdown.verification;
  const totalScore = Math.min(100, Math.max(20, Math.round(rawTotal)));
  const tierInfo = resolveTier(totalScore);

  // Estimate CO2 saved (kg per guest)
  const days = Math.max(1, Number(item?.days || 1));
  const itemType = kind === 'tour' ? 'tour' : (item?.type || 'stay');
  const baselineKg = (BASELINE_CO2_PER_DAY_KG[itemType] || 12) * days;
  const explicitCarbon = Number(item?.carbon || 0);
  const calculatedCo2Saved = explicitCarbon > 0
    ? Math.round(explicitCarbon * 10) / 10
    : Math.round(baselineKg * (totalScore / 140) * 10) / 10;

  const impactLine = `Giảm khoảng ${calculatedCo2Saved.toLocaleString('vi-VN')} kg CO₂ mỗi khách so với lựa chọn thông thường`;

  // Pick top 3 concise highlights for travelers
  const highlights = activeHighlights.slice(0, 3);
  if (highlights.length === 0) {
    highlights.push('Ưu tiên trải nghiệm tôn trọng thiên nhiên và văn hóa bản địa');
  }

  // Actionable tips for Providers (NCC)
  const improvementTips = [];
  if (verificationStatus !== 'verified') {
    improvementTips.push('Bổ sung hình ảnh hoặc tài liệu minh chứng cam kết xanh để quản trị viên xác thực và nhận tối đa điểm.');
  }
  for (const missing of missingCriteria.slice(0, 2)) {
    improvementTips.push(`Triển khai thêm tiêu chí: "${missing.label}" để cải thiện thứ hạng hiển thị.`);
  }

  return {
    targetType: kind,
    targetId: String(item?.id || ''),
    tier: tierInfo.tier,
    tierLabel: tierInfo.tierLabel,
    verificationStatus,
    verificationLabel: verificationStatus === 'verified' ? 'Đã xác thực minh chứng' : (hasEvidence ? 'Đang chờ duyệt minh chứng' : 'Đối tác tự công bố'),
    co2SavedKg: calculatedCo2Saved,
    impactLine,
    highlights,
    rewardMultiplier: tierInfo.rewardMultiplier,
    recommendBoost: tierInfo.recommendBoost,
    // Internal breakdown used by Provider & Admin dashboards (never shown as raw debug data to travelers)
    providerDetail: {
      totalScore,
      breakdown,
      criteria: declared,
      evidenceUrls: savedAssessment?.evidence_urls || [],
      evidenceNote: savedAssessment?.evidence_note || '',
      improvementTips
    }
  };
}

async function loadTargetAndOwner(targetType, targetId) {
  if (targetType === 'service') {
    const service = await GreenService.findByPk(targetId);
    if (!service) return null;
    const vender = service.vender_id ? await Vender.findByPk(service.vender_id) : null;
    const badges = (await BadgeService.findAll({ where: { service_id: service.id } })).map(b => b.badge_name);
    return { item: service, kind: 'service', ownerUserId: vender?.user_id || null, badges };
  }
  if (targetType === 'tour') {
    const schedule = await Schedule.findByPk(targetId);
    if (!schedule) return null;
    const sample = await ScheduleSample.findByPk(targetId);
    const provider = sample?.provider_id ? await Provider.findByPk(sample.provider_id) : null;
    const badges = (await BadgeSchedule.findAll({ where: { schedule_id: schedule.id } })).map(b => b.badge_name);
    return { item: schedule, kind: 'tour', ownerUserId: provider?.user_id || null, badges };
  }
  return null;
}

async function getEcoAssessment(targetType, targetId, { includeProviderDetail = false } = {}) {
  await store.authenticate();
  const target = await loadTargetAndOwner(targetType, targetId);
  if (!target) {
    const error = new Error('Không tìm thấy dịch vụ hoặc lịch trình.');
    error.statusCode = 404;
    throw error;
  }
  const saved = await assessmentCollection().findOne({ target_type: target.kind, target_id: String(targetId) });
  const evaluated = calculateAssessment({
    item: target.item,
    kind: target.kind,
    savedAssessment: saved,
    badges: target.badges
  });

  if (!includeProviderDetail) {
    const { providerDetail, ...publicView } = evaluated;
    return publicView;
  }
  return evaluated;
}

async function submitProviderAssessment({ user, targetType, targetId, criteria = {}, evidenceUrls = [], evidenceNote = '' }) {
  await store.authenticate();
  const target = await loadTargetAndOwner(targetType, targetId);
  if (!target) {
    const error = new Error('Không tìm thấy dịch vụ hoặc lịch trình.');
    error.statusCode = 404;
    throw error;
  }
  if (user.role !== 'admin' && String(target.ownerUserId || '') !== String(user.id)) {
    const error = new Error('Bạn chỉ được cập nhật hồ sơ xanh cho dịch vụ do mình quản lý.');
    error.statusCode = 403;
    throw error;
  }

  const sanitizedCriteria = {};
  for (const key of Object.keys(CRITERIA_CATALOG)) {
    if (key in criteria) sanitizedCriteria[key] = Boolean(criteria[key]);
  }
  const cleanEvidence = Array.isArray(evidenceUrls)
    ? evidenceUrls.map(u => String(u || '').trim()).filter(Boolean).slice(0, 5)
    : [];

  const now = new Date();
  const doc = {
    target_type: target.kind,
    target_id: String(targetId),
    owner_id: target.ownerUserId,
    criteria: sanitizedCriteria,
    evidence_urls: cleanEvidence,
    evidence_note: String(evidenceNote || '').trim().slice(0, 600),
    verification_status: cleanEvidence.length > 0 ? 'pending_review' : 'self_declared',
    updated_by: user.id,
    updated_at: now
  };

  await assessmentCollection().updateOne(
    { target_type: target.kind, target_id: String(targetId) },
    { $set: doc, $setOnInsert: { created_at: now } },
    { upsert: true }
  );

  const evaluated = calculateAssessment({
    item: target.item,
    kind: target.kind,
    savedAssessment: doc,
    badges: target.badges
  });

  // Synchronise estimated CO2 reduction back to the catalog item
  target.item.carbon = evaluated.co2SavedKg;
  await target.item.save();

  await historyCollection().insertOne({
    target_type: target.kind,
    target_id: String(targetId),
    actor_id: user.id,
    action: 'provider_submit',
    tier: evaluated.tier,
    score: evaluated.providerDetail.totalScore,
    ts: now
  });

  return evaluated;
}

async function verifyAssessmentByAdmin({ adminUser, targetType, targetId, approved, reason = '' }) {
  await store.authenticate();
  const target = await loadTargetAndOwner(targetType, targetId);
  if (!target) {
    const error = new Error('Không tìm thấy dịch vụ hoặc lịch trình.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const nextStatus = approved ? 'verified' : 'self_declared';
  await assessmentCollection().updateOne(
    { target_type: target.kind, target_id: String(targetId) },
    {
      $set: {
        verification_status: nextStatus,
        verified_by: adminUser.id,
        verified_at: now,
        review_reason: String(reason || '').trim().slice(0, 500)
      },
      $setOnInsert: {
        target_type: target.kind,
        target_id: String(targetId),
        owner_id: target.ownerUserId,
        created_at: now
      }
    },
    { upsert: true }
  );

  if (target.ownerUserId) {
    await AdminAuditLog.create({
      actor_id: adminUser.id,
      target_user_id: target.ownerUserId,
      action: approved ? 'APPROVE_ECO_ASSESSMENT' : 'REJECT_ECO_ASSESSMENT',
      reason: String(reason || (approved ? 'Đạt minh chứng tiêu chuẩn xanh' : 'Minh chứng chưa đầy đủ')),
      previous_state: { targetType: target.kind, targetId: String(targetId) },
      new_state: { verification_status: nextStatus },
      result: 'success'
    });
  }

  return getEcoAssessment(targetType, targetId, { includeProviderDetail: true });
}

async function listPendingAssessments() {
  await store.authenticate();
  const rows = await assessmentCollection()
    .find({ verification_status: 'pending_review' })
    .sort({ updated_at: -1 })
    .limit(50)
    .toArray();

  const results = [];
  for (const row of rows) {
    const target = await loadTargetAndOwner(row.target_type, row.target_id);
    if (!target) continue;
    const evaluated = calculateAssessment({
      item: target.item,
      kind: target.kind,
      savedAssessment: row,
      badges: target.badges
    });
    results.push({
      targetType: row.target_type,
      targetId: row.target_id,
      name: target.item.name_service || target.item.tour_name,
      destination: target.item.destination,
      ownerUserId: target.ownerUserId,
      updatedAt: row.updated_at,
      evidenceUrls: row.evidence_urls || [],
      evidenceNote: row.evidence_note || '',
      tierLabel: evaluated.tierLabel,
      co2SavedKg: evaluated.co2SavedKg,
      highlights: evaluated.highlights
    });
  }
  return results;
}

module.exports = {
  CRITERIA_CATALOG,
  calculateAssessment,
  getEcoAssessment,
  submitProviderAssessment,
  verifyAssessmentByAdmin,
  listPendingAssessments
};
