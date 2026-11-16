// @vitest-environment jsdom
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoadingIndicator } from './loading-indicator';

describe('LoadingIndicator', () => {
  let fixture: ComponentFixture<LoadingIndicator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoadingIndicator] }).compileComponents();
    fixture = TestBed.createComponent(LoadingIndicator);
  });

  it('renders its label and accessible status in compact and regular modes', () => {
    fixture.componentRef.setInput('label', 'Đang tải tour...');
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Đang tải tour...');
    expect(fixture.nativeElement.querySelector('.loading-indicator__spinner')).toBeTruthy();

    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-indicator--compact')).toBeTruthy();
  });
});
