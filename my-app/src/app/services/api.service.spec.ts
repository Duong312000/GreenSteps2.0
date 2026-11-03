// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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
