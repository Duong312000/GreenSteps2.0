import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TourDetail } from './tour-detail';

describe('TourDetail', () => {
  let component: TourDetail;
  let fixture: ComponentFixture<TourDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TourDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(TourDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
