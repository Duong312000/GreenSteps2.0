import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { expect, it, vi } from 'vitest';

import { CommunityComponent } from './community';

describe('CommunityComponent', () => {
  let component: CommunityComponent;
  let fixture: ComponentFixture<CommunityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([CommunityComponent])).compileComponents();

    fixture = TestBed.createComponent(CommunityComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears loading and offers retry when the feed request fails', async () => {
    (TestBed.inject(ApiService) as any).getCommunityPosts = vi.fn().mockRejectedValue(new Error('offline'));

    await component.refreshPage();
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.loadError).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Thử lại');
  });

  it('ignores an older feed response after a newer filter request starts', async () => {
    let resolveFirst!: (posts: any[]) => void;
    let resolveSecond!: (posts: any[]) => void;
    const api = TestBed.inject(ApiService) as any;
    api.getCommunityPosts = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));

    const first = component.refreshPage();
    component.activeTab = 'question';
    const second = component.refreshPage();
    resolveSecond([{ id: 'new-filter' }]);
    await second;
    resolveFirst([{ id: 'old-filter' }]);
    await first;

    expect(component.posts.map(post => post.id)).toEqual(['new-filter']);
  });

  it('invalidates a pending personalized feed when the signed-in account changes', async () => {
    let resolveAccountA!: (posts: any[]) => void;
    let resolveAccountB!: (posts: any[]) => void;
    const api = TestBed.inject(ApiService) as any;
    api.getCommunityPosts = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveAccountA = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveAccountB = resolve; }));
    const auth = TestBed.inject(AuthService) as any;

    const accountARequest = component.refreshPage();
    auth.currentUserSubject.next({ id: 'account-b', role: 'traveler' });
    resolveAccountA([{ id: 'saved-for-a' }]);
    await accountARequest;
    resolveAccountB([{ id: 'saved-for-b' }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.posts.map(post => post.id)).toEqual(['saved-for-b']);
  });
});
