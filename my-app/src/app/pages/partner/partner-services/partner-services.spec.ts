import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerServices } from './partner-services';

describe('PartnerServices', () => {
  let component: PartnerServices;
  let fixture: ComponentFixture<PartnerServices>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PartnerServices],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerServices);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
