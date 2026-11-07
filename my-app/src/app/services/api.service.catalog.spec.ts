import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { ApiService } from './api.service';

describe('shared service catalog metadata', () => {
  const current_data = { priceStatus: 'on_request', bookingEnabled: false, carbonStatus: 'unconfirmed', capacityStatus: 'unconfirmed', sourceUrls: ['https://example.org/official'], description: 'Official description' };
  it('keeps the provider and traveler views on the same metadata and destination', async () => {
    const service = new ApiService({ get: vi.fn((url: string) => of(url.includes('/provider/')
      ? [{ id: 'service', name: 'Service', dest: 'Hội An', current_data }]
      : [{ id: 'service', name: 'Service', destination: 'Hội An', current_data }])) } as any);
    const publicRecord = (await service.getServices())[0];
    const providerRecord = (await service.getMyServices('provider'))[0];
    for (const row of [publicRecord, providerRecord]) {
      expect(row.destination).toBe('Hội An');
      expect(row.priceStatus).toBe('on_request');
      expect(row.bookingEnabled).toBe(false);
      expect(row.carbonKnown).toBe(false);
      expect(row.description).toBe('Official description');
      expect(row.sourceUrls).toEqual(['https://example.org/official']);
    }
  });
  it('excludes archived sample listings from the public catalog', async () => {
    const service = new ApiService({ get: () => of([{ id: 'archived', current_data: { catalogHidden: true } }, { id: 'public', current_data }]) } as any);
    expect((await service.getServices()).map(row => row.id)).toEqual(['public']);
  });
});
