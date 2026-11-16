import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { FoodApi, FoodPlace } from './food-api';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';

@Component({
  selector: 'app-food-detail', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './food-detail.html', styleUrl: './food-detail.css',
})
export class FoodDetailComponent implements OnInit, OnDestroy {
  private api = inject(FoodApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private login = inject(LoginModalService);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;
  private version = 0;
  place: FoodPlace | null = null;
  loading = true;
  error = '';
  bookingError = '';
  notice = '';
  saving = false;
  saved = false;
  date = '';
  time = '';
  guests = 2;
  fullname = '';
  phone = '';
  get today() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
  ngOnInit() {
    this.subscription = this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      // Route reuse emits during change detection; update loading on the next turn.
      queueMicrotask(() => { if (this.route.snapshot.paramMap.get('id') === id) void this.load(id); });
    });
  }
  ngOnDestroy() { this.version++; this.subscription?.unsubscribe(); }
  async load(id = this.route.snapshot.paramMap.get('id') || '') {
    const version = ++this.version;
    this.loading = true; this.error = ''; this.place = null; this.notice = ''; this.bookingError = '';
    try {
      const place = await this.api.request<FoodPlace>('GET', `/places/${encodeURIComponent(id)}`);
      if (version !== this.version) return;
      this.place = place;
      this.guests = Math.min(2, place.capacity ?? 2);
      this.fullname = this.auth.getCurrentUser()?.fullname || '';
      this.date = this.today;
      try { const saved = JSON.parse(localStorage.getItem('greensteps_food_saved') || '[]'); this.saved = Array.isArray(saved) && saved.includes(place.id); } catch { this.saved = false; }
    } catch (error: any) {
      if (version !== this.version) return;
      this.error = error?.status === 404 ? 'Địa điểm này không còn được hiển thị.' : 'Không tải được thông tin địa điểm. Vui lòng thử lại.';
    } finally {
      if (version === this.version) {
        this.loading = false; this.cdr.detectChanges();
        if (this.place && this.route.snapshot.fragment === 'booking') document.getElementById('booking')?.scrollIntoView({ block: 'start' });
      }
    }
  }
  scrollTo(event: MouseEvent, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  toggleSave() {
    if (!this.place) return;
    try {
      const raw = JSON.parse(localStorage.getItem('greensteps_food_saved') || '[]');
      const ids: string[] = Array.isArray(raw) ? raw.filter(id => typeof id === 'string') : [];
      const saved = !ids.includes(this.place.id);
      localStorage.setItem('greensteps_food_saved', JSON.stringify(saved ? [...ids, this.place.id] : ids.filter(id => id !== this.place!.id)));
      this.saved = saved;
    } catch { this.notice = 'Không thể lưu địa điểm trên trình duyệt này.'; }
  }
  async share() {
    try { await navigator.clipboard.writeText(location.href); this.notice = 'Đã sao chép liên kết địa điểm.'; }
    catch { this.notice = 'Bạn có thể sao chép địa chỉ trang để chia sẻ địa điểm.'; }
    this.cdr.detectChanges();
  }
  addToSchedule() {
    if (!this.place) return;
    try { sessionStorage.setItem('greensteps_pending_food', this.place.id); void this.router.navigate(['/schedule']); }
    catch { this.notice = 'Không thể chuyển địa điểm sang lịch trình.'; }
  }
  async reserve() {
    if (!this.place || this.saving) return;
    if (this.place.bookingEnabled === false) { this.bookingError = 'Vui lòng liên hệ trực tiếp với quán.'; return; }
    if (!this.auth.getCurrentUser()) { this.bookingError = 'Vui lòng đăng nhập để gửi yêu cầu đặt bàn.'; this.login.open(); return; }
    this.saving = true; this.bookingError = ''; this.notice = '';
    try {
      const result = await this.api.request<{ id: string }>('POST', `/places/${encodeURIComponent(this.place.id)}/reservations`, {
        date: this.date, time: this.time, guests: this.guests, fullname: this.fullname, phone: this.phone,
      });
      this.notice = `Đã gửi yêu cầu ${result.id.slice(0, 8)}. Vui lòng chờ xác nhận trước khi đến quán.`;
    } catch (error: any) { this.bookingError = error?.error?.message || 'Chưa gửi được yêu cầu. Vui lòng thử lại.'; }
    finally { this.saving = false; this.cdr.detectChanges(); }
  }
  imageError(event: Event) {
    const image = event.target as HTMLImageElement;
    if (image.getAttribute('src') !== '/image/service-photo-pending.svg') image.src = '/image/service-photo-pending.svg';
  }
}
