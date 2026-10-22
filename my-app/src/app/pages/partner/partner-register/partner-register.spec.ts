import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerRegister } from './partner-register';

describe('PartnerRegister', () => {
  let component: PartnerRegister;
  let fixture: ComponentFixture<PartnerRegister>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PartnerRegister],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerRegister);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
