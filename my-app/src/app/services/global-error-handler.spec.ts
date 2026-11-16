// @vitest-environment jsdom
import { HttpErrorResponse } from '@angular/common/http';
import { GlobalErrorHandler } from './global-error-handler';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('GlobalErrorHandler', () => {
  afterEach(() => vi.restoreAllMocks());

  function createHandler() {
    const reports = {
      capture: vi.fn(() => ({ id: 'GS-TEST' })),
      beginErrorNavigation: vi.fn(() => true)
    };
    const router = {
      url: '/services?type=stay',
      navigateByUrl: vi.fn().mockResolvedValue(true)
    };
    const handler = new GlobalErrorHandler(reports as any, router as any);
    return { handler, reports, router };
  }

  it('does not replace the whole app for API, network, or recoverable UI errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler, router } = createHandler();

    handler.handleError(new HttpErrorResponse({ status: 503, url: '/api/tours/search' }));
    handler.handleError(new HttpErrorResponse({ status: 0, url: '/api/notifications/user/1' }));
    handler.handleError(new Error('A non-fatal component error'));

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('routes an explicitly fatal application error to /500 without storing query secrets', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler, router } = createHandler();

    handler.handleError(Object.assign(new Error('Fatal app failure'), { fatal: true }));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/500', {
      state: { returnUrl: '/services' }
    });
  });
});
