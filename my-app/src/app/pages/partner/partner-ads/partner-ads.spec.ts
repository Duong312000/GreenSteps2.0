import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerAds } from './partner-ads';

describe('PartnerAds', () => {
  let component: PartnerAds;
  let fixture: ComponentFixture<PartnerAds>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PartnerAds],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerAds);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
