import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../../testing/component-test-setup';

import { PartnerBookings } from './partner-bookings';
import { ApiService } from '../../../services/api.service';
import { expect, it, vi } from 'vitest';

describe('PartnerBookings', () => {
  let component: PartnerBookings;
  let fixture: ComponentFixture<PartnerBookings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([PartnerBookings])).compileComponents();

    fixture = TestBed.createComponent(PartnerBookings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('partner bookings exposes loading empty and retry states', async () => {
    component.currentUser = { id: 'provider-1', role: 'provider' } as any;
    (TestBed.inject(ApiService) as any).getMyServices = vi.fn().mockRejectedValue(new Error('offline'));

    await component.loadAllData();

    expect(component.isLoading).toBe(false);
    expect(component.loadError).toBe(true);
  });
});
