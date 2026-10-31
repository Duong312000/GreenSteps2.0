import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/models';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LoginModalComponent } from '../login-modal/login-modal';
import { LoginModalService } from '../../services/login-modal.service';

declare const L: any; // Leaflet mapped globally via index.html script tag

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy {
  public currentUser: User | null = null;
  public currentPath: string = '';

  private modalMap: any = null;
  private modalMarkers: { [key: string]: any } = {};
  private destCoords: { [key: string]: [number, number] } = {
    'Đà Lạt': [11.940419, 108.458313],
    'Phú Yên': [13.088198, 109.314957],
    'Đà Nẵng - Hội An': [16.047079, 108.206230]
  };
  public smartSearchQuery: string = '';
  public isSearchDropdownActive: boolean = false;
  public isNotificationDropdownActive: boolean = false;
  public notifications: any[] = [];

  public get unreadNotificationCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  public toggleNotificationDropdown(event: Event) {
    event.stopPropagation();
    this.isNotificationDropdownActive = !this.isNotificationDropdownActive;
    this.isProfileOpen = false;
    if (this.isNotificationDropdownActive && this.currentUser) {
      this.loadRealNotifications(this.currentUser.id || this.currentUser._id || '');
    }
  }

  public async markAllNotificationsAsRead() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    const ok = await this.apiService.markAllNotificationsRead(userId);
    if (ok) {
      this.notifications.forEach(n => n.read = true);
    }
  }

  public async clearNotifications() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    const ok = await this.apiService.clearNotifications(userId);
    if (ok) {
      this.notifications = [];
    }
  }

  public async markNotificationRead(notif: any) {
    if (notif.read) return;
    const ok = await this.apiService.markNotificationRead(notif.id);
    if (ok) {
      notif.read = true;
    }
  }

  public viewAllNotifications() {
    this.isNotificationDropdownActive = false;
    this.router.navigate(['/profile'], { queryParams: { section: 'notifications' } });
  }

  public async loadRealNotifications(userId: string) {
    try {
      const list = await this.apiService.getNotifications(userId);
      this.notifications = list.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        time: this.formatTimeAgo(n.createdAt)
      }));
    } catch (e) {
      console.warn('Failed to load real notifications:', e);
    }
  }

  private formatTimeAgo(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  }
  public isMobileMenuOpen: boolean = false;
  public isLoginModalOpen: boolean = false;
  public isOverflowOpen: boolean = false;  // controlled by mouseenter/mouseleave
  public isProfileOpen: boolean = false;   // profile dropdown hover
  public navStartX: number = 0;            // left-x of first nav tab, for overflow panel alignment

  // All tabs combined (traveler + provider when applicable)
  public allTabs: any[] = [];
  // Subset that overflows the nav row — rendered in the dropdown panel
  public overflowTabs: any[] = [];
  // Indices of tabs that overflow — used to hide them in the main nav
  public overflowTabIndices: Set<number> = new Set<number>();

  public get filteredMobileTabs(): any[] {
    const query = this.normalizeMenuSearch(this.smartSearchQuery);
    if (!query) return this.allTabs;

    return this.allTabs.filter(tab => {
      const label = this.normalizeMenuSearch(tab.label || '');
      return label.includes(query);
    });
  }

  // AI Planner Modal
  public isCreateModalOpen: boolean = false;
  public modalDest: string = 'Đà Lạt';
  public modalDays: number = 3;

  // Smart Search filters
  public filterDest: string = 'Đà Lạt';
  public filterBudget: string = '6';
  public filterStyle: string = 'eco';

  public currentTheme: 'light' | 'dark' = 'light';
  public isScrolled: boolean = false;

  @ViewChild('headerWrapper') headerWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('navContainer') navContainerRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput!: ElementRef;
  @ViewChild('filterDropdown') filterDropdown!: ElementRef;

  private resizeObserver!: ResizeObserver;
  private loginModalSubscription?: Subscription;
  private profileCloseTimer?: number;
  private updateScrollState() {
    const nextIsScrolled = window.scrollY > 0;
    if (this.isScrolled === nextIsScrolled) return;

    this.isScrolled = nextIsScrolled;
    if (this.isHomeHeaderCollapsed) {
      this.isOverflowOpen = false;
    }
  }

  @HostListener('window:scroll')
  public onWindowScroll() {
    this.updateScrollState();
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    if (this.overflowTabs.length > 0) {
      this.isOverflowOpen = true;
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.isOverflowOpen = false;
  }

  @HostListener('window:resize')
  onResize() {
    this.scheduleOverflowCalc();
  }

  @HostListener('document:keydown.escape')
  public onEscapeKey() {
    if (this.isMobileMenuOpen) {
      this.isMobileMenuOpen = false;
      document.body.style.overflow = '';
    }
  }

  public isHomePage(): boolean {
    return this.router.url === '/' || this.router.url.startsWith('/home');
  }

  public get isHomeHeaderCollapsed(): boolean {
    return this.isHomePage() && !this.isScrolled;
  }

  public get isHeaderTransparent(): boolean {
    return this.isHomeHeaderCollapsed && !this.isOverflowOpen;
  }

  constructor(
    public authService: AuthService,
    private router: Router,
    private apiService: ApiService,
    private loginModalService: LoginModalService
  ) { }

  @HostListener('document:mousedown', ['$event'])
  public onClickOutside(event: MouseEvent) {
    if (this.isSearchDropdownActive &&
      this.searchInput &&
      this.filterDropdown &&
      !this.searchInput.nativeElement.contains(event.target) &&
      !this.filterDropdown.nativeElement.contains(event.target)) {
      this.isSearchDropdownActive = false;
    }
  }

  public toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  public loginModalMode: 'login' | 'register' = 'login';

  public openLoginModal(mode: 'login' | 'register' = 'login') {
    this.isMobileMenuOpen = false;
    document.body.style.overflow = '';
    this.loginModalMode = mode;
    this.isLoginModalOpen = true;
  }

  public closeLoginModal() {
    this.isLoginModalOpen = false;
  }

  ngOnInit() {
    this.updateScrollState();
    this.loginModalSubscription = this.loginModalService.open$.subscribe(() => this.openLoginModal());

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.updateNavigation();
      if (user) {
        this.loadRealNotifications(user.id || user._id || '');
      } else {
        this.notifications = [];
      }
      // Recalculate after DOM updates with new tabs
      setTimeout(() => this.calculateOverflow(), 50);
    });

    this.currentPath = this.router.url;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentPath = event.url;
      this.updateScrollState();
    });

    const savedTheme = localStorage.getItem('greensteps_theme') as 'light' | 'dark';
    if (savedTheme) {
      this.currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  ngAfterViewInit() {
    // Double rAF ensures DOM layout is complete before measuring
    this.scheduleOverflowCalc();
    if (this.navContainerRef) {
      this.resizeObserver = new ResizeObserver(() => this.scheduleOverflowCalc());
      this.resizeObserver.observe(this.navContainerRef.nativeElement);
    }
  }

  /** Schedule overflow calc on next paint frame */
  private scheduleOverflowCalc() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.calculateOverflow());
    });
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    this.loginModalSubscription?.unsubscribe();
    this.clearProfileCloseTimer();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  /**
   * Measures which tabs overflow the nav container's visible width.
   * Uses getBoundingClientRect for accuracy regardless of offsetParent.
   * Populates both overflowTabs (for the panel) and overflowTabIndices (to hide in main nav).
   */
  public calculateOverflow() {
    if (!this.navContainerRef) return;
    const navEl = this.navContainerRef.nativeElement;
    const parentEl = navEl.parentElement || navEl;
    const parentRect = parentEl.getBoundingClientRect();
    const tabEls = navEl.querySelectorAll<HTMLElement>('.nav-tab-item');

    const newOverflow: any[] = [];
    const newIndices = new Set<number>();
    let firstVisibleLeft: number = 0;
    let firstVisibleFound = false;

    tabEls.forEach((el, i) => {
      const elRect = el.getBoundingClientRect();
      // Tab is overflowing if its right edge exceeds the clipping parent container's right edge
      if (elRect.right > parentRect.right + 1 && this.allTabs[i]) {
        newOverflow.push(this.allTabs[i]);
        newIndices.add(i);
      } else if (!firstVisibleFound) {
        firstVisibleLeft = elRect.left;
        firstVisibleFound = true;
      }
    });
    this.overflowTabs = newOverflow;
    this.overflowTabIndices = newIndices;
    // Align overflow panel: use exact left position of first visible tab relative to the wrapper content area
    if (firstVisibleFound && this.headerWrapperRef) {
      const wrapperEl = this.headerWrapperRef.nativeElement;
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const wrapperStyle = window.getComputedStyle(wrapperEl);
      const paddingLeft = parseFloat(wrapperStyle.paddingLeft || '0');
      this.navStartX = firstVisibleLeft - wrapperRect.left - paddingLeft;
    } else {
      this.navStartX = 0;
    }
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent) {
    this.isProfileOpen = false;
    this.isSearchDropdownActive = false;
    this.isNotificationDropdownActive = false;
  }

  public toggleProfileOpen(event: Event) {
    event.stopPropagation();
    this.isProfileOpen = !this.isProfileOpen;
  }

  public toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('greensteps_theme', this.currentTheme);
  }

  public showSearchDropdown() {
    this.isSearchDropdownActive = true;
  }

  public onSearchKeypress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.triggerSearch();
    }
  }

  public triggerSearch() {
    const query = this.smartSearchQuery.trim();
    this.isSearchDropdownActive = false;
    if (query) {
      this.router.navigate(['/tours'], { queryParams: { search: query } });
    }
  }

  public applySmartFilters() {
    this.isSearchDropdownActive = false;
    this.router.navigate(['/tours'], {
      queryParams: {
        dest: this.filterDest,
        budget: this.filterBudget,
        style: this.filterStyle
      }
    });
  }

  public getFirstLetter(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  public showGreenHandbookAlert() {
    alert('Tính năng Cẩm Nang Xanh đang phát triển!');
  }

  public isAiPlannerActive(): boolean {
    return this.router.url.startsWith('/schedule');
  }

  public isServicesActive(): boolean {
    return this.router.url.startsWith('/services');
  }

  public selectSearchDest(dest: string) {
    this.smartSearchQuery = dest;
    this.isSearchDropdownActive = false;
    this.router.navigate(['/tours'], { queryParams: { dest: dest } });
  }

  public handleAiPlannerClick() {
    this.router.navigate(['/schedule']);
  }

  public openProfileMenu() {
    this.clearProfileCloseTimer();
    this.isProfileOpen = true;
  }

  public scheduleProfileMenuClose() {
    this.clearProfileCloseTimer();
    this.profileCloseTimer = window.setTimeout(() => {
      this.isProfileOpen = false;
      this.profileCloseTimer = undefined;
    }, 180);
  }

  private clearProfileCloseTimer() {
    if (!this.profileCloseTimer) return;
    window.clearTimeout(this.profileCloseTimer);
    this.profileCloseTimer = undefined;
  }

  public openCreateItineraryModal() {
    this.isCreateModalOpen = true;
    setTimeout(() => {
      this.initModalMap('headerModalMap');
    }, 150);
  }

  public closeCreateItineraryModal() {
    this.isCreateModalOpen = false;
    if (this.modalMap) {
      try {
        this.modalMap.remove();
      } catch (e) { }
      this.modalMap = null;
      this.modalMarkers = {};
    }
  }

  private initModalMap(containerId: string) {
    const mapEl = document.getElementById(containerId);
    if (!mapEl) return;

    if (this.modalMap) {
      try {
        this.modalMap.remove();
      } catch (e) { }
      this.modalMap = null;
      this.modalMarkers = {};
    }

    this.modalMap = L.map(containerId, {
      zoomControl: true,
      attributionControl: false
    }).setView([14.2, 108.8], 6);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    }).addTo(this.modalMap);


    Object.keys(this.destCoords).forEach(dest => {
      const coords = this.destCoords[dest];
      const isSelected = this.modalDest === dest;

      const markerIcon = L.divIcon({
        className: 'custom-modal-marker',
        html: `<div class="modal-pin ${isSelected ? 'active-pin' : ''}" style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: ${isSelected ? '#0E9F6E' : '#9CA3AF'};
          border: 3px solid #FFFFFF;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          transition: all 0.3s;
          transform: scale(${isSelected ? 1.4 : 1});
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker(coords, { icon: markerIcon }).addTo(this.modalMap);

      marker.bindTooltip(dest, {
        permanent: true,
        direction: 'right',
        className: 'modal-marker-tooltip',
        offset: [10, 0]
      });

      marker.on('click', () => {
        this.selectDestinationFromMap(dest);
      });

      this.modalMarkers[dest] = marker;
    });

    setTimeout(() => {
      if (this.modalMap) {
        this.modalMap.invalidateSize();
      }
    }, 200);
  }

  public selectDestinationFromMap(dest: string) {
    this.modalDest = dest;
    this.updateModalMarkers();
    if (this.modalMap) {
      this.modalMap.panTo(this.destCoords[dest]);
    }
  }

  private updateModalMarkers() {
    Object.keys(this.modalMarkers).forEach(dest => {
      const marker = this.modalMarkers[dest];
      if (!marker) return;

      const isSelected = this.modalDest === dest;

      const icon = L.divIcon({
        className: 'custom-modal-marker',
        html: `<div class="modal-pin ${isSelected ? 'active-pin' : ''}" style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: ${isSelected ? '#0E9F6E' : '#9CA3AF'};
          border: 3px solid #FFFFFF;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          transition: all 0.3s;
          transform: scale(${isSelected ? 1.4 : 1});
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      marker.setIcon(icon);
    });
  }

  public onModalDestChange() {
    this.updateModalMarkers();
    if (this.modalMap && this.destCoords[this.modalDest]) {
      this.modalMap.panTo(this.destCoords[this.modalDest]);
    }
  }

  public async submitNewItinerary(event: Event) {
    event.preventDefault();
    this.isCreateModalOpen = false;

    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';

    const daysData = Array.from({ length: Number(this.modalDays) }, () => []);

    const newIti = {
      id: 'iti_' + Date.now(),
      name: `Lịch trình tự thiết kế ${this.modalDest}`,
      user_id: userId,
      destination: this.modalDest,
      days: Number(this.modalDays),
      totalCost: 0,
      totalCarbon: 0,
      daysData
    };

    await this.apiService.saveItinerary(newIti);
    this.router.navigate(['/schedule', newIti.id]);
  }



  public handleLogout() {
    this.authService.logout();
    alert('Đã đăng xuất tài khoản!');
    this.router.navigate(['/']);
  }
  public updateNavigation() {
    const travelerTabs = [
      { label: 'Khuyến mãi', link: '/promotions' },
      { label: 'Cộng đồng', link: '/community' },
      { label: 'Chuyến đi trọn gói', link: '/tours' },
      { label: 'Lưu trú', link: '/services', queryParams: { type: 'stay' } },
      { label: 'Phương tiện', link: '/services', queryParams: { type: 'transport' } },
      { label: 'Ăn uống', link: '/services', queryParams: { type: 'food' } },
      { label: 'Giải trí', link: '/services', queryParams: { type: 'attraction' } },
      { label: 'Lịch trình của tôi', action: 'ai_planner' }
    ];

    if (this.currentUser && this.currentUser.role === 'provider') {
      this.allTabs = [
        ...travelerTabs,
        { label: 'Thống kê doanh thu', link: '/partner-dashboard' },
        { label: 'Dịch vụ', link: '/partner-services' },
        { label: 'Quản lý booking', link: '/partner-bookings' },
        { label: 'Tiếp thị và chăm sóc', link: '/partner-ads' },
        { label: 'Quảng bá', link: '/partner-promotions' }
      ];
    } else if (this.currentUser && this.currentUser.role === 'admin') {
      this.allTabs = [
        ...travelerTabs,
        { label: 'Bảng quản trị', link: '/admin' }
      ];
    } else {
      this.allTabs = [...travelerTabs];
    }

    this.overflowTabs = [];
  }

  private normalizeMenuSearch(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export { HeaderComponent as Header };
