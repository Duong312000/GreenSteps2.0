import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FoodApi, FoodPlace, FOOD_CATEGORIES, FOOD_FEATURES } from './food-api';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-local-food',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './local-food.html',
  styleUrl: './local-food.css',
})
export class LocalFoodComponent implements OnInit, OnDestroy {
  private api = inject(FoodApi);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private routeQuerySubscription?: Subscription;
  places: FoodPlace[] = [];
  categories = FOOD_CATEGORIES;
  features = FOOD_FEATURES;
  destination = 'Đà Lạt';
  category = '';
  budget = '';
  selectedFeatures: string[] = [];
  query = '';
  sort = 'recommended';
  date = '';
  time = '';
  guests = 2;
  loading = true;
  error = '';
  page = 1;
  pageSize = 6;
  isMobileFilterOpen = false;
  isFiltering = false;
  selected: FoodPlace | null = null;
  booking = false;
  saving = false;
  fullname = '';
  phone = '';
  bookingError = '';
  notice = '';
  saved: string[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private fetching = false;
  private trigger?: HTMLElement;
  private filterTimer?: ReturnType<typeof setTimeout>;
  get today() {
    return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  }
  get destinations() {
    return [...new Set(this.places.map((p) => p.destination))];
  }
  get filtered() {
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .toLowerCase();
    const list = this.places.filter(
      (p) =>
        (!this.destination || p.destination === this.destination) &&
        (!this.category || p.category === this.category) &&
        (!this.query || normalize(p.name + ' ' + p.description).includes(normalize(this.query))) &&
        (!this.budget ||
          (this.budget === 'low'
            ? p.priceMin < 100000
            : this.budget === 'mid'
              ? p.priceMin >= 100000 && p.priceMin <= 200000
              : p.priceMin > 200000)) &&
        this.selectedFeatures.every((f) => p.features.includes(f)) &&
        p.capacity >= this.guests,
    );
    if (this.sort === 'price') list.sort((a, b) => a.priceMin - b.priceMin);
    if (this.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }
  get totalPages() {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }
  get pages() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
  get visible() {
    return this.filtered.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
  }
  async ngOnInit() {
    this.routeQuerySubscription = this.route.queryParamMap.subscribe(params => {
      const search = params.get('q') || params.get('search') || '';
      if (search !== this.query) {
        this.query = search;
        this.page = 1;
      }
    });
    try {
      const saved = JSON.parse(localStorage.getItem('greensteps_food_saved') || '[]');
      this.saved = Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : [];
    } catch {}
    await this.load();
    this.timer = setInterval(() => {
      if (!document.hidden) void this.load(true);
    }, 30000);
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.routeQuerySubscription?.unsubscribe();
    clearInterval(this.timer);
    clearTimeout(this.filterTimer);
  }
  @HostListener('window:focus') onFocus() {
    void this.load(true);
  }
  async load(quiet = false) {
    if (this.fetching || this.destroyed) return;
    this.fetching = true;
    if (!quiet) this.loading = true;
    try {
      const places = await this.api.list();
      if (this.destroyed) return;
      this.places = places;
      this.error = '';
      this.page = Math.min(this.page, this.totalPages);
    } catch {
      if (!this.destroyed)
        this.error = 'Không tải được danh sách quán. Kiểm tra kết nối và thử lại.';
    } finally {
      this.fetching = false;
      if (!this.destroyed) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }
  reset() {
    this.budget = '';
    this.selectedFeatures = [];
    this.category = '';
    this.query = '';
    this.sort = 'recommended';
    this.guests = 2;
    this.filterChanged();
    this.isMobileFilterOpen = false;
  }
  filterChanged() {
    this.page = 1;
    this.isFiltering = true;
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => {
      this.isFiltering = false;
      if (!this.destroyed) this.cdr.detectChanges();
    }, 180);
  }
  toggleMobileFilters() {
    this.isMobileFilterOpen = !this.isMobileFilterOpen;
  }
  toggleFeature(f: string) {
    this.selectedFeatures = this.selectedFeatures.includes(f)
      ? this.selectedFeatures.filter((x) => x !== f)
      : [...this.selectedFeatures, f];
    this.filterChanged();
  }
  toggleSave(p: FoodPlace) {
    this.saved = this.saved.includes(p.id)
      ? this.saved.filter((id) => id !== p.id)
      : [...this.saved, p.id];
    try {
      localStorage.setItem('greensteps_food_saved', JSON.stringify(this.saved));
      this.notice = 'Đã cập nhật quán yêu thích trên thiết bị này.';
    } catch {
      this.notice = 'Trình duyệt không cho phép lưu quán trên thiết bị.';
    }
  }
  open(p: FoodPlace, booking: boolean, event: Event) {
    this.trigger = event.currentTarget as HTMLElement;
    this.selected = p;
    this.booking = booking;
    this.bookingError = '';
    this.notice = '';
    this.fullname = this.auth.getCurrentUser()?.fullname || '';
    setTimeout(() => document.getElementById('food-dialog-close')?.focus());
  }
  close() {
    if (this.saving) return;
    this.selected = null;
    this.trigger?.focus();
  }
  trap(event: KeyboardEvent) {
    if (event.key === 'Escape') this.close();
    if (event.key !== 'Tab') return;
    const nodes = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,select,a[href]',
      ),
    );
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  async reserve() {
    if (!this.selected || this.saving) return;
    if (!this.auth.getCurrentUser()) {
      this.bookingError = 'Vui lòng đăng nhập bằng nút tài khoản để gửi yêu cầu đặt bàn.';
      return;
    }
    this.saving = true;
    this.bookingError = '';
    try {
      const result = await this.api.request<{ id: string }>(
        'POST',
        `/places/${this.selected.id}/reservations`,
        {
          date: this.date,
          time: this.time,
          guests: this.guests,
          fullname: this.fullname,
          phone: this.phone,
        },
      );
      this.notice = `Đã gửi yêu cầu ${result.id.slice(0, 8)}. Quán cần xác nhận trước khi bạn đến.`;
      this.saving = false;
      this.close();
    } catch (e: any) {
      this.bookingError = e?.error?.message || 'Chưa gửi được yêu cầu. Vui lòng thử lại.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
  addToSchedule(p: FoodPlace) {
    try {
      sessionStorage.setItem('greensteps_pending_food', p.id);
    } catch {
      this.notice = 'Trình duyệt không cho phép chuyển quán sang lịch trình.';
      return;
    }
    this.router.navigate(['/schedule']);
  }
  imageError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('/image/services/food_organic_vietnamese.png'))
      img.src = '/image/services/food_organic_vietnamese.png';
  }
}
