import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../../testing/component-test-setup';

import { PartnerServices } from './partner-services';
import { ApiService } from '../../../services/api.service';
import { expect, it, vi } from 'vitest';

describe('PartnerServices', () => {
  let component: PartnerServices;
  let fixture: ComponentFixture<PartnerServices>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([PartnerServices])).compileComponents();

    fixture = TestBed.createComponent(PartnerServices);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes retry after the service list request fails', async () => {
    component.currentUser = { id: 'provider-1', role: 'provider' } as any;
    (TestBed.inject(ApiService) as any).getMyServices = vi.fn().mockRejectedValue(new Error('offline'));

    await component.loadServices();

    expect(component.isLoading).toBe(false);
    expect(component.loadError).toBe(true);
  });
});
