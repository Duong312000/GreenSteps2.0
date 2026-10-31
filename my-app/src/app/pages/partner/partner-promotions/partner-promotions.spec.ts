import { describe, it, expect, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import '@angular/compiler';
import { AuthService } from '../../../services/auth.service';
import { PartnerPromotionsService } from '../../../services/partner-promotions.service';
import { PartnerPromotionsComponent } from './partner-promotions';

function create() {
  const api = { list: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
  const component = new PartnerPromotionsComponent(
    api as unknown as PartnerPromotionsService,
    {} as AuthService,
    { detectChanges: vi.fn() } as unknown as ChangeDetectorRef,
  );
  component.packages = { featured: 150000 };
  component.form = {
    name: 'Green weekend',
    type: 'voucher',
    code: 'GREEN10',
    service_id: '',
    start_at: new Date(Date.now() + 600000).toISOString(),
    end_at: new Date(Date.now() + 86400000).toISOString(),
    discount_type: 'percent',
    discount_value: 10,
    min_order: 0,
    usage_limit: 10,
  };
  return { component, api };
}

describe('PartnerPromotions', () => {
  it('validates voucher dates, discounts, codes and integer usage limits', () => {
    const { component: c } = create();
    expect(c.formError).toBe('');
    c.form.discount_value = 101;
    expect(c.formError).toContain('100%');
    c.form.discount_value = 10;
    c.form.code = 'BAD CODE';
    expect(c.formError).toContain('Mã cần');
    c.form.code = 'GREEN10';
    c.form.usage_limit = 1.5;
    expect(c.formError).toContain('số nguyên');
    c.form.usage_limit = 10;
    c.form.end_at = c.form.start_at;
    expect(c.formError).toContain('kết thúc');
  });
  it('requires an owned service and a sufficient per-day advertising budget', () => {
    const { component: c } = create();
    c.form.type = 'promotion';
    c.form.package = 'featured';
    c.form.budget = 1;
    expect(c.formError).toContain('dịch vụ');
    c.form.service_id = 'my-service';
    expect(c.formError).toContain('150.000');
    c.form.budget = 150000;
    expect(c.formError).toBe('');
  });
  it('ignores an older HTTP response when filters changed', async () => {
    const { component: c, api } = create();
    let resolveOld!: (data: any) => void;
    api.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const older = c.load();
    api.list.mockResolvedValueOnce({ items: [], total: 2 });
    await c.load();
    resolveOld({ items: [], total: 99 });
    await older;
    expect(c.total).toBe(2);
    expect(c.loading).toBe(false);
  });
  it('shows request errors and rejects invalid filter date ranges', async () => {
    const { component: c, api } = create();
    c.from = '2026-12-02';
    c.to = '2026-12-01';
    await c.load();
    expect(api.list).not.toHaveBeenCalled();
    expect(c.error).toContain('Ngày kết thúc');
    c.from = c.to = '';
    api.list.mockRejectedValueOnce({ error: { message: 'Session expired' } });
    await c.load();
    expect(c.error).toBe('Session expired');
    expect(c.items).toEqual([]);
  });
});
