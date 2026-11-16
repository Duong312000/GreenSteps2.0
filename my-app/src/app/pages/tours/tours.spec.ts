import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';

import { Tours } from './tours';
import { ApiService } from '../../services/api.service';
import { expect, it, vi } from 'vitest';

describe('Tours', () => {
  let component: Tours;
  let fixture: ComponentFixture<Tours>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([Tours])).compileComponents();

    fixture = TestBed.createComponent(Tours);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears tour loading after search failure and exposes retry', async () => {
    const api = TestBed.inject(ApiService);
    api.getToursPage = vi.fn().mockRejectedValue(new Error('offline'));

    await (component as any).loadToursFromServer();

    expect(component.isPageLoading).toBe(false);
    expect(component.loadError).toBe(true);
  });

  it('keeps a legacy tour cover usable when it has no responsive photo metadata', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Tours);
    component = fixture.componentInstance;
    component.ngOnInit = async () => {};
    component.paginatedTours = [{
      id: 'legacy-tour-1', title: 'Legacy tour', destination: 'Da Lat', days: 2,
      image: 'image/legacy-tour.jpg', data: [], is_demo: false
    } as any];
    component.totalTours = 1;
    component.isPageLoading = false;
    fixture.detectChanges(false);

    const image: HTMLImageElement = fixture.nativeElement.querySelector('.card-img');
    expect(image.getAttribute('src')).toBe('image/legacy-tour.jpg');
    expect(image.getAttribute('srcset')).toBeNull();
  });
});
