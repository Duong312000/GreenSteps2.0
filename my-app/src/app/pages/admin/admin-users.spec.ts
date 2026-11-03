import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { AdminUsersComponent } from './admin-users';

function componentWith(api: any): AdminUsersComponent {
  const component = Object.create(AdminUsersComponent.prototype) as any;
  const changeDetector = { markForCheck: vi.fn() };
  Object.assign(component, {
    api, cdr: changeDetector, pagination: { page: 1, limit: 10, total: 0, pages: 0 },
    users: [], selectedIds: new Set<string>(), loading: true, error: '',
    statsLoading: false, statsError: '', stats: null, roleOptions: [], statusOptions: [],
    search: '', role: '', status: '', startDate: '', endDate: '', sort: 'createdAt', order: 'desc',
    usersRequestId: 0, statsRequestId: 0, detailRequestId: 0, activityRequestId: 0, bookingsRequestId: 0
  });
  return component;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('AdminUsersComponent', () => {
  it('loads the server page and its pagination without local demo rows', async () => {
    const api = { getAdminUsers: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'UG1', fullname: 'Mai' }], pagination: { page: 2, limit: 10, total: 21, pages: 3 } }) };
    const component = componentWith(api);
    component.pagination.page = 2;

    await component.loadUsers();

    expect(api.getAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10, sort: 'createdAt' }));
    expect(component.users).toEqual([{ id: 'UG1', fullname: 'Mai' }]);
    expect(component.pagination.total).toBe(21);
    expect(component.loading).toBe(false);
  });

  it('clears the list and presents a retryable error when the users API fails', async () => {
    const component = componentWith({ getAdminUsers: vi.fn().mockRejectedValue(new Error('API down')) });
    component.users = [{ id: 'old-row' }];

    await component.loadUsers();

    expect(component.users).toEqual([]);
    expect(component.error).toContain('Không tải được');
    expect(component.loading).toBe(false);
  });

  it('does not let an older list response overwrite the latest query', async () => {
    const older = deferred<any>();
    const newer = deferred<any>();
    const api = { getAdminUsers: vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise) };
    const component = componentWith(api);

    const oldLoad = component.loadUsers();
    component.search = 'new query';
    const newLoad = component.loadUsers();
    newer.resolve({ success: true, data: [{ id: 'new' }], pagination: { page: 1, limit: 10, total: 1, pages: 1 } });
    await newLoad;
    older.resolve({ success: true, data: [{ id: 'old' }], pagination: { page: 1, limit: 10, total: 1, pages: 1 } });
    await oldLoad;

    expect(component.users.map((user: any) => user.id)).toEqual(['new']);
    expect(component.loading).toBe(false);
  });

  it('does not let an older stats response overwrite the latest stats', async () => {
    const older = deferred<any>();
    const newer = deferred<any>();
    const api = { getAdminUserStats: vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise) };
    const component = componentWith(api);

    const oldLoad = component.loadStats();
    const newLoad = component.loadStats();
    newer.resolve({ success: true, stats: { total: 2 }, roles: [], statuses: [] });
    await newLoad;
    older.resolve({ success: true, stats: { total: 1 }, roles: [], statuses: [] });
    await oldLoad;

    expect(component.stats.total).toBe(2);
    expect(component.statsLoading).toBe(false);
  });

  it('does not let a previous user detail response replace the selected user', async () => {
    const older = deferred<any>();
    const newer = deferred<any>();
    const api = { getAdminUser: vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise) };
    const component = componentWith(api);

    const oldLoad = component.openDetail({ id: 'UG1', fullname: 'Old' });
    const newLoad = component.openDetail({ id: 'UG2', fullname: 'New' });
    newer.resolve({ success: true, user: { id: 'UG2', fullname: 'New detail' } });
    await newLoad;
    older.resolve({ success: true, user: { id: 'UG1', fullname: 'Old detail' } });
    await oldLoad;

    expect(component.detail.id).toBe('UG2');
    expect(component.detail.fullname).toBe('New detail');
    expect(component.drawerLoading).toBe(false);
  });

  it('notifies Angular to render the detail as soon as its API request completes', async () => {
    const api = { getAdminUser: vi.fn().mockResolvedValue({ success: true, user: { id: 'UG1', fullname: 'Mai detail' } }) };
    const component = componentWith(api);

    await component.openDetail({ id: 'UG1', fullname: 'Mai' });

    expect(component.detail.fullname).toBe('Mai detail');
    expect(component.drawerLoading).toBe(false);
    expect(component.cdr.markForCheck).toHaveBeenCalled();
  });

  it('explicit refresh invalidates cached data and reloads list and stats together', async () => {
    const api = {
      refreshAdminUserData: vi.fn(),
      getAdminUsers: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } }),
      getAdminUserStats: vi.fn().mockResolvedValue({ success: true, stats: {}, roles: [], statuses: [] })
    };
    const component = componentWith(api);

    await component.refreshData();

    expect(api.refreshAdminUserData).toHaveBeenCalledOnce();
    expect(api.getAdminUsers).toHaveBeenCalledOnce();
    expect(api.getAdminUserStats).toHaveBeenCalledOnce();
  });

  it('displays legacy users without an account status as active', () => {
    const component = componentWith({});
    expect(component.displayStatus({ is_verified: true })).toBe('Đang hoạt động');
    expect(component.statusClass({ is_verified: true })).toBe('active');
  });

  it('keeps an activity-tab loading error local so the drawer can retry the tab', async () => {
    const component = componentWith({ getAdminUserActivity: vi.fn().mockRejectedValue(new Error('offline')) });
    component.detail = { id: 'UG1' }; component.activityPage = 0; component.drawerError = '';

    await component.setDrawerTab('activity');

    expect(component.activityError).toContain('Không tải được');
    expect(component.drawerError).toBe('');
  });
});
