import { Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, isDevMode } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AccountModalField, AccountModalRecord, AccountModalTab } from './account-detail-modal.component';

type CatalogKey = 'services' | 'tours' | 'promotions' | 'allBookings' | 'refunds';
type AdminTab = 'providers' | CatalogKey | 'bookings' | 'deposits' | 'refunds' | 'withdrawals' | 'wallets' | 'reports';
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
  width?: string;
  minWidth?: string;
  align?: 'left' | 'right' | 'center';
  primary?: boolean;
  optional?: boolean;
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
export class AdminComponent implements OnInit, OnDestroy {
  public communityReports: any[] = [];
  public reportsState: QueueState = 'loading';
  public get pendingCommunityReportCount(): number { return this.communityReports.filter(report => report.status === 'pending').length; }
  public reportStatusFilter = 'all';
  public reportTypeFilter = 'all';
  public reportReasonFilter = 'all';
  public reportFiltersOpen = false;
  public reportsPageSize = 10;
  public selectedReportIds = new Set<string>();
  public get reportMetrics() {
    const ready = this.reportsState === 'ready';
    return [
      { label: 'Tổng báo cáo', value: ready ? this.communityReports.length : '—', icon: 'bi-file-earmark-text', tone: 'blue' },
      { label: 'Chờ kiểm duyệt', value: ready ? this.pendingCommunityReportCount : '—', icon: 'bi-clock', tone: 'amber' },
      { label: 'Đã xử lý', value: ready ? this.communityReports.filter(r => r.status !== 'pending').length : '—', icon: 'bi-check-circle', tone: 'green' },
      { label: 'Vi phạm', value: ready ? this.communityReports.filter(r => r.hidden).length : '—', icon: 'bi-exclamation-triangle', tone: 'red' }
    ];
  }
  public get reportReasons(): string[] { return [...new Set(this.communityReports.map(r => r.reasonLabel))].filter(Boolean); }
  public get allPageReportsSelected(): boolean { return this.pageRows.length > 0 && this.pageRows.every(row => this.selectedReportIds.has(row.id)); }
  public toggleReportSelection(id: string) { this.selectedReportIds.has(id) ? this.selectedReportIds.delete(id) : this.selectedReportIds.add(id); }
  public togglePageReportSelection() {
    const remove = this.allPageReportsSelected;
    for (const row of this.pageRows) remove ? this.selectedReportIds.delete(row.id) : this.selectedReportIds.add(row.id);
  }
  public reportStatusLabel(status: string): string {
    return ({ pending: 'Chờ kiểm duyệt', hidden: 'Đã ẩn', dismissed: 'Giữ nội dung', restored: 'Đã khôi phục' } as Record<string, string>)[status] || status;
  }
  public reviewTarget: any = null;
  public reviewAction = 'hide';
  public reviewNote = '';
  public reviewError = '';
  public reviewing = false;

  public async loadReports() {
    const result = await this.apiService.getCommunityReports();
    if (this.destroyed) return;
    this.communityReports = result.data;
    this.reportsState = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
  }
  public openReportReview(report: any) {
    if (this.isPreviewMode) return;
    this.reviewTarget = report;
    this.reviewAction = report.deleted ? 'dismiss' : report.hidden ? 'restore' : 'hide';
    this.reviewNote = ''; this.reviewError = '';
  }
  public async submitReportReview(event: Event) {
    event.preventDefault();
    if (!this.reviewTarget || this.reviewing || this.reviewNote.trim().length < 5) return;
    this.reviewing = true; this.reviewError = '';
    try {
      await this.apiService.reviewCommunityReport(this.reviewTarget.id, this.reviewAction, this.reviewNote.trim());
      this.reviewTarget = null;
      this.apiService.clearCache('community_posts_');
      await this.loadReports();
    } catch (error: any) { this.reviewError = error?.error?.message || 'Không lưu được quyết định. Vui lòng thử lại.'; }
    finally { this.reviewing = false; this.cdr.detectChanges(); }
  }
  public moderationMediaUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('/uploads/') ? (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:5055' : 'https://greensteps-6swn.onrender.com') + url : url;
  }
  public catalog: Record<CatalogKey, any[]> = { services: [], tours: [], promotions: [], allBookings: [], refunds: [] };
  public catalogState: Record<CatalogKey, QueueState> = { services: 'loading', tours: 'loading', promotions: 'loading', allBookings: 'loading', refunds: 'loading' };
  private refreshTimer?: ReturnType<typeof setInterval>;
  private refreshing = false;
  private destroyed = false;
  public get isCatalogTab(): boolean { return ['services', 'tours', 'promotions', 'allBookings', 'refunds'].includes(this.activeTab); }
  @ViewChild('globalSearchInput') globalSearchInput?: ElementRef<HTMLInputElement>;

  public activeSection = 'overview';
  public activeTab: AdminTab = 'providers';
  public queuePageSize = 5;
  public polishedTablePageSize = 20;
  public columnPopoverOpen = false;
  public providerVisibleColumns: Record<string, boolean> = {
    serviceType: false, revenue: false, cancellationRate: false, rating: false, priority: false
  };
  public serviceVisibleColumns: Record<string, boolean> = { id: true, name: true, detail: true, amount: true, date: true, status: true };
  public sidebarCollapsed = false;
  public mobileMenuOpen = false;
  public isPreviewMode = isDevMode()
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('adminPreview') === '1';
  public currentUser: any = null;
  public globalSearch = '';
  public queueSearch = '';
  public currentPage = 1;
  public get pageSize(): number { return this.activeTab === 'reports' ? this.reportsPageSize : this.isPolishedAdminTable ? this.polishedTablePageSize : this.queuePageSize; }
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
  private requestedQueues = new Set<QueueKey>();
  public providerDetail: any = null;
  public providerModalLoading = false;
  public providerModalError = '';
  public providerModalTab = 'info';
  public providerTabLoading = false;
  public providerTabError = '';
  public providerServices: any[] = [];
  public providerServicesPage = 0;
  public providerServicesPages = 0;
  public providerServicesLoaded = false;
  public providerAdminHistory: any[] = [];
  public providerAdminHistoryPage = 0;
  public providerAdminHistoryPages = 0;
  public providerAdminHistoryLoaded = false;
  public providerEditing = false;
  public providerBusy = false;
  public providerEditValues: Record<string, any> = {};
  public providerEditReason = '';
  private providerDetailRequestId = 0;

  public readonly navigationItems: AdminNavItem[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'bi-house-door' },
    { id: 'users', label: 'Người dùng', icon: 'bi-people' },
    { id: 'providers', label: 'Nhà cung cấp', icon: 'bi-shop-window', tab: 'providers', badgeKey: 'providers' },
    { id: 'services', label: 'Dịch vụ & Tiêu chí xanh', icon: 'bi-tree', tab: 'services' },
    { id: 'tours', label: 'Tour', icon: 'bi-map', tab: 'tours' },
    { id: 'bookings', label: 'Booking', icon: 'bi-calendar2-check', tab: 'bookings', badgeKey: 'bookings' },
    { id: 'transactions', label: 'Giao dịch & Hoàn tiền', icon: 'bi-currency-exchange', tab: 'deposits' },
    { id: 'withdrawals', label: 'Yêu cầu rút tiền', icon: 'bi-wallet2', tab: 'withdrawals', badgeKey: 'withdrawals' },
    { id: 'promotions', label: 'Khuyến mãi & Quảng cáo', icon: 'bi-megaphone', tab: 'promotions' },
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
    { id: 'tours', label: 'Tour', icon: 'bi-map' },
    { id: 'promotions', label: 'Khuyến mãi', icon: 'bi-megaphone' },
    { id: 'allBookings', label: 'Tất cả booking', icon: 'bi-calendar2' },
    { id: 'bookings', label: 'Booking', icon: 'bi-calendar2-check', badgeKey: 'bookings' },
    { id: 'deposits', badgeKey: 'deposits', label: 'Nạp tiền', icon: 'bi-arrow-down-left-circle' },
    { id: 'refunds', label: 'Hoàn tiền', icon: 'bi-arrow-counterclockwise' },
    { id: 'withdrawals', label: 'Rút tiền', icon: 'bi-arrow-up-right-circle', badgeKey: 'withdrawals' },
    { id: 'wallets', label: 'Kích hoạt ví', icon: 'bi-wallet' },
    { id: 'reports', label: 'Nội dung báo cáo', icon: 'bi-flag' }
  ];

  public readonly managementGroups = [
    { id: 'partners', label: 'Đối tác', tabs: ['providers', 'services', 'tours', 'promotions'] as AdminTab[] },
    { id: 'transactions', label: 'Giao dịch', tabs: ['allBookings', 'bookings'] as AdminTab[] },
    { id: 'wallet', label: 'Ví', tabs: ['deposits', 'withdrawals', 'refunds', 'wallets'] as AdminTab[] },
    { id: 'content', label: 'Nội dung', tabs: ['reports'] as AdminTab[] }
  ];
  public activeManagementGroup = 'partners';

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
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as AdminTab | null;
      const group = params.get('group');
      if (!tab || !this.managementTabs.some(item => item.id === tab)) return;
      this.activeTab = tab;
      this.activeManagementGroup = this.managementGroups.some(item => item.id === group && item.tabs.includes(tab))
        ? group! : this.managementGroups.find(item => item.tabs.includes(tab))?.id || 'partners';
      const nav = this.navigationItems.find(item => item.tab === tab);
      if (nav) this.activeSection = nav.id;
      this.queueSearch = '';
      this.currentPage = 1;
      if (this.currentUser) {
        this.loadQueueOnDemand(tab);
        if (tab === 'reports' && !this.isPreviewMode && this.reportsState === 'loading') void this.loadReports();
      }
    });
  }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      this.showAlert('Bạn không có quyền truy cập trang này.', 'error', () => this.router.navigate(['/home']));
      return;
    }

    this.currentUser = user;
    await this.loadAllData();
    if (!this.destroyed && !this.isPreviewMode) this.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.loadAllData();
    }, 15000);
  }

  ngOnDestroy() { this.destroyed = true; if (this.refreshTimer) clearInterval(this.refreshTimer); }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (!this.destroyed && this.currentUser && !this.isPreviewMode && document.visibilityState === 'visible') void this.loadAllData();
  }

  public async loadCatalog(kind: CatalogKey) {
    const result = await this.apiService.getAdminCatalog(kind);
    if (this.destroyed) return;
    this.catalog[kind] = result.data;
    this.catalogState[kind] = result.available ? 'ready' : 'unavailable';
    this.cdr.detectChanges();
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
      this.columnPopoverOpen = false;
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

  public prefetchUsers(): void {
    void Promise.all([
      this.apiService.getAdminUsers({ page: 1, limit: 10, sort: 'createdAt', order: 'desc' }),
      this.apiService.getAdminUserStats()
    ]).catch(() => undefined);
  }

  public setActiveTab(tab: AdminTab) {
    this.activeTab = tab;
    this.queueSearch = '';
    this.currentPage = 1;
    this.loadQueueOnDemand(tab);
    const group = this.managementGroups.find(item => item.tabs.includes(tab));
    if (group) this.activeManagementGroup = group.id;
    const nav = this.navigationItems.find(item => item.tab === tab);
    if (nav) this.activeSection = nav.id;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { group: group?.id || null, tab }, queryParamsHandling: 'merge' });
  }

  public get visibleManagementTabs() { return this.managementTabs.filter(tab => this.managementGroups.find(group => group.id === this.activeManagementGroup)?.tabs.includes(tab.id)); }

  private loadQueueOnDemand(tab: AdminTab): void {
    if (this.isPreviewMode) return;
    const keyByTab: Partial<Record<AdminTab, QueueKey>> = {
      providers: 'providers',
      bookings: 'bookings',
      deposits: 'deposits',
      withdrawals: 'withdrawals',
      wallets: 'wallets'
    };
    const key = keyByTab[tab];
    if (!key || this.requestedQueues.has(key)) return;

    this.requestedQueues.add(key);
    switch (key) {
      case 'providers': void this.loadProviders(); break;
      case 'deposits': void this.loadDeposits(); break;
      case 'withdrawals': void this.loadWithdrawals(); break;
      case 'wallets': void this.loadWallets(); break;
      case 'bookings': void this.loadBookings(); break;
    }
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
    if (this.refreshing || this.destroyed) return;
    if (this.isPreviewMode) {
      this.loadPreviewData();
      return;
    }
    this.requestedQueues.add('providers');
    this.requestedQueues.add('bookings');
    this.refreshing = true;
    try { await Promise.all([
      this.loadProviders(),
      this.loadDeposits(),
      this.loadWithdrawals(),
      this.loadWallets(),
      this.loadBookings(),
      this.loadReports(),
      ...(['services', 'tours', 'promotions', 'allBookings', 'refunds'] as CatalogKey[]).map(kind => this.loadCatalog(kind))
    ]); } finally { this.refreshing = false; }

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

  public get activeManagementGroupLabel(): string {
    return this.managementGroups.find(group => group.id === this.activeManagementGroup)?.label || this.activeSectionLabel;
  }

  public get isOverview(): boolean { return this.activeSection === 'overview'; }

  public get isUserManagement(): boolean { return this.activeSection === 'users'; }

  public get unsupportedSection(): boolean {
    return !this.isOverview && !this.isUserManagement && !this.navigationItems.find(item => item.id === this.activeSection)?.tab;
  }

  public get currentQueueState(): QueueState | 'unsupported' {
    if (this.activeTab === 'reports') return this.reportsState;
    if (this.isCatalogTab) return this.catalogState[this.activeTab as CatalogKey];
    // refunds supported via catalog
    return this.queueState[this.activeTab as QueueKey];
  }

  public get currentQueueCount(): number | null {
    return this.currentQueueState === 'ready' ? this.getQueueItems().length : null;
  }

  public get activeTableTitle(): string {
    return {
      providers: 'Yêu cầu phê duyệt nhà cung cấp',
      services: 'Dịch vụ và tiêu chí xanh',
      tours: 'Danh sách tour',
      promotions: 'Khuyến mãi và mã giảm giá',
      allBookings: 'Tất cả booking',
      bookings: 'Booking cần xử lý',
      deposits: 'Yêu cầu nạp tiền',
      refunds: 'Yêu cầu hoàn tiền',
      withdrawals: 'Yêu cầu rút tiền',
      wallets: 'Yêu cầu kích hoạt ví',
      reports: 'Nội dung được báo cáo'
    }[this.activeTab];
  }

  public get isPolishedAdminTable(): boolean { return this.activeTab === 'providers' || this.activeTab === 'services'; }

  public readonly providerOptionalColumns: AdminTableColumn[] = [
    { key: 'serviceType', label: 'Loại dịch vụ', width: '100px', optional: true },
    { key: 'revenue', label: 'Doanh thu', width: '100px', align: 'right', optional: true },
    { key: 'cancellationRate', label: 'Tỷ lệ hủy', width: '86px', align: 'right', optional: true },
    { key: 'rating', label: 'Đánh giá', width: '82px', align: 'right', optional: true },
    { key: 'priority', label: 'Ưu tiên', width: '86px', optional: true }
  ];
  public readonly serviceTableColumns: AdminTableColumn[] = [
    { key: 'id', label: 'Mã', width: '180px', minWidth: '180px' },
    { key: 'name', label: 'Tên', minWidth: '280px', primary: true },
    { key: 'detail', label: 'Thông tin', width: '150px', minWidth: '140px' },
    { key: 'amount', label: 'Giá trị', width: '120px', align: 'right' },
    { key: 'date', label: 'Ngày tạo', width: '110px' },
    { key: 'status', label: 'Trạng thái', width: '110px' }
  ];

  public get columnPickerColumns(): AdminTableColumn[] {
    return this.activeTab === 'providers' ? this.providerOptionalColumns : this.serviceTableColumns;
  }

  public get activeTableColumns(): AdminTableColumn[] {
    if (this.activeTab === 'reports') return [{ key: 'name', label: 'Tác giả' }, { key: 'serviceType', label: 'Nội dung' }, { key: 'detail', label: 'Lý do và nội dung báo cáo' }, { key: 'date', label: 'Ngày báo cáo' }, { key: 'status', label: 'Trạng thái' }];
    if (this.activeTab === 'refunds') return [{ key: 'id', label: 'Mã' }, { key: 'name', label: 'Khách hàng' }, { key: 'detail', label: 'Dịch vụ' }, { key: 'documents', label: 'Lý do & STK' }, { key: 'amount', label: 'Tiền cọc' }, { key: 'status', label: 'Trạng thái' }];
    if (this.activeTab === 'services') return this.serviceTableColumns.filter(column => this.serviceVisibleColumns[column.key]);
    if (this.isCatalogTab) return [
      { key: 'id', label: 'Mã' }, { key: 'name', label: 'Tên' }, { key: 'detail', label: 'Thông tin' },
      { key: 'amount', label: this.activeTab === 'promotions' ? 'Mức giảm' : 'Giá trị' },
      { key: 'date', label: 'Ngày tạo' }, { key: 'status', label: 'Trạng thái' }
    ];
    if (this.activeTab === 'providers') {
      const base: AdminTableColumn[] = [
        { key: 'name', label: 'Nhà cung cấp / Doanh nghiệp', width: '270px', minWidth: '260px', primary: true },
        { key: 'account', label: 'Tài khoản', width: '160px' },
        { key: 'date', label: 'Ngày gửi', width: '130px' },
        { key: 'status', label: 'Trạng thái hồ sơ', width: '160px' },
        { key: 'documents', label: 'Tình trạng giấy tờ', width: '180px' }
      ];
      return [...base, ...this.providerOptionalColumns.filter(column => this.providerVisibleColumns[column.key])];
    }
    return [
      { key: 'id', label: 'Mã yêu cầu' }, { key: 'name', label: 'Khách hàng / Đối tác' },
      { key: 'account', label: 'Tài khoản' }, { key: 'detail', label: 'Nội dung' },
      { key: 'amount', label: 'Số tiền' }, { key: 'date', label: 'Ngày gửi' }, { key: 'status', label: 'Trạng thái' }
    ];
  }

  public get filteredRows(): AdminTableRow[] {
    const query = this.queueSearch.trim().toLocaleLowerCase('vi');
    const rows = this.getQueueItems().filter(item => this.activeTab !== 'reports' || (
      (this.reportStatusFilter === 'all' || item.status === this.reportStatusFilter)
      && (this.reportTypeFilter === 'all' || item.targetType === this.reportTypeFilter)
      && (this.reportReasonFilter === 'all' || item.reasonLabel === this.reportReasonFilter)
    )).map(item => this.toTableRow(item));
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

  public isLongIdentifier(value: string): boolean {
    const candidate = String(value || '').trim();
    if (/\s|@/.test(candidate)) return false;
    return /^[a-f\d]{20,}$/i.test(candidate)
      || /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(candidate)
      || /^[a-z]{2,6}[-_][a-z\d_-]{4,}$/i.test(candidate);
  }

  public statusTone(status: string): 'pending' | 'active' | 'danger' | 'neutral' {
    const value = String(status || '').toLocaleLowerCase('vi');
    if (value.includes('chờ') || value.includes('pending')) return 'pending';
    if (value.includes('hoạt động') || value.includes('active') || value.includes('đã duyệt')) return 'active';
    if (value.includes('từ chối') || value.includes('rejected') || value.includes('ẩn') || value.includes('vi phạm')) return 'danger';
    return 'neutral';
  }

  public toggleTableColumn(key: string): void {
    if (this.activeTab === 'providers') this.providerVisibleColumns[key] = !this.providerVisibleColumns[key];
    else if (this.activeTab === 'services') this.serviceVisibleColumns[key] = !this.serviceVisibleColumns[key];
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
    if (this.activeTab === 'reports') { await this.loadReports(); return; }
    if (this.isCatalogTab) { await this.loadCatalog(this.activeTab as CatalogKey); return; }
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

  public setQueuePageSize(size: number): void {
    if (this.isPolishedAdminTable) this.polishedTablePageSize = size;
    else this.queuePageSize = size;
    this.currentPage = 1;
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

  public async openProviderDetail(row: AdminTableRow): Promise<void> {
    if (this.isPreviewMode || !row.actionId) return;
    const requestId = ++this.providerDetailRequestId;
    const userId = row.actionId;
    this.providerDetail = { id: userId, displayName: row.name, email: row.raw?.User?.email, contracts: [], businessStats: {} };
    this.providerModalTab = 'info';
    this.providerModalLoading = true;
    this.providerModalError = '';
    this.providerTabLoading = false;
    this.providerTabError = '';
    this.providerServices = [];
    this.providerServicesPage = 0;
    this.providerServicesPages = 0;
    this.providerServicesLoaded = false;
    this.providerAdminHistory = [];
    this.providerAdminHistoryPage = 0;
    this.providerAdminHistoryPages = 0;
    this.providerAdminHistoryLoaded = false;
    this.providerEditing = false;
    try {
      const response = await this.apiService.getAdminProvider(userId);
      if (requestId !== this.providerDetailRequestId || this.providerDetail?.id !== userId) return;
      if (!response?.success || !response.user || !response.provider) throw new Error('Provider unavailable');
      this.providerDetail = {
        ...response.user,
        ...response.provider,
        id: response.user.id,
        provider_id: response.provider.id,
        displayName: response.provider.name_provider || response.user.fullname || response.user.username,
        accountStatusLabel: this.providerAccountStatus(response.user.account_status),
        verificationStatusLabel: this.providerVerificationStatus(response.provider.provider_status),
        contracts: response.contracts || [],
        businessStats: response.businessStats || {}
      };
    } catch {
      if (requestId === this.providerDetailRequestId && this.providerDetail?.id === userId) this.providerModalError = 'Không tải được hồ sơ nhà cung cấp.';
    } finally {
      if (requestId === this.providerDetailRequestId && this.providerDetail?.id === userId) {
        this.providerModalLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  public closeProviderDetail(): void {
    this.providerDetailRequestId++;
    this.providerDetail = null;
    this.providerModalLoading = false;
    this.providerTabLoading = false;
    this.providerEditing = false;
  }

  public retryProviderDetail(): void {
    const row = this.pageRows.find(item => item.actionId === this.providerDetail?.id);
    if (row) void this.openProviderDetail(row);
  }

  public get providerTabs(): AccountModalTab[] {
    return [
      { id: 'info', label: 'Thông tin chung' },
      { id: 'legal', label: 'Hồ sơ pháp lý' },
      { id: 'business', label: 'Hoạt động kinh doanh' },
      { id: 'admin', label: 'Lịch sử quản trị' }
    ];
  }

  public setProviderTab(tab: string): void {
    if (!this.providerTabs.some(item => item.id === tab)) return;
    this.providerModalTab = tab;
    this.providerTabError = '';
    if (tab === 'business' && !this.providerServicesLoaded) void this.loadProviderServices();
    if (tab === 'admin' && !this.providerAdminHistoryLoaded) void this.loadProviderAdminHistory();
  }

  public async loadProviderServices(page = 1, append = false): Promise<void> {
    if (!this.providerDetail || this.providerTabLoading) return;
    const userId = this.providerDetail.id;
    const requestId = this.providerDetailRequestId;
    this.providerTabLoading = true;
    this.providerTabError = '';
    try {
      const response = await this.apiService.getAdminProviderServices(userId, page);
      if (requestId !== this.providerDetailRequestId || this.providerDetail?.id !== userId || this.providerModalTab !== 'business') return;
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Provider services unavailable');
      this.providerServices = append ? [...this.providerServices, ...response.data] : response.data;
      this.providerServicesPage = response.pagination?.page || page;
      this.providerServicesPages = response.pagination?.pages || 0;
      this.providerServicesLoaded = true;
    } catch {
      if (requestId === this.providerDetailRequestId && this.providerDetail?.id === userId && this.providerModalTab === 'business') this.providerTabError = 'Không tải được hoạt động kinh doanh.';
    } finally {
      if (requestId === this.providerDetailRequestId && this.providerDetail?.id === userId) {
        this.providerTabLoading = false;
        this.cdr.detectChanges();
        if (this.providerModalTab !== 'business' && this.providerModalTab === 'admin' && !this.providerAdminHistoryLoaded) void this.loadProviderAdminHistory();
      }
    }
  }

  public async loadProviderAdminHistory(page = 1, append = false): Promise<void> {
    if (!this.providerDetail || this.providerTabLoading) return;
    const userId = this.providerDetail.id;
    const requestId = this.providerDetailRequestId;
    this.providerTabLoading = true;
    this.providerTabError = '';
    try {
      const response = await this.apiService.getAdminUserActivity(userId, page);
      if (requestId !== this.providerDetailRequestId || this.providerDetail?.id !== userId || this.providerModalTab !== 'admin') return;
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Provider history unavailable');
      this.providerAdminHistory = append ? [...this.providerAdminHistory, ...response.data] : response.data;
      this.providerAdminHistoryPage = response.pagination?.page || page;
      this.providerAdminHistoryPages = response.pagination?.pages || 0;
      this.providerAdminHistoryLoaded = true;
    } catch {
      if (requestId === this.providerDetailRequestId && this.providerDetail?.id === userId && this.providerModalTab === 'admin') this.providerTabError = 'Không tải được lịch sử quản trị.';
    } finally {
      if (requestId === this.providerDetailRequestId && this.providerDetail?.id === userId) {
        this.providerTabLoading = false;
        this.cdr.detectChanges();
        if (this.providerModalTab !== 'admin' && this.providerModalTab === 'business' && !this.providerServicesLoaded) void this.loadProviderServices();
      }
    }
  }

  public retryProviderTab(): void {
    this.providerTabError = '';
    if (this.providerModalTab === 'business') {
      this.providerServicesLoaded = false;
      void this.loadProviderServices(1);
    } else if (this.providerModalTab === 'admin') {
      this.providerAdminHistoryLoaded = false;
      void this.loadProviderAdminHistory(1);
    } else {
      this.retryProviderDetail();
    }
  }

  public get providerCanLoadMore(): boolean {
    return (this.providerModalTab === 'business' && this.providerServicesPage > 0 && this.providerServicesPage < this.providerServicesPages)
      || (this.providerModalTab === 'admin' && this.providerAdminHistoryPage > 0 && this.providerAdminHistoryPage < this.providerAdminHistoryPages);
  }

  public get providerLoadMoreBusy(): boolean { return this.providerTabLoading; }

  public loadMoreProviderTab(): void {
    if (this.providerModalTab === 'business') void this.loadProviderServices(this.providerServicesPage + 1, true);
    else if (this.providerModalTab === 'admin') void this.loadProviderAdminHistory(this.providerAdminHistoryPage + 1, true);
  }

  public get providerFields(): AccountModalField[] {
    const account = this.providerDetail;
    if (!account) return [];
    if (this.providerModalTab === 'info') {
      const fields: AccountModalField[] = [
        { label: 'Tên nhà cung cấp', value: account.name_provider, key: 'name_provider', required: true },
        { label: 'Người đại diện', value: account.fullname, key: 'fullname' },
        { label: 'Email', value: account.email },
        { label: 'Số điện thoại', value: account.phone, key: 'phone', type: 'tel' },
        { label: 'Địa chỉ tài khoản', value: account.address, key: 'address' },
        { label: 'Ngày đăng ký', value: this.formatDate(account.createdAt) },
        { label: 'Trạng thái xác minh', value: this.providerVerificationStatus(account.provider_status) },
        { label: 'Trạng thái tài khoản', value: this.providerAccountStatus(account.account_status) }
      ];
      return this.providerEditing ? fields.filter(field => Boolean(field.key)) : fields;
    }
    if (this.providerModalTab === 'legal') {
      const providerFields: AccountModalField[] = [
        { label: 'Mã hồ sơ nhà cung cấp', value: account.provider_id },
        { label: 'Lĩnh vực kinh doanh', value: account.field, key: 'field' },
        { label: 'Địa điểm kinh doanh', value: account.destination, key: 'destination', required: true },
        { label: 'Ảnh hồ sơ đã lưu', value: account.image_url },
        ...account.contracts.map((contract: any, index: number) => ({ label: 'Hợp đồng ' + (index + 1), value: contract.name_contract + ' · ' + this.formatDate(contract.createdAt) }))
      ];
      return this.providerEditing ? providerFields.filter(field => Boolean(field.key)) : providerFields;
    }
    if (this.providerModalTab === 'business') {
      return [
        { label: 'Tổng dịch vụ', value: account.businessStats?.services ?? 0 },
        { label: 'Booking dịch vụ', value: account.businessStats?.serviceBookings ?? 0 },
        { label: 'Tour liên kết', value: account.businessStats?.tourProducts ?? 0 }
      ];
    }
    return [];
  }

  public get providerSectionHeading(): string {
    return this.providerTabs.find(tab => tab.id === this.providerModalTab)?.label || '';
  }

  public get providerEmptyMessage(): string {
    const account = this.providerDetail;
    if (!account) return '';
    if (this.providerModalTab === 'legal' && !account.contracts.length) return 'Chưa có hợp đồng pháp lý được lưu cho hồ sơ này.';
    if (this.providerModalTab === 'business' && this.providerServicesLoaded && !this.providerServices.length) return 'Nhà cung cấp chưa có dịch vụ kinh doanh được lưu.';
    if (this.providerModalTab === 'admin' && this.providerAdminHistoryLoaded && !this.providerAdminHistory.length) return 'Chưa có lịch sử quản trị được ghi nhận.';
    return '';
  }

  public get providerRecords(): AccountModalRecord[] {
    const account = this.providerDetail;
    if (!account) return [];
    if (this.providerModalTab === 'legal') {
      return account.contracts.map((contract: any) => ({ title: contract.name_contract, detail: contract.text, meta: this.formatDate(contract.createdAt) }));
    }
    if (this.providerModalTab === 'business') {
      return this.providerServices.map((service: any) => ({ title: service.name_service, detail: service.destination, meta: 'Tạo ngày ' + this.formatDate(service.createdAt), status: service.status }));
    }
    if (this.providerModalTab === 'admin') {
      return this.providerAdminHistory.map((item: any) => ({ title: item.action, detail: item.reason, meta: this.formatDate(item.createdAt) + ' · ' + item.actor_id }));
    }
    return [];
  }

  public startProviderEdit(): void {
    if (!this.providerDetail) return;
    this.providerEditValues = {
      name_provider: this.providerDetail.name_provider || '',
      fullname: this.providerDetail.fullname || '',
      phone: this.providerDetail.phone || '',
      address: this.providerDetail.address || '',
      field: this.providerDetail.field || '',
      destination: this.providerDetail.destination || ''
    };
    this.providerEditReason = '';
    this.providerEditing = true;
  }

  public async saveProviderEdit(event: { values: Record<string, any>; reason: string }): Promise<void> {
    if (!this.providerDetail) return;
    this.providerBusy = true;
    try {
      await this.apiService.updateAdminProvider(this.providerDetail.id, { ...event.values, reason: event.reason });
      this.providerEditing = false;
      this.providerEditReason = '';
      await this.reloadProviderDetailAndList();
      this.showAlert('Đã cập nhật hồ sơ nhà cung cấp.', 'success');
    } catch { this.showAlert('Cập nhật hồ sơ nhà cung cấp thất bại.', 'error'); }
    finally { this.providerBusy = false; this.cdr.detectChanges(); }
  }

  public async toggleProviderStatus(event: { reason: string }): Promise<void> {
    if (!this.providerDetail) return;
    this.providerBusy = true;
    const action = this.providerDetail.account_status === 'suspended' || this.providerDetail.account_status === 'deactivated' ? 'unsuspend' : 'suspend';
    try {
      await this.apiService.updateAdminProviderStatus(this.providerDetail.id, action, event.reason);
      await this.reloadProviderDetailAndList();
      this.showAlert(action === 'suspend' ? 'Đã khóa tài khoản nhà cung cấp.' : 'Đã mở khóa tài khoản nhà cung cấp.', 'success');
    } catch { this.showAlert('Không thể cập nhật trạng thái tài khoản nhà cung cấp.', 'error'); }
    finally { this.providerBusy = false; this.cdr.detectChanges(); }
  }

  private async reloadProviderDetailAndList(): Promise<void> {
    if (!this.providerDetail) return;
    const userId = this.providerDetail.id;
    const response = await this.apiService.getAdminProvider(userId);
    if (!response?.success || !response.user || !response.provider) throw new Error('Provider unavailable');
    this.providerDetail = {
      ...response.user, ...response.provider, id: response.user.id,
      provider_id: response.provider.id,
      displayName: response.provider.name_provider || response.user.fullname || response.user.username,
      accountStatusLabel: this.providerAccountStatus(response.user.account_status),
      verificationStatusLabel: this.providerVerificationStatus(response.provider.provider_status),
      contracts: response.contracts || [],
      businessStats: response.businessStats || {}
    };
    await this.loadProviders();
    if (this.providerModalTab === 'business') {
      this.providerServicesLoaded = false;
      await this.loadProviderServices(1);
    } else if (this.providerModalTab === 'admin') {
      this.providerAdminHistoryLoaded = false;
      await this.loadProviderAdminHistory(1);
    }
  }

  private providerAccountStatus(status: string): string {
    return status === 'suspended' || status === 'deactivated' ? 'Đã khóa' : 'Đang hoạt động';
  }

  private providerVerificationStatus(status: string): string {
    return status === 'active' ? 'Đã xác minh' : status === 'rejected' ? 'Bị từ chối' : 'Chờ xác minh';
  }

  public approveDeposit(id: string) {
    if (this.isPreviewMode) return;
    this.showConfirm('Xác nhận đã nhận tiền nạp và duyệt giao dịch này?', async () => {
      const verificationReference = window.prompt('Nhập mã đối soát ngân hàng đã xác minh (tối thiểu 8 ký tự):');
      if (!verificationReference || verificationReference.trim().length < 8) return;
      const success = await this.apiService.approveDeposit(id, verificationReference.trim());
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
      const verificationReference = window.prompt('Nhập mã đối soát ngân hàng đã xác minh (tối thiểu 8 ký tự):');
      if (!verificationReference || verificationReference.trim().length < 8) return;
      const success = await this.apiService.approveWithdrawal(id, verificationReference.trim());
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

  
  public async approveRefundRow(row: AdminTableRow) {
    if (this.isPreviewMode) return;
    this.showConfirm(`Xác nhận đã chuyển tiền hoàn cọc cho mã ${row.id}?`, async () => {
      const ok = await this.apiService.approveAdminRefund(row.id);
      if (ok) {
        this.showAlert('Đã xác nhận hoàn tiền thành công.', 'success');
        await this.loadCatalog('refunds');
      } else {
        this.showAlert('Không thể cập nhật trạng thái.', 'error');
      }
    });
  }

  public async rejectRefundRow(row: AdminTableRow) {
    if (this.isPreviewMode) return;
    this.showConfirm(`Từ chối yêu cầu hoàn tiền cho mã ${row.id}?`, async () => {
      const ok = await this.apiService.rejectAdminRefund(row.id, 'Không đủ điều kiện theo chính sách');
      if (ok) {
        this.showAlert('Đã từ chối yêu cầu hoàn tiền.', 'info');
        await this.loadCatalog('refunds');
      } else {
        this.showAlert('Không thể cập nhật trạng thái.', 'error');
      }
    });
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
    if (this.activeTab === 'reports') return this.communityReports;
    if (this.isCatalogTab) return this.catalog[this.activeTab as CatalogKey];
    // refunds supported via catalog
    return this.queueFor(this.activeTab as QueueKey);
  }

  private toTableRow(item: any): AdminTableRow {
    const common = {
      id: String(item.id || '—'), actionId: String(item.id || ''), name: '—', account: '—', detail: '—', date: this.formatDate(item.createdAt || item.date),
      status: item.status || 'Chờ xử lý', serviceType: '—', documents: '—', revenue: '—', cancellationRate: '—', rating: '—', priority: '—', amount: this.formatMoney(item.amount ?? item.value), raw: item
    };
    if (this.activeTab === 'reports') return { ...common, name: item.author, serviceType: item.targetType === 'post' ? 'Bài viết / video' : 'Bình luận', detail: `${item.reasonLabel}: ${item.details || ''} · ${item.text || ''}`, status: ({ pending: 'Chờ kiểm duyệt', hidden: 'Đã ẩn', dismissed: 'Giữ nội dung', restored: 'Đã khôi phục' } as Record<string, string>)[item.status] || item.status };
    if (this.isCatalogTab) return { ...common, name: item.name || '—', detail: item.detail || '—',
      status: item.status || '—', amount: this.activeTab === 'promotions'
        ? (item.discount_type === 'percent' ? `${item.discount_value}%` : this.formatMoney(item.discount_value))
        : this.formatMoney(item.value) };
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
