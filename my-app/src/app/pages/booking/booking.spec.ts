import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';

import { Booking } from './booking';

describe('Booking', () => {
  let component: Booking;
  let fixture: ComponentFixture<Booking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([Booking])).compileComponents();

    fixture = TestBed.createComponent(Booking);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
