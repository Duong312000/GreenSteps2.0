import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({ selector: 'app-my-vouchers', standalone: true, imports: [CommonModule, RouterLink],
  templateUrl: './my-vouchers.html', styleUrl: './my-vouchers.css' })
export class MyVouchersComponent implements OnInit, OnDestroy {
  vouchers: any[] = [];
  loading = true;
  error = '';
  copied = '';
  copyError = '';
  filter = 'all';
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private busy = false;
  filters = [{ id: 'all', label: 'Tất cả' }, { id: 'active', label: 'Có thể dùng' },
    { id: 'used', label: 'Đã dùng' }, { id: 'expired', label: 'Hết hạn / Tạm dừng' }];
  ngOnInit() { void this.load(); this.timer = setInterval(() => { if (document.visibilityState === 'visible') void this.load(false); }, 30000); }
  ngOnDestroy() { this.destroyed = true; if (this.timer) clearInterval(this.timer); }
  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}
  @HostListener('document:visibilitychange') onVisibilityChange() { if (document.visibilityState === 'visible') void this.load(false); }
  async load(showLoading = true) {
    if (this.busy) return;
    this.busy = true; if (showLoading) this.loading = true;
    try {
      const result = await this.api.getSavedPromotions();
      if (!this.destroyed) { this.vouchers = result; this.error = ''; }
    } catch { if (!this.destroyed) this.error = 'Chưa tải được mã giảm giá. Vui lòng thử lại.'; }
    finally { this.busy = false; if (!this.destroyed) { this.loading = false; this.cdr.detectChanges(); } }
  }
  get filtered() { return this.vouchers.filter(v => this.filter === 'all' || (this.filter === 'expired' ? !['active', 'used'].includes(v.status) : v.status === this.filter)); }
  statusLabel(status: string) { return ({ active: 'Có thể dùng', used: 'Đã sử dụng', expired: 'Đã hết hạn', unavailable: 'Tạm ngừng áp dụng', scheduled: 'Chưa đến ngày áp dụng' } as Record<string, string>)[status] || status; }
  money(value: number) { return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ'; }
  async copy(voucher: any) {
    this.copyError = '';
    try { await navigator.clipboard.writeText(voucher.code); this.copied = voucher.id; }
    catch { this.copyError = 'Chưa sao chép được. Bạn có thể chọn và sao chép mã trực tiếp.'; }
    this.cdr.detectChanges();
  }
}
