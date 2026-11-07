const { test } = require('node:test');
const assert=require('node:assert/strict');
const { ObjectId }=require('mongodb');
const jwt=require('jsonwebtoken');
const M=require('../src/transport/models');
const { User }=require('../src/models');
const { JWT_SECRET }=require('../src/middlewares/auth.middleware');
const app=require('../src/app');
test('Transport MongoDB/API integration: search, concurrency, ownership, cancellation and admin', {skip:process.env.TRANSPORT_INTEGRATION!=='1',timeout:180000},async t=>{
 await M.init();const suffix=new ObjectId().toHexString(),ids={},users=[],server=app.listen(0);const base=`http://127.0.0.1:${server.address().port}/api/transport`;
 async function request(path,method='GET',body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 async function make(name,data){const _id=new ObjectId();(ids[name]??=[]).push(_id);await M.col(name).insertOne({_id,...data,createdAt:new Date(),updatedAt:new Date()});return _id;}
 try{
  for(const role of ['traveler','traveler','admin']){const id=`transport-check-${suffix}-${users.length}`;await User.create({id,username:id,email:`${id}@greensteps.invalid`,password_hash:'disabled-integration-account',role});users.push({id,token:jwt.sign({id,role},JWT_SECRET,{expiresIn:'10m'})});}
  const partner=await make('partners',{name:`Transport check ${suffix}`,status:'active',booking_mode:'internal',is_seed_data:true});
  const vehicle=await make('vehicles',{partner_id:partner,name:'Integration shuttle',vehicle_type:'minibus',transport_type:'shared',capacity:6,fuel_type:'electric',amenities:['USB'],images:['/image/services/transport_electric_car.png'],status:'active',is_seed_data:true});
  const route=await make('routes',{origin:`Origin ${suffix}`,destination:'Hội An',distance_km:30,estimated_duration:60,status:'active'});
  const departure=new Date(Date.now()+5*86400000),arrival=new Date(+departure+3600000);
  const trip=await make('trips',{partner_id:partner,vehicle_id:vehicle,route_id:route,transport_type:'shared',departure_time:departure,arrival_time:arrival,total_seats:6,available_seats:6,price_per_person:123000,currency:'VND',allocated_passengers:4,cancellation_hours:2,status:'active',is_seed_data:true});
  const rv=await make('vehicles',{partner_id:partner,name:'Integration rental',vehicle_type:'electric_car',transport_type:'rental',capacity:5,fuel_type:'electric',amenities:[],images:[],status:'active',is_seed_data:true});
  const rental=await make('rentals',{partner_id:partner,vehicle_id:rv,pickup_location:`Location ${suffix}`,price_per_hour:100000,price_per_day:700000,deposit:1000000,rental_conditions:'Internal request',cancellation_hours:2,status:'active',is_seed_data:true});
  await t.test('public filtering, sorting, detail IDs, emission compare and validation',async()=>{
   const q=`?origin=${encodeURIComponent('Origin '+suffix)}`;
   let r=await request('/trips'+q+'&type=shared&sortBy=co2');assert.equal(r.status,200);assert.equal(r.total,1);assert.equal(r.data[0]._id,String(trip));assert.equal(r.data[0].partner.email,undefined);assert.ok(r.data[0].sustainability.co2e_per_person>0);
   assert.equal((await request('/trips'+q+'&type=bus')).total,0);assert.equal((await request('/trips'+q+'&maxPrice=100')).total,0);assert.equal((await request('/trips'+q+'&minSeats=7')).total,0);
   assert.equal((await request('/trips/'+trip)).data._id,String(trip));assert.equal((await request('/trips/invalid')).status,400);assert.equal((await request('/trips/'+new ObjectId())).status,404);
   assert.equal((await request('/trips?passengers=1.5')).status,400);assert.equal((await request('/trips?departurePeriod=invalid')).status,400);
   const e=await request('/emissions/compare?tripId='+trip);assert.equal(e.data.co2e_per_person,.615);
   const rent=await request(`/emissions/compare?rentalId=${rental}&distanceKm=30`);assert.equal(rent.data.estimated_co2e,2.46);assert.equal(rent.data.reduction_percent,undefined);
  });
  let booking;
  await t.test('authentication, no oversell under concurrent requests, server price',async()=>{
   assert.equal((await request('/bookings','POST',{trip_id:String(trip)})).status,401);
   assert.equal((await request('/bookings','POST',{trip_id:String(trip),passenger_count:7},users[0].token)).status,409);
   const results=await Promise.all(Array.from({length:9},()=>request('/bookings','POST',{trip_id:String(trip),passenger_count:1,total_price:1},users[0].token)));
   const ok=results.filter(x=>x.status===200);assert.equal(ok.length,6,JSON.stringify(results));assert.equal(results.filter(x=>x.status===409).length,3);assert.equal((await M.col('trips').findOne({_id:trip})).available_seats,0);
   booking=ok[0].data;assert.equal(booking.total_price,123000);assert.equal(booking.payment_status,'UNPAID');assert.equal(booking.user_id,users[0].id);
  });
  await t.test('ownership, account listing, idempotent cancellation, valid admin transitions',async()=>{
   assert.equal((await request('/bookings/'+booking._id,'GET',null,users[1].token)).status,404);
   const mine=await request('/bookings/me','GET',null,users[0].token);assert.equal(mine.total,6);assert.ok(mine.data[0].partner.name);
   assert.equal((await request('/admin/trips','GET',null,users[0].token)).status,403);
   assert.equal((await request('/admin/bookings/'+booking._id,'PATCH',{booking_status:'CONFIRMED'},users[2].token)).status,200);
   assert.equal((await request('/admin/bookings/'+booking._id,'PATCH',{booking_status:'COMPLETED'},users[2].token)).status,409);
   const cancelled=await Promise.all([request('/bookings/'+booking._id+'/cancel','POST',{},users[0].token),request('/bookings/'+booking._id+'/cancel','POST',{},users[0].token)]);assert.ok(cancelled.every(x=>x.status===200));assert.equal((await M.col('trips').findOne({_id:trip})).available_seats,1);
   assert.equal((await request('/admin/bookings/'+booking._id,'PATCH',{booking_status:'CONFIRMED'},users[2].token)).status,409);
  });
  await t.test('rental overlap exclusion, adjacency, price quote, cancellation',async()=>{
   const start=new Date(Date.now()+86400000),end=new Date(+start+25*3600000),body={rental_id:String(rental),rental_start:start.toISOString(),rental_end:end.toISOString()};
   const results=await Promise.all([request('/bookings','POST',body,users[0].token),request('/bookings','POST',body,users[1].token)]);
   assert.equal(results.filter(x=>x.status===200).length,1,JSON.stringify(results));assert.equal(results.filter(x=>x.status===409).length,1);
   const success=results.find(x=>x.status===200).data;assert.equal(success.total_price,800000);
   const q=`?location=${encodeURIComponent('Location '+suffix)}&pickupDate=${encodeURIComponent(body.rental_start)}&returnDate=${encodeURIComponent(body.rental_end)}`;
   assert.equal((await request('/rentals'+q)).total,0);
   const adjacent=await request('/bookings','POST',{rental_id:String(rental),rental_start:end.toISOString(),rental_end:new Date(+end+3600000).toISOString()},users[0].token);assert.equal(adjacent.status,200);
   assert.equal((await request('/admin/bookings/'+success._id,'PATCH',{booking_status:'CANCELLED'},users[2].token)).status,200);
   assert.equal((await request('/rentals'+q)).total,1);
   const quote=await request(`/rentals/${rental}?pickupDate=${encodeURIComponent(body.rental_start)}&returnDate=${encodeURIComponent(body.rental_end)}`);assert.equal(quote.data.quote.total_price,800000);
  });
  await t.test('checkout confirms without admin, is owned/idempotent and cannot debit real money',async()=>{
   const future = new Date(Date.now()+6*86400000);
   const checkoutTrip=await make('trips',{partner_id:partner,vehicle_id:vehicle,route_id:route,transport_type:'shared',departure_time:future,arrival_time:new Date(+future+3600000),total_seats:6,available_seats:6,price_per_person:200000,currency:'VND',allocated_passengers:4,cancellation_hours:2,status:'active',is_seed_data:true});
   const created=await request('/bookings','POST',{trip_id:String(checkoutTrip),passenger_count:2},users[0].token);
   const paymentPath=`/bookings/${created.data._id}/payment`,body={payment_method:'wallet',accepted_terms:true,total_price:1};
   assert.equal((await request(paymentPath,'POST',body)).status,401);
   assert.equal((await request(paymentPath,'POST',body,users[1].token)).status,404);
   assert.equal((await request(paymentPath,'POST',{...body,accepted_terms:false},users[0].token)).status,400);
   assert.equal((await request(paymentPath,'POST',{...body,payment_method:'external'},users[0].token)).status,400);
   const walletCollection=M.store.models.Wallet.collection;
   const walletBefore=await walletCollection.findOne({user_id:users[0].id});
   const paid=await Promise.all([request(paymentPath,'POST',body,users[0].token),request(paymentPath,'POST',body,users[0].token)]);
   assert.ok(paid.every(r=>r.status===200),JSON.stringify(paid));
   assert.equal(paid[0].data.payment_reference,paid[1].data.payment_reference);
   assert.equal(paid[0].data.payment_amount,400000);assert.equal(paid[0].data.booking_status,'CONFIRMED');
   assert.equal(paid[0].data.payment_status,'SIMULATED_PAID');assert.equal(paid[0].data.payment_mode,'internal');
   assert.equal(paid[0].data.can_pay,false);
   assert.deepEqual(await walletCollection.findOne({user_id:users[0].id}),walletBefore);
   assert.equal((await M.col('trips').findOne({_id:checkoutTrip})).available_seats,4);
   const cancelled=await request(`/bookings/${created.data._id}/cancel`,'POST',{},users[0].token);
   assert.equal(cancelled.data.payment_status,'SIMULATED_REFUNDED');
   assert.equal((await request(paymentPath,'POST',body,users[0].token)).status,409);
   assert.equal((await M.col('trips').findOne({_id:checkoutTrip})).available_seats,6);
   const old=await request('/bookings','POST',{trip_id:String(checkoutTrip),passenger_count:1},users[0].token);
   await M.col('bookings').updateOne({_id:new ObjectId(old.data._id)},{$set:{payment_status:'NOT_REQUIRED'}});
   assert.equal((await request(`/bookings/${old.data._id}/payment`,'POST',{payment_method:'bank',accepted_terms:true},users[0].token)).status,200);
  });
  await t.test('admin CRUD persists and affects public availability',async()=>{
   const a=users[2].token;
   const p=await request('/admin/partners','POST',{name:`CRUD ${suffix}`,status:'active',booking_mode:'internal',is_seed_data:true},a);assert.equal(p.status,200);ids.partners.push(new ObjectId(p.data._id));
   assert.equal((await request('/admin/partners/'+p.data._id,'PATCH',{name:'Updated transport partner'},a)).data.name,'Updated transport partner');
   assert.equal((await request('/admin/partners/'+p.data._id,'DELETE',{},a)).data.status,'deleted');
   assert.equal((await request('/admin/trips/'+trip,'PATCH',{status:'suspended'},a)).status,200);assert.equal((await request('/trips/'+trip)).status,404);
   assert.equal((await request('/admin/trips/'+trip,'PATCH',{available_seats:6},a)).status,409);
  });
  await t.test('multi-stop booking validates IDs, persists authoritative snapshots and keeps full-trip pricing',async()=>{
   const start=new Date(Date.now()+7*86400000),end=new Date(+start+55*60000);
   const stops=[0,10,30,55].map((m,i)=>({id:`stop-${suffix}-${i}`,order:i,name:['Đà Nẵng','Cầu Rồng','Ngũ Hành Sơn','Hội An'][i],address:`Địa chỉ ${i}`,estimated_time:new Date(+start+m*60000),allow_pickup:i<3,allow_dropoff:i>0}));
   const multi=await make('trips',{partner_id:partner,vehicle_id:vehicle,route_id:route,transport_type:'shared',departure_time:start,arrival_time:end,total_seats:6,available_seats:6,price_per_person:70000,currency:'VND',allocated_passengers:4,cancellation_hours:2,status:'active',is_seed_data:true,stops});
   const body={trip_id:String(multi),passenger_count:2,pickup_stop_id:stops[1].id,dropoff_stop_id:stops[3].id,total_price:1,pickup_stop:{name:'Tampered'}};
   for(const bad of [{pickup_stop_id:'other-trip'},{dropoff_stop_id:stops[0].id},{dropoff_stop_id:stops[1].id},{pickup_stop_id:stops[3].id},{pickup_stop_id:null},{dropoff_stop_id:null}]){
    assert.equal((await request('/bookings','POST',{...body,...bad},users[0].token)).status,400);
   }
   assert.equal((await M.col('trips').findOne({_id:multi})).available_seats,6,'Invalid pairs must not reserve seats');
   const created=await request('/bookings','POST',body,users[0].token);assert.equal(created.status,200,JSON.stringify(created));
   assert.equal(created.data.total_price,140000);assert.equal(created.data.pickup_stop.name,'Cầu Rồng');
   assert.equal(created.data.pickup_stop_id,stops[1].id);assert.equal(created.data.dropoff_stop_id,stops[3].id);
   assert.equal(+new Date(created.data.service_end)-+new Date(created.data.service_start),45*60000);
   const saved=await request('/bookings/'+created.data._id,'GET',null,users[0].token);
   assert.equal(saved.data.dropoff_stop.address,'Địa chỉ 3');assert.equal(saved.data.pickup_stop.estimated_time,stops[1].estimated_time.toISOString());
   assert.equal((await request('/admin/trips/'+multi,'PATCH',{stops:stops.map(s=>({...s,name:s.name+' changed'}))},users[2].token)).status,409,'Held route cannot change');
   const paid=await request('/bookings/'+created.data._id+'/payment','POST',{payment_method:'bank',accepted_terms:true},users[0].token);
   assert.equal(paid.status,200);assert.equal(paid.data.pickup_stop.name,'Cầu Rồng');
   await request('/bookings/'+created.data._id+'/cancel','POST',{},users[0].token);
   assert.equal((await M.col('trips').findOne({_id:multi})).available_seats,6);
  });
  await t.test('listing paginates large Atlas base64 galleries without sorting the image payload',async()=>{
   const images=Array.from({length:4},()=>`data:image/jpeg;base64,${'A'.repeat(260000)}`);
   const largeVehicle=await make('vehicles',{partner_id:partner,name:'Large gallery regression',vehicle_type:'minibus',transport_type:'shared',capacity:6,fuel_type:'electric',amenities:[],images,status:'active',is_seed_data:true});
   const departure=new Date(Date.now()+8*86400000);
   const rows=Array.from({length:40},(_,i)=>({_id:new ObjectId(),partner_id:partner,vehicle_id:largeVehicle,route_id:route,transport_type:'shared',departure_time:new Date(+departure+i*60000),arrival_time:new Date(+departure+(i+60)*60000),total_seats:6,available_seats:6,price_per_person:234567,currency:'VND',allocated_passengers:4,cancellation_hours:2,status:'active',is_seed_data:true}));
   ids.trips.push(...rows.map(r=>r._id));await M.col('trips').insertMany(rows);
   const query='?type=shared&minPrice=234567&maxPrice=234567&sortBy=departure&limit=12';
   const first=await request('/trips'+query);assert.equal(first.status,200,JSON.stringify({status:first.status,message:first.message}));assert.equal(first.total,40);assert.equal(first.data.length,12);
   assert.ok(first.data.every(t=>t.vehicle.images.length===1&&t.vehicle.images[0]===images[0]));
   const second=await request('/trips'+query+'&page=2');assert.equal(second.status,200);assert.equal(second.total,40);assert.equal(second.data.length,12);
   assert.ok(second.data.every(t=>!first.data.some(p=>p._id===t._id)));
   const detail=await request('/trips/'+rows[0]._id);assert.equal(detail.status,200);assert.equal(detail.data.vehicle.images.length,4);
  });
 }finally{
  // Remove only records created in this test; never clear collections or touch seed/user data.
  await M.col('bookings').deleteMany({user_id:{$in:users.map(x=>x.id)}});
  for(const [name,list] of Object.entries(ids))await M.col(name).deleteMany({_id:{$in:list}});
  for(const u of users)await User.collection.deleteOne({id:u.id});
  await new Promise(resolve=>server.close(resolve));await M.store.close();
 }
});
