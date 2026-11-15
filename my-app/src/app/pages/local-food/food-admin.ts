import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FoodApi, FoodPlace, FOOD_CATEGORIES, FOOD_FEATURES } from './food-api';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './food-admin.html',
  styleUrl: './food-admin.css',
})
export class FoodAdminComponent implements OnInit {
  private api = inject(FoodApi);
  private cdr = inject(ChangeDetectorRef);
  places: FoodPlace[] = [];
  reservations: any[] = [];
  categories = FOOD_CATEGORIES;
  features = FOOD_FEATURES;
  loading = true;
  busy = false;
  error = '';
  message = '';
  search = '';
  status = '';
  editing: FoodPlace | null = null;
  deleting: FoodPlace | null = null;
  get filtered() {
    return this.places.filter(
      (p) =>
        (!this.status || p.status === this.status) &&
        (p.name + ' ' + p.destination).toLowerCase().includes(this.search.toLowerCase()),
    );
  }
  ngOnInit() {
    void this.load();
  }
  trap(event: KeyboardEvent) {
    if (event.key === 'Escape' && !this.busy) {
      this.editing = null;
      this.deleting = null;
    }
    if (event.key !== 'Tab') return;
    const nodes = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,textarea,select',
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
  async load() {
    this.loading = true;
    this.error = '';
    try {
      const [places, reservations] = await Promise.all([
        this.api.list(true),
        this.api.request<any[]>('GET', '/admin/reservations'),
      ]);
      this.places = places;
      this.reservations = reservations;
    } catch (e: any) {
      this.error = e?.error?.message || 'Không tải được dữ liệu quản trị. Vui lòng thử lại.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  edit(p?: FoodPlace) {
    this.error = '';
    this.message = '';
    this.editing = p
      ? structuredClone(p)
      : {
          id: '',
          name: '',
          destination: 'Đà Lạt',
          address: '',
          description: '',
          category: this.categories[0],
          image: '/image/services/food_organic_vietnamese.png',
          priceMin: 0,
          priceMax: 0,
          priceUnit: 'người',
          hours: '08:00 – 21:00',
          capacity: 20,
          rating: 0,
          reviewCount: 0,
          features: [],
          menu: [{ name: '', price: 0 }],
          status: 'hidden',
          version: 0,
        };
    setTimeout(() => document.getElementById('food-admin-name')?.focus());
  }
  feature(f: string) {
    if (this.editing)
      this.editing.features = this.editing.features.includes(f)
        ? this.editing.features.filter((x) => x !== f)
        : [...this.editing.features, f];
  }
  async save() {
    if (!this.editing || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const p = this.editing;
      await this.api.request(
        p.id ? 'PUT' : 'POST',
        p.id ? `/admin/places/${p.id}` : '/admin/places',
        p,
      );
      this.editing = null;
      this.message = 'Đã lưu địa điểm. Trang khách lấy dữ liệu mới khi mở hoặc sau tối đa 30 giây.';
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.message || 'Không lưu được địa điểm. Kiểm tra kết nối và thử lại.';
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
  async remove() {
    if (!this.deleting || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.api.request('DELETE', `/admin/places/${this.deleting.id}`, {
        version: this.deleting.version,
      });
      this.deleting = null;
      this.message = 'Đã xóa địa điểm khỏi danh sách. Lịch sử yêu cầu vẫn được giữ.';
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.message || 'Không xóa được địa điểm.';
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
  async toggleStatus(p: FoodPlace) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.api.request('PUT', `/admin/places/${p.id}`, {
        ...p,
        status: p.status === 'published' ? 'hidden' : 'published',
      });
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.message || 'Không cập nhật được trạng thái.';
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
  async review(id: string, status: string) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.api.request('PATCH', `/admin/reservations/${id}`, { status });
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.message || 'Không cập nhật được yêu cầu.';
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
}
