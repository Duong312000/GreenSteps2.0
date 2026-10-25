import { Component, DestroyRef, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User, Booking, Service } from '../../../models/models';
import { bookingDate, dashboardAnalytics, periodLabel } from './partner-dashboard.analytics';

@Component({
  selector: 'app-partner-dashboard',
  standalone: false,
  templateUrl: './partner-dashboard.html',
  styleUrl: './partner-dashboard.css',
})
export class PartnerDashboardComponent {
  private readonly destroyRef = inject(DestroyRef);
  public currentUser: User | null = null;
  public bookings: Booking[] = [];
  public services: Service[] = [];
  public selectedPeriod = 'all';
  public isLoading = true;
  public loadError = false;
  public analytics = dashboardAnalytics([], []);
  public tooltip: string | null = null;
  private loadSequence = 0;
  public readonly grid = [0, 1, 2, 3];
  public readonly statusLabels: Record<string, string> = {
    pending: 'Chờ xác nhận',
    deposit: 'Đã xác nhận',
    confirmed: 'Đã xác nhận',
    completed: 'Đã hoàn thành',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
    rejected: 'Đã từ chối',
    pending_payment: 'Chờ thanh toán',
    unpaid: 'Chờ thanh toán',
  };
  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    public cdr: ChangeDetectorRef,
    private loginModalService: LoginModalService,
  ) {
    this.authService.currentUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      this.currentUser = user;
      if (user?.role === 'provider') void this.loadDashboardData();
      else {
        this.isLoading = false;
        this.loginModalService.open();
      }
    });
  }
  get periods(): { key: string; label: string }[] {
    return [
      ...new Set(
        this.bookings
          .map(bookingDate)
          .filter((date): date is string => !!date)
          .map((date) => date.slice(0, 7)),
      ),
    ]
      .sort()
      .reverse()
      .map((key) => ({ key, label: periodLabel(key) }));
  }
  get periodText(): string {
    return this.selectedPeriod === 'all' ? 'Toàn bộ thời gian' : periodLabel(this.selectedPeriod);
  }
  get filteredBookings(): Booking[] {
    return this.selectedPeriod === 'all'
      ? this.bookings
      : this.bookings.filter((b) => bookingDate(b)?.startsWith(this.selectedPeriod));
  }
  get taskCount(): number {
    return Number(this.analytics.pendingBookings > 0) + Number(this.analytics.pendingServices > 0);
  }
  get allocationRows() {
    return [
      { key: 'tour', label: 'Gói tour', value: this.analytics.allocation.tour },
      { key: 'stay', label: 'Lưu trú', value: this.analytics.allocation.stay },
      { key: 'other', label: 'Dịch vụ khác', value: this.analytics.allocation.other },
    ];
  }
  get totalAllocation(): number {
    return this.filteredBookings.length;
  }
  formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
  }
  shortMoney(value: number): string {
    return value >= 1e6
      ? `${this.formatNumber(value / 1e6)}tr`
      : value >= 1000
        ? `${this.formatNumber(value / 1000)}k`
        : this.formatNumber(value);
  }
  displayDate(booking: Booking): string {
    const date = bookingDate(booking);
    return date ? `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : 'Chưa có ngày';
  }
  bookingStatus(booking: Booking): string {
    return this.statusLabels[booking.status] || booking.status || 'Chưa có trạng thái';
  }
  recalculate(): void {
    this.analytics = dashboardAnalytics(this.filteredBookings, this.services);
  }
  public async loadDashboardData(): Promise<void> {
    const providerId = this.currentUser?.id || this.currentUser?._id;
    if (!providerId) {
      this.isLoading = false;
      this.loadError = true;
      return;
    }
    const sequence = ++this.loadSequence;
    this.isLoading = true;
    this.loadError = false;
    try {
      const [bookings, services] = await Promise.all([
        this.apiService.getBookings(providerId),
        this.apiService.getMyServices(providerId),
      ]);
      if (sequence !== this.loadSequence || this.destroyRef.destroyed) return;
      this.bookings = bookings;
      this.services = services;
      this.recalculate();
    } catch {
      if (!this.destroyRef.destroyed) this.loadError = true;
    } finally {
      if (!this.destroyRef.destroyed && sequence === this.loadSequence) {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }
  public async approveBooking(id: string): Promise<void> {
    if (confirm('Bạn có chắc chắn muốn phê duyệt đặt cọc đơn hàng này?')) {
      const success = await this.apiService.approveBooking(id);
      if (success) {
        alert('Phê duyệt đặt cọc thành công!');
        await this.loadDashboardData();
      } else alert('Có lỗi xảy ra khi phê duyệt đơn hàng.');
      this.cdr.detectChanges();
    }
  }
  public async rejectBooking(id: string): Promise<void> {
    if (confirm('Bạn có chắc chắn muốn hủy/từ chối đơn hàng này?')) {
      const success = await this.apiService.rejectBooking(id);
      if (success) {
        alert('Đã từ chối đơn hàng thành công!');
        await this.loadDashboardData();
      } else alert('Có lỗi xảy ra khi từ chối đơn hàng.');
      this.cdr.detectChanges();
    }
  }
  exportCsv(): void {
    const escape = (text: unknown) =>
      '"' +
      String(text ?? '')
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""') +
      '"';
    const rows: unknown[][] = [
      ['Mã booking', 'Dịch vụ', 'Khách hàng', 'Ngày đặt', 'Trạng thái', 'Giá trị'],
    ];
    for (const b of this.filteredBookings)
      rows.push([
        b.id,
        b.service || b.service_name,
        b.customer || b.customer_name,
        this.displayDate(b),
        this.bookingStatus(b),
        b.value,
      ]);
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'greensteps-bookings.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export { PartnerDashboardComponent as PartnerDashboard };
