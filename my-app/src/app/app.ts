import { Component, isDevMode, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App implements OnInit {
  title = 'GreenSteps Travel';
  isAdminRoute = false;
  isScheduleRoute = false;
  isPlannerRoute = false;
  isProfileRoute = false;
  isStandalonePolicyRoute = false;
  isNavigating = false;
  isStandaloneMaintenanceRoute = false;

  constructor(
    private route: ActivatedRoute, 
    private router: Router, 
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.updateAdminShell(this.router.url);
    // Pre-warm maps & local POI cache in background on session start
    this.apiService.preloadMapData();

    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.isNavigating = true;
        if (isDevMode()) {
          console.debug('[ROUTER]', {
            from: this.router.url.split(/[?#]/, 1)[0],
            to: event.url.split(/[?#]/, 1)[0],
            trigger: event.navigationTrigger
          });
        }
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        if (event instanceof NavigationEnd) {
          this.updateAdminShell(event.urlAfterRedirects);
        }
        // Small graceful delay to smoothly complete progress animation
        setTimeout(() => {
          this.isNavigating = false;
        }, 180);
      }
    });

    this.route.queryParamMap.subscribe(params => {
      const token = params.get('token');
      if (token) {
        this.authService.loginWithOnlyToken(token);
      }
    });
  }

  private updateAdminShell(url: string) {
    const cleanUrl = (url || '').split('?')[0].split('#')[0];
    this.isAdminRoute = cleanUrl === '/admin' || cleanUrl === '/admin/food';
    this.isScheduleRoute = cleanUrl.startsWith('/schedule');
    this.isPlannerRoute = cleanUrl === '/ai-planner';
    this.isProfileRoute = cleanUrl === '/profile';
    this.isStandalonePolicyRoute = cleanUrl === '/cancellation-policy' || cleanUrl === '/transparency';
    this.isStandaloneMaintenanceRoute = cleanUrl === '/maintenance';
  }
}
