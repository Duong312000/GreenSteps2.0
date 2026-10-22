import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
  public recommendedServices: any[] = [];
  public isPageLoading: boolean = true;

  // Filters
  public searchQuery: string = '';
  public filterDest: string = 'all';
  public filterPrice: string = 'all';
  public filterRating: string = 'all';
  public sortOrder: string = 'popular';

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
      
      // Load all services
      try {
        const allServices = await this.apiService.getServices() || [];
        this.servicesData = allServices;
      } catch (e) {
        console.error('Failed to load services:', e);
        this.servicesData = [];
      }

      // Load AI Recommendations if logged in
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
          console.warn('Failed to load recommended services in background:', e);
        }
      }

      this.filterServices();
      this.isPageLoading = false;
      this.cdr.detectChanges();
    });
  }

  public filterServices() {
    const query = this.searchQuery.toLowerCase().trim();
    
    // 1. Filter type & criteria
    let list = this.servicesData.filter(s => {
      // Service type match (support both stay/lodging and food/dining aliases)
      const isStay = this.serviceType === 'stay' && (s.type === 'stay' || s.type === 'lodging');
      const isFood = this.serviceType === 'food' && (s.type === 'food' || s.type === 'dining');
      const isTransport = this.serviceType === 'transport' && s.type === 'transport';
      const isExplore = this.serviceType === 'attraction' && (s.type === 'attraction' || s.type === 'explore');
      
      if (!isStay && !isFood && !isTransport && !isExplore) {
        return false;
      }

      // Destination match
      const matchDest = this.filterDest === 'all' || 
                        s.destination.toLowerCase().includes(this.filterDest.toLowerCase()) ||
                        this.filterDest.toLowerCase().includes(s.destination.toLowerCase());

      // Search match
      const matchSearch = !query || 
                          s.name.toLowerCase().includes(query) || 
                          s.destination.toLowerCase().includes(query);

      // Price match
      let matchPrice = true;
      if (this.filterPrice === 'under500k') {
        matchPrice = s.cost < 500000;
      } else if (this.filterPrice === '500k-1.5M') {
        matchPrice = s.cost >= 500000 && s.cost <= 1500000;
      } else if (this.filterPrice === 'above1.5M') {
        matchPrice = s.cost > 1500000;
      }

      // Rating match
      let matchRating = true;
      if (this.filterRating === 'above4.5') {
        matchRating = (s.rating || 5.0) >= 4.5;
      } else if (this.filterRating === 'above4.0') {
        matchRating = (s.rating || 5.0) >= 4.0;
      }

      return matchDest && matchSearch && matchPrice && matchRating;
    });

    // 2. Sort
    if (this.sortOrder === 'popular') {
      // Order by bookings_count desc (most popular)
      list.sort((a, b) => (b.bookings_count || 0) - (a.bookings_count || 0));
    } else if (this.sortOrder === 'rating') {
      // Order by rating desc
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.sortOrder === 'cost_asc') {
      // Price low to high
      list.sort((a, b) => a.cost - b.cost);
    } else if (this.sortOrder === 'cost_desc') {
      // Price high to low
      list.sort((a, b) => b.cost - a.cost);
    }

    // 3. Recommended items priority (if not overridden by direct price sorting)
    if (this.sortOrder !== 'cost_asc' && this.sortOrder !== 'cost_desc') {
      list.sort((a, b) => {
        const aRec = a.isRecommended ? 1 : 0;
        const bRec = b.isRecommended ? 1 : 0;
        return bRec - aRec;
      });
    }

    this.filteredServices = list;
    this.cdr.detectChanges();
  }

  public getCategoryTitle(): string {
    switch (this.serviceType) {
      case 'stay': return 'Không gian Lưu Trú Xanh';
      case 'transport': return 'Phương Tiện Di Chuyển Xanh';
      case 'food': return 'Ẩm Thực Hữu Cơ & Địa Phương';
      case 'attraction': return 'Điểm Tham Quan & Trải Nghiệm Xanh';
      default: return 'Dịch vụ Xanh GreenSteps';
    }
  }

  public getCategorySub(): string {
    switch (this.serviceType) {
      case 'stay': return 'Lựa chọn khách sạn, homestay giảm thiểu năng lượng, thân thiện với môi trường.';
      case 'transport': return 'Thuê xe đạp điện, xe điện tự lái hoặc xe dịch vụ hybrid giảm thiểu phát thải.';
      case 'food': return 'Thưởng thức ẩm thực sử dụng nguyên liệu hữu cơ thu hoạch trực tiếp tại trang trại.';
      case 'attraction': return 'Trekking, chèo thuyền Kayak, check-in di tích và các hoạt động bảo vệ môi trường.';
      default: return 'Hành trình du lịch giảm thiểu dấu chân carbon của bạn.';
    }
  }

  public filterByDestination(dest: string) {
    this.filterDest = dest;
    this.filterServices();
  }

  public getServiceRouteType(service: Service): string {
    const type = (service.type || this.serviceType || '').toLowerCase();
    if (type === 'stay' || type === 'lodging') return 'stay';
    if (type === 'transport') return 'transport';
    if (type === 'food' || type === 'dining') return 'food';
    return 'attraction';
  }

  public resetFilters() {
    this.searchQuery = '';
    this.filterDest = 'all';
    this.filterPrice = 'all';
    this.filterRating = 'all';
    this.sortOrder = 'popular';
    this.filterServices();
  }
}

export { ServicesComponent as Services };
