import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { BusTripDetailComponent } from './bus-trip-detail';
const start = Date.parse('2030-01-01T06:00:00+07:00');
function fixture(legacy = false) {
 const c = new BusTripDetailComponent();
 c.trip = { _id:'trip-a',route:{origin:'Đà Nẵng',destination:'Hội An'},pickup_point:'Đà Nẵng',dropoff_point:'Hội An',departure_time:new Date(start).toISOString(),arrival_time:new Date(start+55*60000).toISOString(),available:true,available_seats:4,vehicle:{images:['/bus.jpg']},stops:legacy?undefined:[0,10,30,55].map((m,i)=>({id:`a-${i}`,order:i,name:`Stop ${i}`,estimated_time:new Date(start+m*60000).toISOString(),allow_pickup:i<3,allow_dropoff:i>0})) };
 return c;
}
describe('Bus route selection',()=>{
 it('keeps a downstream dropoff and computes the selected duration',()=>{
  const c=fixture();c.pickupId='a-1';c.pickupChanged();
  expect(c.dropoffs.map(s=>s.id)).toEqual(['a-2','a-3']);expect(c.dropoffId).toBe('a-3');expect(c.minutes).toBe(45);
  expect(c.segmentSelected(0)).toBe(false);expect(c.segmentSelected(1)).toBe(true);
 });
 it('clears an invalid dropoff and revokes consent when pickup changes',()=>{
  const c=fixture();c.dropoffId='a-2';c.agreed=true;c.pickupId='a-2';c.pickupChanged();
  expect(c.dropoffId).toBe('');expect(c.agreed).toBe(false);expect(c.validPair).toBe(false);expect(c.canContinue).toBe(false);
 });
 it('defaults older trips to their two endpoints, with a full-width single image',()=>{
  const c=fixture(true);expect(c.stops.length).toBe(2);expect(c.validPair).toBe(true);expect(c.minutes).toBe(55);expect(c.images).toEqual(['/bus.jpg']);
 });
 it('requires valid integer seats, available service and terms before emitting authoritative IDs',()=>{
  const c=fixture();const events:any[]=[];c.continueBooking.subscribe(e=>events.push(e));
  c.submit();expect(events).toHaveLength(0);c.agreed=true;
  for(const invalid of [0,1.5,5,NaN]){c.seats=invalid;c.submit();}expect(events).toHaveLength(0);
  c.seats=2;c.submit();expect(events).toEqual([{pickup_stop_id:'a-0',dropoff_stop_id:'a-3',passenger_count:2,accepted_terms:true}]);
  c.detail.available=false;expect(c.canContinue).toBe(false);
 });
});
