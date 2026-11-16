import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { AdminComponent } from './admin';

function componentWith(activeSection = 'overview', activeTab = 'providers'): AdminComponent {
  const component = Object.create(AdminComponent.prototype) as any;
  Object.assign(component, {
    isPreviewMode: false,
    activeSection,
    activeTab,
    navigationItems: [
      { id: 'overview' },
      { id: 'providers', tab: 'providers' },
      { id: 'services', tab: 'services' }
    ],
    refreshing: false,
    destroyed: false,
    cdr: { detectChanges: vi.fn() },
    apiService: { getAdminDashboardSummary: vi.fn() },
    requestedQueues: new Set<string>()
  });
  return component;
}

describe('AdminComponent data loading', () => {
  it('loads only the two queues displayed on the overview', async () => {
    const component = componentWith() as any;
    component.loadProviders = vi.fn().mockResolvedValue(undefined);
    component.loadBookings = vi.fn().mockResolvedValue(undefined);
    component.loadDeposits = vi.fn().mockResolvedValue(undefined);
    component.loadWithdrawals = vi.fn().mockResolvedValue(undefined);
    component.loadWallets = vi.fn().mockResolvedValue(undefined);
    component.loadReports = vi.fn().mockResolvedValue(undefined);
    component.loadCatalog = vi.fn().mockResolvedValue(undefined);
    component.loadDashboardSummary = vi.fn().mockResolvedValue(undefined);

    await component.loadAllData();

    expect(component.loadProviders).toHaveBeenCalledTimes(1);
    expect(component.loadBookings).toHaveBeenCalledTimes(1);
    expect(component.loadDeposits).not.toHaveBeenCalled();
    expect(component.loadWithdrawals).not.toHaveBeenCalled();
    expect(component.loadWallets).not.toHaveBeenCalled();
    expect(component.loadReports).not.toHaveBeenCalled();
    expect(component.loadCatalog).not.toHaveBeenCalled();
    expect(component.loadDashboardSummary).toHaveBeenCalledTimes(1);
  });

  it('loads only the selected catalog when opening its management tab', async () => {
    const component = componentWith('services', 'services') as any;
    component.loadCatalog = vi.fn().mockResolvedValue(undefined);
    component.loadProviders = vi.fn().mockResolvedValue(undefined);
    component.loadBookings = vi.fn().mockResolvedValue(undefined);

    await component.loadAllData();

    expect(component.loadCatalog).toHaveBeenCalledWith('services');
    expect(component.loadProviders).not.toHaveBeenCalled();
    expect(component.loadBookings).not.toHaveBeenCalled();
  });

  it('shows live KPI values and marks unsupported anomaly detection instead of inventing a count', async () => {
    const component = componentWith() as any;
    component.apiService.getAdminDashboardSummary.mockResolvedValue({
      success: true,
      data: {
        activeUsers: { value: 40 },
        pendingServices: { value: 4 },
        platformRevenueToday: { value: 0 },
        abnormalTransactions: { available: false, reason: 'Chưa có tiêu chí nghiệp vụ.' },
        alerts: { items: [] }
      }
    });
    component.queueState = { providers: 'ready', bookings: 'ready' };
    component.pendingProviders = [{}, {}, {}];
    component.pendingBookings = [];

    await component.loadDashboardSummary();

    expect(component.metrics[0].value).toBe('40');
    expect(component.metrics[2].value).toBe('4');
    expect(component.metrics[4].value).toBe('Chưa triển khai');
    expect(component.metrics[4].note).toContain('Chưa có tiêu chí');
    expect(component.metrics[5].value).not.toBe('—');
  });

  it('does not convert a failed KPI request into zero or an empty queue', async () => {
    const component = componentWith() as any;
    component.apiService.getAdminDashboardSummary.mockRejectedValue(new Error('503'));
    component.queueState = { providers: 'loading', bookings: 'loading' };
    component.pendingProviders = [];
    component.pendingBookings = [];
    await component.loadDashboardSummary();

    expect(component.dashboardSummaryState).toBe('unavailable');
    expect(component.metrics[0].value).toBe('—');
    expect(component.metrics[0].note).toContain('Không tải được');
  });
});
