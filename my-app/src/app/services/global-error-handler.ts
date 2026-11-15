import { ErrorHandler, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorReportService } from './error-report.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private reports: ErrorReportService, private router: Router) {}

  public handleError(error: unknown): void {
    this.reports.capture(error);

    // Không điều hướng lặp nếu chính trang 500 gặp lỗi khi đang hiển thị.
    if (!this.router.url.startsWith('/500') && this.reports.beginErrorNavigation()) {
      void this.router.navigateByUrl('/500').catch(() => undefined);
    }
  }
}
