import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/models';
import { Subscription, Subject, from, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { LoginModalComponent } from '../login-modal/login-modal';
import { LoginModalService } from '../../services/login-modal.service';

declare const L: any; // Leaflet mapped globally via index.html script tag

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild('navbarSearchPanel') private navbarSearchPanel?: ElementRef<HTMLElement>;
  private readonly searchTerms$ = new Subject<string>();
  private readonly destroyed$ = new Subject<void>();
  private searchRequestSequence = 0;
  private searchFocusTimer?: number;
  public isNavbarSearchOpen = false;
  private notifPollingTimer?: any;
  public navbarSearchQuery = '';
  public navbarSearchSuggestions: Array<{ id: string; label: string; detail: string; kind: 'tour' | 'service'; route: string; }> = [];
  public isNavbarSearchLoading = false;
  public navbarSearchError = false;
  public activeNavbarSearchIndex = -1;
  public currentUser: User | null = null;
  public currentPath: string = '';

  public get isHelpCenterRoute(): boolean {
    return this.currentPath.startsWith('/help-center') || this.currentPath.startsWith('/contact');
  }

  private modalMap: any = null;
  private modalMarkers: { [key: string]: any } = {};
  private destCoords: { [key: string]: [number, number] } = {
    'Đà Lạt': [11.940419, 108.458313],
    'Phú Yên': [13.088198, 109.314957],
    'Đà Nẵng - Hội An': [16.047079, 108.206230]
  };
  public isNotificationDropdownActive: boolean = false;
  public notifications: any[] = [];

  public get unreadNotificationCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  public toggleNotificationDropdown(event: Event) {
    event.stopPropagation();
    this.closeNavbarSearch();
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
    if (String(notif.id || '').startsWith('counter-')) {
      this.apiService.markLocalNotificationRead(notif.id);
      notif.read = true;
    } else if (!notif.read) {
      const ok = await this.apiService.markNotificationRead(notif.id);
      if (ok) notif.read = true;
    }
    this.isNotificationDropdownActive = false;
    const destination = this.getNotificationDestination(notif);
    if (destination) void this.router.navigateByUrl(destination);
  }

  private getNotificationDestination(notif: any): string | null {
    const rawLink = String(notif?.link || notif?.link_url || '').trim();
    const refId = String(notif?.reference_id || notif?.referenceId || notif?.bookingId || notif?.booking_id || '').trim();
    const normalizedText = this.normalizeNotificationText(`${notif?.title || ''} ${notif?.message || ''}`);
    const counterRequest = /quay|counter/i.test(normalizedText);
    if (counterRequest && refId) return `/booking/confirm?bookingId=${encodeURIComponent(refId)}`;

    // 1. Direct specific deep link if already present in notification
    if (rawLink) {
      if (rawLink.includes('/schedule/') || rawLink.includes('/community?post=') || rawLink.includes('/tour-detail/') || rawLink.includes('/service-detail/')) {
        return rawLink;
      }
    }

    // 2. Specific Community post / comment notification
    if (notif?.type === 'community' || /\b(?:cong dong|bai viet|binh luan|thao luan|hoi dap|phan hoi|vmt|comment|cau tra loi|tra loi)\b/i.test(normalizedText)) {
      const postId = notif?.postId || refId;
      if (postId) return `/community?post=${encodeURIComponent(postId)}`;
      if (rawLink && rawLink.includes('post=')) return rawLink;
      return '/community';
    }

    // 3. Specific Itinerary / Schedule editor notification
    if (notif?.type === 'itinerary' || /\b(?:lich trinh|hanh trinh|chuyen di|tu thiet ke|khoi tao thanh cong|planner|schedule)\b/i.test(normalizedText)) {
      const itiId = notif?.itineraryId || refId;
      if (itiId) return `/schedule/${encodeURIComponent(itiId)}`;
      const storedId = localStorage.getItem('greensteps_working_itinerary_id');
      if (storedId) return `/schedule/${encodeURIComponent(storedId)}`;
      return '/profile?section=itineraries';
    }

    // 4. Specific Booking / Ticket notification
    if (notif?.type === 'booking' || /\b(?:dat ve|don hang|ma don|ve may bay|ve xe|dat tour|dat phong|booking|ticket)\b/i.test(normalizedText)) {
      const bId = notif?.bookingId || notif?.booking_id || refId;
      if (bId) return `/booking/confirm?bookingId=${encodeURIComponent(bId)}`;
      return '/profile?section=tickets';
    }

    // 5. Wallet
    if (notif?.type === 'wallet' || /\b(?:vi green|green wallet|so du vi|nap tien|rut tien|hoan tien ve vi|hoan tien|tien coc|vi dien tu)\b/i.test(normalizedText)) {
      return '/profile?section=wallet';
    }

    // 6. Fallback to raw link if provided
    if (rawLink) {
      try {
        const url = new URL(rawLink, window.location.origin);
        const code = url.searchParams.get('code');
        const id = url.searchParams.get('bookingId');
        if (url.pathname === '/booking-lookup' && code) {
          return `/booking/confirm?bookingId=${encodeURIComponent(code)}`;
        }
        if (url.pathname === '/booking/confirm' && (id || code)) {
          return `/booking/confirm?bookingId=${encodeURIComponent(id || code || '')}`;
        }
        if (url.origin === window.location.origin) {
          return `${url.pathname}${url.search}${url.hash}`;
        }
      } catch {
        if (rawLink.startsWith('/')) return rawLink;
      }
    }

    return null;
  }

  public viewAllNotifications() {
    this.isNotificationDropdownActive = false;
    this.router.navigate(['/profile'], { queryParams: { section: 'notifications' } });
  }

  public async loadRealNotifications(userId: string) {
    try {
      const list = await this.apiService.getNotifications(userId);
      const serverNotifications = list.filter(n => !this.isStaleQrNotice(n)).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link || n.link_url || null,
        bookingId: n.bookingId || n.booking_id || (n.type === 'booking' ? n.reference_id : null),
        reference_id: n.reference_id,
        postId: n.postId || (n.type === 'community' ? n.reference_id : null),
        itineraryId: n.itineraryId || (n.type === 'itinerary' ? n.reference_id : null),
        type: n.type,
        read: n.read,
        time: this.formatTimeAgo(n.createdAt)
      }));
      const serverBookingIds = new Set(serverNotifications.map(n => this.getNotificationBookingId(n)).filter(Boolean));
      const localNotifications = this.apiService.getLocalCounterBookingNotifications(userId)
        .filter(n => !serverBookingIds.has(this.getNotificationBookingId(n)))
        .map(n => ({ ...n, time: this.formatTimeAgo(n.createdAt) }));
      this.notifications = [...localNotifications, ...serverNotifications];
    } catch (e) {
      console.warn('Failed to load real notifications:', e);
    }
  }

  @HostListener('window:greensteps-notifications-refresh')
  public refreshNotificationsAfterBooking() {
    const userId = this.currentUser?.id || this.currentUser?._id;
    if (userId) void this.loadRealNotifications(userId);
  }

  private getNotificationBookingId(notif: any): string {
    const directId = notif?.bookingId || notif?.booking_id || notif?.reference_id;
    if (directId) return String(directId);
    try {
      const url = new URL(String(notif?.link || notif?.link_url || ''), window.location.origin);
      return url.searchParams.get('bookingId') || url.searchParams.get('code') || '';
    } catch { return ''; }
  }

  private isStaleQrNotice(notif: any): boolean {
    const text = this.normalizeNotificationText(`${notif?.title || ''} ${notif?.message || ''}`);
    return notif?.type === 'booking' && /cho duyet giao dich|cho quan tri vien phe duyet/.test(text)
      && /qr|chuyen khoan/.test(text);
  }

  private normalizeNotificationText(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
  public isProfileOpen: boolean = false;   // profile dropdown hover

  // All tabs combined (traveler + provider when applicable)
  public allTabs: any[] = [];

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

  private loginModalSubscription?: Subscription;
  private profileCloseTimer?: number;
  private updateScrollState() {
    const nextIsScrolled = window.scrollY > 0;
    if (this.isScrolled === nextIsScrolled) return;

    this.isScrolled = nextIsScrolled;
  }

  @HostListener('window:scroll')
  public onWindowScroll() {
    this.updateScrollState();
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onEscapeKey(event?: Event) {
    if (this.isNavbarSearchOpen) {
      event?.preventDefault();
      this.closeNavbarSearch();
      return;
    }
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
    return this.isHomeHeaderCollapsed;
  }

  constructor(
    public authService: AuthService,
    private router: Router,
    private apiService: ApiService,
    private loginModalService: LoginModalService
  ) { }

  public toggleMobileMenu() {
    this.closeNavbarSearch();
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  public loginModalMode: 'login' | 'register' = 'login';

  public openLoginModal(mode: 'login' | 'register' = 'login') {
    this.closeNavbarSearch();
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
    });

    // Silent background notification polling (updates without reloading the page)
    this.notifPollingTimer = setInterval(() => {
      if (this.currentUser && document.visibilityState === 'visible') {
        void this.loadRealNotifications(this.currentUser.id || this.currentUser._id || '');
      }
    }, 20000);

    this.currentPath = this.router.url;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentPath = event.url;
      this.updateScrollState();
    });

    this.searchTerms$.pipe(
      map(term => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        const sequence = ++this.searchRequestSequence;
        if (term.length < 2) {
          this.isNavbarSearchLoading = false;
          this.navbarSearchError = false;
          this.navbarSearchSuggestions = [];
          this.activeNavbarSearchIndex = -1;
          return of({ sequence, items: [], failed: false });
        }
        this.isNavbarSearchLoading = true;
        this.navbarSearchError = false;
        return from(Promise.allSettled([
          this.apiService.getToursPage({ q: term, page: 1, pageSize: 4, sort: 'popular' }),
          this.apiService.getServicesPage({ q: term, page: 1, pageSize: 4, sort: 'bookings_count' })
        ])).pipe(map(([toursResult, servicesResult]) => {
          const tours = toursResult.status === 'fulfilled' ? toursResult.value?.items || [] : [];
          const services = servicesResult.status === 'fulfilled' ? servicesResult.value?.items || [] : [];
          const items = [
            ...tours.map((tour: any) => ({ id: String(tour.id), label: String(tour.title || 'Tour'), detail: String(tour.destination || 'Tour du lịch'), kind: 'tour' as const, route: `/tours/${encodeURIComponent(String(tour.id))}` })),
            ...services.map((service: any) => {
              const type = String(service.type || 'service').trim();
              const isFood = /food|dining|ăn|uống/i.test(type);
              return { id: String(service.id), label: String(service.name || service.name_service || 'Dịch vụ'), detail: `${isFood ? 'Ẩm thực địa phương' : 'Dịch vụ'} · ${String(service.destination || 'GreenSteps')}`, kind: 'service' as const, route: `/services/${encodeURIComponent(type)}/${encodeURIComponent(String(service.id))}` };
            })
          ];
          return { sequence, items, failed: toursResult.status === 'rejected' || servicesResult.status === 'rejected' };
        }), catchError(() => of({ sequence, items: [], failed: true })));
      }),
      takeUntil(this.destroyed$)
    ).subscribe(result => {
      if (result.sequence !== this.searchRequestSequence) return;
      this.isNavbarSearchLoading = false;
      this.navbarSearchError = result.failed;
      this.navbarSearchSuggestions = result.items;
      this.activeNavbarSearchIndex = -1;
    });

    const savedTheme = localStorage.getItem('greensteps_theme') as 'light' | 'dark';
    if (savedTheme) {
      this.currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  ngOnDestroy() {
    if (this.notifPollingTimer) clearInterval(this.notifPollingTimer);
    document.body.style.overflow = '';
    this.loginModalSubscription?.unsubscribe();
    this.clearProfileCloseTimer();
    this.destroyed$.next();
    this.destroyed$.complete();
    this.searchTerms$.complete();
    if (this.searchFocusTimer !== undefined) window.clearTimeout(this.searchFocusTimer);
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent) {
    const target = event.target as Node | null;
    const searchPanel = this.navbarSearchPanel?.nativeElement;
    if (this.isNavbarSearchOpen && target && !searchPanel?.contains(target)) {
      this.closeNavbarSearch();
    }
    this.isProfileOpen = false;
    this.isNotificationDropdownActive = false;
  }

  public openNavbarSearch(event: Event): void {
    event.stopPropagation();
    this.isNavbarSearchOpen = true;
    this.isProfileOpen = false;
    this.isNotificationDropdownActive = false;
    if (this.searchFocusTimer !== undefined) window.clearTimeout(this.searchFocusTimer);
    this.searchFocusTimer = window.setTimeout(() => {
      this.searchFocusTimer = undefined;
      if (!this.isNavbarSearchOpen) return;
      const input = document.querySelector<HTMLInputElement>('#navbar-search-panel input[type="search"]');
      input?.focus();
    }, 40);
  }

  public closeNavbarSearch(): void {
    this.isNavbarSearchOpen = false;
    this.isNavbarSearchLoading = false;
    this.activeNavbarSearchIndex = -1;
    this.searchRequestSequence++;
  }

  public onNavbarSearchChanged(value: string): void {
    this.navbarSearchQuery = value;
    this.searchRequestSequence++;
    if (value.trim().length < 2) {
      this.isNavbarSearchLoading = false;
      this.navbarSearchError = false;
      this.navbarSearchSuggestions = [];
    }
    this.searchTerms$.next(value);
  }

  public onNavbarSearchKeydown(event: KeyboardEvent): void {
    const count = this.navbarSearchSuggestions.length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.activeNavbarSearchIndex = (this.activeNavbarSearchIndex + 1) % count;
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.activeNavbarSearchIndex = this.activeNavbarSearchIndex <= 0 ? count - 1 : this.activeNavbarSearchIndex - 1;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = this.navbarSearchSuggestions[this.activeNavbarSearchIndex];
      if (active) this.selectNavbarSearchSuggestion(active);
      else this.submitNavbarSearch();
    }
  }

  public selectNavbarSearchSuggestion(suggestion: { route: string }): void {
    this.closeNavbarSearch();
    void this.router.navigateByUrl(suggestion.route);
  }

  public submitNavbarSearch(): void {
    const term = this.navbarSearchQuery.trim();
    if (!term) return;
    const path = this.router.url.split(/[?#]/)[0];
    const isFood = path === '/local-food' || (path === '/services' && /[?&]type=(food|dining)(?:&|$)/i.test(this.router.url));
    const isServices = path.startsWith('/services') && !isFood;
    const destination = isFood ? '/local-food' : isServices ? '/services' : '/tours';
    const queryParams: Record<string, string> = { search: term };
    if (isFood) queryParams['q'] = term;
    if (path === '/services' && isFood) queryParams['type'] = 'food';
    this.closeNavbarSearch();
    void this.router.navigate([destination], { queryParams });
  }

  public toggleProfileOpen(event: Event) {
    event.stopPropagation();
    this.closeNavbarSearch();
    this.isProfileOpen = !this.isProfileOpen;
  }

  public toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('greensteps_theme', this.currentTheme);
  }

  public applySmartFilters() {
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
    return this.router.url.split(/[?#]/)[0] === '/ai-planner';
  }

  public isServicesActive(): boolean {
    return this.router.url.startsWith('/services') || this.router.url.startsWith('/transport');
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
      { label: 'AI Planner', action: 'ai_planner' }
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

  }

}

export { HeaderComponent as Header };
