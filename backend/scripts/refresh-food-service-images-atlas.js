// Replaces only the image fields on existing type=food services in the confirmed
// dev/staging Atlas database. Downloads licensed dish/ingredient photos first.
// Usage: node backend/scripts/refresh-food-service-images-atlas.js [--apply]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('../src/config/env');
const { MongoClient } = require('mongodb');

const DB_NAME = 'GreenStepsData';
const COLLECTION = `${process.env.MONGODB_COLLECTION_PREFIX || 'app_'}greenservices`;
const ROOT = path.resolve(__dirname, '../../');
const PUBLIC_ROOT = path.join(ROOT, 'my-app/public');
const IS_APPLY = process.argv.includes('--apply');
const GROUPS = {
  rice: [
    'Cơm Chiên, Da Nang, Vietnam.jpg', 'Cơm chiên.JPG', 'Cơm chiên Dương Châu ở Đông Hà năm 2017.jpg', 'Com Hen at Hue Vietnam.JPG', 'Cơm lam Tây Nguyên.jpg'
  ],
  coffee: [
    'Vietnamese coffee.jpg', 'Vietnamese Coffee Beans.webp', 'Coffee blossom.JPG', 'Cafe Nguyệt Ca năm 2022 (ly cafe sữa nóng) (1).jpg', 'Cafe 2K20 ng21th5n2022 (tách cà phê sữa) (1).jpg'
  ],
  vegetarian: [
    'Gỏi Cuốn Chay Vietnamese Fresh Vegetarian Spring Roll 2019-1599.jpg', 'Thit rang chay canh.jpg', 'Món chay cúng Ông năm 2017 (1) - Copy.jpg', 'Cà tím nướng.JPG', 'Tomato-sauced tofu.jpg'
  ],
  tea: [
    'Chè xí má ở Hội An - Xi ma in Hoi An, Vietname.jpg', 'Chè đậu trắng 1.jpg', 'Chè đỗ xanh.jpg', 'Chendol2.jpg', 'Bánh cam.jpg'
  ],
  cooking: [
    'Cao Lau - Ba Be, Hoi An Market VND15000.jpg', 'Fried wonton Hoi An.JPG', 'Food SpringRollCaoLau.JPG', 'BanhUot-Alpha-HoiAn.jpg', 'Bánh bèo, Bánh ít trần, Bánh bột lọc trần.jpg'
  ],
  seafood: [
    'Gỏi nhệch 1.jpg', 'Chả mực.jpg', 'Com Hen at Hue Vietnam.JPG', 'Bữa ăn gia đình (món mực sim luộc), Tết năm 2019 (1).jpg', 'Hào nướng phô mai Nguyễn Nhữ Lãm, T4 (1).jpg'
  ]
};
const FOOD_SERVICE_GROUP = new Map([
  ['ser_1783939184743', 'rice'], ['SRV_DL_CAUKDAT01', 'coffee'], ['srv_duong_2', 'vegetarian'],
  ['srv_duong_5', 'tea'], ['SRV_HA_TRAQUE01', 'cooking'], ['SRV_PY_DAMOLOAN01', 'seafood'],
  ['srv_demo_detail_dalat_farm_table', 'tea'], ['GGP_DL_LANGCHAY', 'vegetarian'],
  ['GGP_HA_ANLACCHAY', 'vegetarian'], ['GGP_DN_QUANCHAY', 'vegetarian']
]);

function plain(s = '') { return String(s).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
function slug(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }
function imageFields(doc) {
  return { _id: doc._id, id: doc.id, image_url: doc.image_url, coverMediaAssetId: doc.coverMediaAssetId, coverMediaVerified: doc.coverMediaVerified,
    current_data: { img: doc.current_data?.img, images: doc.current_data?.images, gallery: doc.current_data?.gallery, imageSource: doc.current_data?.imageSource, imageMetadata: doc.current_data?.imageMetadata } };
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchRetry(url, options, label) {
  let delay = 1500;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`${label} failed ${response.status}`);
    await pause(delay); delay = Math.min(delay * 2, 12000);
  }
  throw new Error(`${label} remains unavailable after retries`);
}
async function commonsFile(filename) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k,v] of Object.entries({action:'query',format:'json',titles:`File:${filename}`,prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1280'})) url.searchParams.set(k,v);
  const response = await fetchRetry(url, { headers: { 'User-Agent': 'GreenStepsTravel/1.0 (licensed food photo catalog)' } }, `Commons lookup ${filename}`);
  const result = await response.json();
  const page = Object.values(result.query?.pages || {})[0], info = page?.imageinfo?.[0], meta = info?.extmetadata || {};
  if (!info?.thumburl || !meta.LicenseShortName?.value || (!meta.LicenseUrl?.value && !/public domain/i.test(meta.LicenseShortName.value)) || !meta.Artist?.value) throw new Error(`Missing license/source metadata: ${filename}`);
  return { filename, page: info.descriptionurl, thumb: info.thumburl, original: info.url, width: info.thumbwidth || info.width, height: info.thumbheight || info.height,
    license: plain(meta.LicenseShortName.value), licenseUrl: plain(meta.LicenseUrl?.value || info.descriptionurl), author: plain(meta.Artist.value), description: plain(meta.ImageDescription?.value || filename) };
}
async function downloadPhoto(group, file) {
  const ext = path.extname(new URL(file.thumb).pathname).toLowerCase() || '.jpg';
  const rel = `image/greensteps/food/${group}/${slug(file.filename).replace(/-(jpg|jpeg|png|webp)$/i, '')}${ext}`;
  const abs = path.join(PUBLIC_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!fs.existsSync(abs)) {
    const response = await fetchRetry(file.thumb, { headers: { 'User-Agent': 'GreenStepsTravel/1.0 (licensed food photo catalog)' } }, `Image download ${file.filename}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 4000) throw new Error(`Image too small: ${file.filename}`);
    fs.writeFileSync(abs, bytes);
  }
  const subject = file.description || file.filename;
  const entry = { path: file.thumb, localAssetPath: rel, caption: subject, alt: subject, sourcePage: file.page, author: file.author, licenseId: file.license, licenseUrl: file.licenseUrl,
    attribution: `${file.author}, via Wikimedia Commons, ${file.license}`, verificationStatus: 'verified', verifiedOn: new Date().toISOString().slice(0,10),
    relevance: { type: 'real_food_photo', explanation: 'Ảnh thật về món ăn, đồ uống hoặc nguyên liệu; không xác nhận đây là món do cơ sở dịch vụ cụ thể phục vụ.' },
    subjectType: 'food_or_drink', modifications: `Tải thumbnail Wikimedia Commons rộng tối đa 1280px, lưu JPEG tương thích; ${file.width}×${file.height}px nguồn.`, width: file.width, height: file.height };
  return entry;
}
async function main() {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await client.connect();
  try {
    const db = client.db();
    if (db.databaseName !== DB_NAME) throw new Error(`Refusing database ${db.databaseName}; expected confirmed dev/staging ${DB_NAME}`);
    const collection = db.collection(COLLECTION);
    const allFood = await collection.find({ type: 'food' }).project({ id:1, name_service:1, destination:1, type:1, image_url:1, coverMediaAssetId:1, coverMediaVerified:1, current_data:1 }).toArray();
    if (allFood.length !== 10 || allFood.some(d => !FOOD_SERVICE_GROUP.has(d.id))) throw new Error(`Unexpected food inventory (${allFood.length}); refusing write.`);
    const catalog = {};
    for (const [group, filenames] of Object.entries(GROUPS)) {
      catalog[group] = [];
      for (const filename of filenames) { catalog[group].push(await downloadPhoto(group, await commonsFile(filename))); await pause(1400); }
    }
    const plan = allFood.map(doc => ({ doc, group: FOOD_SERVICE_GROUP.get(doc.id), gallery: catalog[FOOD_SERVICE_GROUP.get(doc.id)] }));
    if (plan.some(x => x.gallery.length !== 5 || new Set(x.gallery.map(p => p.sourcePage)).size !== 5)) throw new Error('Every food service must have five unique, licensed food photos.');
    const imageBackup = { database: db.databaseName, collection: COLLECTION, createdAt:new Date().toISOString(), count:allFood.length, records:allFood.map(imageFields) };
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const backupPath = path.join(ROOT, 'tmp', `mongo-food-image-backup-${stamp}.json`);
    fs.mkdirSync(path.dirname(backupPath), {recursive:true});
    fs.writeFileSync(backupPath, JSON.stringify(imageBackup,null,2));
    const sha = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
    const allPhotos = Object.values(catalog).flat();
    const report = {database:db.databaseName,collection:COLLECTION,foodDocuments:allFood.length,plannedDocuments:plan.length,imagesPerService:5,assetFiles:allPhotos.length,uniqueFoodAssets:new Set(allPhotos.map(photo=>photo.sourcePage)).size,backupPath,backupSha256:sha,mode:IS_APPLY?'apply':'dry-run'};
    console.log(JSON.stringify({...report, services:plan.map(x=>({id:x.doc.id,name:x.doc.name_service,group:x.group,images:x.gallery.map(i=>i.path)}))},null,2));
    if (!IS_APPLY) return;
    const now = new Date().toISOString();
    const operations = plan.map(({doc,group,gallery}) => {
      const cover=gallery[0], paths=gallery.map(x=>x.path);
      return {updateOne:{filter:{_id:doc._id,type:'food'},update:{$set:{image_url:cover.path,coverMediaAssetId:`commons:${crypto.createHash('sha1').update(cover.sourcePage).digest('hex').slice(0,16)}`,coverMediaVerified:false,'current_data.img':cover.path,'current_data.images':paths,'current_data.gallery':paths,'current_data.imageSource':{provider:'Wikimedia Commons',classification:'real_food_photo',verifiedAt:now,serviceCategory:group},'current_data.imageMetadata':gallery}}}};
    });
    const result=await collection.bulkWrite(operations,{ordered:false});
    const after=await collection.find({type:'food'}).project({id:1,image_url:1,coverMediaVerified:1,current_data:1}).toArray();
    const invalid=after.filter(d=>{const paths=d.current_data?.gallery||[],meta=d.current_data?.imageMetadata||[];return paths.length!==5||meta.length!==5||d.image_url!==d.current_data?.img||!paths.every((p,i)=>p===meta[i].path&&/^https:\/\//.test(p)&&meta[i].localAssetPath&&fs.existsSync(path.join(PUBLIC_ROOT,meta[i].localAssetPath)))});
    const out={...report,matchedCount:result.matchedCount,modifiedCount:result.modifiedCount,readBackDocuments:after.length,invalidDocuments:invalid.map(d=>d.id),imageUrls:5*after.length,classification:'real_food_photo'};
    const reportPath=path.join(ROOT,'tmp',`mongo-food-image-update-${stamp}.json`);fs.writeFileSync(reportPath,JSON.stringify(out,null,2));
    console.log(JSON.stringify({...out,reportPath},null,2));
    if(result.matchedCount!==10||result.modifiedCount!==10||invalid.length)throw new Error(`Post-write validation failed. Backup: ${backupPath}`);
  } finally { await client.close(); }
}
main().catch(e=>{console.error(e.stack || e.message);process.exitCode=1;});
