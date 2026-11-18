// @vitest-environment jsdom
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { getApiUrl } from '../config/api-config';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  it('loads the authenticated overview from the backend with credentials enabled', async () => {
    const response = { success: true, overview: { score: 50 } };
    const http = { get: vi.fn(() => of(response)) };
    const service = new SecurityService(http as unknown as HttpClient);

    await expect(service.getOverview()).resolves.toEqual(response.overview);
    expect(http.get).toHaveBeenCalledWith(`${getApiUrl()}/account/security/overview`, { withCredentials: true });
  });

  it('posts revocation requests using backend session identifiers', async () => {
    const http = { post: vi.fn(() => of({ success: true, revokedCount: 1 })) };
    const service = new SecurityService(http as unknown as HttpClient);

    await service.revokeOtherSessions();
    expect(http.post).toHaveBeenCalledWith(`${getApiUrl()}/account/security/sessions/revoke-others`, {}, { withCredentials: true });
  });
});
