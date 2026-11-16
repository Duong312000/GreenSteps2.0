import { CommonModule, registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { FavoritesService } from '../services/favorites.service';
import { LoginModalService } from '../services/login-modal.service';
import { TransportService } from '../services/transport.service';

registerLocaleData(localeVi, 'vi-VN');

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, media: '', onchange: null, addListener: () => undefined,
      removeListener: () => undefined, addEventListener: () => undefined,
      removeEventListener: () => undefined, dispatchEvent: () => false })
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function asyncApiStub() {
  const defaultMethod = () => Promise.resolve([]);
  return new Proxy({ clearCache: () => undefined }, {
    get(target, key: string) {
      return key in target ? (target as any)[key] : defaultMethod;
    }
  });
}

function authStub() {
  return {
    currentUser$: of(null),
    user$: of(null),
    getCurrentUser: () => null,
    getGoogleClientId: () => Promise.resolve(''),
    prepareFacebook: () => Promise.resolve()
  };
}

function loginModalStub() {
  return { open$: new Subject<void>(), open: () => undefined };
}

function favoritesStub() {
  return {
    items$: new BehaviorSubject([]),
    loading$: new BehaviorSubject(false),
    error$: new BehaviorSubject(''),
    items: [], isSaved: () => false, isBusy: () => false,
    refresh: () => Promise.resolve(), toggle: () => Promise.resolve(false),
    setSaved: () => Promise.resolve(false), placeRef: (place: any) => ({ type: 'place', id: place?.id || '' })
  };
}

function noOpService() {
  const method = () => undefined;
  return new Proxy({}, { get: () => method });
}

export function componentTestModule(declarations: any[]) {
  return {
    declarations,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forRoot([])],
    providers: [
      { provide: ApiService, useValue: asyncApiStub() },
      { provide: AuthService, useValue: authStub() },
      { provide: LoginModalService, useValue: loginModalStub() },
      { provide: FavoritesService, useValue: favoritesStub() },
      { provide: TransportService, useValue: noOpService() }
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
  };
}
