const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tripStops, validateStops, selectStops } = require('../src/transport/stops');
const { validate } = require('../src/transport/models');
const departure = new Date('2030-01-01T06:00:00+07:00'), arrival = new Date(+departure+55*60000);
const legacy = { _id:'trip-a', departure_time: departure, arrival_time: arrival, pickup_point:'Đà Nẵng', dropoff_point:'Hội An' };
const stops = [0,10,30,55].map((m,i) => ({ id:`a-${i}`, order:i, name:`Stop ${i}`, address:'Address', estimated_time:new Date(+departure+m*60000), allow_pickup:i<3, allow_dropoff:i>0 }));
test('legacy endpoints are stable, defaultable and isolated between trips', () => {
 const pair = selectStops(legacy);
 assert.equal(pair.pickup.name,'Đà Nẵng'); assert.equal(pair.dropoff.name,'Hội An');
 assert.deepEqual(tripStops(legacy), tripStops(legacy));
 assert.throws(() => selectStops(legacy,'trip-b-start','trip-b-end'));
 assert.throws(() => selectStops(legacy,'trip-a-start'));
});
test('intermediate selection validates route membership, direction, permissions and explicit IDs', () => {
 const trip = {...legacy,stops};
 const pair = selectStops(trip,'a-1','a-3');
 assert.equal((pair.dropoff.estimated_time-pair.pickup.estimated_time)/60000,45);
 assert.throws(()=>selectStops(trip,'a-2','a-1'));
 assert.throws(()=>selectStops(trip,'a-1','a-1'));
 assert.throws(()=>selectStops(trip,'other-trip','a-3'));
 assert.throws(()=>selectStops(trip));
 assert.throws(()=>selectStops({...trip,stops:stops.map((s,i)=>({...s,allow_dropoff:i===2?false:s.allow_dropoff}))},'a-1','a-2'));
});
test('stop validation rejects duplicate IDs/orders, invalid dates, permissions and out-of-range times', () => {
 assert.equal(validateStops([...stops].reverse(),departure,arrival)[0].id,'a-0');
 for (const change of [{id:'a-0'},{order:0},{estimated_time:'garbage'},{estimated_time:new Date(+arrival+60000)},{estimated_time:departure},{allow_pickup:'yes'},{name:{$ne:null}}]) {
  assert.throws(()=>validateStops(stops.map((s,i)=>i===1?{...s,...change}:s),departure,arrival));
 }
 assert.throws(()=>validateStops([],departure,arrival));
 assert.throws(()=>validateStops(stops.map(s=>({...s,allow_dropoff:false})),departure,arrival));
});
test('vehicle admin validation accepts bounded base64 images and rejects executable/oversized images', () => {
 assert.deepEqual(validate('vehicles',{images:['data:image/jpeg;base64,/9j/']},true).images,['data:image/jpeg;base64,/9j/']);
 assert.throws(()=>validate('vehicles',{images:['javascript:alert(1)']},true));
 assert.throws(()=>validate('vehicles',{images:['data:image/svg+xml;base64,PHN2Zz4=']},true));
 assert.throws(()=>validate('vehicles',{images:Array(7).fill('/image/test.jpg')},true));
});
