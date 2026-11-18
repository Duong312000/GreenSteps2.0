import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { SecurityService } from '../../services/security.service';
import { componentTestModule } from '../../testing/component-test-setup';
import { Profile } from './profile';

describe('Profile', () => {
  let fixture: ComponentFixture<Profile>;
  let component: Profile;
  let currentUser: BehaviorSubject<any>;
  let securityReads: number;

  beforeEach(async () => {
    currentUser = new BehaviorSubject<any>(null);
    securityReads = 0;
    const testModule: any = componentTestModule([Profile]);
    testModule.providers = [
      ...testModule.providers.filter((provider: any) => ![AuthService, SecurityService].includes(provider.provide)),
      { provide: AuthService, useValue: {
        currentUser$: currentUser.asObservable(),
        getCurrentUser: () => currentUser.value,
        refreshProfile: async () => undefined
      } },
      { provide: SecurityService, useValue: {
        getOverview: () => { securityReads++; return Promise.reject({ status: 401 }); },
        getActivity: () => Promise.reject({ status: 401 })
      } }
    ];
    await TestBed.configureTestingModule(testModule).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('loads backend security data when the security section is opened', () => {
    currentUser.next({ id: 'user-1', username: 'traveler', role: 'traveler' });
    fixture.detectChanges();

    component.setActiveSection('security');
    expect(securityReads).toBe(1);
    expect(component.securityLoading).toBe(true);
  });
});
