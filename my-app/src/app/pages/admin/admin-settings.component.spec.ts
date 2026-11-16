import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { AdminSettingsComponent } from './admin-settings.component';

function createComponent(overrides: Record<string, any> = {}): any {
  const api = {
    getAdminSettingsCategories: vi.fn().mockResolvedValue({ categories: [{ id: 'food', name: 'Ăn uống', active: true, serviceCount: 2 }] }),
    getAdminBookingSettings: vi.fn().mockResolvedValue({ settings: { version: 1 }, addons: [] }),
    getAdminSettingsAudit: vi.fn().mockResolvedValue({ data: [] }),
    createAdminSettingsCategory: vi.fn().mockResolvedValue({}),
    updateAdminSettingsCategory: vi.fn().mockResolvedValue({}),
    archiveAdminSettingsCategory: vi.fn().mockResolvedValue({}),
    updateAdminBookingPricing: vi.fn().mockResolvedValue({ settings: { version: 2 } }),
    createAdminBookingAddon: vi.fn().mockResolvedValue({}),
    updateAdminBookingAddon: vi.fn().mockResolvedValue({})
  };
  const component = Object.create(AdminSettingsComponent.prototype) as any;
  Object.assign(component, {
    api,
    cdr: { markForCheck: vi.fn() },
    tab: 'categories', loadingCategories: true, loadingBooking: false, loadingAudit: false,
    categoriesLoaded: false, bookingLoaded: false, auditLoaded: false,
    categoryLoadError: '', bookingLoadError: '', auditLoadError: '',
    saving: false, error: '', message: '', categories: [], settings: {}, addons: [], audit: [],
    modalKind: 'category', modalId: '', editValues: {},
    ...overrides
  });
  return component;
}

describe('AdminSettingsComponent data loading', () => {
  it('loads only categories on entry and notifies Angular after async data arrives', async () => {
    const component = createComponent();

    await component.ngOnInit();

    expect(component.api.getAdminSettingsCategories).toHaveBeenCalledTimes(1);
    expect(component.api.getAdminBookingSettings).not.toHaveBeenCalled();
    expect(component.api.getAdminSettingsAudit).not.toHaveBeenCalled();
    expect(component.loadingCategories).toBe(false);
    expect(component.categoriesLoaded).toBe(true);
    expect(component.categories[0].id).toBe('food');
    expect(component.cdr.markForCheck).toHaveBeenCalled();
  });

  it('loads booking and audit data on demand once and reuses both caches across tab switches', async () => {
    const component = createComponent();
    await component.ngOnInit();

    await component.selectTab('booking');
    await component.selectTab('categories');
    await component.selectTab('booking');

    expect(component.api.getAdminBookingSettings).toHaveBeenCalledTimes(1);
    expect(component.api.getAdminSettingsAudit).toHaveBeenCalledTimes(1);
    expect(component.bookingLoaded).toBe(true);
    expect(component.auditLoaded).toBe(true);
  });

  it('ends category loading and exposes a retryable error when the request fails', async () => {
    const component = createComponent();
    component.api.getAdminSettingsCategories.mockRejectedValue({ error: { message: 'Category API unavailable' } });

    await component.ngOnInit();

    expect(component.loadingCategories).toBe(false);
    expect(component.categoryLoadError).toBe('Category API unavailable');
    expect(component.cdr.markForCheck).toHaveBeenCalled();
  });

  it('keeps booking and audit errors independent and always clears their own loading states', async () => {
    const component = createComponent();
    await component.ngOnInit();
    component.api.getAdminBookingSettings.mockRejectedValue({ error: { message: 'Booking API unavailable' } });
    component.api.getAdminSettingsAudit.mockRejectedValue({ error: { message: 'Audit API unavailable' } });

    await component.selectTab('booking');

    expect(component.loadingBooking).toBe(false);
    expect(component.loadingAudit).toBe(false);
    expect(component.bookingLoadError).toBe('Booking API unavailable');
    expect(component.auditLoadError).toBe('Audit API unavailable');
  });

  it('refreshes only changed category data after saving a category', async () => {
    const component = createComponent({ modalKind: 'category', modalId: '', auditLoaded: false });
    await component.ngOnInit();
    component.api.getAdminSettingsCategories.mockClear();

    await component.saveModal({ values: { name: 'Lưu trú' }, reason: 'Tạo danh mục' });

    expect(component.api.createAdminSettingsCategory).toHaveBeenCalledTimes(1);
    expect(component.api.getAdminSettingsCategories).toHaveBeenCalledTimes(1);
    expect(component.api.getAdminBookingSettings).not.toHaveBeenCalled();
    expect(component.api.getAdminSettingsAudit).not.toHaveBeenCalled();
  });

  it('uses the pricing update response without reloading category or booking data', async () => {
    const component = createComponent({ settings: { version: 1, reason: 'Adjust fee' }, auditLoaded: false });
    await component.ngOnInit();
    component.api.getAdminSettingsCategories.mockClear();

    await component.savePricing({ invalid: false });

    expect(component.api.updateAdminBookingPricing).toHaveBeenCalledTimes(1);
    expect(component.api.getAdminSettingsCategories).not.toHaveBeenCalled();
    expect(component.api.getAdminBookingSettings).not.toHaveBeenCalled();
    expect(component.settings.version).toBe(2);
  });
});
