// @vitest-environment jsdom
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverErrorInterceptor } from './server-error.interceptor';

describe('serverErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([serverErrorInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it.each([500, 503])('keeps the current page when a public API returns %i', async status => {
    const result = firstValueFrom(http.get('http://localhost:5055/api/tours/search'));
    backend.expectOne('http://localhost:5055/api/tours/search').flush({}, { status, statusText: 'Unavailable' });

    await expect(result).rejects.toMatchObject({ status });
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([401, 403])('does not turn an authentication/authorization status %i into a global error route', async status => {
    const result = firstValueFrom(http.get('http://localhost:5055/api/auth/profile/user-1'));
    backend.expectOne('http://localhost:5055/api/auth/profile/user-1').flush({}, { status, statusText: 'Auth error' });

    await expect(result).rejects.toMatchObject({ status });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the current page on a network error', async () => {
    const result = firstValueFrom(http.get('http://localhost:5055/api/services/search'));
    backend.expectOne('http://localhost:5055/api/services/search').error(new ProgressEvent('error'));

    await expect(result).rejects.toMatchObject({ status: 0 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still routes an explicit maintenance response to maintenance', async () => {
    const result = firstValueFrom(http.get('http://localhost:5055/api/tours/search'));
    backend.expectOne('http://localhost:5055/api/tours/search').flush(
      { maintenance: true },
      { status: 503, statusText: 'Maintenance', headers: { 'X-Maintenance-Mode': 'true' } }
    );

    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(navigate).toHaveBeenCalledWith('/maintenance');
  });
});
