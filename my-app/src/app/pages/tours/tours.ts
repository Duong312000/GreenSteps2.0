import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Tour, Itinerary } from '../../models/models';

declare const L: any;

@Component({
  selector: 'app-tours',
  standalone: false,
  templateUrl: './tours.html',
  styleUrls: ['./tours.css']
})
export class ToursComponent implements OnInit {
  public toursData: Tour[] = [];
  public filteredTours: Tour[] = [];
  public paginatedTours: Tour[] = [];
  public recommendedTours: Tour[] = [];
  public isPageLoading: boolean = true;
  public isMobileFilterOpen: boolean = false;

  // Filter bindings
  public searchQuery: string = '';
  public filterDest: string = 'all';
  public filterType: string = 'all';
  public filterPrice: string = 'all';
  public selectedEcoBadge: string = 'all';
  public sortOrder: string = 'popular';

  // Pagination
  public currentPage: number = 1;
  public pageSize: number = 6;

  // Categories list matching Shop.co
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

  public tourTypes = [
    { id: 'all', label: 'Tất cả loại tour' },
    { id: 'Trải nghiệm', label: 'Tour Trải Nghiệm' },
    { id: 'Nghỉ dưỡng', label: 'Tour Nghỉ Dưỡng' },
    { id: 'Gia đình', label: 'Tour Gia Đình' },
    { id: 'Tiết kiệm', label: 'Tour Tiết Kiệm' }
  ];

  public priceRanges = [
    { id: 'all', label: 'Tất cả mức giá' },
    { id: 'under1.5M', label: 'Dưới 1.500.000đ' },
    { id: '1.5M-2.5M', label: '1.500.000đ - 2.500.000đ' },
    { id: '2.5M-3.5M', label: '2.500.000đ - 3.500.000đ' },
    { id: 'above3.5M', label: 'Trên 3.500.000đ' }
  ];

  public ecoBadgesList = [
    'Net-Zero Verified',
    'Trekking Rừng',
    'Trồng Cây',
    'Bảo tồn biển',
    'Thuyền thúng',
    'Glamping'
  ];

  // Modal control
  public isCreateModalOpen: boolean = false;
  public modalDest: string = 'Đà Lạt';
  public modalDays: number = 3;
  private modalMap: any = null;
  private modalMarkers: { [key: string]: any } = {};
  private destCoords: { [key: string]: [number, number] } = {
    'Đà Lạt': [11.940419, 108.458313],
    'Phú Yên': [13.088198, 109.314957],
    'Hội An': [15.880058, 108.338047],
    'Đà Nẵng': [16.047079, 108.206230]
  };

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    try {
      const allTours = await this.apiService.getPresetTours();
      this.toursData = allTours || [];
    } catch (e) {
      console.warn('Unable to load tours:', e);
      this.toursData = [];
    }

    // Enrich missing fields
    this.toursData.forEach(t => {
      if (!t.oldCost) {
        t.oldCost = Math.round(t.cost * 1.2 / 10000) * 10000;
      }
      if (!t.discountPercent) {
        t.discountPercent = Math.round(((t.oldCost - t.cost) / t.oldCost) * 100);
      }
    });

    this.filteredTours = [...this.toursData];
    this.isPageLoading = false;
    this.cdr.detectChanges();

    // Query params filtering
    this.route.queryParams.subscribe(params => {
      if (params['search']) this.searchQuery = params['search'];
      if (params['dest']) this.filterDest = params['dest'];
      if (params['style']) {
        const style = params['style'];
        if (style === 'eco') this.filterType = 'Trải nghiệm';
        else if (style === 'adventure') this.filterType = 'Tiết kiệm';
        else if (style === 'relax') this.filterType = 'Nghỉ dưỡng';
      }
      if (params['create'] === 'true') {
        this.openCreateItineraryModal();
      }

      this.filterTours();
    });

    // Check user recommendations
    const user = this.authService.getCurrentUser();
    if (user) {
      const userId = user.id || user._id || '';
      this.apiService.getRecommendedTours(userId).then(recommended => {
        if (recommended && recommended.length > 0) {
          const recIds = new Set(recommended.map(r => r.id));
          this.toursData.forEach(tour => {
            tour.isRecommended = recIds.has(tour.id);
          });
          this.filterTours();
        }
      }).catch(() => {});
    }
  }

  public filterTours() {
    const query = this.searchQuery.toLowerCase().trim();

    let list = this.toursData.filter(tour => {
      // 1. Search match
      if (query) {
        const titleMatch = (tour.title || '').toLowerCase().includes(query);
        const destMatch = (tour.destination || '').toLowerCase().includes(query);
        const descMatch = (tour.description || '').toLowerCase().includes(query);
        if (!titleMatch && !destMatch && !descMatch) return false;
      }

      // 2. Destination match
      if (this.filterDest !== 'all') {
        const dNorm = this.filterDest.toLowerCase();
        const tNorm = (tour.destination || '').toLowerCase();
        if (!tNorm.includes(dNorm) && !dNorm.includes(tNorm)) {
          return false;
        }
      }

      // 3. Type match
      if (this.filterType !== 'all' && tour.type !== this.filterType) {
        return false;
      }

      // 4. Price match
      if (this.filterPrice === 'under1.5M' && tour.cost >= 1500000) return false;
      if (this.filterPrice === '1.5M-2.5M' && (tour.cost < 1500000 || tour.cost > 2500000)) return false;
      if (this.filterPrice === '2.5M-3.5M' && (tour.cost < 2500000 || tour.cost > 3500000)) return false;
      if (this.filterPrice === 'above3.5M' && tour.cost <= 3500000) return false;

      // 5. Eco badge match
      if (this.selectedEcoBadge !== 'all') {
        const badgeStr = ((tour.badges || []).join(' ') + ' ' + (tour.ecoFeature || '') + ' ' + (tour.tags || []).join(' ')).toLowerCase();
        if (!badgeStr.includes(this.selectedEcoBadge.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Sort order
    if (this.sortOrder === 'cost_asc') {
      list.sort((a, b) => a.cost - b.cost);
    } else if (this.sortOrder === 'cost_desc') {
      list.sort((a, b) => b.cost - a.cost);
    } else if (this.sortOrder === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.sortOrder === 'carbon') {
      list.sort((a, b) => (b.carbon || 0) - (a.carbon || 0));
    } else {
      // Most popular / votes
      list.sort((a, b) => (b.votes || b.votes_count || 0) - (a.votes || a.votes_count || 0));
    }

    this.filteredTours = list;
    this.currentPage = 1;
    this.updatePagination();
  }

  public updatePagination() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedTours = this.filteredTours.slice(start, start + this.pageSize);
    this.cdr.detectChanges();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTours.length / this.pageSize));
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
    this.filterTours();
  }

  public filterByDestination(dest: string) {
    this.filterDest = dest === 'Tất cả' ? 'all' : dest;
    this.filterTours();
  }

  public resetFilters() {
    this.searchQuery = '';
    this.filterDest = 'all';
    this.filterType = 'all';
    this.filterPrice = 'all';
    this.selectedEcoBadge = 'all';
    this.sortOrder = 'popular';
    this.filterTours();
  }

  public toggleMobileFilter() {
    this.isMobileFilterOpen = !this.isMobileFilterOpen;
  }

  // Itinerary creation modal logic
  public openCreateItineraryModal() {
    this.isCreateModalOpen = true;
    setTimeout(() => {
      this.initModalMap('toursModalMap');
    }, 150);
  }

  public closeCreateItineraryModal() {
    this.isCreateModalOpen = false;
    if (this.modalMap) {
      try {
        this.modalMap.remove();
      } catch (e) {}
      this.modalMap = null;
      this.modalMarkers = {};
    }
  }

  private initModalMap(containerId: string) {
    const mapEl = document.getElementById(containerId);
    if (!mapEl || typeof L === 'undefined') return;

    if (this.modalMap) {
      try {
        this.modalMap.remove();
      } catch (e) {}
      this.modalMap = null;
      this.modalMarkers = {};
    }

    this.modalMap = L.map(containerId, {
      zoomControl: true,
      attributionControl: false
    }).setView([14.2, 108.8], 6);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
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
          background-color: ${isSelected ? '#1b5e20' : '#9CA3AF'};
          border: 3px solid #FFFFFF;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          transition: all 0.3s;
          transform: scale(${isSelected ? 1.4 : 1});
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker(coords, { icon: markerIcon }).addTo(this.modalMap);
      marker.bindTooltip(dest, { permanent: true, direction: 'right', offset: [10, 0] });
      marker.on('click', () => {
        this.selectDestinationFromMap(dest);
      });
      this.modalMarkers[dest] = marker;
    });
  }

  public selectDestinationFromMap(dest: string) {
    this.modalDest = dest;
    this.updateModalMarkers();
    if (this.modalMap && this.destCoords[dest]) {
      this.modalMap.panTo(this.destCoords[dest]);
    }
  }

  private updateModalMarkers() {
    Object.keys(this.modalMarkers).forEach(dest => {
      const marker = this.modalMarkers[dest];
      if (!marker || typeof L === 'undefined') return;
      const isSelected = this.modalDest === dest;
      const icon = L.divIcon({
        className: 'custom-modal-marker',
        html: `<div class="modal-pin ${isSelected ? 'active-pin' : ''}" style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: ${isSelected ? '#1b5e20' : '#9CA3AF'};
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

    const newIti: Itinerary = {
      id: 'iti_' + Date.now(),
      name: `Lịch trình tự thiết kế ${this.modalDest}`,
      user_id: userId,
      destination: this.modalDest,
      days: Number(this.modalDays),
      totalCost: 0,
      totalCarbon: 0,
      daysData: daysData
    };

    await this.apiService.saveItinerary(newIti);
    this.router.navigate(['/schedule', newIti.id]);
  }
}

export { ToursComponent as Tours };
