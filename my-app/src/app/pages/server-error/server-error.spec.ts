// @vitest-environment jsdom
import { ServerErrorComponent } from './server-error';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ServerErrorComponent recovery', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/500');
    vi.restoreAllMocks();
  });

  function createComponent() {
    const reports = {
      ensureReference: vi.fn(() => ({ id: 'GS-TEST', occurredAt: new Date(), details: '' })),
      endErrorNavigation: vi.fn()
    };
    const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    return { component: new ServerErrorComponent(reports as any, router as any), router };
  }

  it('retries a safe same-origin route and drops sensitive query parameters', async () => {
    window.history.replaceState({ returnUrl: '/tours?dest=Sa%20Pa&token=secret' }, '', '/500');
    const { component, router } = createComponent();

    await component.retry();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/tours?dest=Sa+Pa');
  });

  it('returns to the home page when no safe recovery route exists', async () => {
    window.history.replaceState({ returnUrl: 'https://evil.example/steal' }, '', '/500');
    const { component, router } = createComponent();

    await component.retry();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });
});
