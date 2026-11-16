import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { componentTestModule } from './testing/component-test-setup';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([App])).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the application shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
