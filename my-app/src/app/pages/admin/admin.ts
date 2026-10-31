import { Component, ElementRef, HostListener, OnInit, ViewChild, ChangeDetectorRef, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type AdminTab = 'providers' | 'services' | 'bookings' | 'deposits' | 'refunds' | 'withdrawals' | 'wallets' | 'reports';
type QueueState = 'loading' | 'ready' | 'unavailable';
type QueueKey = 'providers' | 'deposits' | 'withdrawals' | 'wallets' | 'bookings';

interface AdminNavItem {
  id: string;
  label: string;
  icon: string;
  tab?: AdminTab;
  badgeKey?: QueueKey;
}

interface AdminTableColumn {
  key: string;
  label: string;
}

interface AdminTableRow {
  id: string;
  actionId: string;
  name: string;
  account: string;
  detail: string;
  date: string;
  status: string;
  serviceType: string;
  documents: string;
  revenue: string;
  cancellationRate: string;
  rating: string;
  priority: string;
  amount: string;
  raw: any;
}

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  @ViewChild('globalSearchInput') globalSearchInput?: ElementRef<HTMLInputElement>;

  public activeSection = 'overview';
  public activeTab: AdminTab = 'providers';
  public sidebarCollapsed = false;
  public mobileMenuOpen = false;
  public isPreviewMode = isDevMode()
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('adminPreview') === '1';
  public currentUser: any = null;
  public globalSearch = '';
  public queueSearch = '';
  public currentPage = 1;
  public readonly pageSize = 5;
  public isDateMenuOpen = false;
  public isNotificationMenuOpen = false;
  public isCreateMenuOpen = false;
  public isProfileMenuOpen = false;
  public activeDateRange = 'Tháng này';

  public pendingProviders: any[] = [];
  public pendingDeposits: any[] = [];
  public pendingWithdrawals: any[] = [];
  public pendingWallets: any[] = [];
  public pendingBookings: any[] = [];
  public queueState: Record<QueueKey, QueueState> = {
    providers: 'loading', deposits: 'loading', withdrawals: 'loading', wallets: 'loading', bookings: 'loading'
  };

  public readonly navigationItems: AdminNavItem[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'bi-house-door' },
    { id: 'users', label: 'Người dùng', icon: 'bi-people' },
    { id: 'providers', label: 'Nhà cung cấp', icon: 'bi-shop-window', tab: 'providers', badgeKey: 'providers' },
    { id: 'services', label: 'Dịch vụ & Tiêu chí xanh', icon: 'bi-tree', tab: 'services' },
    { id: 'bookings', label: 'Booking', icon: 'bi-calendar2-check', tab: 'bookings', badgeKey: 'bookings' },
    { id: 'transactions', label: 'Giao dịch & Hoàn tiền', icon: 'bi-currency-exchange', tab: 'deposits' },
    { id: 'withdrawals', label: 'Yêu cầu rút tiền', icon: 'bi-wallet2', tab: 'withdrawals', badgeKey: 'withdrawals' },
    { id: 'promotions', label: 'Khuyến mãi & Quảng cáo', icon: 'bi-megaphone' },
    { id: 'community', label: 'Nội dung cộng đồng', icon: 'bi-chat-square-text', tab: 'reports' },
    { id: 'support', label: 'Khiếu nại & Hỗ trợ', icon: 'bi-headset' },
    { id: 'settings', label: 'Danh mục & Cấu hình', icon: 'bi-sliders' },
    { id: 'ai', label: 'AI & Gợi ý', icon: 'bi-stars' },
    { id: 'reports', label: 'Báo cáo', icon: 'bi-bar-chart-line' },
    { id: 'security', label: 'Bảo mật & Vận hành', icon: 'bi-shield-check' }
  ];

  public readonly managementTabs: { id: AdminTab; label: string; icon: string; badgeKey?: QueueKey }[] = [
    { id: 'providers', label: 'Nhà cung cấp', icon: 'bi-shop-window', badgeKey: 'providers' },
    { id: 'services', label: 'Dịch vụ', icon: 'bi-tree' },
    { id: 'bookings', label: 'Booking', icon: 'bi-calendar2-check', badgeKey: 'bookings' },
    { id: 'deposits', label: 'Nạp tiền', icon: 'bi-arrow-down-left-circle' },
    { id: 'refunds', label: 'Hoàn tiền', icon: 'bi-arrow-counterclockwise' },
    { id: 'withdrawals', label: 'Rút tiền', icon: 'bi-arrow-up-right-circle', badgeKey: 'withdrawals' },
    { id: 'wallets', label: 'Kích hoạt ví', icon: 'bi-wallet' },
    { id: 'reports', label: 'Nội dung báo cáo', icon: 'bi-flag' }
  ];

  public customDialog: {
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null = null;

  constructor(
    public apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      this.showAlert('Bạn không có quyền truy cập trang này.', 'error', () => this.router.navigate(['/home']));
      return;
    }

    this.currentUser = user;
    await this.loadAllData();
  }

  @HostListener('document:keydown', ['$event'])
  public handleGlobalShortcut(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.globalSearchInput?.nativeElement.focus();
    }
    if (event.key === 'Escape') {
      this.mobileMenuOpen = false;
      this.isDateMenuOpen = false;
      this.isNotificationMenuOpen = false;
      this.isCreateMenuOpen = false;
      this.isProfileMenuOpen = false;
    }
  }

  public setSection(sectionId: string) {
    this.activeSection = sectionId;
    this.mobileMenuOpen = false;
    this.queueSearch = '';
    this.currentPage = 1;
    const item = this.navigationItems.find(navItem => navItem.id === sectionId);
    if (item?.tab) this.setActiveTab(item.tab);
  }

  public setActiveTab(tab: AdminTab) {
    this.activeTab = tab;
    this.queueSearch = '';
    this.currentPage = 1;
  }

  public setDateRange(range: string) {
    this.activeDateRange = range;
    this.isDateMenuOpen = false;
  }

  public showAlert(message: string, type: 'success' | 'error' | 'info' = 'success', callback?: () => void) {
    this.customDialog = {
      message,
      type,
      onConfirm: () => {
        this.closeCustomDialog();
        callback?.();
      }
    };
    this.cdr.detectChanges();
  }

  public showConfirm(message: string, onConfirm: () => void, onCancel?: () => void) {
    this.customDialog = {
      message,
      type: 'confirm',
      onConfirm: () => {
        this.closeCustomDialog();
        onConfirm();
      },
      onCancel: () => {
        this.closeCustomDialog();
        onCancel?.();
      }
    };
    this.cdr.detectChanges();
  }

  public closeCustomDialog() {
    this.customDialog = null;
    this.cdr.detectChanges();
  }

  public cancelDialog() {
    const onCancel = this.customDialog?.onCancel;
    if (onCancel) onCancel();
    else this.closeCustomDialog();
  }

  public confirmDialog() { this.customDialog?.onConfirm?.(); }

  private async loadAllData() {
    if (this.isPreviewMode) {
      this.loadPreviewData();
      return;
    }
    await Promise.all([
      this.loadProviders(),
      this.loadDeposits(),
      this.loadWithdrawals(),
      this.loadWallets(),
      this.loadBookings()
    ]);
  }

  private loadPreviewData() {
    this.pendingProviders = [
      { id: 'VC-033940', User: { id: 'demo-provider-1', fullname: 'H Nhiên K’pơr', username: 'nhien' }, text: 'Công ty TNHH Du lịch Xanh', createdAt: '2025-06-18T14:30:00' },
      { id: 'VC-033939', User: { id: 'demo-provider-2', fullname: 'EcoStay Đà Lạt', username: 'ecostaydl' }, text: 'Hộ kinh doanh EcoStay', createdAt: '2025-06-17T14:20:00' },
      { id: 'VC-033836', User: { id: 'demo-provider-3', fullname: 'Biển Xanh Travel', username: 'bienxanh' }, text: 'Công ty CP Du lịch Biển Xanh', createdAt: '2025-06-16T09:15:00' }
    ];
    this.pendingDeposits = [
      { id: 'GD-DEMO-01', amount: 1200000, description: 'Nạp ví GreenSteps', status: 'pending', Wallet: { User: { fullname: 'Nguyễn Minh Anh', username: 'minhanh' } } }
    ];
    this.pendingWithdrawals = [
      { id: 'WD-DEMO-01', amount: 850000, status: 'pending', bank_name: 'Vietcombank', bank_account: '**** 0182', User: { fullname: 'Eco Homestay', username: 'ecohomestay' }, createdAt: '2025-06-18T12:30:00' }
    ];
    this.pendingWallets = [
      { id: 'GD-WALLET-DEMO', amount: 200000, status: 'pending', wallet_id: 'W-DEMO-08', Wallet: { User: { fullname: 'Trần Gia Bảo', username: 'giabao' } } }
    ];
    this.pendingBookings = [
      { id: 'BK-DEMO-01', customer: 'Trần Gia Bảo', service: 'Tour Cúc Phương 2N1Đ', date: '18/06/2025', value: 3200000, status: 'pending', type: 'tour' },
      { id: 'BK-DEMO-02', customer: 'Lê Thanh Hà', service: 'Lưu trú EcoStay', date: '17/06/2025', value: 1450000, status: 'pending', type: 'service' }
    ];
    for (const key of Object.keys(this.queueState) as QueueKey[]) this.queueState[key] = 'ready';
  }

  public async loadProviders() {
    this.queueState.providers = 'loading';
    const result = await this.apiService.getAdminPendingProviders();
    this.pendingProviders = result.data;
    this.queueState.providers = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
  }

  public async loadDeposits() {
    this.queueState.deposits = 'loading';
    const result = await this.apiService.getAdminPendingDeposits();
    this.pendingDeposits = result.data;
    this.queueState.deposits = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
  }

  public async loadWithdrawals() {
    this.queueState.withdrawals = 'loading';
    const result = await this.apiService.getAdminPendingWithdrawals();
    this.pendingWithdrawals = result.data;
    this.queueState.withdrawals = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
  }

  public async loadWallets() {
    this.queueState.wallets = 'loading';
    const result = await this.apiService.getAdminPendingWallets();
    this.pendingWallets = result.data;
    this.queueState.wallets = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
  }

  public async loadBookings() {
    this.queueState.bookings = 'loading';
    const result = await this.apiService.getAdminPendingBookings();
    this.pendingBookings = result.data;
    this.queueState.bookings = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
  }

  public get activeSectionLabel(): string {
    return this.navigationItems.find(item => item.id === this.activeSection)?.label || 'Tổng quan';
  }

  public get isOverview(): boolean { return this.activeSection === 'overview'; }

  public get unsupportedSection(): boolean {
    return !this.isOverview && !this.navigationItems.find(item => item.id === this.activeSection)?.tab;
  }

  public get currentQueueState(): QueueState | 'unsupported' {
    if (this.activeTab === 'services' || this.activeTab === 'refunds' || this.activeTab === 'reports') return 'unsupported';
    return this.queueState[this.activeTab];
  }

  public get currentQueueCount(): number | null {
    return this.currentQueueState === 'ready' ? this.getQueueItems().length : null;
  }

  public get activeTableTitle(): string {
    return {
      providers: 'Yêu cầu phê duyệt nhà cung cấp',
      services: 'Dịch vụ và tiêu chí xanh',
      bookings: 'Booking cần xử lý',
      deposits: 'Yêu cầu nạp tiền',
      refunds: 'Yêu cầu hoàn tiền',
      withdrawals: 'Yêu cầu rút tiền',
      wallets: 'Yêu cầu kích hoạt ví',
      reports: 'Nội dung được báo cáo'
    }[this.activeTab];
  }

  public get activeTableColumns(): AdminTableColumn[] {
    if (this.activeTab === 'providers') return [
      { key: 'id', label: 'Mã hồ sơ' }, { key: 'name', label: 'Nhà cung cấp / Doanh nghiệp' },
      { key: 'account', label: 'Tài khoản' }, { key: 'date', label: 'Ngày gửi' },
      { key: 'status', label: 'Trạng thái hồ sơ' }, { key: 'serviceType', label: 'Loại dịch vụ' },
      { key: 'documents', label: 'Tình trạng giấy tờ' }, { key: 'revenue', label: 'Doanh thu' },
      { key: 'cancellationRate', label: 'Tỷ lệ hủy' }, { key: 'rating', label: 'Đánh giá' },
      { key: 'priority', label: 'Ưu tiên' }, { key: 'detail', label: 'Thông tin đăng ký' }
    ];
    return [
      { key: 'id', label: 'Mã yêu cầu' }, { key: 'name', label: 'Khách hàng / Đối tác' },
      { key: 'account', label: 'Tài khoản' }, { key: 'detail', label: 'Nội dung' },
      { key: 'amount', label: 'Số tiền' }, { key: 'date', label: 'Ngày gửi' }, { key: 'status', label: 'Trạng thái' }
    ];
  }

  public get filteredRows(): AdminTableRow[] {
    const query = this.queueSearch.trim().toLocaleLowerCase('vi');
    const rows = this.getQueueItems().map(item => this.toTableRow(item));
    if (!query) return rows;
    return rows.filter(row => `${row.id} ${row.name} ${row.account} ${row.detail} ${row.status}`.toLocaleLowerCase('vi').includes(query));
  }

  public get pageRows(): AdminTableRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  public get pageCount(): number { return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize)); }

  public get metrics() {
    return [
      { label: 'Người dùng đang hoạt động', value: '—', note: 'Chưa có dữ liệu', icon: 'bi-people', tone: 'green' },
      { label: 'Nhà cung cấp chờ duyệt', value: this.queueValue('providers'), note: this.queueNote('providers'), icon: 'bi-shop', tone: 'amber' },
      { label: 'Dịch vụ chờ kiểm duyệt', value: '—', note: 'Chưa có dữ liệu', icon: 'bi-file-earmark-check', tone: 'amber' },
      { label: 'Booking cần xử lý', value: this.queueValue('bookings'), note: this.queueNote('bookings'), icon: 'bi-calendar2-check', tone: 'blue' },
      { label: 'Giao dịch bất thường', value: '—', note: 'Chưa có dữ liệu', icon: 'bi-exclamation-triangle', tone: 'red' },
      { label: 'Doanh thu nền tảng hôm nay', value: '—', note: 'Chưa có dữ liệu', icon: 'bi-graph-up-arrow', tone: 'green' }
    ];
  }

  public get demoBookingDistribution() {
    return [
      { label: 'Đang chờ', percent: 18, color: '#4d9ae8' },
      { label: 'Đã xác nhận', percent: 52, color: '#0e9f6e' },
      { label: 'Đang diễn ra', percent: 14, color: '#f4bd28' },
      { label: 'Hoàn thành', percent: 12, color: '#96dfa6' },
      { label: 'Đã hủy', percent: 4, color: '#ef626b' }
    ];
  }

  public get bookingDonutStyle(): string {
    let cursor = 0;
    const slices = this.demoBookingDistribution.map(item => {
      const start = cursor;
      cursor += item.percent;
      return `${item.color} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${slices.join(', ')})`;
  }

  public get sectionPlaceholderText(): string {
    return `${this.activeSectionLabel} chưa có API quản trị tương ứng nên chưa hiển thị dữ liệu trong chế độ thực.`;
  }

  public get pageEnd(): number { return Math.min(this.currentPage * this.pageSize, this.filteredRows.length); }

  public cellValue(row: AdminTableRow, key: string): string {
    return (row as any)[key] ?? '—';
  }

  public statusClass(status: string): string {
    const value = String(status || '').toLocaleLowerCase('vi');
    if (['success', 'approved', 'completed', 'hoàn thành', 'đã xác nhận'].some(token => value.includes(token))) return 'status-success';
    if (['reject', 'failed', 'cancel', 'từ chối', 'đã hủy'].some(token => value.includes(token))) return 'status-danger';
    if (['accepted', 'deposit', 'đang diễn ra'].some(token => value.includes(token))) return 'status-info';
    if (['pending', 'chờ', 'đang chờ'].some(token => value.includes(token))) return '';
    return 'status-muted';
  }

  public async refreshActiveQueue() {
    switch (this.activeTab) {
      case 'providers': await this.loadProviders(); break;
      case 'deposits': await this.loadDeposits(); break;
      case 'withdrawals': await this.loadWithdrawals(); break;
      case 'wallets': await this.loadWallets(); break;
      case 'bookings': await this.loadBookings(); break;
      default: break;
    }
  }

  public getQueueCount(key: QueueKey): number | null {
    return this.queueState[key] === 'ready' ? this.queueFor(key).length : null;
  }

  public queueStateLabel(state: QueueState | 'unsupported'): string {
    if (state === 'loading') return 'Đang tải dữ liệu…';
    if (state === 'unavailable') return 'Chưa kết nối được dữ liệu';
    if (state === 'unsupported') return 'Chưa có API cho mục này';
    return 'Không có yêu cầu nào đang chờ';
  }

  public changePage(page: number) {
    this.currentPage = Math.max(1, Math.min(this.pageCount, page));
  }

  public approveProvider(targetUserId: string) {
    if (this.isPreviewMode || !targetUserId) return;
    this.showConfirm('Bạn có chắc chắn muốn phê duyệt nhà cung cấp này?', async () => {
      const success = await this.apiService.approveProvider(targetUserId);
      if (success) {
        this.showAlert('Phê duyệt nhà cung cấp thành công.', 'success');
        await this.loadProviders();
      } else this.showAlert('Phê duyệt thất bại. Vui lòng thử lại.', 'error');
    });
  }

  public approveDeposit(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Xác nhận đã nhận tiền nạp và duyệt giao dịch này?', async () => {
      const success = await this.apiService.approveDeposit(id);
      if (success) { this.showAlert('Đã duyệt nạp tiền.', 'success'); await this.loadDeposits(); }
      else this.showAlert('Phê duyệt thất bại.', 'error');
    });
  }

  public rejectDeposit(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Từ chối giao dịch nạp tiền này?', async () => {
      const success = await this.apiService.rejectDeposit(id);
      if (success) { this.showAlert('Đã từ chối giao dịch nạp tiền.', 'success'); await this.loadDeposits(); }
      else this.showAlert('Thao tác thất bại.', 'error');
    });
  }

  public approveWithdrawal(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Xác nhận đối soát và duyệt yêu cầu rút tiền này?', async () => {
      const success = await this.apiService.approveWithdrawal(id);
      if (success) { this.showAlert('Đã duyệt yêu cầu rút tiền.', 'success'); await this.loadWithdrawals(); }
      else this.showAlert('Phê duyệt thất bại.', 'error');
    });
  }

  public rejectWithdrawal(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Từ chối yêu cầu rút tiền này?', async () => {
      const success = await this.apiService.rejectWithdrawal(id);
      if (success) { this.showAlert('Đã từ chối yêu cầu rút tiền.', 'success'); await this.loadWithdrawals(); }
      else this.showAlert('Thao tác thất bại.', 'error');
    });
  }

  public approveWallet(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Phê duyệt kích hoạt ví GreenSteps cho khách hàng này?', async () => {
      const success = await this.apiService.approveWallet(id);
      if (success) { this.showAlert('Đã kích hoạt ví.', 'success'); await this.loadWallets(); }
      else this.showAlert('Duyệt ví thất bại.', 'error');
    });
  }

  public rejectWallet(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Từ chối yêu cầu kích hoạt ví này?', async () => {
      const success = await this.apiService.rejectWallet(id);
      if (success) { this.showAlert('Đã từ chối yêu cầu kích hoạt ví.', 'success'); await this.loadWallets(); }
      else this.showAlert('Thao tác thất bại.', 'error');
    });
  }

  public approveBooking(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Phê duyệt và xác nhận yêu cầu booking này?', async () => {
      const success = await this.apiService.approveBooking(id);
      if (success) { this.showAlert('Đã phê duyệt booking.', 'success'); await this.loadBookings(); }
      else this.showAlert('Phê duyệt thất bại.', 'error');
    });
  }

  public rejectBooking(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Từ chối booking này?', async () => {
      const success = await this.apiService.rejectBooking(id);
      if (success) { this.showAlert('Đã từ chối booking.', 'success'); await this.loadBookings(); }
      else this.showAlert('Thao tác thất bại.', 'error');
    });
  }

  public approveAllBookings() {
    if (this.isPreviewMode || !this.pendingBookings.length) return;
    this.showConfirm(`Phê duyệt tất cả ${this.pendingBookings.length} booking đang chờ?`, async () => {
      let successCount = 0;
      let failCount = 0;
      for (const item of this.pendingBookings) {
        const ok = await this.apiService.approveBooking(item.id);
        if (ok) successCount++; else failCount++;
      }
      await this.loadBookings();
      this.showAlert(`Hoàn thành: ${successCount} thành công${failCount ? `, ${failCount} thất bại` : ''}.`, failCount ? 'error' : 'success');
    });
  }

  public rejectAllBookings() {
    if (this.isPreviewMode || !this.pendingBookings.length) return;
    this.showConfirm(`Từ chối tất cả ${this.pendingBookings.length} booking đang chờ? Hành động này không thể hoàn tác.`, async () => {
      let successCount = 0;
      let failCount = 0;
      for (const item of this.pendingBookings) {
        const ok = await this.apiService.rejectBooking(item.id);
        if (ok) successCount++; else failCount++;
      }
      await this.loadBookings();
      this.showAlert(`Đã từ chối: ${successCount} booking${failCount ? `, ${failCount} thất bại` : ''}.`, failCount ? 'error' : 'success');
    });
  }

  public runRowAction(row: AdminTableRow, action: 'approve' | 'reject') {
    if (this.isPreviewMode) return;
    switch (this.activeTab) {
      case 'providers': this.approveProvider(row.actionId); break;
      case 'deposits': action === 'approve' ? this.approveDeposit(row.actionId) : this.rejectDeposit(row.actionId); break;
      case 'withdrawals': action === 'approve' ? this.approveWithdrawal(row.actionId) : this.rejectWithdrawal(row.actionId); break;
      case 'wallets': action === 'approve' ? this.approveWallet(row.actionId) : this.rejectWallet(row.actionId); break;
      case 'bookings': action === 'approve' ? this.approveBooking(row.actionId) : this.rejectBooking(row.actionId); break;
      default: break;
    }
  }

  public logout() { this.authService.logout(); }

  private queueValue(key: QueueKey): string {
    const count = this.getQueueCount(key);
    return count === null ? '—' : new Intl.NumberFormat('vi-VN').format(count);
  }

  private queueNote(key: QueueKey): string {
    return this.queueState[key] === 'unavailable' ? 'Không tải được dữ liệu' : this.queueState[key] === 'loading' ? 'Đang tải dữ liệu' : 'Yêu cầu đang chờ xử lý';
  }

  private queueFor(key: QueueKey): any[] {
    return {
      providers: this.pendingProviders,
      deposits: this.pendingDeposits,
      withdrawals: this.pendingWithdrawals,
      wallets: this.pendingWallets,
      bookings: this.pendingBookings
    }[key];
  }

  private getQueueItems(): any[] {
    if (this.activeTab === 'services' || this.activeTab === 'refunds' || this.activeTab === 'reports') return [];
    return this.queueFor(this.activeTab);
  }

  private toTableRow(item: any): AdminTableRow {
    const common = {
      id: String(item.id || '—'), actionId: String(item.id || ''), name: '—', account: '—', detail: '—', date: this.formatDate(item.createdAt || item.date),
      status: item.status || 'Chờ xử lý', serviceType: '—', documents: '—', revenue: '—', cancellationRate: '—', rating: '—', priority: '—', amount: this.formatMoney(item.amount ?? item.value), raw: item
    };
    switch (this.activeTab) {
      case 'providers':
        return { ...common, actionId: String(item.User?.id || ''), name: item.User?.fullname || '—', account: item.User?.username ? `@${item.User.username}` : '—', detail: item.text || '—', status: 'Chờ duyệt', serviceType: '—', documents: 'Chưa có dữ liệu', revenue: '—', cancellationRate: '—', rating: '—', priority: '—' };
      case 'deposits':
        return { ...common, name: item.Wallet?.User?.fullname || 'Khách hàng', account: item.Wallet?.User?.username ? `@${item.Wallet.User.username}` : '—', detail: item.description || 'Nạp tiền ví', status: item.status || 'Chờ xử lý' };
      case 'withdrawals':
        return { ...common, name: item.User?.fullname || 'Nhà cung cấp', account: item.User?.username ? `@${item.User.username}` : '—', detail: [item.bank_name, item.bank_account].filter(Boolean).join(' · ') || '—', status: item.status || 'Chờ xử lý' };
      case 'wallets':
        return { ...common, name: item.Wallet?.User?.fullname || 'Khách hàng', account: item.Wallet?.User?.username ? `@${item.Wallet.User.username}` : '—', detail: item.wallet_id || 'Kích hoạt ví GreenSteps', status: item.status || 'Chờ xử lý' };
      case 'bookings':
        return { ...common, name: item.customer || item.fullname || 'Khách hàng', account: item.type === 'tour' ? 'Tour' : item.type === 'service' ? 'Dịch vụ' : item.type === 'itinerary' ? 'Lịch trình' : '—', detail: item.service || item.name_service || item.tour_name || '—', date: this.formatDate(item.date || item.booking_date || item.createdAt), status: item.status || 'Chờ xử lý' };
      default:
        return common;
    }
  }

  private formatDate(value: any): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  private formatMoney(value: any): string {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${new Intl.NumberFormat('vi-VN').format(amount)} ₫` : '—';
  }
}

export { AdminComponent as Admin };
