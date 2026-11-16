import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServicesComponent } from './services';

function catalog() {
  const navigate = vi.fn().mockResolvedValue(true);
  const component = new ServicesComponent({} as any, {} as any, { snapshot: {} } as any,
    { navigate } as any, { detectChanges: vi.fn() } as any);
  return { component, navigate };
}

afterEach(() => vi.useRealTimers());

describe('service catalog server-side filters', () => {
  it('leaves the minimum-rating filter out when all ratings are selected', async () => {
    vi.useFakeTimers();
    const { component, navigate } = catalog();
    component.filterServices();
    await vi.advanceTimersByTimeAsync(251);
    const query = navigate.mock.calls[0][1].queryParams;
    expect(query.type).toBe('stay');
    expect(query.rating).toBeNull();
    vi.useRealTimers();
  });

  it('sends a selected minimum rating to the server through URL state', async () => {
    vi.useFakeTimers();
    const { component, navigate } = catalog();
    component.filterRating = '4.5';
    component.filterServices();
    await vi.advanceTimersByTimeAsync(251);
    expect(navigate.mock.calls[0][1].queryParams.rating).toBe('4.5');
    vi.useRealTimers();
  });

  it('keeps category and text search in server-side URL filters', async () => {
    vi.useFakeTimers();
    const { component, navigate } = catalog();
    component.serviceType = 'food';
    component.searchQuery = 'new';
    component.filterServices();
    await vi.advanceTimersByTimeAsync(251);
    const query = navigate.mock.calls[0][1].queryParams;
    expect(query.type).toBe('food');
    expect(query.search).toBe('new');
    vi.useRealTimers();
  });
});
