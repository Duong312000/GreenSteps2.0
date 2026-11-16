// Update only GreenService image fields from licensed, local Commons assets.
// Run with: node backend/scripts/update-service-images-atlas.js --apply
// The database name and collection are checked before a backup or write.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('../src/config/env');
const { MongoClient } = require('mongodb');

const approvedDatabase = 'GreenStepsData'; // user-confirmed dev/staging Atlas database
const approvedCollection = `${process.env.MONGODB_COLLECTION_PREFIX || 'app_'}greenservices`;
const root = path.resolve(__dirname, '../../');
const appRoot = path.join(root, 'my-app');
const isApply = process.argv.includes('--apply');
const iso = new Date().toISOString().replace(/[:.]/g, '-');

function stripHtml(value = '') { return String(value).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim(); }
function normalized(value = '') { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd'); }
function destinationKey(value) {
  const d = normalized(value);
  if (d.includes('ha giang')) return 'ha-giang';
  if (d.includes('da lat')) return 'dalat';
  if (d.includes('phu yen')) return 'phu-yen';
  if (d.includes('hoi an')) return d.includes('da nang') ? 'da-nang-hoi-an' : 'hoi-an';
  if (d.includes('da nang')) return 'da-nang';
  if (d.includes('sa pa')) return 'sa-pa';
  if (d.includes('ninh binh')) return 'ninh-binh';
  if (d.includes('phu quoc')) return 'phu-quoc';
  return null;
}
function stableOffset(id, length) { return Number.parseInt(crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 8), 16) % length; }
function backupDoc(doc) {
  return {
    _id: doc._id,
    id: doc.id,
    image_url: doc.image_url,
    coverMediaAssetId: doc.coverMediaAssetId,
    coverMediaVerified: doc.coverMediaVerified,
    current_data: {
      img: doc.current_data?.img,
      images: doc.current_data?.images,
      gallery: doc.current_data?.gallery,
      imageSource: doc.current_data?.imageSource,
      imageMetadata: doc.current_data?.imageMetadata
    }
  };
}

function loadPools() {
  const sourcePath = path.join(appRoot, 'src/app/data/demo-tour-photo-data.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const literal = source.slice(source.indexOf('= {') + 2, source.lastIndexOf('};') + 1);
  const demo = JSON.parse(literal);
  const pools = new Map();
  for (const [tourId, data] of Object.entries(demo)) {
    const group = tourId.replace(/^demo-vn-tour-/, '').replace(/-\d+$/, '');
    const key = group === 'da-nang-hoi-an' ? group : group;
    const list = pools.get(key) || [];
    for (const photo of data.photoMetadata || []) {
      if (photo.verificationStatus !== 'verified' || !photo.sourcePage || !photo.licenseId || !photo.licenseUrl) continue;
      if (list.some(item => item.path === photo.path)) continue;
      list.push(photo);
    }
    pools.set(key, list);
  }
  const haGiang = JSON.parse(fs.readFileSync(path.join(root, 'tmp/ha-giang-image-metadata.json'), 'utf8'));
  pools.set('ha-giang', haGiang.map(photo => ({
    path: photo.path,
    caption: photo.description || 'Cảnh quan tại Hà Giang.',
    alt: photo.description ? `Cảnh quan Hà Giang: ${photo.description}` : 'Cảnh quan vùng núi Hà Giang',
    sourcePage: photo.sourcePage,
    author: photo.author,
    licenseId: photo.license,
    licenseUrl: photo.licenseUrl,
    attribution: `${photo.author || 'Tác giả không ghi rõ'}, via Wikimedia Commons, ${photo.license}`,
    subjectLocation: 'Hà Giang, Việt Nam',
    verificationStatus: 'verified',
    verifiedOn: new Date().toISOString().slice(0, 10),
    relevance: { type: 'destination_context', explanation: 'Ảnh chụp thật về cảnh quan tại Hà Giang, từ Wikimedia Commons.' },
    modifications: `Tải bản JPEG 1600px; ${photo.width}×${photo.height} px.` ,
    width: photo.width,
    height: photo.height,
    responsiveVariants: photo.responsiveVariants || []
  })));
  const daNang = (pools.get('da-nang-hoi-an') || []).filter(photo => !normalized(`${photo.caption} ${photo.subjectLocation} ${photo.path}`).includes('hoi an'));
  pools.set('da-nang', daNang);
  const hoiAn = (pools.get('da-nang-hoi-an') || []).filter(photo => normalized(`${photo.caption} ${photo.subjectLocation} ${photo.path}`).includes('hoi an'));
  const extraHoiAn = JSON.parse(fs.readFileSync(path.join(root, 'tmp/hoi-an-image-metadata.json'), 'utf8')).map(photo => ({
    path: photo.path,
    caption: 'Phố cổ Hội An về đêm.',
    alt: 'Phố cổ Hội An với những ngôi nhà và đèn lồng vào buổi tối',
    sourcePage: photo.sourcePage,
    author: photo.author,
    licenseId: photo.license,
    licenseUrl: photo.licenseUrl,
    attribution: `${photo.author || 'Tác giả không ghi rõ'}, via Wikimedia Commons, ${photo.license}`,
    subjectLocation: 'Phố cổ Hội An',
    verificationStatus: 'verified',
    verifiedOn: new Date().toISOString().slice(0, 10),
    relevance: { type: 'destination_context', explanation: 'Ảnh phố cổ Hội An; không xác nhận cơ sở dịch vụ.' },
    modifications: `Tải bản JPEG 1600px; ${photo.width}×${photo.height} px.`,
    width: photo.width,
    height: photo.height,
    responsiveVariants: photo.responsiveVariants || []
  }));
  pools.set('hoi-an', [...hoiAn, ...extraHoiAn]);
  pools.set('da-nang-hoi-an', [...(pools.get('da-nang-hoi-an') || []), ...extraHoiAn]);
  return pools;
}

function galleryFor(doc, pools) {
  const key = destinationKey(doc.destination);
  const pool = (key && pools.get(key)) || [];
  if (!pool.length) return [];
  const count = Math.min(6, pool.length);
  const offset = stableOffset(doc.id || doc._id, pool.length);
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]).map(photo => {
    const file = path.join(appRoot, 'public', photo.path);
    if (!fs.existsSync(file)) throw new Error(`Asset missing: ${photo.path}`);
    return {
      ...photo,
      caption: photo.caption || `Cảnh quan tại ${photo.subjectLocation || doc.destination}.`,
      alt: photo.alt || `Cảnh quan tại ${doc.destination}`,
      relevance: { type: 'destination_context', explanation: `Ảnh chụp thật về ${photo.subjectLocation || doc.destination}, được cấp phép qua Wikimedia Commons.` },
      verificationStatus: 'verified'
    };
  });
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 });
  await client.connect();
  try {
    const db = client.db();
    if (db.databaseName !== approvedDatabase) throw new Error(`Refusing database ${db.databaseName}; expected confirmed dev/staging database ${approvedDatabase}.`);
    const collection = db.collection(approvedCollection);
    const docs = await collection.find({}, { projection: { id: 1, name_service: 1, destination: 1, type: 1, status: 1, current_data: 1, image_url: 1, coverMediaAssetId: 1, coverMediaVerified: 1 } }).toArray();
    if (docs.length !== 82) throw new Error(`Refusing unexpected service count ${docs.length}; inventory was 82.`);
    if (docs.some(doc => !doc._id || !doc.id)) throw new Error('Refusing documents missing stable identifiers.');
    const pools = loadPools();
    const proposals = docs.map(doc => ({ doc, gallery: galleryFor(doc, pools) }));
    const tooFew = proposals.filter(item => item.gallery.length < 5);
    if (tooFew.length) console.warn(`Gallery source pool has fewer than 5 suitable destination images for ${tooFew.length} service(s); their available count will be used.`);
    const usedPaths = new Set(proposals.flatMap(item => item.gallery.map(photo => photo.path)));
    if (proposals.some(item => item.gallery.length && new Set(item.gallery.map(photo => photo.path)).size !== item.gallery.length)) throw new Error('Duplicate image found inside a service gallery.');

    const backup = {
      database: db.databaseName, collection: approvedCollection, createdAt: new Date().toISOString(), count: docs.length,
      records: docs.map(backupDoc)
    };
    const backupPath = path.join(root, 'tmp', `mongo-service-images-backup-${iso}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    const backupHash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
    const updates = proposals.filter(item => item.gallery.length).map(({ doc, gallery }) => {
      const paths = gallery.map(photo => photo.path);
      const cover = gallery[0];
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: {
            image_url: cover.path,
            coverMediaAssetId: `commons:${crypto.createHash('sha1').update(cover.sourcePage).digest('hex').slice(0, 16)}`,
            coverMediaVerified: false,
            'current_data.img': cover.path,
            'current_data.images': paths,
            'current_data.gallery': paths,
            'current_data.imageSource': { provider: 'Wikimedia Commons', classification: 'real_destination_photo', verifiedAt: new Date().toISOString() },
            'current_data.imageMetadata': gallery
          } }
        }
      };
    });
    const report = {
      database: db.databaseName, collection: approvedCollection, serviceCount: docs.length,
      proposedUpdates: updates.length, servicesWithAtLeastFive: proposals.filter(item => item.gallery.length >= 5).length,
      servicesBelowFive: tooFew.map(item => ({ id: item.doc.id, name: item.doc.name_service, destination: item.doc.destination, count: item.gallery.length })),
      uniqueAssetsReferenced: usedPaths.size, backupPath, backupSha256: backupHash,
      mode: isApply ? 'apply' : 'dry-run'
    };
    console.log(JSON.stringify(report, null, 2));
    if (!isApply) return;

    const result = await collection.bulkWrite(updates, { ordered: false });
    if (result.matchedCount !== updates.length || result.modifiedCount !== updates.length) {
      throw new Error(`Update count mismatch: matched ${result.matchedCount}, modified ${result.modifiedCount}, expected ${updates.length}. Backup retained at ${backupPath}.`);
    }
    const after = await collection.find({}, { projection: { id: 1, image_url: 1, coverMediaVerified: 1, current_data: 1 } }).toArray();
    const validated = after.filter(doc => {
      const paths = doc.current_data?.gallery || [];
      return doc.image_url && doc.image_url === doc.current_data?.img && paths.length >= 1 && paths.length === (doc.current_data?.images || []).length
        && doc.current_data?.imageMetadata?.length === paths.length && paths.every(p => fs.existsSync(path.join(appRoot, 'public', p)));
    });
    const validationReport = { ...report, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, validatedDocuments: validated.length, postWriteCount: after.length };
    const out = path.join(root, 'tmp', `service-image-atlas-update-${iso}.json`);
    fs.writeFileSync(out, JSON.stringify(validationReport, null, 2));
    console.log(JSON.stringify({ ...validationReport, resultPath: out }, null, 2));
    if (validated.length !== updates.length || after.length !== docs.length) throw new Error('Post-write validation failed.');
  } finally {
    await client.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
