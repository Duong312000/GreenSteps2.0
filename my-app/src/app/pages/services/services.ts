import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Service } from '../../models/models';

@Component({
  selector: 'app-services',
  standalone: false,
  templateUrl: './services.html',
  styleUrls: ['./services.css']
})
export class ServicesComponent implements OnInit {
  public serviceType: string = 'stay';
  public servicesData: Service[] = [];
  public filteredServices: Service[] = [];
  public paginatedServices: Service[] = [];
  public recommendedServices: any[] = [];
  public isPageLoading: boolean = true;
  public isMobileFilterOpen: boolean = false;

  // Filter bindings
  public searchQuery: string = '';
  public filterDest: string = 'all';
  public filterPrice: string = 'all';
  public filterRating: string = 'all';
  public selectedEcoBadge: string = 'all';
  public sortOrder: string = 'popular';

  // Pagination
  public currentPage: number = 1;
  public pageSize: number = 6;

  // Static options matching Shop.co filter system
  public categories = [
    { id: 'tours', name: 'Tour Trọn Gói Net-Zero', path: '/tours', type: null },
    { id: 'stay', name: 'Lưu Trú Sinh Thái (Stay)', path: '/services', type: 'stay' },
    { id: 'transport', name: 'Di Chuyển Xanh (Transport)', path: '/services', type: 'transport' },
    { id: 'food', name: 'Ẩm Thực Hữu Cơ (Food)', path: '/services', type: 'food' },
    { id: 'attraction', name: 'Trải Nghiệm Sinh Thái (Attraction)', path: '/services', type: 'attraction' },
  ];

  public destinations = [
    'Tất cả',
    'Đà Lạt',
    'Phú Yên',
    'Hội An',
    'Đà Nẵng'
  ];

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
    this.route.queryParams.subscribe(async params => {
      this.isPageLoading = true;
      this.serviceType = params['type'] || 'stay';
      
      try {
        const allServices = await this.apiService.getServices();
        this.servicesData = allServices || [];
      } catch (e) {
        console.warn('Unable to load services:', e);
        this.servicesData = [];
      }

      // Check recommendation
      const user = this.authService.getCurrentUser();
      if (user) {
        try {
          const userId = user.id || user._id || '';
          this.recommendedServices = await this.apiService.getRecommendedServices(userId) || [];
          const recIds = new Set(this.recommendedServices.map(r => r.id));
          this.servicesData.forEach(s => {
            s.isRecommended = recIds.has(s.id);
          });
        } catch (e) {
          // ignore
        }
      }

      // Enrich data with oldCost and discountPercent if missing
      this.servicesData.forEach(s => {
        if (!s.oldCost) {
          s.oldCost = Math.round(s.cost * 1.2 / 10000) * 10000;
        }
        if (!s.discountPercent) {
          s.discountPercent = Math.round(((s.oldCost - s.cost) / s.oldCost) * 100);
        }
      });

      this.filterServices();
      this.isPageLoading = false;
      this.cdr.detectChanges();
    });
  }

  public filterServices() {
    const query = this.searchQuery.toLowerCase().trim();
    
    let list = this.servicesData.filter(s => {
      // 1. Type match
      const isStay = this.serviceType === 'stay' && (s.type === 'stay' || s.type === 'lodging');
      const isFood = this.serviceType === 'food' && (s.type === 'food' || s.type === 'dining');
      const isTransport = this.serviceType === 'transport' && s.type === 'transport';
      const isExplore = this.serviceType === 'attraction' && (s.type === 'attraction' || s.type === 'explore');
      
      if (!isStay && !isFood && !isTransport && !isExplore) {
        return false;
      }

      // 2. Destination match
      if (this.filterDest !== 'all') {
        const dNorm = this.filterDest.toLowerCase();
        const sNorm = (s.destination || '').toLowerCase();
        if (!sNorm.includes(dNorm) && !dNorm.includes(sNorm)) {
          return false;
        }
      }

      // 3. Search query
      if (query) {
        const nameMatch = (s.name || '').toLowerCase().includes(query);
        const destMatch = (s.destination || '').toLowerCase().includes(query);
        const descMatch = (s.description || '').toLowerCase().includes(query);
        if (!nameMatch && !destMatch && !descMatch) return false;
      }

      // 4. Price range
      if (this.filterPrice === 'under200k' && s.cost >= 200000) return false;
      if (this.filterPrice === '200k-500k' && (s.cost < 200000 || s.cost > 500000)) return false;
      if (this.filterPrice === '500k-1M' && (s.cost < 500000 || s.cost > 1000000)) return false;
      if (this.filterPrice === 'above1M' && s.cost <= 1000000) return false;

      // 5. Rating filter
      const rating = s.rating;
      if (rating == null) return false;
      if (this.filterRating === '5.0' && rating < 5.0) return false;
      if (this.filterRating === '4.8' && rating < 4.8) return false;
      if (this.filterRating === '4.5' && rating < 4.5) return false;

      // 6. Eco badge pill filter
      if (this.selectedEcoBadge !== 'all') {
        const badgeStr = ((s.badges || []).join(' ') + ' ' + (s.ecoFeature || '')).toLowerCase();
        if (!badgeStr.includes(this.selectedEcoBadge.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Sort order (matching Shop.co sorting)
    if (this.sortOrder === 'cost_asc') {
      list.sort((a, b) => a.cost - b.cost);
    } else if (this.sortOrder === 'cost_desc') {
      list.sort((a, b) => b.cost - a.cost);
    } else if (this.sortOrder === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.sortOrder === 'carbon') {
      list.sort((a, b) => (b.carbon || 0) - (a.carbon || 0));
    } else {
      // Most popular / bookings count
      list.sort((a, b) => (b.bookings_count || 0) - (a.bookings_count || 0));
    }

    this.filteredServices = list;
    this.currentPage = 1;
    this.updatePagination();
  }

  public updatePagination() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedServices = this.filteredServices.slice(start, start + this.pageSize);
    this.cdr.detectChanges();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredServices.length / this.pageSize));
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  public setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
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
    this.sortOrder = 'popular';
    this.filterServices();
  }

  public toggleMobileFilter() {
    this.isMobileFilterOpen = !this.isMobileFilterOpen;
  }
}

export { ServicesComponent as Services };
