import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { PromotionsComponent } from './promotions';

function component() {
  const c = new PromotionsComponent({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  c.now = Date.parse('2026-11-12T12:00:00Z');
  return c;
}
function offer(c: PromotionsComponent, overrides = {}) {
  return { id: 'flash-1', type: 'flash_sale', name: 'Sale', discount_type: 'percent', discount_value: 20,
    usage_limit: 10, used_count: 2, start_at: new Date(c.now - 1000).toISOString(),
    end_at: new Date(c.now + (86400 + 2 * 3600 + 3 * 60 + 4) * 1000).toISOString(),
    service: { id: 'bike', name: 'Thuê xe đạp', cost: 50000, type: 'transport' },
    category: 'transport', ...overrides } as any;
}
describe('Flash Sale display', () => {
  it('saves a coupon once and requests login for anonymous visitors', async () => {
    const api = { claimPromotion: vi.fn().mockResolvedValue({ success: true }) };
    const login = { open: vi.fn() };
    const auth = { getCurrentUser: vi.fn().mockReturnValue(null) };
    const c = new PromotionsComponent({} as any, {} as any, {} as any, { detectChanges: vi.fn() } as any, auth as any, api as any, login as any);
    c.loadOffers = vi.fn().mockResolvedValue(undefined);
    const coupon = offer(c, { type: 'voucher', campaign_id: 'campaign-1', code: 'WELCOME' });
    await c.claimOffer(coupon, { stopPropagation() {} } as Event);
    expect(login.open).toHaveBeenCalledOnce();
    expect(api.claimPromotion).not.toHaveBeenCalled();
    auth.getCurrentUser.mockReturnValue({ id: 'user-1' } as any);
    await c.claimOffer(coupon, { stopPropagation() {} } as Event);
    await c.claimOffer(coupon, { stopPropagation() {} } as Event);
    expect(api.claimPromotion).toHaveBeenCalledExactlyOnceWith('campaign-1');
    expect(c.savedCampaigns.has('campaign-1')).toBe(true);
    expect(c.claimSuccess).toContain('WELCOME');
  });
  it('counts down to the nearest expiry and removes expired offers', () => {
    const c = component();
    c.offers = [offer(c), offer(c, { id: 'expired', end_at: new Date(c.now).toISOString() })];
    c.applyFilters();
    expect(c.flashOffers.length).toBe(1);
    expect(c.flashCountdown.map(unit => unit.value)).toEqual(['01', '02', '03', '04']);
    c.now += 2 * 86400000;
    c.applyFilters();
    expect(c.flashOffers).toEqual([]);
  });
  it('uses actual inventory and prioritizes low stock over sales labels', () => {
    const c = component();
    const sale = offer(c, { used_count: 6 });
    expect(c.remaining(sale)).toBe(4);
    expect(c.soldPercent(sale)).toBe(60);
    expect(c.flashStatus(sale)).toBe('Chỉ còn 4');
    expect(c.flashStatus(offer(c))).toBe('Ưu đãi hot');
    c.offers = [offer(c, { used_count: 10 })];
    c.applyFilters();
    expect(c.flashOffers).toEqual([]);
  });
  it('calculates percent and fixed discounts from persisted campaign values', () => {
    const c = component();
    expect((c as any).toOffer(offer(c)).salePrice).toBe(40000);
    const fixed = (c as any).toOffer(offer(c, { discount_type: 'fixed', discount_value: 15000 }));
    expect(fixed.salePrice).toBe(35000);
    expect(fixed.discountPercent).toBe(30);
  });
});
