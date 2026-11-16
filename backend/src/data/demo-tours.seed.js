const { demoTourEditorial, tourPresentation } = require('./demo-tour-editorial');
const photoManifest = require('../../../docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json');

const names = {
  'dalat': ['Đà Lạt chậm: rừng thông và nông nghiệp địa phương', 'Một ngày xanh quanh Đà Lạt'],
  'phu-yen': ['Phú Yên: theo dấu miền biển bình yên', 'Sắc xanh ven biển Phú Yên'],
  'da-nang-hoi-an': ['Đà Nẵng – Hội An: di sản và biển xanh', 'Miền Trung qua nhịp sống địa phương'],
  'sa-pa': ['Sa Pa: đường núi và văn hóa bản địa', 'Tây Bắc xanh qua những lối nhỏ'],
  'ninh-binh': ['Ninh Bình: non nước và làng quê', 'Một hành trình chậm giữa di sản Ninh Bình'],
  'phu-quoc': ['Phú Quốc: biển đảo và sinh thái', 'Sống chậm giữa đảo ngọc']
};
const displayNames = { dalat: 'Đà Lạt', 'phu-yen': 'Phú Yên', 'da-nang-hoi-an': 'Đà Nẵng – Hội An', 'sa-pa': 'Sa Pa', 'ninh-binh': 'Ninh Bình', 'phu-quoc': 'Phú Quốc' };

const demoTours = Object.entries(names).flatMap(([slug, titles]) => titles.map((title, index) => {
  const tourSlug = `${slug}-${index + 1}`;
  const id = `demo-vn-tour-${tourSlug}`;
  const editorial = demoTourEditorial[tourSlug];
  const presentation = tourPresentation[tourSlug];
  const photos = photoManifest.filter(photo => photo.tourSlugs.includes(tourSlug)).map(photo => ({
    path: photo.assetPath,
    caption: photo.caption,
    alt: photo.alt,
    sourcePage: photo.sourcePage,
    author: photo.author,
    licenseId: photo.licenseId,
    licenseUrl: photo.licenseUrl,
    attribution: photo.attribution,
    subjectLocation: photo.subjectLocation,
    verificationStatus: photo.verificationStatus,
    verifiedOn: photo.verifiedOn,
    relevance: photo.tourRelevance[tourSlug],
    modifications: photo.modifications,
    responsiveVariants: photo.responsiveVariants,
    width: photo.width,
    height: photo.height
  }));
  const preferredCoverFile = presentation.coverFile || editorial.coverFile;
  const coverIndex = photos.findIndex(photo => photo.path.includes(`/${preferredCoverFile}.`));
  if (coverIndex > 0) photos.unshift(photos.splice(coverIndex, 1)[0]);
  return {
    id,
    tour_name: title,
    destination: displayNames[slug],
    destination_ids: [`destination:${slug}`],
    days: 3,
    carbon: null,
    tour_description: presentation.description,
    highlights: presentation.highlights,
    responsible_travel: presentation.responsibleTravel,
    practical_notes: editorial.practical_notes,
    editorial_itinerary_notice: 'Lịch trình biên tập gợi ý; chưa phải dịch vụ hay lịch khởi hành đã xác nhận.',
    image_url: photos[0]?.path,
    gallery: photos.map(photo => photo.path),
    photo_metadata: photos,
    catalog_status: 'demo',
    catalog_source: { kind: 'editorial/demo', seedVersion: 3 },
    style: presentation.style,
    style_explanation: presentation.styleExplanation,
    group_size: null,
    fitness_level: presentation.fitnessLevel,
    fitness_is_estimate: true,
    fitness_explanation: presentation.fitnessExplanation,
    itinerary: editorial.activities.map(([activity, note], activityIndex) => ({
      id: `${id}-activity-${activityIndex + 1}`,
      schedule_id: id,
      day_number: activityIndex + 1,
      time: 'Tham khảo',
      activity_name: activity,
      activity_cost: null,
      carbon: null,
      coordinates: null,
      editorial_note: note
    }))
  };
}));

module.exports = { demoTours };
