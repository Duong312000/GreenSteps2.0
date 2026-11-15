import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ErrorReportService } from './error-report.service';

export const serverErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const reports = inject(ErrorReportService);

  return next(request).pipe(catchError((error: unknown) => {
    const requestUrl = new URL(request.url, window.location.origin);
    const isApiRequest = requestUrl.pathname.includes('/api/');
    const isServerFailure = error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
    const isMaintenanceResponse = error instanceof HttpErrorResponse
      && (error.headers.get('X-Maintenance-Mode') === 'true' || error.error?.maintenance === true);

    if (isApiRequest && isMaintenanceResponse && !router.url.startsWith('/maintenance') && reports.beginErrorNavigation()) {
      reports.capture(error);
      void router.navigateByUrl('/maintenance').catch(() => undefined);
    } else if (isApiRequest && isServerFailure && !router.url.startsWith('/500') && reports.beginErrorNavigation()) {
      reports.capture(error);
      void router.navigateByUrl('/500').catch(() => undefined);
    }

    return throwError(() => error);
  }));
};
