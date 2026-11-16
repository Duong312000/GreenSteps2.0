const { randomUUID } = require('node:crypto');

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96);
}

async function saveDestination(models, id, input) {
  if (!input || typeof input !== 'object') throw new Error('Destination payload is required.');
  const name = String(input.name || '').trim();
  const slug = slugify(input.slug || name);
  const status = input.status || 'editorial';
  const current = id ? await models.Destination.findByPk(id) : null;
  if (id && !current) return null;
  const regionId = String(input.regionId || '');
  const adminAreaIds = [...new Set(Array.isArray(input.adminAreaIds) ? input.adminAreaIds.map(String) : [])];
  if (name.length < 2 || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid destination name or slug.');
  if (!['draft', 'editorial', 'published', 'archived'].includes(status)) throw new Error('Invalid destination status.');
  if (!await models.Region.findByPk(regionId)) throw new Error('Region does not exist.');
  for (const areaId of adminAreaIds) if (!await models.AdminArea.findByPk(areaId)) throw new Error('Administrative area does not exist.');
  const duplicate = await models.Destination.findOne({ where: { slug } });
  if (duplicate && duplicate.id !== id) throw new Error('Destination slug already exists.');

  const coordinates = input.coordinates && typeof input.coordinates === 'object' ? {
    lat: Number(input.coordinates.lat), lng: Number(input.coordinates.lng)
  } : null;
  if (coordinates && (!Number.isFinite(coordinates.lat) || coordinates.lat < -90 || coordinates.lat > 90 || !Number.isFinite(coordinates.lng) || coordinates.lng < -180 || coordinates.lng > 180)) throw new Error('Invalid destination coordinates.');
  const coordinateVerification = input.coordinateVerification === 'verified' ? 'verified' : 'pending';
  const source = input.source && typeof input.source === 'object' && typeof input.source.name === 'string' && input.source.name.trim()
    ? { name: input.source.name.trim().slice(0, 200), type: String(input.source.type || 'editorial').slice(0, 40), url: typeof input.source.url === 'string' ? input.source.url.slice(0, 2048) : null }
    : null;
  if (status === 'published' && (coordinateVerification !== 'verified' || !coordinates || !source)) throw new Error('A destination needs verified coordinates and source before publishing.');

  const mediaAssetIds = [...new Set(Array.isArray(input.mediaAssetIds)
    ? input.mediaAssetIds.map(String).slice(0, 15)
    : (current?.mediaAssetIds || []).map(String).slice(0, 15))];
  const mediaAssets = [];
  for (const mediaId of mediaAssetIds) {
    const asset = await models.MediaAsset.findByPk(mediaId);
    if (!asset || asset.deletedAt) throw new Error('Destination gallery contains unavailable media.');
    mediaAssets.push(asset);
  }
  const coverMediaAssetId = Object.hasOwn(input, 'coverMediaAssetId') ? input.coverMediaAssetId || null : current?.coverMediaAssetId || null;
  let coverMediaVerified = false;
  let coverMediaVariants = [];
  let coverPublicUrl = null;
  if (coverMediaAssetId) {
    const asset = await models.MediaAsset.findByPk(coverMediaAssetId);
    coverMediaVerified = Boolean(asset && asset.verificationStatus === 'verified' && !asset.deletedAt);
    if (coverMediaVerified) {
      coverMediaVariants = asset.variants || [];
      coverPublicUrl = asset.publicUrl || null;
    }
    if (status === 'published' && !coverMediaVerified) throw new Error('Cover media must have verified usage rights before publishing.');
  }
  const gallery = mediaAssets.filter(asset => asset.verificationStatus === 'verified').map(asset => ({
    id: asset.id, url: asset.publicUrl, variants: asset.variants || [], attributionText: asset.attributionText || null
  }));
  const record = {
    ...(id ? {} : { id: `destination:${randomUUID()}` }),
    name, slug, aliases: [...new Set((Array.isArray(input.aliases) ? input.aliases : []).map(String).map(value => value.trim()).filter(Boolean).slice(0, 30))],
    regionId, adminAreaIds, coordinates, coordinateVerification, source, status,
    description: typeof input.description === 'string' ? input.description.slice(0, 5000) : '',
    coverMediaAssetId, coverMediaVerified, coverMediaVariants, mediaAssetIds, gallery,
    image_url: coverMediaVerified ? coverPublicUrl : null, version: current?.version || '1'
  };
  if (id) {
    await current.update(record);
    return current;
  }
  return models.Destination.create(record);
}

async function saveEditorialTour(models, id, input = {}) {
  const title = String(input.title || '').trim();
  const destinationIds = [...new Set(Array.isArray(input.destinationIds) ? input.destinationIds.map(String) : [])];
  const status = input.status || 'editorial';
  const days = Number(input.days || 1);
  if (['bookable', 'verified'].includes(status)) throw new Error('CMS cannot set a tour to bookable or verified.');
  if (!['draft', 'editorial', 'demo'].includes(status)) throw new Error('Invalid editorial tour status.');
  if (title.length < 2 || title.length > 160 || !Number.isInteger(days) || days < 1 || days > 30 || !destinationIds.length) throw new Error('Invalid editorial tour content.');
  const destinations = [];
  for (const destinationId of destinationIds) {
    const destination = await models.Destination.findByPk(destinationId);
    if (!destination) throw new Error('Tour destination does not exist.');
    destinations.push(destination);
  }
  const current = id ? await models.Schedule.findByPk(id) : null;
  if (id && (!current || !['draft', 'editorial', 'demo'].includes(current.catalog_status))) {
    if (!current) throw new Error('Tour does not exist.');
    throw new Error('Only editorial and demo tours can be edited in this CMS.');
  }
  const mediaAssetIds = [...new Set(Array.isArray(input.mediaAssetIds)
    ? input.mediaAssetIds.map(String).slice(0, 15)
    : (current?.mediaAssetIds || []).map(String).slice(0, 15))];
  const mediaAssets = [];
  for (const mediaId of mediaAssetIds) {
    const asset = await models.MediaAsset.findByPk(mediaId);
    if (!asset || asset.deletedAt) throw new Error('Tour gallery contains unavailable media.');
    mediaAssets.push(asset);
  }
  const coverMediaAssetId = Object.hasOwn(input, 'coverMediaAssetId') ? input.coverMediaAssetId || null : current?.coverMediaAssetId || null;
  const coverAsset = coverMediaAssetId ? mediaAssets.find(asset => asset.id === coverMediaAssetId) : null;
  if (coverMediaAssetId && !coverAsset) throw new Error('Tour cover must be selected from its gallery.');
  const verifiedGallery = mediaAssets.filter(asset => asset.verificationStatus === 'verified').map(asset => ({
    id: asset.id, url: asset.publicUrl, variants: asset.variants || [], attributionText: asset.attributionText || null
  }));
  const record = {
    ...(id ? {} : { id: `editorial-tour:${randomUUID()}` }), tour_name: title, destination: destinations[0].name,
    destination_ids: destinationIds, days, tour_description: String(input.description || '').slice(0, 5000),
    catalog_status: status, catalog_source: { kind: 'editorial', createdBy: 'admin-cms' },
    style: typeof input.style === 'string' ? input.style.slice(0, 100) : null,
    mediaAssetIds, coverMediaAssetId,
    coverMediaVerified: Boolean(coverAsset && coverAsset.verificationStatus === 'verified'),
    coverMediaVariants: coverAsset?.verificationStatus === 'verified' ? coverAsset.variants || [] : [],
    image_url: coverAsset?.verificationStatus === 'verified' ? coverAsset.publicUrl : null,
    gallery: verifiedGallery.map(asset => asset.url)
  };
  if (current) { await current.update(record); return current; }
  return models.Schedule.create(record);
}

async function createEditorialTour(models, input = {}) {
  return saveEditorialTour(models, null, input);
}

module.exports = { slugify, saveDestination, createEditorialTour, saveEditorialTour };
