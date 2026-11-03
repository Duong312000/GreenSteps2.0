import { describe, expect, it, vi } from 'vitest';
import { AdminComponent } from './admin';

describe('AdminComponent dashboard interactions', () => {
  it('computes moderation metrics from real report states and paginates ten rows', () => {
    const component = new AdminComponent({} as any, {} as any, {} as any, {} as any);
    component.activeTab = 'reports';
    component.reportsState = 'ready';
    component.communityReports = Array.from({ length: 13 }, (_, i) => ({
      id: `r-${i}`, author: `Author ${i}`, text: `Content ${i}`, targetType: i % 2 ? 'comment' : 'post',
      reasonLabel: 'Spam', status: ['pending', 'hidden', 'dismissed'][i % 3], hidden: i % 3 === 1
    }));
    expect(component.reportMetrics.map(item => item.value)).toEqual([13, 5, 8, 4]);
    expect(component.pageRows.length).toBe(10);
    component.changePage(2);
    expect(component.pageRows.length).toBe(3);
    component.reportStatusFilter = 'pending';
    component.currentPage = 1;
    expect(component.filteredRows.length).toBe(5);
    component.reportTypeFilter = 'post';
    expect(component.filteredRows.length).toBe(3);
    component.queueSearch = 'Author 12';
    expect(component.filteredRows.map(row => row.id)).toEqual(['r-12']);
  });

  it('selects and clears only the reports on the current page', () => {
    const component = new AdminComponent({} as any, {} as any, {} as any, {} as any);
    component.activeTab = 'reports';
    component.communityReports = [{ id: 'r-1', author: 'A', status: 'pending' }, { id: 'r-2', author: 'B', status: 'hidden' }];
    component.togglePageReportSelection();
    expect(component.allPageReportsSelected).toBe(true);
    expect(component.selectedReportIds.size).toBe(2);
    component.togglePageReportSelection();
    expect(component.selectedReportIds.size).toBe(0);
  });
  it('displays persisted catalog records without enabling queue approval actions', async () => {
    const rows = [{ id: 'service-1', name: 'Homestay', detail: 'Đà Lạt', value: 500000, status: 'active' }];
    const component = new AdminComponent({ getAdminCatalog: vi.fn().mockResolvedValue({ data: rows, available: true }) } as any, {} as any, {} as any, { detectChanges: vi.fn() } as any);
    component.activeTab = 'services';
    await component.loadCatalog('services');
    expect(component.currentQueueState).toBe('ready');
    expect(component.isCatalogTab).toBe(true);
    expect(component.filteredRows[0]).toMatchObject({ id: 'service-1', name: 'Homestay', status: 'active' });
    component.ngOnDestroy();
  });
  it('routes the users sidebar section to a supported user-management view', () => {
    const component = Object.create(AdminComponent.prototype) as any;
    component.activeSection = 'overview';
    component.navigationItems = [{ id: 'users' }];

    component.setSection('users');

    expect(component.isUserManagement).toBe(true);
    expect(component.unsupportedSection).toBe(false);
  });


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
