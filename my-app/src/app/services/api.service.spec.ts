import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiService } from './api.service';

describe('ApiService admin queues', () => {
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
