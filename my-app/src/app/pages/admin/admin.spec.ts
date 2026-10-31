import { describe, expect, it, vi } from 'vitest';
import { AdminComponent } from './admin';

describe('AdminComponent dashboard interactions', () => {
  it('changes the selected section when a sidebar item is chosen', () => {
    const component = Object.create(AdminComponent.prototype) as any;
    component.activeSection = 'overview';
    component.navigationItems = [{ id: 'bookings', tab: 'bookings' }];
    component.setActiveTab = (tab: string) => { component.activeTab = tab; };

    component.setSection('bookings');

    expect(component.activeSection).toBe('bookings');
    expect(component.activeTab).toBe('bookings');
  });

  it('does not send approval requests while illustrative preview is active', async () => {
    const component = Object.create(AdminComponent.prototype) as any;
    const approveProvider = vi.fn();
    component.isPreviewMode = true;
    component.apiService = { approveProvider };
    component.showConfirm = (_message: string, onConfirm: () => void) => onConfirm();
    component.showAlert = vi.fn();
    component.loadProviders = vi.fn();

    await component.approveProvider('user-1');

    expect(approveProvider).not.toHaveBeenCalled();
  });

  it('keeps unavailable KPI values unknown and uses a pending tone for approvals', () => {
    const component = Object.create(AdminComponent.prototype) as any;
    component.queueState = { providers: 'unavailable', deposits: 'unavailable', withdrawals: 'unavailable', wallets: 'unavailable', bookings: 'unavailable' };

    const metrics = component.metrics;
    const providers = metrics.find((metric: any) => metric.label === 'Nhà cung cấp chờ duyệt');
    const activeUsers = metrics.find((metric: any) => metric.label === 'Người dùng đang hoạt động');

    expect(providers).toMatchObject({ value: '—', note: 'Không tải được dữ liệu', tone: 'amber' });
    expect(activeUsers.value).toBe('—');
  });

});
