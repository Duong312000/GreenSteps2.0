import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import {
  PartnerPromotionsService,
  PartnerCampaign,
  PromotionServiceOption,
} from '../../../services/partner-promotions.service';

@Component({
  selector: 'app-partner-promotions',
  standalone: false,
  templateUrl: './partner-promotions.html',
  styleUrl: './partner-promotions.css',
})
export class PartnerPromotionsComponent implements OnInit, OnDestroy {
  @ViewChild('editor') editor!: ElementRef<HTMLDialogElement>;
  @ViewChild('viewer') viewer!: ElementRef<HTMLDialogElement>;
  @ViewChild('confirmation') confirmation!: ElementRef<HTMLDialogElement>;
  readonly tabs = [
    { id: '', label: 'Tất cả chiến dịch' },
    { id: 'promotion', label: 'Quảng bá dịch vụ' },
    { id: 'flash_sale', label: 'Flash Sale' },
    { id: 'voucher', label: 'Mã ưu đãi' },
  ];
  readonly types: Record<string, string> = {
    promotion: 'Quảng bá dịch vụ',
    flash_sale: 'Flash Sale',
    voucher: 'Mã ưu đãi',
  };
  readonly statuses: Record<string, string> = {
    active: 'Đang chạy',
    scheduled: 'Đã lên lịch',
    paused: 'Tạm dừng',
    expired: 'Đã kết thúc',
    cancelled: 'Đã hủy',
    exhausted: 'Hết lượt',
  };
  readonly packageNames: Record<string, string> = {
    discovery: 'Khám phá',
    featured: 'Nổi bật',
    premium: 'Ưu tiên',
  };
  tab = '';
  query = '';
  typeFilter = '';
  statusFilter = '';
  from = '';
  to = '';
  page = 1;
  pageSize = 10;
  total = 0;
  items: PartnerCampaign[] = [];
  services: PromotionServiceOption[] = [];
  packages: Record<string, number> = {};
  loading = false;
  saving = false;
  optionsLoading = false;
  error = '';
  notice = '';
  formMessage = '';
  optionsError = '';
  menuId = '';
  editing: PartnerCampaign | null = null;
  selected: PartnerCampaign | null = null;
  report: Record<string, any> | null = null;
  pending: { row: PartnerCampaign; action: 'delete' | 'cancel' } | null = null;
  form: any = {};
  private subscription?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private requestId = 0;
  private alive = true;
  constructor(
    private api: PartnerPromotionsService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}
  ngOnInit() {
    this.subscription = this.auth.currentUser$.subscribe((user) => {
      this.items = [];
      this.total = 0;
      if (user?.role === 'provider') {
        void this.loadOptions();
        void this.load();
      } else {
        ++this.requestId;
        this.loading = false;
        this.services = [];
        this.error = 'Vui lòng đăng nhập tài khoản nhà cung cấp.';
      }
    });
  }
  ngOnDestroy() {
    this.alive = false;
    ++this.requestId;
    this.subscription?.unsubscribe();
    clearTimeout(this.searchTimer);
  }
  private refresh() {
    if (this.alive) this.cdr.detectChanges();
  }
  private message(error: any) {
    return error?.error?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  }
  get pages() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
  get first() {
    return this.total ? (this.page - 1) * this.pageSize + 1 : 0;
  }
  get last() {
    return Math.min(this.page * this.pageSize, this.total);
  }
  async loadOptions() {
    this.optionsLoading = true;
    this.optionsError = '';
    try {
      const data = await this.api.optionsList();
      this.services = data.services;
      this.packages = data.packages;
    } catch (error) {
      this.optionsError = this.message(error);
    } finally {
      this.optionsLoading = false;
      this.refresh();
    }
  }
  async load() {
    const request = ++this.requestId;
    this.loading = true;
    this.error = '';
    this.menuId = '';
    try {
      if (this.from && this.to && this.from > this.to)
        throw { error: { message: 'Ngày kết thúc lọc phải sau ngày bắt đầu.' } };
      const data = await this.api.list({
        q: this.query.trim(),
        type: this.tab || this.typeFilter,
        status: this.statusFilter,
        from: this.from ? new Date(`${this.from}T00:00:00`).toISOString() : '',
        to: this.to ? new Date(`${this.to}T23:59:59.999`).toISOString() : '',
        page: this.page,
        limit: this.pageSize,
      });
      if (!this.alive || request !== this.requestId) return;
      this.items = data.items;
      this.total = data.total;
      if (this.page > this.pages) {
        this.page = this.pages;
        await this.load();
      }
    } catch (error) {
      if (request === this.requestId) {
        this.error = this.message(error);
        this.items = [];
        this.total = 0;
      }
    } finally {
      if (request === this.requestId) {
        this.loading = false;
        this.refresh();
      }
    }
  }
  changeTab(id: string) {
    this.tab = id;
    this.typeFilter = '';
    this.page = 1;
    void this.load();
  }
  filter() {
    clearTimeout(this.searchTimer);
    this.page = 1;
    void this.load();
  }
  search() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.filter(), 300);
  }
  reset() {
    this.query = this.typeFilter = this.statusFilter = this.from = this.to = '';
    this.filter();
  }
  paginate(value: number) {
    this.page = Math.max(1, Math.min(this.pages, value));
    void this.load();
  }
  editable(row: PartnerCampaign) {
    return !['cancelled', 'expired', 'exhausted'].includes(row.effective_status);
  }
  icon(type: string) {
    return type === 'promotion'
      ? 'bi-megaphone'
      : type === 'flash_sale'
        ? 'bi-lightning-charge'
        : 'bi-ticket-perforated';
  }
  private localDate(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  openCreate() {
    this.editing = null;
    this.formMessage = '';
    this.menuId = '';
    const start = new Date(Date.now() + 5 * 60000);
    this.form = {
      name: '',
      type: this.tab || 'promotion',
      service_id: '',
      start_at: this.localDate(start),
      end_at: this.localDate(new Date(+start + 86400000)),
      package: 'featured',
      budget: 150000,
      discount_type: 'percent',
      discount_value: 10,
      min_order: 0,
      usage_limit: 100,
      code: '',
    };
    this.editor.nativeElement.showModal();
  }
  async openEdit(row: PartnerCampaign) {
    this.menuId = '';
    this.error = '';
    try {
      const { item } = await this.api.detail(row.id);
      this.editing = item;
      this.formMessage = '';
      this.form = {
        ...item,
        service_id: item.service_id || '',
        start_at: this.localDate(new Date(item.start_at)),
        end_at: this.localDate(new Date(item.end_at)),
      };
      this.editor.nativeElement.showModal();
    } catch (error) {
      this.error = this.message(error);
    }
    this.refresh();
  }
  get requiredBudget() {
    return (
      (this.packages[this.form.package] || 0) *
      Math.max(
        1,
        Math.ceil((+new Date(this.form.end_at) - +new Date(this.form.start_at)) / 86400000) || 1,
      )
    );
  }
  get formError(): string {
    const f = this.form;
    if (!f.name?.trim() || f.name.trim().length < 3 || f.name.trim().length > 120)
      return 'Tên chiến dịch cần từ 3 đến 120 ký tự.';
    if (f.type !== 'voucher' && !f.service_id) return 'Vui lòng chọn một dịch vụ đang hoạt động.';
    if (!f.start_at || !f.end_at || +new Date(f.end_at) <= +new Date(f.start_at))
      return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    if (+new Date(f.end_at) <= Date.now()) return 'Thời hạn phải nằm trong tương lai.';
    if (
      (!this.editing || f.start_at !== this.localDate(new Date(this.editing.start_at))) &&
      +new Date(f.start_at) < Date.now() - 60000
    )
      return 'Thời gian bắt đầu không được ở quá khứ.';
    if (f.type === 'promotion') {
      if (!this.packages[f.package] || !Number.isFinite(f.budget) || f.budget < this.requiredBudget)
        return `Ngân sách tối thiểu là ${this.requiredBudget.toLocaleString('vi-VN')} đ cho gói và thời gian đã chọn.`;
    } else {
      if (
        !Number.isFinite(f.discount_value) ||
        f.discount_value < 1 ||
        (f.discount_type === 'percent' && f.discount_value > 100)
      )
        return 'Mức giảm phải lớn hơn 0 và không quá 100%.';
      const service = this.services.find((s) => s.id === f.service_id);
      if (f.discount_type === 'fixed' && service && f.discount_value > service.cost)
        return 'Mức giảm không được vượt giá dịch vụ.';
      if (!Number.isFinite(f.min_order) || f.min_order < 0)
        return 'Giá trị đơn tối thiểu không hợp lệ.';
      if (
        !Number.isInteger(f.usage_limit) ||
        f.usage_limit < Math.max(1, this.editing?.used_count || 0)
      )
        return 'Giới hạn phải là số nguyên dương, không thấp hơn số lượt đã dùng.';
      if (f.type === 'voucher' && !/^[A-Z0-9_-]{3,32}$/i.test((f.code || '').trim()))
        return 'Mã cần 3–32 ký tự: chữ không dấu, số, _ hoặc -.';
    }
    return '';
  }
  async save() {
    this.formMessage = this.formError;
    if (this.formMessage || this.saving) return;
    this.saving = true;
    try {
      const start_at =
        this.editing && this.form.start_at === this.localDate(new Date(this.editing.start_at))
          ? this.editing.start_at
          : new Date(this.form.start_at).toISOString();
      const body = {
        ...this.form,
        name: this.form.name.trim(),
        start_at,
        end_at: new Date(this.form.end_at).toISOString(),
        version: this.editing?.version,
      };
      await this.api.save(body, this.editing?.id);
      this.editor.nativeElement.close();
      this.notice = this.editing ? 'Đã cập nhật chiến dịch.' : 'Đã tạo chiến dịch thành công.';
      await this.load();
    } catch (error) {
      this.formMessage = this.message(error);
    } finally {
      this.saving = false;
      this.refresh();
    }
  }
  async changeStatus(row: PartnerCampaign, status: string) {
    if (this.saving) return;
    this.saving = true;
    this.menuId = '';
    this.error = '';
    try {
      await this.api.status(row, status);
      this.notice = 'Đã cập nhật trạng thái chiến dịch.';
      await this.load();
    } catch (error) {
      this.error = this.message(error);
    } finally {
      this.saving = false;
      this.refresh();
    }
  }
  confirm(row: PartnerCampaign, action: 'delete' | 'cancel') {
    this.pending = { row, action };
    this.menuId = '';
    this.confirmation.nativeElement.showModal();
  }
  async execute() {
    if (!this.pending || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      const { row, action } = this.pending;
      if (action === 'delete') await this.api.remove(row);
      else await this.api.status(row, 'cancelled');
      this.confirmation.nativeElement.close();
      this.pending = null;
      this.notice = 'Đã hủy/lưu trữ chiến dịch và giữ lại lịch sử.';
      await this.load();
    } catch (error) {
      this.error = this.message(error);
      this.confirmation.nativeElement.close();
    } finally {
      this.saving = false;
      this.refresh();
    }
  }
  async view(row: PartnerCampaign, withReport = false) {
    this.menuId = '';
    this.error = '';
    this.report = null;
    try {
      const { item } = await this.api.detail(row.id);
      this.selected = item;
      if (withReport) this.report = (await this.api.report(row.id)).report;
      this.viewer.nativeElement.showModal();
    } catch (error) {
      this.error = this.message(error);
    }
    this.refresh();
  }
  closeEditor() {
    if (!this.saving) this.editor.nativeElement.close();
  }
  cancelDialog(event: Event) {
    if (this.saving) event.preventDefault();
  }
  track(_: number, row: PartnerCampaign) {
    return row.id;
  }
}
export { PartnerPromotionsComponent as PartnerPromotions };
