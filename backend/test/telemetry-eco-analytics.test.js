'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { store } = require('../src/config/db.config');
const telemetry = require('../src/services/telemetry.service');
const ecoScore = require('../src/services/eco-score.service');
const recommendation = require('../src/services/recommendation.service');

test.after(async () => {
  await store.close();
});

test('telemetry helpers reject bots, strip PII from search queries, and clamp dwell time', () => {
  const { isBot, normalizeQuery, clampNumber, cleanTarget } = telemetry._internal;
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'), false);

  assert.equal(normalizeQuery('  Sa Pa   trekking '), 'sa pa trekking');
  assert.equal(normalizeQuery('lien he user@gmail.com'), null);
  assert.equal(normalizeQuery('goi 0912345678'), null);

  assert.equal(clampNumber(45.6, 0, 1800), 46);
  assert.equal(clampNumber(99999, 0, 1800), 1800);
  assert.deepEqual(cleanTarget('service', 'SRV_001'), { tt: 'service', tid: 'SRV_001' });
  assert.equal(cleanTarget('unknown', 'SRV_001'), null);
});

test('eco-score engine produces human-friendly tier labels, CO2 reduction line, and provider tips', () => {
  const result = ecoScore.calculateAssessment({
    item: {
      id: 'SRV_ECO_TEST',
      name_service: 'Homestay Sinh Thái Bản Cát Cát',
      type: 'stay',
      destination: 'Sa Pa',
      carbon: 0,
      max_capacity: 10,
      rating: 4.8,
      reviews_count: 15,
      is_partner: true,
      current_data: {
        description: 'Homestay dùng năng lượng mặt trời, không nhựa dùng một lần, phân loại rác, ẩm thực hữu cơ bản địa, trekking bảo tồn rừng.'
      }
    },
    kind: 'service',
    savedAssessment: {
      verification_status: 'verified',
      criteria: {
        low_carbon_transport: true,
        no_single_use_plastic: true,
        renewable_energy: true,
        water_waste_treatment: true,
        conservation_activity: true,
        small_group_limit: true,
        local_workforce: true,
        local_organic_food: true
      },
      evidence_urls: ['https://example.com/cert.jpg']
    },
    badges: ['Eco Stay']
  });

  assert.equal(result.tier, 'excellent');
  assert.equal(result.tierLabel, 'Xanh xuất sắc');
  assert.ok(result.co2SavedKg > 0);
  assert.match(result.impactLine, /Giảm khoảng .* kg CO₂/);
  assert.ok(Array.isArray(result.highlights) && result.highlights.length >= 1);
  assert.ok(result.providerDetail.totalScore >= 85);
});

test('recommendation embedding places same-destination eco items closer than unrelated items', () => {
  const { embedText, cosineSimilarity } = recommendation._internal;
  const userInterest = embedText({
    text: 'Trekking rừng nguyên sinh bản làng Sa Pa homestay gỗ',
    destination: 'Sa Pa',
    tags: ['trekking', 'sapa'],
    category: 'tour'
  });
  const sapaTour = embedText({
    text: 'Hành trình đi bộ xuyên bản Tả Van Sa Pa ngủ homestay bản địa',
    destination: 'Sa Pa',
    tags: ['trekking', 'sapa'],
    category: 'tour'
  });
  const beachTour = embedText({
    text: 'Nghỉ dưỡng biển đảo lặn ngắm san hô Phú Quốc',
    destination: 'Phú Quốc',
    tags: ['bien', 'phuquoc'],
    category: 'tour'
  });

  const simSapa = cosineSimilarity(userInterest, sapaTour);
  const simBeach = cosineSimilarity(userInterest, beachTour);
  assert.ok(simSapa > simBeach, `Expected Sa Pa similarity (${simSapa}) > Beach similarity (${simBeach})`);
});

test('community ranking preserves newest posts first before applying behavioral ordering', async () => {
  const now = new Date('2026-11-19T06:00:00Z');
  const posts = [
    {
      id: 'post_old_1',
      text: 'Kinh nghiệm đi biển Phú Quốc mùa khô',
      destination: 'Phú Quốc',
      hashtags: ['phuquoc'],
      likes_count: 2,
      createdAt: new Date(now.getTime() - 6 * 86400 * 1000).toISOString()
    },
    {
      id: 'post_fresh_1',
      text: 'Chia sẻ mới nhất hôm nay về Côn Đảo',
      destination: 'Côn Đảo',
      hashtags: ['condao'],
      likes_count: 0,
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: 'post_old_high_likes',
      text: 'Hành trình săn mây Tà Xùa nhiều lượt thích',
      destination: 'Tà Xùa',
      hashtags: ['taxua'],
      likes_count: 45,
      createdAt: new Date(now.getTime() - 5 * 86400 * 1000).toISOString()
    }
  ];

  const ranked = await recommendation.rankCommunityPosts({ posts, userId: null, anonId: null, now });
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].id, 'post_fresh_1', 'Fresh post within 48h must stay at the very top');
  assert.equal(ranked[1].id, 'post_old_high_likes', 'Older post with stronger engagement ranks above low-engagement older post');
});
