// Source-backed listings; archives only the six known demo rows, preserving bookings.
const assert = require('node:assert/strict');
const m = require('../src/food/model');
const catalog = require('../data/real-food-places.json');
const selectedIds = process.argv.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
const sources = selectedIds ? catalog.filter(place => selectedIds.includes(place.id)) : catalog;
const media = require('./food-image');
let browser;
async function main() {
  if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ mode:'preview', places:sources.map(p=>({id:p.id,name:p.name,sources:p.sources})) })); return; }
  await m.init();
  const { chromium } = require('../../my-app/node_modules/playwright');
  browser = await chromium.launch({channel:'chrome',headless:true});media.setPage(await browser.newPage());
  const changes=[];
  for(const source of sources){
    const { replaces, imageUrl, imagePage, mapsQuery, ...fields }=source;
    const image=await media.convert(imageUrl,{});
    const data={...fields,image,destination:source.destination || 'Đà Lạt',status:'published',rating:null,reviewCount:null,capacity:null};
    const checked=m.validate(data);
    changes.push({source,data:{...data,...checked,isDemo:false,bookingEnabled:false,
      mapsUrl:source.mapsUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
      sourceCheckedAt:'2026-11-15',sourceStatus:'public_sources',
      imageSource:{url:imageUrl,page:imagePage,storage:'base64'},
    }});
  }
  const backups=m.store.db.collection(`${m.store.prefix}catalog_import_backups`);
  for(const {source,data} of changes){
    const existing=await m.places().findOne({id:source.id});
    if(existing){await backups.updateOne({_id:`real-food-v1:${existing.id}`},{$setOnInsert:{place:existing,savedAt:new Date()}},{upsert:true});}
    await m.places().updateOne({id:source.id},{$set:{...data,updatedAt:new Date()},$setOnInsert:{createdAt:new Date()},$inc:{version:1}},{upsert:true});
    const legacy=source.replaces ? await m.places().findOne({id:source.replaces}) : null;
    if(legacy){
      assert.equal(legacy.isDemo,true,`Refusing to archive non-demo: ${source.replaces}`);
      await backups.updateOne({_id:`real-food-v1:${legacy.id}`},{$setOnInsert:{place:legacy,savedAt:new Date()}},{upsert:true});
      await m.places().updateOne({id:legacy.id,version:legacy.version},{$set:{status:'hidden',replacementId:source.id,updatedAt:new Date()},$inc:{version:1}});
    }
    const saved=await m.places().findOne({id:source.id});assert.equal(saved.name,source.name);assert.equal(saved.isDemo,false);assert.ok(saved.image.startsWith('data:image/'));
    console.log(JSON.stringify({saved:source.id,name:source.name,base64:true,bookingEnabled:false}));
  }
  console.log(JSON.stringify({publishedRealPlaces:await m.places().countDocuments({status:'published',isDemo:false}),publishedDemos:await m.places().countDocuments({status:'published',isDemo:true})}));
}
main().catch(e=>{console.error(e.name+': '+String(e.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;})
 .finally(async()=>{await browser?.close();await m.store.close();});
