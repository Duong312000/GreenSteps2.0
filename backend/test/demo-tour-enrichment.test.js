const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { demoTours } = require('../src/data/demo-tours.seed');
const { Schedule } = require('../src/models');
const photoManifest = require('../../docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json');

const expectedIds = [
  'demo-vn-tour-dalat-1', 'demo-vn-tour-dalat-2',
  'demo-vn-tour-phu-yen-1', 'demo-vn-tour-phu-yen-2',
  'demo-vn-tour-da-nang-hoi-an-1', 'demo-vn-tour-da-nang-hoi-an-2',
  'demo-vn-tour-sa-pa-1', 'demo-vn-tour-sa-pa-2',
  'demo-vn-tour-ninh-binh-1', 'demo-vn-tour-ninh-binh-2',
  'demo-vn-tour-phu-quoc-1', 'demo-vn-tour-phu-quoc-2'
];

test('the checked-in inventory contains the twelve existing demo IDs and keeps commercial facts unverified', () => {
  assert.deepEqual(demoTours.map(tour => tour.id), expectedIds);
  for (const tour of demoTours) {
    assert.equal(tour.catalog_status, 'demo');
    assert.equal(tour.cost, undefined);
    assert.equal(tour.carbon, null);
    assert.equal(tour.rating, undefined);
    assert.equal(tour.votes_count, undefined);
    assert.equal(tour.max_capacity, undefined);
    assert.equal(tour.itinerary.length, 3);
    assert.ok(tour.tour_description.length > 250, `${tour.id} needs useful tour-specific copy`);
    assert.ok(tour.highlights.length >= 3, `${tour.id} needs destination highlights`);
    assert.ok(tour.responsible_travel);
    assert.ok(tour.practical_notes);
  }
});

test('each demo tour includes explicit, tour-specific editorial characteristics and overview content', () => {
  const responsibleTravelNotes = new Set();
  for (const tour of demoTours) {
    assert.ok(tour.style, `${tour.id} needs an existing-taxonomy tour style`);
    assert.ok(tour.style_explanation, `${tour.id} needs a style explanation`);
    assert.ok(['Nhẹ nhàng', 'Trung bình', 'Vận động nhiều'].includes(tour.fitness_level), `${tour.id} needs a supported qualitative intensity`);
    assert.equal(tour.fitness_is_estimate, true);
    assert.ok(tour.fitness_explanation, `${tour.id} needs an intensity explanation`);
    assert.equal(tour.group_size, null, 'editorial records must not assert group capacity');
    assert.ok(tour.tour_description.trim().split(/\s+/).length >= 150, `${tour.id} needs a useful destination-specific introduction`);
    assert.ok(tour.highlights.length >= 4 && tour.highlights.length <= 6, `${tour.id} needs four to six highlights`);
    assert.ok(tour.itinerary.every((activity, index) => activity.day_number === index + 1));
    responsibleTravelNotes.add(tour.responsible_travel);
  }
  assert.equal(responsibleTravelNotes.size, demoTours.length, 'responsible travel guidance should reflect each tour');
});

test('Schedule model persists the editorial characteristic fields used by demo tours', () => {
  for (const field of ['style_explanation', 'fitness_is_estimate', 'fitness_explanation']) {
    assert.ok(Schedule.fields[field], `Schedule is missing ${field}`);
  }
});

test('each demo tour has a location-matched, licensed cover and a 6 to 10 original photo gallery', () => {
  const manifestBySlug = new Map(photoManifest.map(photo => [photo.assetPath, photo]));
  for (const tour of demoTours) {
    assert.ok(tour.image_url, `${tour.id} has no cover`);
    assert.ok(tour.gallery.length >= 6 && tour.gallery.length <= 10, `${tour.id} gallery size`);
    assert.equal(tour.gallery[0], tour.image_url, `${tour.id} first gallery image is the cover`);
    assert.equal(tour.photo_metadata.length, tour.gallery.length);
    const withinTour = new Set();
    for (const photo of tour.photo_metadata) {
      assert.ok(!withinTour.has(photo.path.toLowerCase()), `${tour.id} repeats ${photo.path}`);
      withinTour.add(photo.path.toLowerCase());
      const source = manifestBySlug.get(photo.path);
      assert.ok(source, `Missing manifest row for ${photo.path}`);
      const tourRelevance = source.tourRelevance?.[tour.id.replace(/^demo-vn-tour-/, '')];
      assert.ok(tourRelevance?.type && tourRelevance?.explanation, `Missing tour-specific relevance for ${tour.id}: ${photo.path}`);
      assert.deepEqual(photo.relevance, tourRelevance);
      assert.ok(fs.existsSync(path.resolve(__dirname, '../../my-app/public', photo.path)), `Missing local asset ${photo.path}`);
      assert.ok(source.sourcePage && source.author && source.licenseId && source.licenseUrl);
      assert.ok(source.attribution && source.caption && source.alt);
      assert.equal(source.verificationStatus, 'verified');
      assert.equal(source.destinationSlug, tour.destination_ids[0].replace('destination:', ''));
      assert.equal(source.responsiveVariants.length, 3);
      for (const variant of source.responsiveVariants) {
        assert.ok(variant.width <= 1600);
        assert.ok(fs.existsSync(path.resolve(__dirname, '../../my-app/public', variant.path)), variant.path);
      }
    }
  }
});

test('the two tours at each destination use different covers', () => {
  for (let index = 0; index < demoTours.length; index += 2) {
    assert.notEqual(demoTours[index].image_url, demoTours[index + 1].image_url, `${demoTours[index].destination} covers should differ`);
  }
});

test('same-destination tours share no more than 25 percent of gallery originals', () => {
  for (let index = 0; index < demoTours.length; index += 2) {
    const [first, second] = demoTours.slice(index, index + 2);
    const firstPaths = new Set(first.gallery.map(photoPath => photoPath.toLowerCase()));
    const sharedCount = second.gallery.filter(photoPath => firstPaths.has(photoPath.toLowerCase())).length;
    const overlapRatio = sharedCount / Math.min(first.gallery.length, second.gallery.length);
    assert.ok(overlapRatio <= 0.25, `${first.destination} gallery overlap was ${(overlapRatio * 100).toFixed(1)}%`);
  }
});

test('photo manifest contains no repeated assets and every local path exists', () => {
  const paths = photoManifest.map(photo => photo.assetPath.toLowerCase());
  assert.equal(new Set(paths).size, paths.length, 'photo manifest must not contain duplicate asset paths');
  const contentHashes = [];
  for (const photo of photoManifest) {
    const assetPath = path.resolve(__dirname, '../../my-app/public', photo.assetPath);
    assert.ok(fs.existsSync(assetPath), photo.assetPath);
    contentHashes.push(createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex'));
    assert.ok(photo.sourcePage.startsWith('https://commons.wikimedia.org/wiki/File:'));
    assert.ok(photo.licenseUrl.startsWith('https://creativecommons.org/') || photo.licenseUrl === 'https://commons.wikimedia.org/wiki/Template:PD-self');
    assert.equal(photo.modifications, 'Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.');
  }
  assert.equal(new Set(contentHashes).size, contentHashes.length, 'different manifest assets must not contain duplicate image bytes');
});

test('every original records verifiable Commons file metadata for downloads and attribution', () => {
  for (const photo of photoManifest) {
    assert.match(photo.sourceSha1, /^[a-f0-9]{40}$/i, `${photo.assetPath} needs the Commons source SHA-1`);
    assert.ok(photo.sourceFileUrl?.startsWith('https://upload.wikimedia.org/'), `${photo.assetPath} needs the original file URL`);
    assert.match(photo.sourceThumbnailUrl || '', /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//, `${photo.assetPath} needs the optimized download URL`);
    assert.ok(photo.sourceMime?.startsWith('image/'), `${photo.assetPath} needs the source MIME type`);
    assert.ok(photo.originalWidth > 0 && photo.originalHeight > 0, `${photo.assetPath} needs source dimensions`);
    assert.ok(photo.sourceDescription?.trim(), `${photo.assetPath} needs its Commons description for location review`);
  }
});
