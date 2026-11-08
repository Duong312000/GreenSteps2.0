const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../src/services/favorites.service');
const {GreenService,Schedule,ScheduleCustom,UserSchedule}=require('../src/models');
test('favorite identity is scoped to account/type and rejects query injection',()=>{
 assert.notEqual(F.key('a','service','same'),F.key('b','service','same'));
 assert.notEqual(F.key('a','service','same'),F.key('a','tour','same'));
 assert.throws(()=>F.identity('user','one'));
 assert.throws(()=>F.identity('service',{$ne:null}));
 assert.throws(()=>F.identity('service','x\0y'));
});
test('place snapshots validate coordinates and discard executable URLs and private fields',()=>{
 const p=F.placeSnapshot({name:'Riverside',image:'javascript:alert(1)',lat:15,lng:108,cost:0,user_id:'another-account',password:'not-stored'});
 assert.equal(p.image,'');assert.equal(p.price,0);assert.equal(p.user_id,undefined);assert.equal(p.password,undefined);
 assert.match(p.map_url,/15%2C108/);assert.throws(()=>F.placeSnapshot({name:'Invalid',lat:200}));
 assert.equal(F.placeSnapshot(p).price,0,'refresh preserves the stored price');
});
test('service favorite metadata is read from the catalog, not the client payload',async t=>{
 t.mock.method(GreenService,'findByPk',async()=>({name_service:'Actual service',destination:'Da Nang',cost:150000,status:'active',image_url:'/image/a.jpg',current_data:{}}));
 const result=await F.resolve('service','service-1','user-1',{name:'Forged name',cost:1,url:'https://untrusted.invalid'});
 assert.equal(result.name,'Actual service');assert.equal(result.price,150000);assert.equal(result.url,'/services/service-1');
});
test('favorites cannot reveal another account private itinerary',async t=>{
 t.mock.method(Schedule,'findByPk',async()=>({tour_name:'Private',destination:'Da Lat',days:2}));
 t.mock.method(ScheduleCustom,'findByPk',async()=>({user_id:'owner',total_cost:200}));
 t.mock.method(UserSchedule,'findOne',async()=>null);
 await assert.rejects(()=>F.resolve('itinerary','private-1','visitor'),e=>e.statusCode===404);
 const own=await F.resolve('itinerary','private-1','owner');assert.equal(own.name,'Private');
});
