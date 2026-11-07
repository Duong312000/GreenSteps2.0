const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emissions,rentalPrice,integer,id,validate } = require('../src/transport/models');
test('emissions use consistent scope, allocation, non-zero electricity',()=>{
 const f={vehicle_kg_per_km:0.082,baseline_kg_per_km:0.192,scope:'operating energy',source:'internal parameters'};
 const s=emissions(30,f,4);
 assert.equal(s.co2e_per_person,.615);assert.equal(s.baseline_co2e,5.76);assert.equal(s.reduction_kg,5.145);assert.equal(s.reduction_percent,89.3);
 assert.equal(s.scope,f.scope);assert.ok(emissions(30,f,1).co2e_per_person>0);assert.equal(emissions(30,null,1),null);
});
test('rental billing rounds hours, caps partial day, separates deposit',()=>{
 const r={price_per_hour:100,price_per_day:700,deposit:2000},start=new Date('2030-01-01T00:00:00Z');
 const price=hours=>rentalPrice(r,start,new Date(+start+hours*3600000));
 assert.equal(price(.2),100);assert.equal(price(7),700);assert.equal(price(8),700);assert.equal(price(24),700);assert.equal(price(25),800);assert.equal(price(48),1400);assert.throws(()=>price(0));
});
test('validation rejects malformed IDs, passengers, enums and negative prices',()=>{
 assert.throws(()=>id('not-an-id'));assert.throws(()=>integer(1.5,1));assert.throws(()=>integer(0,1));assert.throws(()=>validate('trips',{price_per_person:-1},true));assert.throws(()=>validate('vehicles',{transport_type:'flight'},true));assert.throws(()=>validate('vehicles',{capacity:1.5},true));assert.throws(()=>validate('partners',{name:{$ne:null}},true));
 assert.deepEqual(validate('partners',{name:'Lá Mây',unexpected:'ignored'},true),{name:'Lá Mây'});
});
