import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../../testing/component-test-setup';

import { PartnerDashboard } from './partner-dashboard';

describe('PartnerDashboard', () => {
  let component: PartnerDashboard;
  let fixture: ComponentFixture<PartnerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([PartnerDashboard])).compileComponents();

    fixture = TestBed.createComponent(PartnerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
