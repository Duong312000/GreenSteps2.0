import { Component, isDevMode, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Tour, Itinerary, TourPhotoCredit } from '../../models/models';

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
  public loadError = false;
  public isMobileFilterOpen: boolean = false;

  // Filter bindings
  public searchQuery: string = '';
  public filterDest: string = 'all';
  public filterType: string = 'all';
  public filterPrice: string = 'all';
  public selectedEcoBadge: string = 'all';
  public sortOrder: string = 'popular';

  // Autocomplete & activity highlight
  public isSearchSuggestionsOpen: boolean = false;
  public matchedActivities: Map<string, string[]> = new Map();

  // Pagination
  public currentPage: number = 1;
  public pageSize: number = 6;
  public totalTours = 0;
  private suppressFilterReload = false;
  private loadSequence = 0;

  public photoSrcSet(photo?: TourPhotoCredit): string | null {
    const variants = photo?.responsiveVariants || [];
    return variants.length ? variants.map(variant => `${variant.path} ${variant.width}w`).join(', ') : null;
  }

  // Categories list matching Shop.co
  public categories = [
    { id: 'tours', name: 'Tour Trọn Gói Net-Zero', path: '/tours', type: null },
    { id: 'stay', name: 'Lưu Trú Sinh Thái (Stay)', path: '/services', type: 'stay' },
    { id: 'transport', name: 'Di Chuyển Xanh (Transport)', path: '/services', type: 'transport' },
    { id: 'food', name: 'Ẩm Thực Hữu Cơ (Food)', path: '/services', type: 'food' },
    { id: 'attraction', name: 'Trải Nghiệm Sinh Thái (Attraction)', path: '/services', type: 'attraction' },
  ];

  public destinations = ['Tất cả'];

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
  public modalDest = '';
  public modalDays: number = 3;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    void this.loadDestinationFilters().catch(error => {
      if (isDevMode()) console.warn('[API ERROR] Destination filters unavailable on Tours', error);
    });
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['search'] || '';
      this.filterDest = params['dest'] || 'all';
      this.currentPage = Number(params['page']) || 1;
      this.filterType = params['type'] || 'all';
      this.filterPrice = params['price'] || 'all';
      this.selectedEcoBadge = params['badge'] || 'all';
      this.sortOrder = params['sort'] || 'popular';
      if (params['style']) {
        const style = params['style'];
        if (style === 'eco') this.filterType = 'Trải nghiệm';
        else if (style === 'adventure') this.filterType = 'Tiết kiệm';
        else if (style === 'relax') this.filterType = 'Nghỉ dưỡng';
      }
      if (params['create'] === 'true') {
        this.openCreateItineraryModal();
      }

      if (this.suppressFilterReload) this.suppressFilterReload = false;
      else void this.loadToursFromServer();
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

  private async loadDestinationFilters(): Promise<void> {
    const response = await this.apiService.getNationalDestinations({ page: 1, pageSize: 100 });
    const items = Array.isArray(response?.items) ? response.items : [];
    this.destinations = ['Tất cả', ...items.map((item: any) => String(item.name || '').trim()).filter(Boolean)];
    if (!this.modalDest && items.length) this.modalDest = items[0].name;
  }

  private async loadToursFromServer(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isPageLoading = true;
    this.loadError = false;
    try {
      const query: Record<string, string | number | undefined> = {
        q: this.searchQuery.trim() || undefined,
        dest: this.filterDest !== 'all' ? this.filterDest : undefined,
        style: this.selectedEcoBadge !== 'all' ? this.selectedEcoBadge : (this.filterType !== 'all' ? this.filterType : undefined),
        sort: this.sortOrder === 'cost_asc' ? 'price_asc' : this.sortOrder === 'cost_desc' ? 'price_desc' : this.sortOrder === 'rating' ? 'rating' : this.sortOrder === 'carbon' ? 'name' : 'popular',
        page: this.currentPage, pageSize: this.pageSize
      };
      if (this.filterPrice === 'under1.5M') query['maxPrice'] = 1500000;
      else if (this.filterPrice === '1.5M-2.5M') { query['minPrice'] = 1500000; query['maxPrice'] = 2500000; }
      else if (this.filterPrice === '2.5M-3.5M') { query['minPrice'] = 2500000; query['maxPrice'] = 3500000; }
      else if (this.filterPrice === 'above3.5M') query['minPrice'] = 3500000;
      const response = await this.apiService.getToursPage(query);
      if (sequence !== this.loadSequence) return;
      this.toursData = response?.items || [];
      this.filteredTours = this.toursData;
      this.paginatedTours = this.toursData;
      this.totalTours = response?.total || 0;
      this.currentPage = response?.page || this.currentPage;
    } catch {
      if (sequence !== this.loadSequence) return;
      try {
        const fallbackTours = await this.apiService.getPresetTours();
        if (fallbackTours && fallbackTours.length > 0) {
          this.toursData = fallbackTours;
          this.filterTours();
          this.loadError = false;
          return;
        }
      } catch {}
      this.toursData = this.filteredTours = this.paginatedTours = [];
      this.totalTours = 0;
      this.loadError = true;
    } finally {
      if (sequence === this.loadSequence) {
        this.isPageLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  public retryLoad(): void {
    void this.loadToursFromServer();
  }

  public loadTours(): void {
    void this.loadToursFromServer();
  }

  public filterTours() {
    this.currentPage = 1;
    this.suppressFilterReload = true;
    void this.router.navigate([], { relativeTo: this.route, queryParams: {
      search: this.searchQuery.trim() || null,
      dest: this.filterDest === 'all' ? null : this.filterDest,
      type: this.filterType === 'all' ? null : this.filterType,
      price: this.filterPrice === 'all' ? null : this.filterPrice,
      badge: this.selectedEcoBadge === 'all' ? null : this.selectedEcoBadge,
      sort: this.sortOrder === 'popular' ? null : this.sortOrder,
      page: 1
    }, queryParamsHandling: 'merge' }).then(() => {
      this.suppressFilterReload = false;
      void this.loadToursFromServer();
    });
    return;

    const query = this.searchQuery.toLowerCase().trim();

    let list = this.toursData.filter(tour => {
      // 1. Search match (title, destination, description, activity names in itinerary)
      if (query) {
        const titleMatch = (tour.title || '').toLowerCase().includes(query);
        const destMatch = (tour.destination || '').toLowerCase().includes(query);
        const descMatch = (tour.description || '').toLowerCase().includes(query);
        const activityMatch = (tour.data || []).some((day: any[]) =>
          (day || []).some((act: any) => (act.name || '').toLowerCase().includes(query))
        );
        if (!titleMatch && !destMatch && !descMatch && !activityMatch) return false;
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

    // Build matched activity map for highlights
    this.matchedActivities = new Map();
    if (query) {
      list.forEach(tour => {
        const matched: string[] = [];
        (tour.data || []).forEach((day: any[]) => {
          (day || []).forEach((act: any) => {
            if ((act.name || '').toLowerCase().includes(query) && !matched.includes(act.name)) {
              matched.push(act.name);
            }
          });
        });
        if (matched.length > 0) this.matchedActivities.set(tour.id, matched);
      });
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
    return Math.max(1, Math.ceil(this.totalTours / this.pageSize));
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  public setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.suppressFilterReload = true;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page }, queryParamsHandling: 'merge' }).then(() => {
      this.suppressFilterReload = false;
      void this.loadToursFromServer();
    });
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
  }

  public closeCreateItineraryModal() {
    this.isCreateModalOpen = false;
  }

  public onModalDestChange() {
    // Map previews stay disabled until the destination coordinates and Maps use are verified.
  }

  public async submitNewItinerary(event: Event) {
    event.preventDefault();
    if (!this.modalDest) return;
    this.isCreateModalOpen = false;

    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';
    const daysNum = Math.max(1, Number(this.modalDays) || 1);
    const daysData = Array.from({ length: daysNum }, () => []);
    const newItiId = 'iti_' + Date.now();
    const title = `Lịch trình tự thiết kế ${this.modalDest}`;

    const newIti: Itinerary = {
      id: newItiId,
      name: title,
      user_id: userId,
      destination: this.modalDest,
      days: daysNum,
      totalCost: 0,
      totalCarbon: 0,
      daysData: daysData
    };

    // Save to localStorage immediately so schedule editor loads instantly without network lag
    const destSlug = (this.modalDest || '').toLowerCase().includes('nẵng') ? 'da-nang'
      : (this.modalDest || '').toLowerCase().includes('phú yên') ? 'phu-yen' : 'da-lat';

    const editorDays = Array.from({ length: daysNum }, (_, idx) => ({
      dayNum: idx + 1,
      title: `Ngày ${idx + 1}`,
      activities: []
    }));

    const draftPayload = {
      id: newItiId,
      title: title,
      dest: destSlug,
      destLabel: this.modalDest,
      destination: this.modalDest,
      days: editorDays,
      daysData: daysData,
      status: 'draft',
      totalCost: 0,
      totalCarbon: 0
    };

    try {
      localStorage.setItem(`greensteps_draft_${newItiId}`, JSON.stringify(draftPayload));
      localStorage.setItem(`greensteps_user_draft_${newItiId}`, JSON.stringify(draftPayload));
      localStorage.setItem(`greensteps_guest_draft_${newItiId}`, JSON.stringify(draftPayload));
      localStorage.setItem('greensteps_working_itinerary_id', newItiId);
    } catch (e) {}

    this.apiService.saveItinerary(newIti).catch(err => console.warn('Background save itinerary warning:', err));
    this.router.navigate(['/schedule', newIti.id]);
  }
  // ── Autocomplete helpers ──────────────────────────────────────────
  public buildSearchSuggestions(): string[] {
    const all = new Set<string>();
    this.toursData.forEach(tour => {
      [tour.title, tour.destination, ...(tour.highlights || [])]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .forEach(value => all.add(value));
    });
    return Array.from(all).sort();
  }

  public getFilteredSuggestions(): string[] {
    if (!this.searchQuery || this.searchQuery.length < 2) return [];
    const q = this.searchQuery.toLowerCase();
    return this.buildSearchSuggestions().filter(s => s.toLowerCase().includes(q)).slice(0, 8);
  }

  public selectSuggestion(suggestion: string) {
    this.searchQuery = suggestion;
    this.isSearchSuggestionsOpen = false;
    this.filterTours();
  }

  public closeSearchSuggestions() {
    setTimeout(() => { this.isSearchSuggestionsOpen = false; }, 180);
  }

}

export { ToursComponent as Tours };
