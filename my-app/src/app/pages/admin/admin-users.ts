import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, AdminUserQuery } from '../../services/api.service';
import { AccountModalAction, AccountModalField, AccountModalRecord, AccountModalTab, AccountDetailModalComponent } from './account-detail-modal.component';

type UserAction = 'suspend' | 'unsuspend' | 'deactivate' | 'reactivate' | 'role';
type DrawerTab = 'info' | 'activity' | 'bookings' | 'admin';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AccountDetailModalComponent],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css'
})
export class AdminUsersComponent implements OnDestroy, OnInit {
  public stats: any = null;
  public users: any[] = [];
  public readonly skeletonRows = [0, 1, 2, 3, 4];
  public readonly skeletonColumns = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  public pagination = { page: 1, limit: 10, total: 0, pages: 0 };
  public loading = true;
  public statsLoading = true;
  public error = '';
  public statsError = '';
  public roleOptions: Array<{ value: string; label: string }> = [];
  public statusOptions: Array<{ value: string; label: string }> = [];
  public search = '';
  public role = '';
  public status = '';
  public startDate = '';
  public endDate = '';
  public sort = 'createdAt';
  public order = 'desc';
  public selectedIds = new Set<string>();
  public detail: any = null;
  public drawerLoading = false;
  public drawerError = '';
  public activityError = '';
  public bookingsError = '';
  public drawerTab: DrawerTab = 'info';
  public activity: any[] = [];
  public adminHistory: any[] = [];
  public adminHistoryLoaded = false;
  public adminHistoryPage = 0;
  public adminHistoryPages = 0;
  public bookings: any[] = [];
  public activityPage = 0;
  public activityPages = 0;
  public bookingsPage = 0;
  public bookingsPages = 0;
  public activityLoading = false;
  public adminHistoryLoading = false;
  public adminHistoryError = '';
  public bookingsLoading = false;
  public createOpen = false;
  public createBusy = false;
  public createForm: FormGroup;
  public action: { type: UserAction; user: any; targets?: any[] } | null = null;
  public actionReason = '';
  public nextRole = 'traveler';
  public actionBusy = false;
  public accountStatusBusy = false;
  public editing = false;
  public editForm: any = {};
  public editReason = '';
  public editBusy = false;
  public toast = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private usersRequestId = 0;
  private statsRequestId = 0;
  private detailRequestId = 0;
  private activityRequestId = 0;
  private adminHistoryRequestId = 0;
  private bookingsRequestId = 0;

  constructor(private api: ApiService, formBuilder: FormBuilder, private cdr: ChangeDetectorRef) {
    this.createForm = formBuilder.group({
      fullname: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      role: ['traveler'],
      reason: ['', [Validators.required, Validators.maxLength(1000)]]
    });
  }

  ngOnInit(): void { void this.reload(); }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.usersRequestId++;
    this.statsRequestId++;
    this.detailRequestId++;
    this.activityRequestId++;
    this.adminHistoryRequestId++;
    this.bookingsRequestId++;
  }

  public async reload(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadStats()]);
  }

  public refreshData(): Promise<void> {
    this.api.refreshAdminUserData();
    return this.reload();
  }

  public get query(): AdminUserQuery {
    return {
      search: this.search.trim() || undefined,
      role: this.role || undefined,
      status: this.status || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      page: this.pagination.page,
      limit: this.pagination.limit,
      sort: this.sort,
      order: this.order
    };
  }

  public async loadUsers(): Promise<void> {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    const requestId = ++this.usersRequestId;
    const query = { ...this.query };
    this.loading = true;
    this.error = '';
    try {
      const response = await this.api.getAdminUsers(query);
      if (requestId !== this.usersRequestId) return;
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Users unavailable');
      this.users = response?.success && Array.isArray(response.data) ? response.data : [];
      this.pagination = { ...this.pagination, ...(response?.pagination || {}) };
      this.selectedIds.clear();
    } catch {
      if (requestId === this.usersRequestId) {
        this.users = [];
      this.error = 'Không tải được danh sách người dùng. Kiểm tra quyền quản trị và kết nối API rồi thử lại.';
      }
    } finally {
      if (requestId === this.usersRequestId) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  public async loadStats(): Promise<void> {
    const requestId = ++this.statsRequestId;
    this.statsLoading = true;
    this.statsError = '';
    try {
      const response = await this.api.getAdminUserStats();
      if (!response?.success) throw new Error('Stats unavailable');
      if (requestId !== this.statsRequestId) return;
      this.stats = response.stats;
      this.roleOptions = (response.roles || []).map((value: string) => ({ value, label: this.displayRole(value) }));
      const statusLabels: Record<string, string> = { active: 'Đang hoạt động', suspended: 'Tạm khóa', deactivated: 'Vô hiệu hóa', unverified: 'Chờ xác minh' };
      this.statusOptions = (response.statuses || []).map((value: string) => ({ value, label: statusLabels[value] || value }));
    } catch {
      if (requestId === this.statsRequestId) {
      this.stats = null;
      this.statsError = 'Không tải được thống kê.';
      }
    } finally {
      if (requestId === this.statsRequestId) {
        this.statsLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  public onSearchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.usersRequestId++;
    this.loading = false;
    this.searchTimer = setTimeout(() => { this.pagination.page = 1; void this.loadUsers(); }, 300);
  }

  public applyFilters(): void { this.pagination.page = 1; void this.loadUsers(); }

  public resetFilters(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.search = ''; this.role = ''; this.status = ''; this.startDate = ''; this.endDate = '';
    this.sort = 'createdAt'; this.order = 'desc'; this.pagination.page = 1;
    void this.loadUsers();
  }

  public quickDateRange(value: string): void {
    if (!value) return;
    const end = new Date();
    const start = new Date(end);
    if (value === 'today') start.setHours(0, 0, 0, 0);
    else if (value === '7d') start.setDate(start.getDate() - 6);
    else if (value === '30d') start.setDate(start.getDate() - 29);
    else return;
    this.startDate = start.toISOString().slice(0, 10);
    this.endDate = end.toISOString().slice(0, 10);
    this.applyFilters();
  }

  public changePage(page: number): void {
    if (page < 1 || page > this.pagination.pages || page === this.pagination.page) return;
    this.pagination.page = page;
    void this.loadUsers();
  }

  public changeLimit(value: string): void {
    const limit = Number(value);
    if (![10, 20, 50].includes(limit)) return;
    this.pagination.limit = limit; this.pagination.page = 1;
    void this.loadUsers();
  }

  public setSort(field: string): void {
    if (!['createdAt', 'last_login_at', 'fullname', 'email'].includes(field)) return;
    this.order = this.sort === field && this.order === 'desc' ? 'asc' : 'desc';
    this.sort = field; this.pagination.page = 1;
    void this.loadUsers();
  }

  public toggleUser(user: any, checked: boolean): void {
    if (checked) this.selectedIds.add(user.id); else this.selectedIds.delete(user.id);
  }

  public get allPageSelected(): boolean {
    return this.users.length > 0 && this.users.every(user => this.selectedIds.has(user.id));
  }

  public trackByUserId(_index: number, user: any): string { return user.id; }

  public get pageEnd(): number { return Math.min(this.pagination.page * this.pagination.limit, this.pagination.total); }

  public initials(name: string): string {
    return String(name || '?').trim().split(/\s+/).slice(-2).map(part => part[0] || '').join('').toLocaleUpperCase('vi') || '?';
  }

  public toggleCurrentPage(checked: boolean): void {
    for (const user of this.users) {
      if (checked) this.selectedIds.add(user.id); else this.selectedIds.delete(user.id);
    }
  }

  public async exportList(selected = false): Promise<void> {
    try {
      const blob = await this.api.exportAdminUsers(this.query, selected ? [...this.selectedIds] : []);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'greensteps-users.csv'; link.click();
      URL.revokeObjectURL(url);
      this.notify('Đã xuất danh sách người dùng.');
    } catch { this.notify('Xuất danh sách thất bại.'); }
  }

  public async openDetail(user: any): Promise<void> {
    const requestId = ++this.detailRequestId;
    const userId = String(user.id);
    this.activityRequestId++;
    this.adminHistoryRequestId++;
    this.bookingsRequestId++;
    this.detail = user;
    this.drawerTab = 'info'; this.activity = []; this.adminHistory = []; this.adminHistoryLoaded = false; this.adminHistoryPage = 0; this.adminHistoryPages = 0; this.bookings = [];
    this.activityLoading = false; this.adminHistoryLoading = false; this.bookingsLoading = false;
    this.activityPage = 0; this.activityPages = 0; this.bookingsPage = 0; this.bookingsPages = 0;
    this.activityError = ''; this.adminHistoryError = ''; this.bookingsError = '';
    this.drawerLoading = true; this.drawerError = ''; this.editing = false;
    try {
      const response = await this.api.getAdminUser(userId);
      if (requestId !== this.detailRequestId || this.detail?.id !== userId) return;
      if (!response?.success || !response.user) throw new Error('User unavailable');
      this.detail = { ...response.user, activityStats: response.activityStats };
    } catch { if (requestId === this.detailRequestId && this.detail?.id === userId) this.drawerError = 'Không tải được hồ sơ người dùng.'; }
    finally {
      if (requestId === this.detailRequestId && this.detail?.id === userId) {
        this.drawerLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  public closeDetail(): void {
    this.detailRequestId++;
    this.activityRequestId++;
    this.adminHistoryRequestId++;
    this.bookingsRequestId++;
    this.detail = null;
    this.drawerLoading = false;
    this.editing = false;
  }

  public async setDrawerTab(tab: DrawerTab | string): Promise<void> {
    if (!['info', 'activity', 'bookings', 'admin'].includes(tab)) return;
    const selectedTab = tab as DrawerTab;
    this.drawerTab = selectedTab;
    if (!this.detail) return;
    const userId = String(this.detail.id);
    if (tab === 'activity' && this.activityPage === 0 && !this.activityLoading) {
      const requestId = ++this.activityRequestId;
      this.activityLoading = true;
      this.activityError = '';
      try {
        const response = await this.api.getAdminUserEvents(userId);
        if (requestId !== this.activityRequestId || this.detail?.id !== userId || this.drawerTab !== 'activity') return;
        this.activity = response?.data || []; this.activityPage = response?.pagination?.page || 1; this.activityPages = response?.pagination?.pages || 0;
      }
      catch { if (requestId === this.activityRequestId && this.detail?.id === userId && this.drawerTab === 'activity') this.activityError = 'Không tải được lịch sử quản trị.'; }
      finally {
        if (requestId === this.activityRequestId && this.detail?.id === userId) {
          this.activityLoading = false;
          this.cdr.markForCheck();
        }
      }
    }
    if (tab === 'admin' && !this.adminHistoryLoaded && !this.adminHistoryLoading) {
      const requestId = ++this.adminHistoryRequestId;
      this.adminHistoryLoading = true;
      this.adminHistoryError = '';
      try {
        const response = await this.api.getAdminUserActivity(userId);
        if (requestId !== this.adminHistoryRequestId || this.detail?.id !== userId || this.drawerTab !== 'admin') return;
        this.adminHistory = response?.data || [];
        this.adminHistoryPage = response?.pagination?.page || 1;
        this.adminHistoryPages = response?.pagination?.pages || 0;
        this.adminHistoryLoaded = true;
      } catch { if (requestId === this.adminHistoryRequestId && this.detail?.id === userId && this.drawerTab === 'admin') this.adminHistoryError = 'Không tải được lịch sử quản trị.'; }
      finally {
        if (requestId === this.adminHistoryRequestId && this.detail?.id === userId) {
          this.adminHistoryLoading = false;
          this.cdr.markForCheck();
        }
      }
    }
    if (tab === 'bookings' && this.bookingsPage === 0 && !this.bookingsLoading) {
      const requestId = ++this.bookingsRequestId;
      this.bookingsLoading = true;
      this.bookingsError = '';
      try {
        const response = await this.api.getAdminUserBookings(userId);
        if (requestId !== this.bookingsRequestId || this.detail?.id !== userId || this.drawerTab !== 'bookings') return;
        this.bookings = response?.data || []; this.bookingsPage = response?.pagination?.page || 1; this.bookingsPages = response?.pagination?.pages || 0;
      }
      catch { if (requestId === this.bookingsRequestId && this.detail?.id === userId && this.drawerTab === 'bookings') this.bookingsError = 'Không tải được lịch sử booking.'; }
      finally {
        if (requestId === this.bookingsRequestId && this.detail?.id === userId) {
          this.bookingsLoading = false;
          this.cdr.markForCheck();
        }
      }
    }
  }

  public async loadMoreActivity(): Promise<void> {
    if (!this.detail || this.activityLoading || this.activityPage >= this.activityPages) return;
    const requestId = ++this.activityRequestId;
    const userId = String(this.detail.id);
    const page = this.activityPage + 1;
    this.activityLoading = true;
    try {
      const response = await this.api.getAdminUserEvents(userId, page);
      if (requestId !== this.activityRequestId || this.detail?.id !== userId || this.drawerTab !== 'activity') return;
      this.activity = [...this.activity, ...(response?.data || [])]; this.activityPage = response?.pagination?.page || this.activityPage + 1; this.activityPages = response?.pagination?.pages || this.activityPages;
    } catch { if (requestId === this.activityRequestId && this.detail?.id === userId && this.drawerTab === 'activity') this.activityError = 'Không tải thêm được lịch sử quản trị.'; }
    finally {
      if (requestId === this.activityRequestId && this.detail?.id === userId) {
        this.activityLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  public async loadMoreBookings(): Promise<void> {
    if (!this.detail || this.bookingsLoading || this.bookingsPage >= this.bookingsPages) return;
    const requestId = ++this.bookingsRequestId;
    const userId = String(this.detail.id);
    const page = this.bookingsPage + 1;
    this.bookingsLoading = true;
    try {
      const response = await this.api.getAdminUserBookings(userId, page);
      if (requestId !== this.bookingsRequestId || this.detail?.id !== userId || this.drawerTab !== 'bookings') return;
      this.bookings = [...this.bookings, ...(response?.data || [])]; this.bookingsPage = response?.pagination?.page || this.bookingsPage + 1;
    } catch { if (requestId === this.bookingsRequestId && this.detail?.id === userId && this.drawerTab === 'bookings') this.bookingsError = 'Không tải thêm được lịch sử booking.'; }
    finally {
      if (requestId === this.bookingsRequestId && this.detail?.id === userId) {
        this.bookingsLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  public async retryActivity(): Promise<void> {
    this.activityError = ''; this.activityPage = 0;
    await this.setDrawerTab('activity');
  }

  public async retryAdminHistory(): Promise<void> {
    this.adminHistoryError = ''; this.adminHistory = []; this.adminHistoryLoaded = false; this.adminHistoryPage = 0; this.adminHistoryPages = 0;
    await this.setDrawerTab('admin');
  }

  public async loadMoreAdminHistory(): Promise<void> {
    if (!this.detail || this.adminHistoryLoading || this.adminHistoryPage >= this.adminHistoryPages) return;
    const requestId = ++this.adminHistoryRequestId;
    const userId = String(this.detail.id);
    this.adminHistoryLoading = true;
    this.adminHistoryError = '';
    try {
      const response = await this.api.getAdminUserActivity(userId, this.adminHistoryPage + 1);
      if (requestId !== this.adminHistoryRequestId || this.detail?.id !== userId || this.drawerTab !== 'admin') return;
      this.adminHistory = [...this.adminHistory, ...(response?.data || [])];
      this.adminHistoryPage = response?.pagination?.page || this.adminHistoryPage + 1;
    } catch { if (requestId === this.adminHistoryRequestId && this.detail?.id === userId) this.adminHistoryError = 'Không tải thêm được lịch sử quản trị.'; }
    finally {
      if (requestId === this.adminHistoryRequestId && this.detail?.id === userId) {
        this.adminHistoryLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  public retryDetailTab(): void {
    if (this.drawerError) { void this.openDetail(this.detail); return; }
    if (this.drawerTab === 'info') void this.openDetail(this.detail);
    else if (this.drawerTab === 'activity') void this.retryActivity();
    else if (this.drawerTab === 'bookings') void this.retryBookings();
    else void this.retryAdminHistory();
  }

  public saveModalEdit(event: { values: Record<string, any>; reason: string }): void {
    this.editForm = { ...event.values };
    this.editReason = event.reason;
    void this.saveEdit();
  }

  public handleAccountAction(value: string): void {
    if (['role', 'suspend', 'unsuspend', 'deactivate', 'reactivate'].includes(value)) this.startAction(value as UserAction);
  }

  public async toggleAccountStatus(event: { reason: string }): Promise<void> {
    if (!this.detail || this.accountStatusBusy) return;
    this.accountStatusBusy = true;
    const current = this.detail.account_status || 'active';
    const action: 'suspend' | 'unsuspend' | 'reactivate' = current === 'suspended' ? 'unsuspend' : current === 'deactivated' ? 'reactivate' : 'suspend';
    try {
      await this.api.updateAdminUserStatus(this.detail.id, action, event.reason);
      await Promise.all([this.loadUsers(), this.loadStats()]);
      await this.openDetail(this.users.find(user => user.id === this.detail?.id) || this.detail);
      this.notify(action === 'suspend' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    } catch { this.notify('Không thể cập nhật trạng thái tài khoản.'); }
    finally { this.accountStatusBusy = false; this.cdr.markForCheck(); }
  }

  public async retryBookings(): Promise<void> {
    this.bookingsError = ''; this.bookingsPage = 0;
    await this.setDrawerTab('bookings');
  }

  public beginEdit(): void {
    this.editForm = { fullname: this.detail?.fullname || '', phone: this.detail?.phone || '', dob: this.detail?.dob || '', gender: this.detail?.gender || '', address: this.detail?.address || '' };
    this.editReason = ''; this.editing = true;
  }

  public async saveEdit(): Promise<void> {
    if (!this.detail || !this.editReason.trim()) return;
    this.editBusy = true;
    try {
      const response = await this.api.updateAdminUser(this.detail.id, { ...this.editForm, reason: this.editReason.trim() });
      this.detail = { ...this.detail, ...response.user };
      await this.loadUsers(); this.editing = false; this.notify('Đã cập nhật hồ sơ.');
    } catch { this.notify('Cập nhật hồ sơ thất bại.'); }
    finally { this.editBusy = false; this.cdr.markForCheck(); }
  }

  public startAction(type: UserAction, user = this.detail): void {
    if (!user) return;
    this.action = { type, user };
    this.actionReason = '';
    this.nextRole = user.role === 'provider' ? 'traveler' : 'provider';
  }

  public startBulkAction(type: 'suspend' | 'unsuspend'): void {
    const targets = this.users.filter(user => this.selectedIds.has(user.id) && user.role !== 'admin');
    if (!targets.length) { this.notify('Không có tài khoản phù hợp trong lựa chọn hiện tại.'); return; }
    this.action = { type, user: { fullname: `${targets.length} tài khoản được chọn`, email: '' }, targets };
    this.actionReason = '';
  }

  public async confirmAction(): Promise<void> {
    if (!this.action || !this.actionReason.trim()) return;
    this.actionBusy = true;
    const { type, user } = this.action;
    const isBulk = Boolean(this.action.targets?.length);
    try {
      const targets = this.action.targets || [user];
      let successes = 0;
      for (const target of targets) {
        try {
          if (type === 'role') await this.api.changeAdminUserRole(target.id, this.nextRole, this.actionReason.trim());
          else await this.api.updateAdminUserStatus(target.id, type, this.actionReason.trim());
          successes++;
        } catch { /* show per-target partial result after refreshing */ }
      }
      this.action = null; this.actionReason = '';
      await Promise.all([this.loadUsers(), this.loadStats()]);
      if (this.detail?.id === user.id && !isBulk) await this.openDetail(this.users.find(row => row.id === user.id) || user);
      this.notify(successes === targets.length ? `Đã cập nhật ${successes} tài khoản.` : `Đã cập nhật ${successes}/${targets.length} tài khoản; một số thao tác không thành công.`);
    } catch { this.notify('Thao tác thất bại. Kiểm tra quyền, trạng thái và lý do rồi thử lại.'); }
    finally { this.actionBusy = false; this.cdr.markForCheck(); }
  }

  public openCreate(): void {
    this.createForm.reset({ fullname: '', email: '', phone: '', role: 'traveler', reason: '' });
    this.createOpen = true;
  }

  public async createUser(): Promise<void> {
    if (this.createBusy || this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.createBusy = true;
    try {
      const value = this.createForm.getRawValue();
      const response = await this.api.createAdminUser({ ...value, fullname: value.fullname.trim(), email: value.email.trim(), phone: value.phone.trim() });
      this.createOpen = false; this.pagination.page = 1;
      await Promise.all([this.loadUsers(), this.loadStats()]);
      this.notify(response?.inviteQueued ? 'Đã tạo tài khoản và gửi hướng dẫn đặt mật khẩu qua email.' : 'Đã tạo tài khoản nhưng email mời chưa gửi được; người dùng có thể dùng chức năng Quên mật khẩu.');
    } catch { this.notify('Không thể tạo tài khoản. Email có thể đã tồn tại hoặc dịch vụ email không khả dụng.'); }
    finally { this.createBusy = false; this.cdr.markForCheck(); }
  }

  public displayRole(role: string): string { return ({ traveler: 'Khách hàng', provider: 'Nhà cung cấp', admin: 'Quản trị viên' } as Record<string, string>)[role] || role; }
  public get detailTabs(): AccountModalTab[] {
    return [
      { id: 'info', label: 'Thông tin chung' },
      { id: 'bookings', label: 'Lịch sử booking' },
      { id: 'activity', label: 'Lịch sử hoạt động' },
      { id: 'admin', label: 'Lịch sử quản trị' }
    ];
  }
  public get detailFields(): AccountModalField[] {
    if (!this.detail) return [];
    const user = this.detail;
    const info: AccountModalField[] = [
      { label: 'Họ và tên', value: user.fullname, key: 'fullname', required: true },
      { label: 'Email', value: user.email },
      { label: 'Số điện thoại', value: user.phone, key: 'phone', type: 'tel' },
      { label: 'Ngày sinh', value: user.dob, key: 'dob', type: 'date' },
      { label: 'Giới tính', value: user.gender, key: 'gender' },
      { label: 'Địa chỉ', value: user.address, key: 'address' },
      { label: 'Vai trò', value: this.displayRole(user.role) },
      { label: 'Email xác thực', value: user.is_verified ? 'Đã xác thực' : 'Chưa xác thực' },
      { label: 'Ngày tham gia', value: this.formatDate(user.createdAt) },
      { label: 'Đăng nhập cuối', value: user.last_login_at ? this.formatDate(user.last_login_at) : 'Chưa đăng nhập' }
    ];
    if (this.editing) return info.filter(field => Boolean(field.key));
    return this.drawerTab === 'info' ? info : [];
  }
  public get detailSectionHeading(): string {
    return this.drawerTab === 'info' ? 'Thông tin tài khoản'
      : this.drawerTab === 'bookings' ? 'Lịch sử booking'
      : this.drawerTab === 'activity' ? 'Lịch sử hoạt động'
      : 'Lịch sử quản trị';
  }
  public get detailRecords(): AccountModalRecord[] {
    if (this.drawerTab === 'bookings') return this.bookings.map(item => ({ title: item.name || 'Booking', detail: item.id, meta: this.formatDate(item.bookingDate), status: item.status }));
    if (this.drawerTab === 'activity') return this.activity.map(item => ({ title: item.title || item.type, detail: item.detail, meta: this.formatDate(item.createdAt), status: item.status }));
    if (this.drawerTab === 'admin') return this.adminHistory.map(item => ({ title: item.action, detail: item.reason, meta: this.formatDate(item.createdAt) + ' · ' + item.actor_id }));
    return [];
  }
  public get modalLoading(): boolean {
    return this.drawerLoading || (this.drawerTab === 'activity' && this.activityLoading && !this.activity.length)
      || (this.drawerTab === 'bookings' && this.bookingsLoading && !this.bookings.length)
      || (this.drawerTab === 'admin' && this.adminHistoryLoading && !this.adminHistory.length);
  }
  public get modalCanLoadMore(): boolean {
    return (this.drawerTab === 'activity' && this.activityPage > 0 && this.activityPage < this.activityPages)
      || (this.drawerTab === 'bookings' && this.bookingsPage > 0 && this.bookingsPage < this.bookingsPages)
      || (this.drawerTab === 'admin' && this.adminHistoryPage > 0 && this.adminHistoryPage < this.adminHistoryPages);
  }
  public get modalLoadMoreBusy(): boolean {
    return this.drawerTab === 'activity' ? this.activityLoading : this.drawerTab === 'bookings' ? this.bookingsLoading : this.drawerTab === 'admin' && this.adminHistoryLoading;
  }
  public loadMoreCurrentTab(): void {
    if (this.drawerTab === 'activity') void this.loadMoreActivity();
    else if (this.drawerTab === 'bookings') void this.loadMoreBookings();
    else if (this.drawerTab === 'admin') void this.loadMoreAdminHistory();
  }
  public get modalError(): string {
    return this.drawerError || (this.drawerTab === 'activity' ? this.activityError : this.drawerTab === 'bookings' ? this.bookingsError : this.drawerTab === 'admin' ? this.adminHistoryError : '');
  }
  public get modalActions(): AccountModalAction[] {
    return [
      { id: 'role', label: 'Phân quyền', icon: 'bi-person-gear', disabled: this.detail?.role === 'admin' },
      { id: this.detail?.account_status === 'deactivated' ? 'reactivate' : 'deactivate', label: this.detail?.account_status === 'deactivated' ? 'Khôi phục tài khoản' : 'Vô hiệu hóa tài khoản', icon: 'bi-person-x', disabled: this.detail?.role === 'admin' || this.detail?.account_status === 'deactivated' }
    ];
  }
  public displayStatus(user: any): string {
    if (!user.is_verified) return 'Chờ xác minh';
    return ({ active: 'Đang hoạt động', suspended: 'Tạm khóa', deactivated: 'Vô hiệu hóa' } as Record<string, string>)[user.account_status || 'active'] || 'Không rõ';
  }
  public statusClass(user: any): string { return user.is_verified === false ? 'pending' : user.account_status || 'active'; }
  public formatDate(value: string | Date | undefined): string { return value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '—'; }
  public notify(message: string): void {
    this.toast = message;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.toast === message) {
        this.toast = '';
        this.cdr.markForCheck();
      }
    }, 3500);
  }
}
