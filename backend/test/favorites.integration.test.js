const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
const {store,User,Favorite,GreenService,Schedule,ScheduleSample,ScheduleCustom,UserSchedule}=require('../src/models');
const F=require('../src/services/favorites.service');
const {JWT_SECRET}=require('../src/middlewares/auth.middleware');
const app=require('../src/app');
test('MongoDB Favorites API persists, isolates accounts, enforces itinerary rights and handles deleted targets',{skip:process.env.FAVORITES_INTEGRATION!=='1',timeout:180000},async()=>{
 await F.ensureSchema();const tag='fav-check-'+randomUUID(),users=[],fixtures=[];const server=app.listen(0);
 const base=`http://127.0.0.1:${server.address().port}/api/favorites`;
 async function request(path='',method='GET',body,user=users[0]){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 async function fixture(model,values){fixtures.push([model,values.id]);return model.create(values);}
 try{
  for(let i=0;i<2;i++){const id=tag+'-user-'+i;await User.create({id,username:id,email:id+'@greensteps.invalid',role:'traveler',password_hash:'disabled-favorites-test'});users.push({id,token:jwt.sign({id,role:'traveler'},JWT_SECRET,{expiresIn:'10m'})});}
  const service=await fixture(GreenService,{id:tag+'-service',name_service:'Favorite service',type:'stay',destination:'Da Nang',cost:200000,status:'active',current_data:{}});
  const tourId=tag+'-tour',itineraryId=tag+'-itinerary';
  await fixture(Schedule,{id:tourId,tour_name:'Favorite tour',destination:'Da Lat',days:2});await fixture(ScheduleSample,{id:tourId,cost:350000});
  await fixture(Schedule,{id:itineraryId,tour_name:'Favorite itinerary',destination:'Hoi An',days:3});await fixture(ScheduleCustom,{id:itineraryId,user_id:users[0].id,total_cost:600000});
  assert.equal((await request('','GET',null,null)).status,401);
  const servicePath='/service/'+service.id;
  const concurrent=await Promise.all(Array.from({length:5},()=>request(servicePath,'PUT',{name:'Forged',cost:1,user_id:users[1].id})));
  assert.ok(concurrent.every(r=>r.status===200),JSON.stringify(concurrent));assert.equal(await Favorite.collection.countDocuments({user_id:users[0].id}),1);
  assert.equal(concurrent[0].data.name,'Favorite service');assert.equal(concurrent[0].data.price,200000);
  assert.equal((await request('','GET',null,users[1])).total,0);
  assert.equal((await request('/itinerary/'+itineraryId,'PUT',{},users[1])).status,404);
  assert.equal((await request('/itinerary/'+itineraryId,'PUT',{})).status,200);
  assert.equal((await request('/tour/'+tourId,'PUT',{})).status,200);
  const placeId='place:'+tag;assert.equal((await request('/place/'+encodeURIComponent(placeId),'PUT',{name:'Saved riverside',lat:15,lng:108})).status,200);
  let list=await request('?page=1&limit=2');assert.equal(list.total,4);assert.equal(list.data.length,2);
  assert.equal((await request('?type=tour')).total,1);assert.equal((await request('?limit=1000')).status,400);
  await request(servicePath,'DELETE',null,users[1]);assert.equal((await request('?type=service')).total,1);
  await GreenService.collection.updateOne({id:service.id},{$set:{status:'suspended'}});
  const unavailable=await request('?type=service');assert.equal(unavailable.data[0].available,false);assert.equal(unavailable.data[0].url,null);
  await request(servicePath,'DELETE');await request(servicePath,'DELETE');assert.equal((await request('')).total,3);
  assert.equal(await Favorite.collection.countDocuments({user_id:users[1].id}),0);
  console.log('Verified MongoDB persistence, concurrent idempotent add, account isolation, private itinerary access, filtering, pagination and unavailable/removal states.');
 }finally{
  await Favorite.collection.deleteMany({user_id:{$in:users.map(u=>u.id)}});
  await UserSchedule.collection.deleteMany({schedule_id:{$in:[tag+'-itinerary',tag+'-tour']}});
  for(const [model,id] of fixtures.reverse())await model.collection.deleteOne({id});
  for(const user of users)await User.collection.deleteOne({id:user.id});
  await new Promise(resolve=>server.close(resolve));await store.close();
 }
});
