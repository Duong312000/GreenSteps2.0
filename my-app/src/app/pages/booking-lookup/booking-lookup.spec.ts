import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookingLookup } from './booking-lookup';

describe('BookingLookup', () => {
  let component: BookingLookup;
  let fixture: ComponentFixture<BookingLookup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BookingLookup],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingLookup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
