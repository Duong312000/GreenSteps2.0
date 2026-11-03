// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { of, throwError } from 'rxjs';
import { ApiService } from './api.service';

describe('ApiService admin queues', () => {
  it('loads the admin catalog through the authenticated API', async () => {
    const rows = [{ id: 'service-1', status: 'active' }];
    const http = { get: vi.fn(() => of(rows)) };
    const api = new ApiService(http as any);
    expect(await api.getAdminCatalog('services')).toEqual({ data: rows, available: true });
    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/admin/catalog/services', { withCredentials: true });
  });

  it('does not reuse cached shared records after another account changes them', () => {
    const api = new ApiService({} as any) as any;
    for (const key of ['preset_tours_guest', 'preset_tour_1', 'services_all', 'service_detail_tour_1', 'itineraries_1', 'itinerary_1', 'wallet_info_1', 'transactions_1']) {
      api.setCachedData(key, [{ status: 'pending' }]);
      expect(api.getCachedData(key)).toBeNull();
    }
    api.setCachedData('community_posts_1', [{ id: 'post-1' }]);
    expect(api.getCachedData('community_posts_1')).toBeNull();
  });
  beforeEach(() => vi.stubGlobal('window', { location: { hostname: 'localhost' } }));
  afterEach(() => vi.unstubAllGlobals());

  it('calls the admin users API with server-side filters and returns its response', async () => {
    const response = { success: true, data: [{ id: 'u1' }], pagination: { page: 2, limit: 10, total: 1, pages: 1 } };
    const http = { get: vi.fn(() => of(response)) };
    const api = new ApiService(http as any);

    const result = await (api as any).getAdminUsers({ search: 'mai', role: 'traveler', status: 'active', page: 2, limit: 10, sort: 'createdAt', order: 'desc' });

    expect(http.get).toHaveBeenCalledWith(
      'http://localhost:5055/api/admin/users?search=mai&role=traveler&status=active&page=2&limit=10&sort=createdAt&order=desc',
      { withCredentials: true }
    );
    expect(result).toEqual(response);
  });

  it('deduplicates identical admin user queries and caches successful responses', async () => {
    const response = { success: true, data: [{ id: 'u1' }], pagination: { page: 1, limit: 10, total: 1, pages: 1 } };
    const http = { get: vi.fn(() => of(response)) };
    const api = new ApiService(http as any);
    api.setAdminUserCacheScope('admin-1');

    const [first, second] = await Promise.all([
      api.getAdminUsers({ page: 1, limit: 10, sort: 'createdAt', order: 'desc' }),
      api.getAdminUsers({ order: 'desc', sort: 'createdAt', limit: 10, page: 1 })
    ]);
    const cached = await api.getAdminUsers({ page: 1, limit: 10, sort: 'createdAt', order: 'desc' });

    expect(first).toEqual(response);
    expect(second).toEqual(response);
    expect(cached).toEqual(response);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('does not share cached admin user data after switching account scope', async () => {
    const http = { get: vi.fn()
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'admin-1-view' }] }))
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'admin-2-view' }] })) };
    const api = new ApiService(http as any);
    const query = { page: 1, limit: 10, sort: 'createdAt', order: 'desc' };

    api.setAdminUserCacheScope('admin-1');
    const first = await api.getAdminUsers(query);
    api.setAdminUserCacheScope('admin-2');
    const second = await api.getAdminUsers(query);

    expect(first.data[0].id).toBe('admin-1-view');
    expect(second.data[0].id).toBe('admin-2-view');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('lets an explicit refresh bypass cached list and stats data', async () => {
    const http = { get: vi.fn()
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'stale' }] }))
      .mockReturnValueOnce(of({ success: true, stats: { total: 1 } }))
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'fresh' }] }))
      .mockReturnValueOnce(of({ success: true, stats: { total: 2 } })) };
    const api = new ApiService(http as any);
    const query = { page: 1, limit: 10, sort: 'createdAt', order: 'desc' };

    await api.getAdminUsers(query);
    await api.getAdminUserStats();
    api.refreshAdminUserData();
    const [users, stats] = await Promise.all([api.getAdminUsers(query), api.getAdminUserStats()]);

    expect(users.data[0].id).toBe('fresh');
    expect(stats.stats.total).toBe(2);
    expect(http.get).toHaveBeenCalledTimes(4);
  });

  it('caches detail reads in memory and invalidates them after a profile update', async () => {
    const http = {
      get: vi.fn()
        .mockReturnValueOnce(of({ success: true, user: { id: 'u1', fullname: 'Before' } }))
        .mockReturnValueOnce(of({ success: true, user: { id: 'u1', fullname: 'After' } })),
      patch: vi.fn(() => of({ success: true, user: { id: 'u1', fullname: 'After' } }))
    };
    const api = new ApiService(http as any);
    api.setAdminUserCacheScope('admin-1');

    const first = await api.getAdminUser('u1');
    const cached = await api.getAdminUser('u1');
    await api.updateAdminUser('u1', { fullname: 'After', reason: 'Correction' });
    const fresh = await api.getAdminUser('u1');

    expect(first.user.fullname).toBe('Before');
    expect(cached.user.fullname).toBe('Before');
    expect(fresh.user.fullname).toBe('After');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('does not cache an unsuccessful admin user API response', async () => {
    const http = { get: vi.fn()
      .mockReturnValueOnce(of({ success: false }))
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'fresh' }] })) };
    const api = new ApiService(http as any);
    const query = { page: 1, limit: 10, sort: 'createdAt', order: 'desc' };

    await api.getAdminUsers(query);
    const result = await api.getAdminUsers(query);

    expect(result.data[0].id).toBe('fresh');
    expect(http.get).toHaveBeenCalledTimes(2);
  });


  it('unwraps the backend withdrawal envelope and keeps pending rows only', async () => {
    const http = { get: vi.fn(() => of({
      success: true,
      withdrawals: [
        { id: 'WD-1', status: 'pending' },
        { id: 'WD-2', status: 'approved' }
      ]
    })) };
    const api = new ApiService(http as any);

    const result = await (api as any).getAdminPendingWithdrawals();

    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/wallet/withdrawals', { withCredentials: true });
    expect(result).toEqual({ data: [{ id: 'WD-1', status: 'pending' }], available: true });
  });

  it('marks an unavailable queue when its API request fails', async () => {
    const http = { get: vi.fn(() => throwError(() => new Error('Unavailable'))) };
    const api = new ApiService(http as any);

    const result = await (api as any).getAdminPendingProviders();

    expect(result).toEqual({ data: [], available: false });
  });
});
