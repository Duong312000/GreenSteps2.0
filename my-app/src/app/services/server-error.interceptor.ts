import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ErrorReportService } from './error-report.service';

export const serverErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const reports = inject(ErrorReportService);

  return next(request).pipe(catchError((error: unknown) => {
    const requestUrl = new URL(request.url, window.location.origin);
    const isApiRequest = requestUrl.pathname.includes('/api/');
    const isMaintenanceResponse = error instanceof HttpErrorResponse
      && (error.headers.get('X-Maintenance-Mode') === 'true' || error.error?.maintenance === true);

    if (isApiRequest && error instanceof HttpErrorResponse) {
      const category = error.status === 0 ? 'network'
        : error.status === 401 ? 'unauthenticated'
          : error.status === 403 ? 'forbidden'
            : error.status === 503 ? 'database-unavailable'
              : error.status >= 500 ? 'backend'
                : 'client';
      reports.capture(error, 'api');
      if (isDevMode()) {
        console.warn('[API ERROR]', {
          method: request.method,
          url: requestUrl.pathname,
          status: error.status,
          category,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (isApiRequest && isMaintenanceResponse && !router.url.startsWith('/maintenance') && reports.beginErrorNavigation()) {
      void router.navigateByUrl('/maintenance').catch(() => undefined);
    }

    return throwError(() => error);
  }));
};
