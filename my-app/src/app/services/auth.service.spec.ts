// @vitest-environment jsdom
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throwError } from 'rxjs';

describe('AuthService', () => {
  let service: AuthService;
  const apiService = {
    preloadAppData: vi.fn(),
    setAdminUserCacheScope: vi.fn(),
    clearCache: vi.fn()
  };

  beforeEach(() => {
    localStorage.clear();
    apiService.preloadAppData.mockClear();
    apiService.setAdminUserCacheScope.mockClear();
    apiService.clearCache.mockClear();
    service = new AuthService({} as HttpClient, apiService as unknown as ApiService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(apiService.preloadAppData).not.toHaveBeenCalled();
  });

  it('keeps the saved session when profile validation is temporarily unavailable', async () => {
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    localStorage.setItem('greensteps_token', token);
    localStorage.setItem('greensteps_user', JSON.stringify({ id: 'user-1', username: 'traveler', role: 'traveler' }));
    const http = { get: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' }))) };
    service = new AuthService(http as unknown as HttpClient, apiService as unknown as ApiService);

    await service.refreshProfile();

    expect(service.getCurrentUser()?.id).toBe('user-1');
    expect(localStorage.getItem('greensteps_token')).toBe(token);
  });

  it('keeps an authenticated session on 403 and clears it only when profile validation returns 401', async () => {
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    localStorage.setItem('greensteps_token', token);
    localStorage.setItem('greensteps_user', JSON.stringify({ id: 'user-1', username: 'traveler', role: 'traveler' }));
    const http = { get: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))) };
    service = new AuthService(http as unknown as HttpClient, apiService as unknown as ApiService);

    await service.refreshProfile();
    expect(service.getCurrentUser()?.id).toBe('user-1');

    http.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })));
    await service.refreshProfile();
    expect(service.getCurrentUser()).toBeNull();
    expect(localStorage.getItem('greensteps_token')).toBeNull();
  });
});
