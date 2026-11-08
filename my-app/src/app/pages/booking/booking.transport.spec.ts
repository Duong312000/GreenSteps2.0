import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { convertToParamMap, NavigationEnd } from '@angular/router';
import { BookingComponent } from './booking';

describe('Transport in the existing service checkout', () => {
  beforeEach(() => vi.stubGlobal('window', { location: { hostname: 'localhost' } }));
  afterEach(() => vi.unstubAllGlobals());
  function create(transport = true, paid = false) {
    const params = convertToParamMap(transport ? { transportBookingId: '0123456789abcdef01234567' } : {});
    const route = { snapshot: { queryParamMap: params }, queryParamMap: new BehaviorSubject(params) };
    const events = new Subject<any>();
    const router = { url: '/transport/trips/123', events, navigate: vi.fn().mockResolvedValue(true) };
    const legacyApi = { createBooking: vi.fn(), getBooking: vi.fn(), getWalletInfo: vi.fn() };
    const user = { id: 'user-1', fullname: 'Nguyen Van A', email: 'a@example.invalid' };
    const auth = { currentUser$: new BehaviorSubject(user), getCurrentUser: () => user };
    const booking = { _id:'0123456789abcdef01234567', booking_code:'GS-T-123', total_price:250000, passenger_count:2,
      booking_type:'shared', booking_status:paid ? 'CONFIRMED':'PENDING', payment_status:paid ? 'SIMULATED_PAID':'UNPAID',
      payment_amount:paid ? 250000:undefined, can_pay:!paid, is_seed_data:true, service_start:'2030-01-01T06:00:00+07:00',
      service_end:'2030-01-01T07:00:00+07:00', vehicle:{name:'Xe chia sẻ 9 chỗ',images:['/vehicle.jpg']},
      partner:{name:'Lá Mây'}, trip:{pickup_point:'Đà Nẵng',dropoff_point:'Hội An'}, notice:'Không trừ tiền thật.' };
    const api = { request:vi.fn().mockResolvedValue({data:booking}), message:()=> 'Không tải được đơn' };
    const c = new BookingComponent(route as any, router as any, legacyApi as any, auth as any,
      {open:vi.fn()} as any, {markForCheck:vi.fn(),detectChanges:vi.fn()} as any, {} as any, api as any);
    return {c,router,events,api,legacyApi,booking};
  }
  it('loads server fare and handles NavigationEnd into the existing payment step', async () => {
    const {c,router,events,api,legacyApi}=create();
    await c.ngOnInit();
    router.url='/booking/payment?transportBookingId=0123456789abcdef01234567';
    events.next(new NavigationEnd(1,router.url,router.url));
    await vi.waitFor(()=>expect(c.isPageLoading).toBe(false));
    expect(c.isPaymentStep).toBe(true);
    expect(api.request).toHaveBeenCalledWith('GET','/bookings/0123456789abcdef01234567');
    expect(c.totalAmount).toBe(250000);expect(c.depositAmount).toBe(250000);
    expect(c.serviceFee).toBe(0);expect(c.discountAmount).toBe(0);
    expect(c.hotelName).toBe('Xe chia sẻ 9 chỗ');expect(legacyApi.getBooking).not.toHaveBeenCalled();
    expect(c.checkoutPaymentMethods.some(method => method.id === 'momo')).toBe(false);
    c.ngOnDestroy();
  });
  it('requires consent and settles without invoking legacy real payment APIs', async () => {
    const {c,api,router,legacyApi}=create();await c.ngOnInit();
    await vi.waitFor(()=>expect(c.isPageLoading).toBe(false));
    await c.completeDeposit();expect(api.request).toHaveBeenCalledTimes(1);
    c.acceptedTerms=true;c.paymentMethod='card';await c.completeDeposit();
    expect(api.request).toHaveBeenLastCalledWith('POST','/bookings/0123456789abcdef01234567/payment',{
      payment_method:'card',accepted_terms:true
    });
    expect(router.navigate).toHaveBeenCalledWith(['/booking/confirm'],{queryParams:{transportBookingId:c.currentBookingId}});
    expect(legacyApi.createBooking).not.toHaveBeenCalled();expect(legacyApi.getWalletInfo).not.toHaveBeenCalled();
    c.ngOnDestroy();
  });
  it('restores a settled booking without creating another reservation', async () => {
    const {c,api}=create(true,true);await c.ngOnInit();
    await vi.waitFor(()=>expect(c.isPageLoading).toBe(false));
    expect(c.confirmationIsPaid).toBe(true);expect(c.confirmationTotal).toBe(250000);
    expect(c.confirmationTitle).toBe('Đã hoàn tất thanh toán nội bộ');
    expect(api.request).toHaveBeenCalledTimes(1);c.ngOnDestroy();
  });
  it('preserves the existing tour pricing path', () => {
    const {c}=create(false);c.activeTour={cost:1000000} as any;c.bookingContext.guestCount=2;
    expect(c.basePrice).toBe(2000000);expect(c.discountAmount).toBe(160000);
    expect(c.serviceFee).toBe(120000);expect(c.depositAmount).toBe(588000);
    expect(c.checkoutPaymentMethods.some(method => method.id === 'momo')).toBe(true);
  });
});
