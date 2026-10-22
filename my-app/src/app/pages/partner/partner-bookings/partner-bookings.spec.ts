import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerBookings } from './partner-bookings';

describe('PartnerBookings', () => {
  let component: PartnerBookings;
  let fixture: ComponentFixture<PartnerBookings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PartnerBookings],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerBookings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
