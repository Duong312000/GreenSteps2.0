import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';

import { ScheduleEditor } from './schedule-editor';

describe('ScheduleEditor', () => {
  let component: ScheduleEditor;
  let fixture: ComponentFixture<ScheduleEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([ScheduleEditor])).compileComponents();

    fixture = TestBed.createComponent(ScheduleEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
