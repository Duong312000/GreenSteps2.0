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
import { Router, RouterModule } from '@angular/router';
import { FoodApi, FoodPlace, FOOD_CATEGORIES, FOOD_FEATURES } from './food-api';


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

  places: FoodPlace[] = [];
  categories = FOOD_CATEGORIES;
  features = FOOD_FEATURES;
  destination = '';
  category = '';
  budget = '';
  selectedFeatures: string[] = [];
  query = '';
  sort = 'recommended';
  guests = 2;
  loading = true;
  error = '';
  page = 1;
  pageSize = 6;
  isMobileFilterOpen = false;
  isFiltering = false;
  notice = '';
  saved: string[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private fetching = false;
  private filterTimer?: ReturnType<typeof setTimeout>;
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
        (!this.budget || (p.priceMin != null &&
          (this.budget === 'low'
            ? p.priceMin < 100000
            : this.budget === 'mid'
              ? p.priceMin >= 100000 && p.priceMin <= 200000
              : p.priceMin > 200000))) &&
        this.selectedFeatures.every((f) => p.features.includes(f)) &&
        (p.capacity == null || p.capacity >= this.guests),
    );
    if (this.sort === 'price') list.sort((a, b) => (a.priceMin ?? Infinity) - (b.priceMin ?? Infinity));
    if (this.sort === 'rating') list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
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
    this.destination = '';
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
    event.stopPropagation();
    void this.router.navigate(['/local-food', p.id], { fragment: booking ? 'booking' : undefined });
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
