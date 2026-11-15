import { Injectable, isDevMode } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface ErrorReport {
  id: string;
  occurredAt: Date;
  details: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorReportService {
  private latest?: ErrorReport;
  private redirecting = false;

  public capture(error: unknown): ErrorReport {
    const occurredAt = new Date();
    const details = this.formatDetails(error);
    this.latest = {
      id: `GS-${occurredAt.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      occurredAt,
      details,
    };

    if (isDevMode()) console.error('[GreenSteps] Unhandled application error', error);
    // TODO: gửi report tới Sentry hoặc logging service khi dự án cấu hình dịch vụ theo dõi lỗi.
    return this.latest;
  }

  public ensureReference(): ErrorReport {
    return this.latest ?? this.capture('Chưa có lỗi cụ thể được ghi nhận. Bạn có thể dùng trang này để xem trước trạng thái 500.');
  }

  private formatDetails(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const safePath = error.url ? this.getPathWithoutQuery(error.url) : '(không có URL)';
      const bodyMessage = typeof error.error === 'string'
        ? error.error
        : error.error && typeof error.error === 'object'
          ? error.error.message || error.error.error || ''
          : '';
      if (error.status === 0) {
        return [
          'Lỗi kết nối tới máy chủ API (status 0).',
          `Đường dẫn: ${safePath}`,
          `Nguyên nhân trình duyệt báo: ${error.message || 'Máy chủ không phản hồi.'}`,
        ].join('\n');
      }
      return [
        `Máy chủ API phản hồi HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}.`,
        `Đường dẫn: ${safePath}`,
        `Thông báo: ${bodyMessage || error.message || 'Không có nội dung lỗi chi tiết.'}`,
      ].join('\n');
    }

    if (error instanceof Error) {
      return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }

    if (error && typeof error === 'object') {
      const value = error as Record<string, unknown>;
      const parts = [
        value['name'] ? `Loại lỗi: ${String(value['name'])}` : '',
        value['message'] ? `Thông báo: ${String(value['message'])}` : '',
        typeof value['status'] === 'number' ? `HTTP status: ${value['status']}` : '',
        value['url'] ? `Đường dẫn: ${this.getPathWithoutQuery(String(value['url']))}` : '',
      ].filter(Boolean);
      if (parts.length) return parts.join('\n');
      try { return JSON.stringify(error, null, 2) || 'Đối tượng lỗi rỗng.'; }
      catch { return 'Không thể đọc nội dung đối tượng lỗi.'; }
    }

    return String(error ?? 'Không có thông tin lỗi.');
  }

  private getPathWithoutQuery(url: string): string {
    try { return new URL(url, window.location.origin).pathname; }
    catch { return url.split(/[?#]/, 1)[0]; }
  }

  public get latestReport(): ErrorReport | undefined {
    return this.latest;
  }

  public beginErrorNavigation(): boolean {
    if (this.redirecting) return false;
    this.redirecting = true;
    return true;
  }

  public endErrorNavigation(): void {
    this.redirecting = false;
  }
}
