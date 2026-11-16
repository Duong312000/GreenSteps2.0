import { Component, isDevMode, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Service } from '../../models/models';

@Component({
  selector: 'app-services',
  standalone: false,
  templateUrl: './services.html',
  styleUrls: ['./services.css']
})
export class ServicesComponent implements OnInit, OnDestroy {
  private authScopeSubscription?: Subscription;
  public serviceType: string = 'stay';
  public servicesData: Service[] = [];
  public filteredServices: Service[] = [];
  public paginatedServices: Service[] = [];
  public recommendedServices: any[] = [];
  public isPageLoading: boolean = true;
  public loadError = false;
  public isMobileFilterOpen: boolean = false;

  // Filter bindings
  public searchQuery: string = '';
  public filterDest: string = 'all';
  public filterPrice: string = 'all';
  public filterRating: string = 'all';
  public selectedEcoBadge: string = 'all';
  public sortOrder: string = 'popular';
  public onlyPartner: boolean = false;

  // Pagination
  public currentPage: number = 1;
  public pageSize: number = 6;
  public totalServices = 0;
  private requestTimer?: ReturnType<typeof setTimeout>;
  private loadSequence = 0;

  // Static options matching Shop.co filter system
  public categories = [
    { id: 'tours', name: 'Tour Trọn Gói Net-Zero', path: '/tours', type: null },
    { id: 'stay', name: 'Lưu Trú Sinh Thái (Stay)', path: '/services', type: 'stay' },
    { id: 'transport', name: 'Di Chuyển Xanh (Transport)', path: '/services', type: 'transport' },
    { id: 'food', name: 'Ẩm Thực Hữu Cơ (Food)', path: '/services', type: 'food' },
    { id: 'attraction', name: 'Trải Nghiệm Sinh Thái (Attraction)', path: '/services', type: 'attraction' },
  ];

  public destinations = ['Tất cả'];

  public priceRanges = [
    { id: 'all', label: 'Tất cả mức giá' },
    { id: 'under200k', label: 'Dưới 200.000đ' },
    { id: '200k-500k', label: '200.000đ - 500.000đ' },
    { id: '500k-1M', label: '500.000đ - 1.000.000đ' },
    { id: 'above1M', label: 'Trên 1.000.000đ' }
  ];

  public ecoBadgesList = [
    'Năng lượng mặt trời',
    'Zero waste',
    'Xe điện',
    'Farm to Table',
    'Không rác nhựa',
    'Bảo tồn biển'
  ];

  public ratingOptions = [
    { id: 'all', label: 'Tất cả đánh giá' },
    { id: '5.0', label: '5.0 ★ Tuyệt đối' },
    { id: '4.8', label: 'Từ 4.8 ★ trở lên' },
    { id: '4.5', label: 'Từ 4.5 ★ trở lên' }
  ];

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    void this.loadDestinationFilters().catch(error => {
      if (isDevMode()) console.warn('[API ERROR] Destination filters unavailable on Services', error);
    });
    let previousUserId: string | null = null;
    let hasUserScope = false;
    this.authScopeSubscription = this.authService.currentUser$.subscribe(user => {
      const nextUserId = user?.id || user?._id || '';
      if (hasUserScope && previousUserId !== nextUserId) {
        this.recommendedServices = [];
        this.servicesData.forEach(service => service.isRecommended = false);
      }
      previousUserId = nextUserId;
      hasUserScope = true;
    });
    this.route.queryParams.subscribe(params => {
      this.serviceType = params['type'] || 'stay';
      if (this.serviceType === 'food' || this.serviceType === 'dining') { this.serviceType = 'food'; this.isPageLoading = false; this.cdr.detectChanges(); return; }
      if (this.serviceType === 'transport') { this.router.navigate(['/transport']); return; }
      this.searchQuery = params['search'] || '';
      this.filterDest = params['dest'] || 'all';
      this.filterPrice = params['price'] || 'all';
      this.filterRating = params['rating'] || 'all';
      this.sortOrder = params['sort'] || 'popular';
      this.onlyPartner = params['partnerOnly'] === 'true';
      this.currentPage = Math.max(1, Number(params['page']) || 1);
      void this.loadServicesFromServer();
    });
  }

  ngOnDestroy(): void { this.authScopeSubscription?.unsubscribe(); }

  private async loadDestinationFilters(): Promise<void> {
    const response = await this.apiService.getNationalDestinations({ page: 1, pageSize: 100 });
    const items = Array.isArray(response?.items) ? response.items : [];
    this.destinations = ['Tất cả', ...items.map((item: any) => String(item.name || '').trim()).filter(Boolean)];
  }

  private async loadServicesFromServer(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isPageLoading = true;
    this.loadError = false;
    const query: Record<string, string | number | undefined> = {
      type: this.serviceType,
      q: this.searchQuery.trim() || undefined,
      dest: this.filterDest !== 'all' ? this.filterDest : undefined,
      page: this.currentPage, pageSize: this.pageSize,
      sort: this.sortOrder === 'cost_asc' || this.sortOrder === 'cost_desc' ? 'cost'
        : this.sortOrder === 'rating' ? 'rating' : this.sortOrder === 'popular' ? 'bookings_count' : 'name_service',
      order: this.sortOrder === 'cost_desc' || this.sortOrder === 'popular' ? 'desc' : 'asc',
      partnerOnly: this.onlyPartner ? 'true' : undefined
    };
    if (this.filterPrice === 'under200k') query['maxPrice'] = 200000;
    else if (this.filterPrice === '200k-500k') { query['minPrice'] = 200000; query['maxPrice'] = 500000; }
    else if (this.filterPrice === '500k-1M') { query['minPrice'] = 500000; query['maxPrice'] = 1000000; }
    else if (this.filterPrice === 'above1M') query['minPrice'] = 1000000;
    if (this.filterRating !== 'all') query['minRating'] = Number(this.filterRating);
    try {
      const response = await this.apiService.getServicesPage(query);
      if (sequence !== this.loadSequence) return;
      this.servicesData = response?.items || [];
      this.filteredServices = this.paginatedServices = this.servicesData;
      this.totalServices = Number(response?.total) || 0;
      this.currentPage = Number(response?.page) || this.currentPage;
      this.isPageLoading = false;
      this.cdr.detectChanges();
      const user = this.authService.getCurrentUser();
      if (user) {
        const userId = user.id || user._id || '';
        const recommendations = await this.apiService.getRecommendedServices(userId).catch(() => []);
        const currentUserId = (() => { const current = this.authService.getCurrentUser(); return current?.id || current?._id || ''; })();
        if (sequence !== this.loadSequence || currentUserId !== userId) return;
        this.recommendedServices = recommendations;
        const ids = new Set(recommendations.map(item => item.id));
        this.servicesData.forEach(service => service.isRecommended = ids.has(service.id));
      } else {
        this.recommendedServices = [];
      }
    } catch {
      if (sequence !== this.loadSequence) return;
      this.servicesData = this.filteredServices = this.paginatedServices = [];
      this.totalServices = 0;
      this.loadError = true;
    } finally {
      if (sequence === this.loadSequence) {
        this.isPageLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  public retryLoad(): void {
    void this.loadServicesFromServer();
  }

  public serviceCardImage(service: Service): string {
    const imageUrl = String(service.image_url || '').trim();
    if (imageUrl && !imageUrl.startsWith('data:')) return imageUrl.replace(/^\//, '');

    // Bundled service artwork is available locally and is safe to use as an
    // illustration even when it is not a verified photo of the listed venue.
    if (/^image\/services\/[a-z0-9_-]+\.png$/i.test(imageUrl)) return imageUrl;

    const type = String(service.type || '').toLowerCase();
    const destination = String(service.destination || '').toLowerCase();
    if (type === 'stay' || type === 'lodging') {
      if (destination.includes('hội an') || destination.includes('hoi an')) return 'image/services/stay_hoi_an_eco.png';
      if (destination.includes('phú yên') || destination.includes('phu yen')) return 'image/services/stay_hon_yen.png';
      if (destination.includes('đà lạt') || destination.includes('da lat')) return 'image/services/stay_homestay_dalat.png';
      return 'image/services/stay_green_boutique.png';
    }
    if (type === 'food' || type === 'dining') return 'image/services/food_organic_vietnamese.png';
    if (type === 'attraction' || type === 'tour') return 'image/services/attraction_kayaking.png';
    return 'image/service-photo-pending.svg';
  }

  public serviceCardImageAlt(service: Service): string {
    const cover = service.photoMetadata?.find(photo => String(photo.path || '').replace(/^\//, '') === this.serviceCardImage(service));
    if (cover?.alt) return cover.alt;
    return service.name || 'Dịch vụ GreenSteps';
  }

  public serviceCardImageSrcSet(service: Service): string | null {
    const cover = service.photoMetadata?.find(photo => String(photo.path || '').replace(/^\//, '') === this.serviceCardImage(service));
    const variants = cover?.responsiveVariants || [];
    return variants.length ? variants.map(variant => `${variant.path} ${variant.width}w`).join(', ') : null;
  }

  public filterServices() {
    this.currentPage = 1;
    if (this.requestTimer) clearTimeout(this.requestTimer);
    this.requestTimer = setTimeout(() => {
      const queryParams: Record<string, string | number | null> = {
        type: this.serviceType,
        search: this.searchQuery.trim() || null,
        dest: this.filterDest !== 'all' ? this.filterDest : null,
        price: this.filterPrice !== 'all' ? this.filterPrice : null,
        rating: this.filterRating !== 'all' ? this.filterRating : null,
        partnerOnly: this.onlyPartner ? 'true' : null,
        sort: this.sortOrder !== 'popular' ? this.sortOrder : null,
        page: null
      };
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    }, 250);
  }

  
  public addToSchedule(service: any) {
    this.router.navigate(['/schedule'], {
      queryParams: {
        addPlace: service.name,
        destination: service.destination
      }
    });
  }

  public updatePagination() {
    this.paginatedServices = this.servicesData;
    this.cdr.detectChanges();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalServices / this.pageSize));
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  public setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page }, queryParamsHandling: 'merge', replaceUrl: true });
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  public nextPage() {
    if (this.currentPage < this.totalPages) {
      this.setPage(this.currentPage + 1);
    }
  }

  public prevPage() {
    if (this.currentPage > 1) {
      this.setPage(this.currentPage - 1);
    }
  }

  public selectCategory(cat: any) {
    if (cat.type) {
      this.router.navigate(['/services'], { queryParams: { type: cat.type } });
    } else {
      this.router.navigate([cat.path]);
    }
    this.isMobileFilterOpen = false;
  }

  public toggleEcoBadge(badge: string) {
    this.selectedEcoBadge = this.selectedEcoBadge === badge ? 'all' : badge;
    this.filterServices();
  }

  public filterByDestination(dest: string) {
    this.filterDest = dest === 'Tất cả' ? 'all' : dest;
    this.filterServices();
  }

  public getCategoryTitle(): string {
    switch (this.serviceType) {
      case 'stay': return 'Lưu Trú Sinh Thái (Stay)';
      case 'transport': return 'Di Chuyển Xanh (Transport)';
      case 'food': return 'Ẩm Thực Hữu Cơ (Food)';
      case 'attraction': return 'Trải Nghiệm Sinh Thái (Attraction)';
      default: return 'Dịch Vụ Du Lịch Xanh';
    }
  }

  public getCategoryBreadcrumb(): string {
    switch (this.serviceType) {
      case 'stay': return 'Lưu Trú';
      case 'transport': return 'Di Chuyển';
      case 'food': return 'Ẩm Thực';
      case 'attraction': return 'Trải Nghiệm';
      default: return 'Dịch Vụ';
    }
  }

  public resetFilters() {
    this.searchQuery = '';
    this.filterDest = 'all';
    this.filterPrice = 'all';
    this.filterRating = 'all';
    this.selectedEcoBadge = 'all';
    this.onlyPartner = false;
    this.sortOrder = 'popular';
    this.filterServices();
  }

  public toggleMobileFilter() {
    this.isMobileFilterOpen = !this.isMobileFilterOpen;
  }
}

export { ServicesComponent as Services }; 
