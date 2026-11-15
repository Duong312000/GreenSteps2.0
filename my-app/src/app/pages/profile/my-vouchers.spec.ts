import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { MyVouchersComponent } from './my-vouchers';
describe('my saved coupons', () => {
  it('loads persisted coupons and separates available, used and expired codes', async () => {
    const vouchers = [{ id: 'a', status: 'active', remaining: 1 }, { id: 'b', status: 'used', remaining: 0 }, { id: 'c', status: 'expired', remaining: 0 }];
    const c = new MyVouchersComponent({ getSavedPromotions: vi.fn().mockResolvedValue(vouchers) } as any, { detectChanges: vi.fn() } as any);
    await c.load();
    expect(c.vouchers).toEqual(vouchers);
    c.filter = 'active';
    expect(c.filtered).toEqual([vouchers[0]]);
    c.filter = 'expired';
    expect(c.filtered).toEqual([vouchers[2]]);
  });
  it('shows an actionable failure instead of claiming an empty account', async () => {
    const c = new MyVouchersComponent({ getSavedPromotions: vi.fn().mockRejectedValue(new Error('offline')) } as any, { detectChanges: vi.fn() } as any);
    await c.load();
    expect(c.error).toContain('thử lại');
    expect(c.loading).toBe(false);
  });
});
