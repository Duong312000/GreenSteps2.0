import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tours } from './tours';

describe('Tours', () => {
  let component: Tours;
  let fixture: ComponentFixture<Tours>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Tours],
    }).compileComponents();

    fixture = TestBed.createComponent(Tours);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
