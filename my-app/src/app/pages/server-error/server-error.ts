import { AfterViewInit, Component, ElementRef, isDevMode, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorReport, ErrorReportService } from '../../services/error-report.service';

@Component({
  selector: 'app-server-error',
  standalone: false,
  templateUrl: './server-error.html',
  styleUrl: './server-error.css',
})
export class ServerErrorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pageTitle') private pageTitle?: ElementRef<HTMLHeadingElement>;

  public readonly isDev = isDevMode();
  public report: ErrorReport;
  public isRetrying = false;
  public copied = false;

  constructor(private reports: ErrorReportService, private router: Router) {
    this.report = this.reports.ensureReference();
  }

  public ngAfterViewInit(): void {
    requestAnimationFrame(() => this.pageTitle?.nativeElement.focus());
  }

  public ngOnDestroy(): void {
    this.reports.endErrorNavigation();
  }

  public async retry(): Promise<void> {
    if (this.isRetrying) return;
    this.isRetrying = true;
    try {
      const target = this.safeReturnUrl(window.history.state?.returnUrl) || '/home';
      const navigated = await this.router.navigateByUrl(target);
      if (!navigated) this.isRetrying = false;
    } catch {
      this.isRetrying = false;
    }
  }

  private safeReturnUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
    try {
      const target = new URL(value, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname === '/500') return null;
      for (const key of ['token', 'access_token', 'accessToken', 'refresh_token', 'resetToken', 'password', 'code']) {
        target.searchParams.delete(key);
      }
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return null;
    }
  }

  public async copyReference(): Promise<void> {
    if (!this.report?.id || this.copied) return;
    try {
      await navigator.clipboard.writeText(this.report.id);
      this.copied = true;
      window.setTimeout(() => this.copied = false, 1800);
    } catch {
      this.copied = false;
    }
  }
}
