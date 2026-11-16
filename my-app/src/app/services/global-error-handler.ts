import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorReportService } from './error-report.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private reports: ErrorReportService, private router: Router) {}

  public handleError(error: unknown): void {
    const report = this.reports.capture(error);
    const fatal = this.isFatalApplicationError(error);

    if (isDevMode()) {
      console.error('[ERROR HANDLER]', {
        category: fatal ? 'fatal-application' : error instanceof HttpErrorResponse ? 'http-request' : 'recoverable-application',
        reportId: report.id,
        route: this.router.url
      });
    }

    // API/network failures and ordinary component exceptions must stay local.
    // Only explicit fatal errors or an unavailable lazy-loaded app chunk
    // justify replacing the current route with the global error screen.
    if (fatal && !this.router.url.startsWith('/500') && this.reports.beginErrorNavigation()) {
      const returnUrl = this.router.url.split(/[?#]/, 1)[0] || '/home';
      void this.router.navigateByUrl('/500', { state: { returnUrl } }).catch(() => undefined);
    }
  }

  private isFatalApplicationError(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) return false;
    if (error && typeof error === 'object' && (error as { fatal?: unknown }).fatal === true) return true;
    if (!(error instanceof Error)) return false;
    return error.name === 'ChunkLoadError'
      || /failed to fetch dynamically imported module|loading chunk .* failed/i.test(error.message);
  }
}
