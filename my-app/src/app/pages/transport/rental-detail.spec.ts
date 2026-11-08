import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { RentalDetailComponent } from './rental-detail';

function fixture(){
 const api={request:vi.fn(),message:()=> 'Không thể tính giá'};
 const c=new RentalDetailComponent(api as any,{markForCheck:vi.fn()} as any);
 c.pickupDate='2040-01-01';c.returnDate='2040-01-02';c.pickupTime='08:00';c.returnTime='09:00';
 c.detail={_id:'rental-1',available:true,deposit:300000,vehicle:{fuel_type:'electric'},quote:null};
 return {c,api};
}
function quote(c:RentalDetailComponent){return {rental_start:c.dates.pickupDate,rental_end:c.dates.returnDate,total_price:800000,deposit:300000};}
describe('Rental detail checkout',()=>{
 it('requires server availability, a matching quote and consent, then submits the exact quoted interval',async()=>{
  const {c,api}=fixture();const emit=vi.fn();c.continueBooking.subscribe(emit);
  c.submit();expect(emit).not.toHaveBeenCalled();
  api.request.mockResolvedValue({data:{...c.detail,quote:quote(c)}});await c.quote();
  expect(api.request).toHaveBeenCalledWith('GET','/rentals/rental-1',undefined,c.dates);
  expect(c.hours).toBe(25);expect(c.canContinue).toBe(false);
  c.agreed=true;c.submit();expect(emit).toHaveBeenCalledWith({rental_start:c.dates.pickupDate,rental_end:c.dates.returnDate,accepted_terms:true});
 });
 it('clears consent and quote after date edits and rejects a stale quote even without a change event',()=>{
  const {c}=fixture();c.detail.quote=quote(c);c.agreed=true;expect(c.canContinue).toBe(true);
  c.returnTime='10:00';expect(c.canContinue).toBe(false);
  c.dateChanged();expect(c.detail.quote).toBeNull();expect(c.agreed).toBe(false);
 });
 it('does not allow a conflicting rental or a failed recheck to reuse an old quote',async()=>{
  const {c,api}=fixture();api.request.mockResolvedValue({data:{...c.detail,available:false,quote:quote(c)}});
  await c.quote();c.agreed=true;expect(c.canContinue).toBe(false);
  api.request.mockRejectedValue(new Error('network'));await c.quote();expect(c.currentQuote).toBeFalsy();expect(c.error).toBe('Không thể tính giá');
 });
 it('ignores a quote response if dates change while the request is running',async()=>{
  const {c,api}=fixture();let resolve!:(value:any)=>void;
  api.request.mockImplementation(()=>new Promise(r=>resolve=r));const payload={...c.detail,quote:quote(c)};
  const pending=c.quote();c.returnDate='2040-01-03';c.dateChanged();resolve({data:payload});await pending;
  expect(c.detail.quote).toBeNull();expect(c.quoting).toBe(false);expect(c.canContinue).toBe(false);
 });
 it('rejects reversed, past or over-90-day ranges before requesting a quote',async()=>{
  const {c,api}=fixture();
  for(const [start,end] of [['2040-01-02','2040-01-01'],['2020-01-01','2020-01-02'],['2040-01-01','2040-05-01']]){
   c.pickupDate=start;c.returnDate=end;expect(c.validDates).toBe(false);await c.quote();
  }
  expect(api.request).not.toHaveBeenCalled();
 });
});
