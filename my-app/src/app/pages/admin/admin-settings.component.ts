import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountDetailModalComponent, AccountModalField } from './account-detail-modal.component';
import { ApiService } from '../../services/api.service';

@Component({ selector: 'app-admin-settings', standalone: true, imports: [CommonModule, FormsModule, AccountDetailModalComponent], templateUrl: './admin-settings.component.html', styleUrl: './admin-settings.component.css' })
export class AdminSettingsComponent implements OnInit {
  tab: 'categories' | 'booking' = 'categories';
  loadingCategories = true;
  loadingBooking = false;
  loadingAudit = false;
  categoriesLoaded = false;
  bookingLoaded = false;
  auditLoaded = false;
  categoryLoadError = '';
  bookingLoadError = '';
  auditLoadError = '';
  saving = false;
  error = '';
  message = '';
  categories: any[] = [];
  settings: any = {};
  addons: any[] = [];
  audit: any[] = [];
  modalOpen = false;
  modalTitle = '';
  modalSubmitLabel = 'Lưu thay đổi';
  modalKind: 'category' | 'addon' | 'archive' = 'category';
  modalId = '';
  categorySearch = '';
  categoryStatus: 'all' | 'active' | 'archived' = 'all';
  fields: AccountModalField[] = [];
  editValues: Record<string, any> = {};
  editReason = '';

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> { await this.loadCategories(); }

  get isRefreshing(): boolean {
    return this.tab === 'categories' ? this.loadingCategories : this.loadingBooking || this.loadingAudit;
  }
  get totalCategoryCount(): number { return this.categories.length; }
  get activeCategoryCount(): number { return this.categories.filter(category => category.active).length; }
  get categoryServiceCount(): number { return this.categories.reduce((total, category) => total + Number(category.serviceCount || 0), 0); }
  get filteredCategories(): any[] {
    const query = this.categorySearch.trim().toLocaleLowerCase();
    return this.categories.filter(category => {
      const matchesQuery = !query || `${category.name || ''} ${category.id || ''}`.toLocaleLowerCase().includes(query);
      const matchesStatus = this.categoryStatus === 'all' || (this.categoryStatus === 'active' ? !!category.active : !category.active);
      return matchesQuery && matchesStatus;
    });
  }

  async load(): Promise<void> {
    if (this.tab === 'categories') {
      await this.loadCategories(true);
      return;
    }
    await Promise.all([this.loadBooking(true), this.loadAudit(true)]);
  }

  async selectTab(tab: 'categories' | 'booking'): Promise<void> {
    this.tab = tab;
    this.cdr.markForCheck();
    if (tab === 'booking') await Promise.all([this.loadBooking(), this.loadAudit()]);
  }

  async loadCategories(force = false): Promise<void> {
    if (this.loadingCategories && this.categoriesLoaded) return;
    if (this.categoriesLoaded && !force) return;
    this.loadingCategories = true; this.categoryLoadError = ''; this.cdr.markForCheck();
    try {
      const response = await this.api.getAdminSettingsCategories();
      this.categories = response.categories || [];
      this.categoriesLoaded = true;
    } catch (e: any) {
      this.categoryLoadError = e?.error?.message || 'Không tải được danh mục. Vui lòng thử lại.';
    } finally {
      this.loadingCategories = false;
      this.cdr.markForCheck();
    }
  }

  async loadBooking(force = false): Promise<void> {
    if (this.loadingBooking || (this.bookingLoaded && !force)) return;
    this.loadingBooking = true; this.bookingLoadError = ''; this.cdr.markForCheck();
    try {
      const response = await this.api.getAdminBookingSettings();
      this.settings = response.settings || {};
      this.addons = response.addons || [];
      this.bookingLoaded = true;
    } catch (e: any) {
      this.bookingLoadError = e?.error?.message || 'Không tải được cấu hình đặt chỗ. Vui lòng thử lại.';
    } finally {
      this.loadingBooking = false;
      this.cdr.markForCheck();
    }
  }

  async loadAudit(force = false): Promise<void> {
    if (this.loadingAudit || (this.auditLoaded && !force)) return;
    this.loadingAudit = true; this.auditLoadError = ''; this.cdr.markForCheck();
    try {
      const response = await this.api.getAdminSettingsAudit();
      this.audit = response.data || [];
      this.auditLoaded = true;
    } catch (e: any) {
      this.auditLoadError = e?.error?.message || 'Không tải được lịch sử thay đổi. Vui lòng thử lại.';
    } finally {
      this.loadingAudit = false;
      this.cdr.markForCheck();
    }
  }

  async refreshAuditIfLoaded(): Promise<void> {
    if (this.auditLoaded) await this.loadAudit(true);
  }

  startCategory(row?: any): void {
    this.modalKind = 'category'; this.modalId = row?.id || ''; this.modalTitle = row ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'; this.modalSubmitLabel = row ? 'Lưu thay đổi' : 'Thêm danh mục';
    this.fields = [{ label: 'Tên danh mục', key: 'name', required: true }, { label: 'Thứ tự hiển thị', key: 'sort_order', type: 'number' }, { label: 'Biểu tượng (tùy chọn)', key: 'icon' }];
    this.editValues = { name: row?.name || '', sort_order: row?.sort_order || 0, icon: row?.icon || '' }; this.editReason = ''; this.error = ''; this.message = ''; this.modalOpen = true;
  }

  startAddon(row?: any): void {
    this.modalKind = 'addon'; this.modalId = row?.id || ''; this.modalTitle = row ? 'Chỉnh sửa dịch vụ thêm' : 'Thêm dịch vụ thêm'; this.modalSubmitLabel = row ? 'Lưu thay đổi' : 'Thêm dịch vụ';
    this.fields = [{ label: 'Mã (chỉ dùng khi tạo mới)', key: 'id', required: !row }, { label: 'Tên', key: 'name', required: true }, { label: 'Giá (VND)', key: 'unit_price', type: 'number', required: true }];
    this.editValues = { id: row?.id || '', name: row?.name || '', unit_price: row?.unit_price || 0 }; this.editReason = ''; this.error = ''; this.message = ''; this.modalOpen = true;
  }

  startArchive(row: any): void {
    this.modalKind = 'archive'; this.modalId = row.id; this.modalTitle = 'Xác nhận lưu trữ danh mục'; this.modalSubmitLabel = 'Xác nhận lưu trữ';
    this.fields = [{ label: 'Danh mục', value: row.name }, { label: 'Dịch vụ đang tham chiếu', value: Number(row.serviceCount || 0) }];
    this.editValues = {}; this.editReason = ''; this.error = ''; this.message = ''; this.modalOpen = true;
  }

  async saveModal(event: { values: Record<string, any>; reason: string }): Promise<void> {
    this.saving = true; this.error = ''; this.message = ''; this.cdr.markForCheck();
    try {
      if (this.modalKind === 'archive') {
        await this.api.archiveAdminSettingsCategory(this.modalId, event.reason);
        this.message = 'Đã lưu trữ danh mục.';
        this.modalOpen = false;
        await Promise.all([this.loadCategories(true), this.refreshAuditIfLoaded()]);
      } else if (this.modalKind === 'category') {
        const payload = { ...event.values, reason: event.reason };
        if (this.modalId) await this.api.updateAdminSettingsCategory(this.modalId, payload); else await this.api.createAdminSettingsCategory(payload);
        this.message = 'Đã lưu danh mục.';
        this.modalOpen = false;
        await Promise.all([this.loadCategories(true), this.refreshAuditIfLoaded()]);
      } else {
        const payload = { ...event.values, reason: event.reason };
        const response = this.modalId ? await this.api.updateAdminBookingAddon(this.modalId, payload) : await this.api.createAdminBookingAddon(payload);
        this.upsertAddon(response.addon || { ...payload, id: this.modalId || String(event.values['id'] || '') });
        this.bookingLoaded = true;
        this.message = 'Đã lưu dịch vụ thêm.';
        this.modalOpen = false;
        await this.refreshAuditIfLoaded();
      }
    } catch (e: any) {
      this.error = e?.error?.message || (this.modalKind === 'archive' ? 'Không thể lưu trữ danh mục.' : 'Không thể lưu thay đổi.');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  upsertAddon(addon: any): void {
    const index = this.addons.findIndex(item => item.id === addon.id);
    if (index < 0) this.addons = [...this.addons, addon];
    else this.addons = this.addons.map(item => item.id === addon.id ? { ...item, ...addon } : item);
  }

  async savePricing(form: any): Promise<void> {
    if (form.invalid || this.saving) return;
    this.saving = true; this.error = ''; this.message = ''; this.cdr.markForCheck();
    try {
      const result = await this.api.updateAdminBookingPricing({ ...this.settings, expectedVersion: this.settings.version, reason: this.settings.reason || 'Cập nhật cấu hình đặt chỗ' });
      this.settings = { ...result.settings, reason: '' };
      this.message = 'Đã lưu cấu hình đặt chỗ.';
      await this.refreshAuditIfLoaded();
    } catch (e: any) {
      this.error = e?.error?.code === 'CONFIG_VERSION_CONFLICT' ? 'Cấu hình vừa được Admin khác cập nhật. Dữ liệu mới nhất đã được tải lại.' : (e?.error?.message || 'Không thể lưu cấu hình.');
      if (e?.error?.settings) this.settings = e.error.settings;
      else if (e?.error?.code === 'CONFIG_VERSION_CONFLICT') await this.loadBooking(true);
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async toggleAddon(addon: any): Promise<void> {
    this.error = ''; this.cdr.markForCheck();
    try {
      const response = await this.api.updateAdminBookingAddon(addon.id, { active: !addon.active, reason: 'Thay đổi trạng thái dịch vụ thêm' });
      this.upsertAddon(response.addon || { ...addon, active: !addon.active });
      await this.refreshAuditIfLoaded();
    } catch (e: any) {
      this.error = e?.error?.message || 'Không thể cập nhật dịch vụ thêm.';
    } finally { this.cdr.markForCheck(); }
  }
}
