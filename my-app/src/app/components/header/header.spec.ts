import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  const api = {
    getToursPage: vi.fn().mockResolvedValue({ items: [{ id: 'tour-1', title: 'Tour rừng xanh', destination: 'Đà Lạt' }] }),
    getServicesPage: vi.fn().mockResolvedValue({ items: [{ id: 'food-1', name: 'Bữa ăn địa phương', type: 'food', destination: 'Đà Lạt' }] }),
    getNotifications: vi.fn().mockResolvedValue([]),
    getLocalCounterBookingNotifications: vi.fn().mockReturnValue([])
  };
  const auth = {
    currentUser$: new BehaviorSubject<any>(null),
    getCurrentUser: () => auth.currentUser$.value
  };

  beforeEach(async () => {
    api.getToursPage.mockClear();
    api.getServicesPage.mockClear();
    auth.currentUser$.next(null);
    await TestBed.configureTestingModule(componentTestModule([Header]))
      .overrideProvider(ApiService, { useValue: api })
      .overrideProvider(AuthService, { useValue: auth })
      .compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows search before register when logged out and before notifications when logged in', () => {
    fixture.detectChanges();
    const controls = fixture.nativeElement.querySelector('.header-controls') as HTMLElement;
    expect(controls.firstElementChild?.classList.contains('navbar-search-trigger')).toBe(true);
    expect(controls.querySelector('.navbar-search-trigger')?.nextElementSibling?.classList.contains('header-auth-actions')).toBe(true);

    fixture.destroy();
    auth.currentUser$.next({ id: 'user-1', fullname: 'GreenSteps user', role: 'traveler' });
    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const authenticatedControls = fixture.nativeElement.querySelector('.header-controls') as HTMLElement;
    expect(authenticatedControls.firstElementChild?.classList.contains('navbar-search-trigger')).toBe(true);
    expect(authenticatedControls.querySelector('.navbar-search-trigger')?.nextElementSibling?.classList.contains('header-notifications')).toBe(true);
  });

  it('opens, focuses, and closes search with outside click and Escape', async () => {
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.navbar-search-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(component.isNavbarSearchOpen).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input[aria-label="Tìm tour, địa điểm, dịch vụ"]'));

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.isNavbarSearchOpen).toBe(false);
    component.openNavbarSearch(new MouseEvent('click'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(component.isNavbarSearchOpen).toBe(false);
  });

  it('debounces real catalog suggestions and navigates to a selected result', async () => {
    fixture.detectChanges();
    component.onNavbarSearchChanged('rừng');
    await new Promise(resolve => setTimeout(resolve, 350));
    await fixture.whenStable();
    expect(api.getToursPage).toHaveBeenCalledTimes(1);
    expect(api.getServicesPage).toHaveBeenCalledTimes(1);
    expect(component.navbarSearchSuggestions.map(item => item.label)).toEqual(['Tour rừng xanh', 'Bữa ăn địa phương']);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component.selectNavbarSearchSuggestion(component.navbarSearchSuggestions[1]);
    expect(navigate).toHaveBeenCalledWith('/services/food/food-1');
    expect(component.isNavbarSearchOpen).toBe(false);
  });

  it('uses the existing tours search route when Enter submits a global query', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.navbarSearchQuery = 'Đà Lạt';
    component.submitNavbarSearch();
    expect(navigate).toHaveBeenCalledWith(['/tours'], { queryParams: { search: 'Đà Lạt' } });
  });
});
