import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Tour, Itinerary } from '../../models/models';

declare const L: any; // Leaflet mapped globally via index.html script tag

@Component({
  selector: 'app-tours',
  standalone: false,
  templateUrl: './tours.html',
})
export class ToursComponent implements OnInit {
  public toursData: Tour[] = [];
  public filteredTours: Tour[] = [];
  public recommendedTours: Tour[] = [];
  public isPageLoading: boolean = true;


  private modalMap: any = null;
  private modalMarkers: { [key: string]: any } = {};
  private destCoords: { [key: string]: [number, number] } = {
    'Đà Lạt': [11.940419, 108.458313],
    'Phú Yên': [13.088198, 109.314957],
    'Đà Nẵng - Hội An': [16.047079, 108.206230]
  };

  // Filter bindings
  public searchQuery: string = '';
  public filterDest: string = 'all';
  public filterType: string = 'all';
  public filterPrice: string = 'all';

  // Modal control
  public isCreateModalOpen: boolean = false;
  public modalDest: string = 'Đà Lạt';
  public modalDays: number = 3;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // 1. Fetch all tours immediately to avoid blocking page render
    const allTours = await this.apiService.getPresetTours() || [];
    this.toursData = allTours;
    this.filteredTours = [...this.toursData];
    this.isPageLoading = false;
    this.cdr.detectChanges();


    // 2. Read query params and perform initial filtering
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchQuery = params['search'];
      }
      if (params['dest']) {
        this.filterDest = params['dest'];
      }
      if (params['budget']) {
        const budget = params['budget'];
        if (budget === '3') this.filterPrice = 'under2M';
        else if (budget === '6') this.filterPrice = '2M-4M';
        else if (budget === '12') this.filterPrice = 'above4M';
      }
      if (params['style']) {
        const style = params['style'];
        if (style === 'eco') this.filterType = 'Trải nghiệm';
        else if (style === 'adventure') this.filterType = 'Tiết kiệm';
        else if (style === 'relax') this.filterType = 'Nghỉ dưỡng';
      }
      if (params['create'] === 'true') {
        this.openCreateItineraryModal();
      }

      // Check session storage fallback from home page
      const sessionDest = sessionStorage.getItem('tours_search_dest');
      if (sessionDest) {
        this.filterDest = sessionDest;
        sessionStorage.removeItem('tours_search_dest');
      }

      this.filterTours();
    });

    // 3. Fetch recommendations asynchronously in background
    const user = this.authService.getCurrentUser();
    if (user) {
      const userId = user.id || user._id || '';
      this.apiService.getRecommendedTours(userId).then(recommended => {
        if (recommended && recommended.length > 0) {
          this.recommendedTours = recommended;
          const recommendedIds = new Set(this.recommendedTours.map(r => r.id));
          
          this.toursData.forEach(tour => {
            tour.isRecommended = recommendedIds.has(tour.id);
          });

          // Sort: Recommended first
          this.toursData.sort((a, b) => {
            if (a.isRecommended && !b.isRecommended) return -1;
            if (!a.isRecommended && b.isRecommended) return 1;
            return 0;
          });

          this.filterTours();
        }
      }).catch(err => {
        console.warn('Failed to load recommended tours in background:', err);
      });
    }
  }

  public filterTours() {
    const query = this.searchQuery.toLowerCase().trim();
    
    this.filteredTours = this.toursData.filter(tour => {
      // Search match
      const matchQuery = !query || 
                         tour.title.toLowerCase().includes(query) || 
                         tour.destination.toLowerCase().includes(query);

      // Destination match
      const matchDest = this.filterDest === 'all' || tour.destination === this.filterDest;

      // Type match
      const matchType = this.filterType === 'all' || tour.type === this.filterType;

      // Price match
      let matchPrice = true;
      if (this.filterPrice === 'under2M') {
        matchPrice = tour.cost < 2000000;
      } else if (this.filterPrice === '2M-4M') {
        matchPrice = tour.cost >= 2000000 && tour.cost <= 4000000;
      } else if (this.filterPrice === 'above4M') {
        matchPrice = tour.cost > 4000000;
      }

      return matchQuery && matchDest && matchType && matchPrice;
    });
    this.cdr.detectChanges();
  }

  public filterByDestination(dest: string) {
    this.filterDest = dest;
    this.filterTours();
  }

  public resetFilters() {
    this.searchQuery = '';
    this.filterDest = 'all';
    this.filterType = 'all';
    this.filterPrice = 'all';
    this.filterTours();
  }

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
    if (!mapEl) return;

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
