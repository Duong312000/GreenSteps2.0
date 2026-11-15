import { AfterViewInit, Component, ElementRef, isDevMode, OnDestroy, ViewChild } from '@angular/core';
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

  constructor(private reports: ErrorReportService) {
    this.report = this.reports.ensureReference();
  }

  public ngAfterViewInit(): void {
    requestAnimationFrame(() => this.pageTitle?.nativeElement.focus());
  }

  public ngOnDestroy(): void {
    this.reports.endErrorNavigation();
  }

  public retry(): void {
    if (this.isRetrying) return;
    this.isRetrying = true;
    window.location.reload();
    window.setTimeout(() => this.isRetrying = false, 1800);
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
