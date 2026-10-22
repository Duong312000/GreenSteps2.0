import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerPromotions } from './partner-promotions';

describe('PartnerPromotions', () => {
  let component: PartnerPromotions;
  let fixture: ComponentFixture<PartnerPromotions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PartnerPromotions],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerPromotions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
