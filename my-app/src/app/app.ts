import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';

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
  isStandalonePolicyRoute = false;

  constructor(private route: ActivatedRoute, private router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.updateAdminShell(this.router.url);
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      this.updateAdminShell(event.urlAfterRedirects);
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
    this.isAdminRoute = cleanUrl === '/admin';
    this.isScheduleRoute = cleanUrl.startsWith('/schedule');
    this.isStandalonePolicyRoute = cleanUrl === '/cancellation-policy' || cleanUrl === '/transparency';
  }
}
