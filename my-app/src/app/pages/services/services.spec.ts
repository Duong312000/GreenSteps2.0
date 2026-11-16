import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';
import { ApiService } from '../../services/api.service';

import { Services } from './services';
import { expect, it, vi } from 'vitest';

describe('Services', () => {
  let component: Services;
  let fixture: ComponentFixture<Services>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([Services])).compileComponents();

    fixture = TestBed.createComponent(Services);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses bounded server pagination and national destination filters for service search', async () => {
    const api = TestBed.inject(ApiService);
    api.getServicesPage = vi.fn().mockResolvedValue({ items: [{ id: 'service-1' }], total: 31, page: 2 });
    component.serviceType = 'stay';
    component.searchQuery = 'homestay';
    component.filterDest = 'Sa Pa';
    component.currentPage = 2;
    await (component as any).loadServicesFromServer();
    expect(api.getServicesPage).toHaveBeenCalledWith(expect.objectContaining({ q: 'homestay', dest: 'Sa Pa', page: 2, pageSize: 6, type: 'stay' }));
    expect(component.totalServices).toBe(31);
    expect(component.paginatedServices).toHaveLength(1);
  });

  it('shows an empty retry state after service search fails', async () => {
    const api = TestBed.inject(ApiService);
    api.getServicesPage = vi.fn().mockRejectedValue(new Error('offline'));

    await (component as any).loadServicesFromServer();

    expect(component.isPageLoading).toBe(false);
    expect(component.loadError).toBe(true);
    expect(component.paginatedServices).toEqual([]);
  });

  it('uses the real catalog photograph without changing the venue verification state', () => {
    const service: any = {
      id: 'service-1', name: 'Eco stay', image_url: 'image/greensteps/dalat/dalat-maple-forest.jpg',
      coverMediaVerified: false,
      photoMetadata: [{ path: 'image/greensteps/dalat/dalat-maple-forest.jpg', alt: 'Rừng thông tại Đà Lạt' }]
    };
    expect(component.serviceCardImage(service)).toBe(service.image_url);
    expect(component.serviceCardImageAlt(service)).toBe('Rừng thông tại Đà Lạt');
    expect(service.coverMediaVerified).toBe(false);
  });
});
