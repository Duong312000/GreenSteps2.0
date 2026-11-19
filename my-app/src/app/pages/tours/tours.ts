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
  public destSearchQuery: string = '';
  public isDestExpanded: boolean = false;

  get filteredDestinations(): string[] {
    if (!this.destinations || this.destinations.length === 0) return [];
    if (this.destSearchQuery.trim()) {
      const q = this.destSearchQuery.toLowerCase().trim();
      return this.destinations.filter(d => d.toLowerCase().includes(q));
    }
    if (this.isDestExpanded) {
      return this.destinations;
    }
    const top = this.destinations.slice(0, 8);
    if (this.filterDest !== 'all' && !top.includes(this.filterDest) && this.destinations.includes(this.filterDest)) {
      return [...top, this.filterDest];
    }
    return top;
  }

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

  // Full Itinerary Creation Modal State (Wanderlog / GreenSteps style)
  public isCreateModalOpen: boolean = false;
  public newTripName: string = '';
  public newTripDestination: string = 'Đà Lạt';
  public newTripOrigin: string = 'TP. Hồ Chí Minh';
  public newTripStartDate: string = '';
  public newTripEndDate: string = '';
  public newTripDepartureTime: string = '07:30';
  public newTripTransport: string = 'Xe khách Limousine';
  public newTripFirstStop: string = '';
  public newTripCompanionEmail: string = '';
  public calculatedDays: number = 3;
  public calculatedNights: number = 2;
  public formDateError: string = '';

  // Compatibility accessors
  get modalDest(): string { return this.newTripDestination; }
  set modalDest(val: string) { this.newTripDestination = val; }
  get modalDays(): number { return this.calculatedDays; }
  set modalDays(val: number) { this.calculatedDays = val; }

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

      // Silent background prefetch of next page ("Thuật toán che mắt" Layer 2)
      const totalPages = Math.ceil(this.totalTours / this.pageSize);
      if (this.currentPage < totalPages) {
        const nextPageQuery = { ...query, page: this.currentPage + 1 };
        setTimeout(() => {
          this.apiService.getToursPage(nextPageQuery).catch(() => {});
        }, 250);
      }
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

  // Itinerary creation modal logic (Full Wanderlog / GreenSteps style)
  public openCreateItineraryModal() {
    this.isCreateModalOpen = true;
    const dest = (this.filterDest && this.filterDest !== 'all') ? this.filterDest : 'Đà Lạt';
    this.newTripDestination = dest;
    this.newTripOrigin = 'TP. Hồ Chí Minh';
    this.newTripName = `Hành trình khám phá ${dest}`;
    this.newTripDepartureTime = '07:30';
    this.newTripTransport = 'Xe khách Limousine';
    this.newTripFirstStop = '';
    this.newTripCompanionEmail = '';
    this.formDateError = '';

    // Set default dates: 7 days from now, 3 days duration
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    this.newTripStartDate = start.toISOString().split('T')[0];
    this.newTripEndDate = end.toISOString().split('T')[0];
    this.onTripDatesChange();
    this.cdr.detectChanges();
  }

  public closeCreateItineraryModal() {
    this.isCreateModalOpen = false;
    this.cdr.detectChanges();
  }

  public onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeCreateItineraryModal();
    }
  }

  public onTripDatesChange() {
    this.formDateError = '';
    if (this.newTripStartDate && this.newTripEndDate) {
      const s = new Date(this.newTripStartDate);
      const e = new Date(this.newTripEndDate);
      if (e < s) {
        this.formDateError = 'Ngày về phải sau hoặc cùng ngày với ngày khởi hành!';
        this.calculatedDays = 1;
        this.calculatedNights = 0;
        return;
      }
      const diffMs = e.getTime() - s.getTime();
      this.calculatedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      this.calculatedNights = Math.max(0, this.calculatedDays - 1);
    } else {
      this.calculatedDays = 3;
      this.calculatedNights = 2;
    }
  }

  public onModalDestChange() {
    if (this.newTripDestination) {
      this.newTripName = `Hành trình khám phá ${this.newTripDestination}`;
    }
  }

  public async submitNewItinerary(event: Event) {
    event.preventDefault();
    if (!this.newTripDestination) return;

    if (this.newTripStartDate && this.newTripEndDate) {
      const s = new Date(this.newTripStartDate);
      const e = new Date(this.newTripEndDate);
      if (e < s) {
        this.formDateError = 'Ngày về phải sau hoặc cùng ngày với ngày khởi hành!';
        return;
      }
    }

    this.isCreateModalOpen = false;
    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';
    const daysNum = Math.max(1, this.calculatedDays || 3);
    const newItiId = 'iti_' + Date.now();
    const tripTitle = this.newTripName.trim() || `Hành trình khám phá ${this.newTripDestination}`;
    const originName = this.newTripOrigin.trim() || 'TP. Hồ Chí Minh';
    const transportName = this.newTripTransport || 'Xe khách Limousine';
    const depTime = this.newTripDepartureTime || '07:30';

    // Auto-populate initial transit & first stop for Day 1
    const day1Activities: any[] = [];
    const isLowCarbon = transportName.includes('điện') || transportName.includes('Tàu hỏa') || transportName.includes('thủy');
    day1Activities.push({
      id: 'act_' + Date.now() + '_dep',
      time: depTime,
      title: `Khởi hành: ${originName} → ${this.newTripDestination}`,
      name: `Khởi hành: ${originName} → ${this.newTripDestination}`,
      type: 'transport',
      cost: 0,
      carbon: isLowCarbon ? 2.5 : 8.0,
      is_shared: true,
      lat: null,
      lng: null,
      note: `Di chuyển bằng ${transportName}. Chuẩn bị hành lý và đồ dùng sinh thái.`
    });

    if (this.newTripFirstStop && this.newTripFirstStop.trim()) {
      day1Activities.push({
        id: 'act_' + Date.now() + '_stop1',
        time: '11:30',
        title: this.newTripFirstStop.trim(),
        name: this.newTripFirstStop.trim(),
        type: 'stay',
        cost: 0,
        carbon: 1.0,
        is_shared: true,
        lat: null,
        lng: null,
        note: `Điểm đến đầu tiên / Nhận phòng nghỉ ngơi tại ${this.newTripDestination}.`
      });
    }

    const daysData = Array.from({ length: daysNum }, (_, i) => i === 0 && day1Activities.length > 0 ? day1Activities : []);

    const newIti: any = {
      id: newItiId,
      name: tripTitle,
      user_id: userId,
      destination: this.newTripDestination,
      origin: originName,
      departure_time: depTime,
      transport: transportName,
      first_stop: this.newTripFirstStop.trim() || null,
      days: daysNum,
      totalCost: 0,
      totalCarbon: day1Activities.reduce((acc, a) => acc + (a.carbon || 0), 0),
      daysData: daysData,
      status: 'draft',
      deposit_deadline: null,
      start_date: this.newTripStartDate || null,
      end_date: this.newTripEndDate || null,
      companion_email: this.newTripCompanionEmail.trim() || null
    };

    const destSlug = this.mapDestToSlug(this.newTripDestination);
    const editorDays = Array.from({ length: daysNum }, (_, idx) => ({
      dayNum: idx + 1,
      title: `Ngày ${idx + 1}`,
      activities: idx === 0 && day1Activities.length > 0 ? day1Activities : []
    }));

    const draftPayload = {
      id: newItiId,
      title: tripTitle,
      name: tripTitle,
      dest: destSlug,
      destLabel: this.newTripDestination,
      destination: this.newTripDestination,
      origin: originName,
      departure_time: depTime,
      transport: transportName,
      first_stop: this.newTripFirstStop.trim() || null,
      days: editorDays,
      daysData: daysData,
      status: 'draft',
      totalCost: 0,
      totalCarbon: newIti.totalCarbon,
      start_date: this.newTripStartDate || null,
      end_date: this.newTripEndDate || null
    };

    try {
      localStorage.setItem(`greensteps_draft_${newItiId}`, JSON.stringify(draftPayload));
      localStorage.setItem(`greensteps_user_draft_${newItiId}`, JSON.stringify(draftPayload));
      localStorage.setItem(`greensteps_guest_draft_${newItiId}`, JSON.stringify(draftPayload));
      localStorage.setItem('greensteps_working_itinerary_id', newItiId);
      const guestIds: string[] = JSON.parse(localStorage.getItem('greensteps_guest_itinerary_ids') || '[]');
      if (!guestIds.includes(newItiId)) {
        guestIds.unshift(newItiId);
        localStorage.setItem('greensteps_guest_itinerary_ids', JSON.stringify(guestIds));
      }
    } catch (e) {}

    this.apiService.saveItinerary(newIti).catch(err => console.warn('Background save itinerary warning:', err));
    this.router.navigate(['/schedule', newIti.id]);
  }
  public mapDestToSlug(destName: string): string {
    if (!destName) return "da-lat";
    const normalized = destName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (normalized.includes("dalat") || normalized.includes("da lat")) return "da-lat";
    if (normalized.includes("phu yen")) return "phu-yen";
    if (normalized.includes("hoi an")) return "hoi-an";
    if (normalized.includes("da nang")) return "da-nang";
    if (normalized.includes("vung tau")) return "vung-tau";
    if (normalized.includes("ha noi")) return "ha-noi";
    if (normalized.includes("phu quoc")) return "phu-quoc";
    if (normalized.includes("nha trang")) return "nha-trang";
    if (normalized.includes("ho chi minh") || normalized.includes("sai gon")) return "ho-chi-minh";
    if (normalized.includes("hue")) return "hue";
    if (normalized.includes("quy nhon")) return "quy-nhon";
    if (normalized.includes("sapa") || normalized.includes("sa pa")) return "sapa";
    if (normalized.includes("ninh binh")) return "ninh-binh";
    if (normalized.includes("ha long")) return "ha-long";
    if (normalized.includes("can tho")) return "can-tho";
    if (normalized.includes("phan thiet") || normalized.includes("mui ne")) return "phan-thiet";
    if (normalized.includes("hai phong")) return "hai-phong";
    return normalized.trim().replace(/\s+/g, "-");
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
