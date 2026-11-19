import { Subscription, combineLatest } from 'rxjs';
import { FavoritesService } from '../../services/favorites.service';
import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener, NgZone, inject } from '@angular/core';
import { FoodApi, FoodPlace } from '../local-food/food-api';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { Itinerary } from '../../models/models';

declare const L: any; // Leaflet mapped globally via index.html script tag
declare const google: any; // Google Maps SDK mapped globally

@Component({
  selector: 'app-schedule-editor',
  standalone: false,
  templateUrl: './schedule-editor.html',
  styleUrls: ['./schedule-editor.css']
})
export class ScheduleEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  private foodApi = inject(FoodApi);
  public pendingFood: FoodPlace | null = null;
  public addingFood = false;
  public dismissPendingFood() { this.pendingFood = null; sessionStorage.removeItem('greensteps_pending_food'); }
  private async loadPendingFood() {
    try {
      const id = sessionStorage.getItem('greensteps_pending_food');
      if (!id) return;
      this.pendingFood = (await this.foodApi.list()).find(p => p.id === id) || null;
      if (!this.pendingFood) sessionStorage.removeItem('greensteps_pending_food');
      this.cdr.detectChanges();
    } catch { /* Keep the handoff for the next visit when the API is available. */ }
  }
  public async addPendingFood() {
    const p = this.pendingFood;
    if (!p || !this.activeItinerary || this.isItineraryLocked() || this.addingFood) return;
    const day = this.activeItinerary.days[this.activeDayIdx];
    if (day?.activities?.some((a: any) => a.title === p.name)) { this.showAlert('Quán đã có trong ngày này.', 'warning'); return; }
    this.addingFood = true;
    try {
      await this.addPlaceFromMap({ title: p.name, cost: p.priceMin, type: 'dining', img: p.image, address: p.address, rating: p.rating, reviews: p.reviewCount, carbon: 0, isPartner: false });
      this.dismissPendingFood();
    } finally { this.addingFood = false; this.cdr.detectChanges(); }
  }
  public currentUser: any = null;
  public activeItinerary: any = null; // Internal Editor representation
  public activeDayIdx: number = 0;
  public walletBalance: number = 5000000;
  public walletRegistered: boolean = false;
  public customPlaceTitle: string = '';
  public isListMode: boolean = false;
  public savedItineraries: any[] = [];
  public filteredSavedItineraries: any[] = [];
  public searchOrLookupQuery: string = '';
  public isSearchingOrLookingUp: boolean = false;
  public isLoadingList: boolean = false;
  public isCreateModalOpen: boolean = false;
  public modalDest: string = 'Đà Lạt';
  public modalDays: number = 3;

  // New Create Itinerary Modal variables
  public isCreateNewModalOpen: boolean = false;
  public newTripName: string = '';
  public newTripDestination: string = 'Đà Lạt';
  public newTripOrigin: string = 'TP. Hồ Chí Minh';
  public newTripStartDate: string = '';
  public newTripEndDate: string = '';
  public newTripDepartureTime: string = '07:30';
  public newTripTransport: string = 'Xe khách Limousine';
  public newTripFirstStop: string = '';
  public newTripCompanionEmail: string = '';

  // Share Itinerary variables
  public isShareModalOpen: boolean = false;
  public sharingItinerary: any = null;
  public shareMessage: string = '';
  public shareLink: string = '';
  public shareAllowClone: boolean = true;
  public shareAllowCollab: boolean = false;

  // Collaborator Invitation properties
  public isInviteFriendModalOpen: boolean = false;
  public inviteEmails: string = '';
  public isSendingInvites: boolean = false;
  private backgroundSyncInterval: any = null;

  // Custom Premium Dialog Modal properties (Alert & Confirm)
  public dialogVisible = false;
  public dialogTitle = '';
  public dialogMessage = '';
  public dialogType: 'info' | 'warning' | 'error' | 'success' | 'confirm' = 'info';
  public dialogIcon = 'bi-info-circle-fill';
  private dialogCallback: ((confirm: boolean) => void) | null = null;

  private modalMap: any = null;
  private modalMarkers: { [key: string]: any } = {};
  private destCoords: { [key: string]: [number, number] } = {
    'Đà Lạt': [11.940419, 108.458313],
    'Phú Yên': [13.088198, 109.314957],
    'Đà Nẵng': [16.0544, 108.2022],
    'Hội An': [15.8801, 108.3380],
    'Đà Nẵng – Hội An': [16.047079, 108.206230],
    'Đà Nẵng - Hội An': [16.047079, 108.206230],
    'Sa Pa': [22.3364, 103.8438],
    'Hà Giang': [22.8233, 104.9839],
    'Mộc Châu': [20.8443, 104.6475],
    'Điện Biên': [21.3853, 103.0173],
    'Hạ Long': [20.9505, 107.0733],
    'Cát Bà': [20.7275, 106.9996],
    'Cao Bằng': [22.6657, 105.9734],
    'Ba Bể': [22.4042, 105.6174],
    'Hà Nội': [21.0285, 105.8542],
    'Ninh Bình': [20.2506, 105.9745],
    'Phong Nha': [17.5898, 106.2829],
    'Huế': [16.4637, 107.5909],
    'Quy Nhơn': [13.7820, 109.2197],
    'Nha Trang': [12.2388, 109.1967],
    'Măng Đen': [14.6000, 108.2917],
    'Buôn Ma Thuột': [12.6675, 108.0383],
    'TP. Hồ Chí Minh': [10.8231, 106.6297],
    'Côn Đảo': [8.6835, 106.6074],
    'Cần Thơ': [10.0452, 105.7469],
    'Phú Quốc': [10.2899, 103.9840],
    'An Giang': [10.5186, 105.0289],
    'Bến Tre': [10.2433, 106.3759]
  };

  // Maps properties
  private map: any = null;
  private leafletMarkers: any[] = [];
  private polyline: any = null;
  private positioningMarker: any = null;

  // AI chat properties
  public isAiChatOpen: boolean = false;
  public aiMessages: { text: string; isOutgoing: boolean; rec?: any; action?: string }[] = [];
  public aiInputText: string = '';
  public isAiThinking: boolean = false;
  public isGoogleMaps: boolean = false;
  public gmap: any = null;
  public gMarkers: any[] = [];
  public gDirectionsService: any = null;
  public gDirectionsRenderer: any = null;
  public placesService: any = null;
  public hoveredPlace: any = null;
  public hoverPopoverPos: { x: number; y: number } = { x: 0, y: 0 };
  private hoverTimeout: any = null;
  public mapClickPlaceName: string = '';
  public locatingActivityIdx: number | null = null;
  public customSearchSuggestions: any[] = [];
  public isAutoSaving: boolean = false;
  public searchMarkers: any[] = [];
  private typingTimeout: any = null;


  // Checkout modal properties
  public isCheckoutModalOpen: boolean = false;
  public isItineraryPay: boolean = false;
  public checkoutItems: { title: string; cost: number; isPartner?: boolean; depositRequired?: boolean }[] = [];
  public checkoutTotal: number = 0;

  // New Checkout details bindings
  public checkoutLastName: string = '';
  public checkoutFirstName: string = '';
  public checkoutEmail: string = '';
  public checkoutPhone: string = '';
  public checkoutCountry: string = 'Việt Nam';
  public checkoutAutoSave: boolean = false;

  // Payment selected method
  public checkoutPaymentMethod: 'wallet' | 'qr' | 'credit' | 'later' = 'wallet';

  // Credit Card fields
  public cardHolderName: string = '';
  public cardNumber: string = '';
  public cardError: string = '';

  // QR & Wallet Redesign properties
  public isQrVisible: boolean = false;
  public qrCodeUrl: string = '';
  public qrPaymentNote: string = 'NAP VI';
  public isWaitingApproval: boolean = false;
  public depositAmount: number = 500000;
  public qrFlowType: 'deposit' | 'payment' = 'deposit';
  private pollingInterval: any = null;

  // Metrics progress calculations
  public totalCost: number = 0;
  public guestCount: number = 1;
  public totalCarbon: number = 0;
  public budgetProgressPct: number = 0;
  public carbonProgressPct: number = 0;

  // Transport Booking & 2-Tab Leg Panel Properties
  public legPanelTab: 'book' | 'directions' = 'book';
  public legVehicleCategory: 'car' | 'motorbike' = 'car';
  public showVehiclePolicyView: boolean = false;
  public isLegTimePickerOpen: boolean = false;
  public legPickupTime: string = '09:00';
  public legPaymentMethodIdx: number = 0;
  public legPaymentMethods: { id: string; name: string; desc: string; icon: string }[] = [
    { id: 'wallet', name: 'Ví GreenSteps', desc: 'Thanh toán trực tiếp bằng số dư ví điện tử', icon: 'bi-wallet2' },
    { id: 'qr', name: 'QR Ngân hàng', desc: 'Quét mã VietQR chuyển khoản tức thì', icon: 'bi-qr-code' },
    { id: 'cash', name: 'Tiền mặt', desc: 'Thanh toán tiền mặt cho tài xế khi đón', icon: 'bi-cash-coin' }
  ];
  public isLegPaymentDropdownOpen: boolean = false;
  public isLegVoucherDropdownOpen: boolean = false;
  public legVoucherIdx: number = 0;
  public legVouchers: { code: string; label: string; desc: string; discount: number }[] = [
    { code: '', label: 'Không dùng voucher', desc: 'Giữ nguyên giá cước', discount: 0 },
    { code: 'ECO20K', label: 'ECO20K (-20.000đ)', desc: 'Giảm 20.000đ cho chuyến đi xanh', discount: 20000 },
    { code: 'XANH35K', label: 'XANH35K (-35.000đ)', desc: 'Ưu đãi đặt xe điện Xanh SM', discount: 35000 },
    { code: 'NETZERO50', label: 'NETZERO50 (-50.000đ)', desc: 'Giảm 50.000đ cho chuyến đi > 20km', discount: 50000 }
  ];
  public selectedLegVehicle: any = null;
  public isGpsNavigating: boolean = false;
  private gpsWatchId: number | null = null;
  private gpsUserMarker: any = null;
  public isTransportModalOpen: boolean = false;
  public transportModalMode: 'leg' | 'departure' | 'rental' = 'leg';
  public activeLegBookingIdx: number | null = null;
  public activeLegOriginName: string = '';
  public activeLegDestName: string = '';
  public activeLegDistanceKm: number = 0;
  public activeLegEstimatedTime: string = '09:00';
  public transportFilterTab: string = 'all';
  public availableTransportOptions: any[] = [];

  // Draggable Directions Panel Offset
  public dirPanelOffsetX: number = 0;
  public dirPanelOffsetY: number = 0;

  // Inline Price Editor & Notes Properties
  public editingPriceActId: string | null = null;
  public tempActivityPrice: number = 0;
  public editingNoteActId: string | null = null;
  public editingLegNoteIdx: number | null = null;
  public tempLegNoteText: string = '';
  public isItineraryNotesModalOpen: boolean = false;
  public newChecklistItemText: string = '';
  public inviteEmailChipList: string[] = [];

  // Resizer Panel properties
  public sidebarWidth: number = 250;
  public mapWidthPct: number = 38;
  public isResizing: boolean = false;
  private resizeType: 'left' | 'right' = 'left';

  // Bottom Sheet Details properties
  public selectedPlaceDetails: any = null;
  public activeGooglePlacePanel: any = null;
  public activePlaceTab: 'overview' | 'reviews' | 'about' = 'overview';
  public activeCategoryFilter: string = 'all';
  public routeLegs: { [key: number]: { distanceKm: number; durationMin: number } } = {};
  private previewRouteLayer: any = null;
  public dailyRouteLayer: any = null;
  private gInfoWindow: any = null;
  public activeLegLayer: any = null;
  public hoveredActivityIdx: number = -1;
  public activeLegDirections: {
    fromIdx: number;
    toIdx: number;
    fromTitle: string;
    fromAddress: string;
    fromCoords: { lat: number; lng: number };
    toTitle: string;
    toAddress: string;
    toCoords: { lat: number; lng: number };
    distance: string;
    duration: string;
    travelMode: 'DRIVE' | 'TWO_WHEELER' | 'WALK';
    steps: Array<{ instruction: string; maneuver: string; distance: string; duration: string; meters?: number }>;
    isLoading: boolean;
    googleMapsUrl: string;
  } | null = null;
  public sheetHeight: number = 220;
  private isSheetResizing: boolean = false;

  // Sidebar Metrics Panel Resizing properties
  public metricsHeight: number = 90;
  public isMetricsResizing: boolean = false;
  public mapSearchQuery: string = '';
  public activeTab: 'timeline' | 'suggestions' | 'bucket' = 'timeline';
  public dynamicRecs: any[] = [];
  public allCombinedRecs: any[] = [];
  public localServices: any[] = [];

  // Smart Scheduling & Conflict Detection
  public isSampleItinerary: boolean = false;
  public hasAnyTimeConflict: boolean = false;
  public isLoadingEditor: boolean = false;

  // Dual View Mode & Route Pipeline Canvas
  public activeTimelineViewMode: 'timeline' | 'pipeline' = (typeof localStorage !== 'undefined' && localStorage.getItem('greensteps_timeline_view_mode') as any) || 'timeline';
  public pipelineZoomScale: number = 1.0;
  public mobileSheetState: 'peek' | 'half' | 'full' = 'full';
  public mobileViewMode: 'list' | 'map' = 'list';
  public mobileActionSheetAct: any = null;
  public mobileActionSheetIdx: number = -1;
  public isMobileNoteModalOpen: boolean = false;
  public mobileNoteTargetAct: any = null;
  public mobileNoteText: string = '';
  public isWalletPromptModalOpen: boolean = false;

  public async handleWalletBadgeClick(event?: MouseEvent) {
    if (event) event.stopPropagation();
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập để sử dụng tính năng Ví GreenSteps!', 'warning');
      return;
    }

    if (this.walletRegistered) {
      // Đã đăng ký ví: Chạy song song lưu lịch trình và dẫn tới trang ví GreenSteps
      void this.saveItineraryToDb();
      void this.router.navigate(['/profile'], { queryParams: { section: 'wallet' } });
    } else {
      // Chưa có ví: Hiện thông báo chức năng cần mở ví
      this.isWalletPromptModalOpen = true;
      this.cdr.detectChanges();
    }
  }

  public closeWalletPromptModal() {
    this.isWalletPromptModalOpen = false;
    this.cdr.detectChanges();
  }

  public confirmOpenWallet() {
    this.isWalletPromptModalOpen = false;
    // Chạy song song lưu lịch trình
    void this.saveItineraryToDb();
    // Chuyển sang đăng ký ví tại trang profile ví
    void this.router.navigate(['/profile'], { queryParams: { section: 'wallet' } });
    this.cdr.detectChanges();
  }

  public toggleMobileViewMode() {
    this.mobileViewMode = this.mobileViewMode === 'list' ? 'map' : 'list';
    this.mobileSheetState = this.mobileViewMode === 'map' ? 'peek' : 'full';
    this.cdr.detectChanges();
  }

  public openMobileActActions(act: any, idx: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.mobileActionSheetAct = act;
    this.mobileActionSheetIdx = idx;
    this.cdr.detectChanges();
  }

  public closeMobileActActions() {
    this.mobileActionSheetAct = null;
    this.mobileActionSheetIdx = -1;
    this.cdr.detectChanges();
  }

  public openMobileNoteModal(act: any, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.closeMobileActActions();
    this.mobileNoteTargetAct = act;
    this.mobileNoteText = act.note || '';
    this.isMobileNoteModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeMobileNoteModal() {
    this.isMobileNoteModalOpen = false;
    this.mobileNoteTargetAct = null;
    this.mobileNoteText = '';
    this.cdr.detectChanges();
  }

  public saveMobileNote() {
    if (!this.mobileNoteTargetAct) return;
    const trimmed = (this.mobileNoteText || '').trim();
    this.mobileNoteTargetAct.note = trimmed;
    this.saveItineraryToDb();
    this.closeMobileNoteModal();
    this.cdr.detectChanges();
  }

  public toggleMobileSheet() {
    if (this.mobileSheetState === 'peek') {
      this.mobileSheetState = 'full';
      this.mobileViewMode = 'list';
    } else {
      this.mobileSheetState = 'peek';
      this.mobileViewMode = 'map';
    }
    this.cdr.detectChanges();
  }

  public setMobileSheetState(state: 'peek' | 'half' | 'full') {
    this.mobileSheetState = state;
    this.cdr.detectChanges();
  }

  public formatStationIndex(idx: number): string {
    const n = (idx || 0) + 1;
    return n < 10 ? '0' + n : '' + n;
  }

  // Drag & Drop State with Smooth Gap & Dashed Indicator
  public dragSrcIdx: number | null = null;
  public canDragItem: boolean = false;
  public dragTargetIdx: number | null = null;
  public dragDropPosition: 'before' | 'after' | null = null;
  public crossDayDropTargetIdx: number | null = null;

  // Favorite Places / Wishlist (Replaced static buckets)
  public favoritePlaces: any[] = [];

  // Guest & Order Lookup properties
  public isBookingSuccessModalOpen: boolean = false;
  public createdBookingCode: string = '';
  public createdBookingEmail: string = '';
  public createdBookingPhone: string = '';
  public createdBookingCustomerName: string = '';

  // Custom categorized list builder properties (kept for backwards compatibility)
  public customLists: { title: string; places: { title: string }[] }[] = [];

  // Cities centers for map coordinates fallbacks
  private cityCenters: { [key: string]: number[] } = {
    "da-lat": [11.9360, 108.4450],      // Quảng trường Lâm Viên / Hồ Xuân Hương
    "phu-yen": [13.0882, 109.3025],     // Tuy Hòa, Phú Yên
    "da-nang": [16.0544, 108.2022],     // Trung tâm Đà Nẵng
    "vung-tau": [10.3460, 107.0843],    // Bãi Sau / Trung tâm TP Vũng Tàu
    "ha-noi": [21.0285, 105.8542],      // Hồ Hoàn Kiếm, Hà Nội
    "hoi-an": [15.8801, 108.3380],      // Phố cổ Hội An
    "phu-quoc": [10.2289, 103.9572],    // Dương Đông, Phú Quốc
    "nha-trang": [12.2388, 109.1967],   // Bờ biển Trần Phú, Nha Trang
    "ho-chi-minh": [10.7769, 106.7009], // Bến Thành, TP. Hồ Chí Minh
    "hue": [16.4637, 107.5909],         // Đại nội Huế
    "quy-nhon": [13.7830, 109.2197],    // TP. Quy Nhơn
    "sapa": [22.3364, 103.8438],        // Trung tâm Sa Pa
    "ninh-binh": [20.2506, 105.9745],   // Tràng An / Ninh Bình
    "ha-long": [20.9505, 107.0734],     // Bãi Cháy, Vịnh Hạ Long
    "can-tho": [10.0452, 105.7469],     // Bến Ninh Kiều, Cần Thơ
    "phan-thiet": [10.9289, 108.1021],  // Mũi Né / Phan Thiết
    "hai-phong": [20.8449, 106.6881]    // Trung tâm Hải Phòng
  };

  public getDestinationCenterCoords(dest: string | null | undefined): [number, number] {
    if (!dest) return [11.9360, 108.4450];
    const slug = this.mapDestToSlug(dest);
    if (this.cityCenters[slug]) {
      return [this.cityCenters[slug][0], this.cityCenters[slug][1]];
    }
    const normalized = dest.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (normalized.includes('vung tau')) return [10.3460, 107.0843];
    if (normalized.includes('ha noi')) return [21.0285, 105.8542];
    if (normalized.includes('hoi an')) return [15.8801, 108.3380];
    if (normalized.includes('phu quoc')) return [10.2289, 103.9572];
    if (normalized.includes('nha trang')) return [12.2388, 109.1967];
    if (normalized.includes('ho chi minh') || normalized.includes('sai gon')) return [10.7769, 106.7009];
    if (normalized.includes('hue')) return [16.4637, 107.5909];
    if (normalized.includes('quy nhon')) return [13.7830, 109.2197];
    if (normalized.includes('sapa')) return [22.3364, 103.8438];
    if (normalized.includes('ninh binh')) return [20.2506, 105.9745];
    if (normalized.includes('ha long')) return [20.9505, 107.0734];
    if (normalized.includes('can tho')) return [10.0452, 105.7469];
    if (normalized.includes('phan thiet') || normalized.includes('mui ne')) return [10.9289, 108.1021];
    if (normalized.includes('hai phong')) return [20.8449, 106.6881];
    if (normalized.includes('phu yen')) return [13.0882, 109.3025];
    if (normalized.includes('da nang')) return [16.0544, 108.2022];
    return [11.9360, 108.4450];
  }

  // Suggestions are loaded dynamically from the database only (GreenServices)

  @HostListener('document:mousedown', ['$event'])
  public onDocumentClick(event: MouseEvent) {
    if (this.selectedPlaceDetails) {
      const target = event.target as HTMLElement;
      const clickedInsideSheet = target.closest('.map-details-sheet');
      const clickedMarker = target.closest('.leaflet-marker-icon') || target.closest('.leaflet-popup');

      if (!clickedInsideSheet && !clickedMarker) {
        this.closePlaceDetails();
      }
    }
  }

  @HostListener('document:mouseup')
  public onGlobalMouseUp() {
    this.canDragItem = false;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private loginModalService: LoginModalService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private favoritesService?: FavoritesService
  ) { }

  public openLoginModal() {
    this.loginModalService.open();
  }

  ngOnInit() {
    this.apiService.preloadMapData();
    void this.loadPendingFood();
    this.loadFavoritePlaces();
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.apiService.getWalletInfo(user.id || user._id || '').then(wallet => {
          this.walletBalance = wallet.balance;
          this.walletRegistered = wallet.registered;
          this.cdr.detectChanges();
        });
      }
      this.cdr.detectChanges();
    });

    // Set default AI welcome message
    this.aiMessages.push({
      text: "Xin chào! Tôi là Trợ lý Lịch trình Xanh của GreenSteps. Hãy cho tôi biết bạn đang muốn đi đâu, muốn tìm quán ăn, hoặc cần hỗ trợ tra cứu gì nhé!",
      isOutgoing: false
    });
    this.cdr.detectChanges();
  }

  ngAfterViewInit() {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, queryParams]) => {
      const pathId = params.get('id');
      const queryId = queryParams.get('id');
      let id = pathId || queryId ||
        this.route.parent?.snapshot.paramMap.get('id') ||
        this.route.snapshot.paramMap.get('id') ||
        this.route.snapshot.queryParamMap.get('id');

      const action = queryParams.get('action') || this.route.snapshot.queryParamMap.get('action');
      const mode = queryParams.get('mode') || this.route.snapshot.queryParamMap.get('mode');
      const destParam = queryParams.get('destination') || queryParams.get('dest') || this.route.snapshot.queryParamMap.get('destination') || this.route.snapshot.queryParamMap.get('dest');

      // If user specifically requests a new itinerary creation
      if (id === 'new' || action === 'new' || mode === 'new') {
        this.isListMode = false;
        this.isLoadingEditor = false;
        let dest = 'Đà Lạt';
        if (destParam) {
          dest = decodeURIComponent(destParam).trim();
        }
        this.openCreateNewModal(dest);
        this.cdr.detectChanges();
        return;
      }

      if (!id) {
        try {
          const segments = window.location.pathname.split('/').filter(Boolean);
          const lastSeg = segments[segments.length - 1];
          if (lastSeg && !['schedule', 'schedule-editor'].includes(lastSeg)) {
            id = decodeURIComponent(lastSeg);
          }
        } catch (e) { }
      }

      if (!id) {
        const storedId = localStorage.getItem('greensteps_working_itinerary_id');
        if (storedId && storedId !== 'undefined' && storedId !== 'null' && storedId !== 'new') {
          id = storedId;
        }
      }

      this.isListMode = false;
      this.isLoadingEditor = true;
      this.cdr.detectChanges();

      if (id && id !== 'new') {
        this.loadItineraryToEditor(id);
        localStorage.setItem('greensteps_working_itinerary_id', id);
      } else {
        // Safe graceful fallback: load active draft or default tour without redirect loop
        this.loadItineraryToEditor('SCH01');
      }
    });
  }

  ngOnDestroy() {
    this.favoritesSubscription?.unsubscribe();
    this.stopBackgroundSync();
    this.clearSearchMarkers();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }


  public async loadSavedItinerariesList() {
    this.isLoadingList = true;
    this.cdr.detectChanges();
    try {
      const user = this.authService.getCurrentUser();
      let customs: any[] = [];
      let bookings: any[] = [];

      if (user) {
        const userId = user.id || user._id || '';
        try {
          customs = await this.apiService.getItineraries(userId) || [];
        } catch (e) {
          console.warn('Could not fetch user itineraries:', e);
        }
        try {
          bookings = await this.apiService.getBookings(undefined, userId) || [];
        } catch (e) {
          console.warn('Could not fetch user bookings:', e);
        }
      }

      // Guest / Local Drafts scanning from localStorage
      const guestDrafts: any[] = [];
      try {
        const guestIds: string[] = JSON.parse(localStorage.getItem('greensteps_guest_itinerary_ids') || '[]');
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('greensteps_guest_draft_') || k.startsWith('greensteps_user_draft_') || k.startsWith('greensteps_draft_'))) {
            const id = k.replace('greensteps_guest_draft_', '').replace('greensteps_user_draft_', '').replace('greensteps_draft_', '');
            if (!guestIds.includes(id)) guestIds.push(id);
          }
        }

        for (const gid of guestIds) {
          const raw = localStorage.getItem(`greensteps_user_draft_${gid}`) || localStorage.getItem(`greensteps_guest_draft_${gid}`) || localStorage.getItem(`greensteps_draft_${gid}`);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              let totalCost = 0;
              let totalCarbon = 0;
              if (parsed.days && Array.isArray(parsed.days)) {
                for (const d of parsed.days) {
                  for (const a of (d.activities || [])) {
                    totalCost += (Number(a.cost) || 0);
                    totalCarbon += (Number(a.carbon) || 0);
                  }
                }
              }
              totalCarbon = Math.round(totalCarbon * 10) / 10;
              guestDrafts.push({
                id: parsed.id || gid,
                name: parsed.title || parsed.name || 'Lịch trình du lịch xanh',
                destination: parsed.destLabel || parsed.destination || 'Việt Nam',
                dest: parsed.dest || '',
                imageUrl: parsed.imageUrl || parsed.image_url || null,
                days: (parsed.days && parsed.days.length) ? parsed.days.length : 3,
                totalCost: totalCost,
                totalCarbon: totalCarbon,
                status: parsed.status || 'draft',
                isGuestDraft: true,
                isTourBooking: false,
                daysData: parsed.days
              });
            } catch (e) { }
          }
        }
      } catch (e) {
        console.warn('Error parsing guest drafts:', e);
      }

      // Guest bookings stored in localStorage
      try {
        const guestBookings: string[] = JSON.parse(localStorage.getItem('greensteps_guest_bookings') || '[]');
        for (const bCode of guestBookings) {
          try {
            const found = await this.apiService.getBooking(bCode);
            if (found && !bookings.some(b => b.id === found.id)) {
              bookings.push(found);
            }
          } catch (e) { }
        }
      } catch (e) { }

      const depositedToursMapped = (bookings || [])
        .filter(b => b.status !== 'rejected' && b.status !== 'cancelled')
        .map(b => {
          const tName = b.tour_name || b.service || b.title || (b.type === 'tour' ? 'Tour Du Lịch Xanh' : 'Dịch Vụ Sinh Thái');
          const dest = b.destination || (tName.includes('Hội An') ? 'Hội An' : (tName.includes('Phú Yên') ? 'Phú Yên' : (tName.includes('Đà Lạt') || tName.includes('Tuyền Lâm') ? 'Đà Lạt' : 'Việt Nam')));
          return {
            id: b.id,
            name: tName,
            destination: dest,
            days: b.days || 3,
            totalCost: b.value,
            totalCarbon: 0,
            status: b.status === 'deposit' ? 'deposited' : b.status,
            bookingDate: b.booking_date || b.date,
            isTourBooking: true,
            imageUrl: b.image_url || b.imageUrl || b.image || null,
            bookingStatusText: b.status === 'confirmed' ? 'Đã xác nhận' : (b.status === 'deposit' ? 'Đã đặt cọc' : (b.status === 'completed' ? 'Đã hoàn thành' : 'Đang chuẩn bị'))
          };
        });

      // Merge: customs (user remote), guestDrafts (local device), depositedToursMapped
      // Enrich customs with any local draft imageUrl overrides
      const enrichedCustoms = (customs || []).map((c: any) => {
        const rawLocal = localStorage.getItem(`greensteps_user_draft_${c.id}`) || localStorage.getItem(`greensteps_guest_draft_${c.id}`) || localStorage.getItem(`greensteps_draft_${c.id}`);
        if (rawLocal) {
          try {
            const parsed = JSON.parse(rawLocal);
            if (parsed.imageUrl || parsed.image_url) {
              return { ...c, imageUrl: parsed.imageUrl || parsed.image_url };
            }
          } catch (e) { }
        }
        return c;
      });

      const allItis = [...enrichedCustoms];
      for (const gd of guestDrafts) {
        if (!allItis.some(x => x.id === gd.id)) {
          allItis.push(gd);
        }
      }
      this.savedItineraries = [...allItis, ...depositedToursMapped];
      this.applySearchOrFilter();
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingList = false;
      this.cdr.detectChanges();
    }
  }

  public get hasDraftItineraries(): boolean {
    return this.filteredSavedItineraries.some(iti => !iti.isTourBooking && iti.status !== 'deposited');
  }

  public get hasDepositedTours(): boolean {
    return this.filteredSavedItineraries.some(iti => iti.isTourBooking || iti.status === 'deposited');
  }

  public applySearchOrFilter() {
    const q = (this.searchOrLookupQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredSavedItineraries = [...this.savedItineraries];
      this.cdr.detectChanges();
      return;
    }
    this.filteredSavedItineraries = this.savedItineraries.filter(iti => {
      const matchName = iti.name && iti.name.toLowerCase().includes(q);
      const matchDest = iti.destination && iti.destination.toLowerCase().includes(q);
      const matchId = iti.id && iti.id.toLowerCase().includes(q);
      return matchName || matchDest || matchId;
    });
    this.cdr.detectChanges();
  }

  public async onSearchOrLookup() {
    const q = (this.searchOrLookupQuery || '').trim();
    if (!q) {
      this.applySearchOrFilter();
      return;
    }

    const upperQ = q.toUpperCase();
    const isOrderCode = upperQ.startsWith('BKT-') || upperQ.startsWith('BKS-') || upperQ.startsWith('BKG_');
    const isPhoneNumber = /^[0-9]{9,11}$/.test(q);

    if (isOrderCode || isPhoneNumber) {
      this.isSearchingOrLookingUp = true;
      this.cdr.detectChanges();
      try {
        let foundBookings: any[] = [];
        if (isOrderCode) {
          const single = await this.apiService.getBooking(upperQ);
          if (single) foundBookings = [single];
        } else if (isPhoneNumber) {
          foundBookings = await this.apiService.lookupBookingsByPhone(q) || [];
        }

        if (foundBookings && foundBookings.length > 0) {
          const mapped = foundBookings.map(b => {
            const tName = b.tour_name || b.service || b.title || (b.type === 'tour' ? 'Tour Du Lịch Xanh' : 'Dịch Vụ Sinh Thái');
            const dest = b.destination || (tName.includes('Hội An') ? 'Hội An' : (tName.includes('Phú Yên') ? 'Phú Yên' : (tName.includes('Đà Lạt') || tName.includes('Tuyền Lâm') ? 'Đà Lạt' : 'Việt Nam')));
            return {
              id: b.id,
              name: tName,
              destination: dest,
              days: b.days || 3,
              totalCost: b.value,
              totalCarbon: 0,
              status: b.status === 'deposit' ? 'deposited' : b.status,
              bookingDate: b.booking_date || b.date,
              isTourBooking: true,
              bookingStatusText: b.status === 'confirmed' ? 'Đã xác nhận' : (b.status === 'deposit' ? 'Đã đặt cọc' : (b.status === 'completed' ? 'Đã hoàn thành' : 'Đang chuẩn bị'))
            };
          });

          // Remember guest booking code in localStorage
          try {
            const guestBookings: string[] = JSON.parse(localStorage.getItem('greensteps_guest_bookings') || '[]');
            for (const mb of mapped) {
              if (!guestBookings.includes(mb.id)) guestBookings.push(mb.id);
            }
            localStorage.setItem('greensteps_guest_bookings', JSON.stringify(guestBookings));
          } catch (e) { }

          // Prepend found items if not already present
          for (const m of mapped) {
            if (!this.savedItineraries.some(x => x.id === m.id)) {
              this.savedItineraries.unshift(m);
            }
          }
          this.filteredSavedItineraries = [...mapped];
          this.showAlert(`Tìm thấy ${mapped.length} đơn đặt chỗ tương ứng!`, 'success');
        } else {
          this.showAlert('Không tìm thấy đơn hàng nào với mã hoặc số điện thoại này. Quý khách vui lòng kiểm tra lại email xác nhận.', 'warning');
          this.applySearchOrFilter();
        }
      } catch (err) {
        console.error(err);
        this.showAlert('Có lỗi khi tra cứu đơn hàng, vui lòng thử lại sau.', 'error');
      } finally {
        this.isSearchingOrLookingUp = false;
        this.cdr.detectChanges();
      }
    } else {
      // Local keyword filter
      this.applySearchOrFilter();
    }
  }

  public clearSearchOrLookup() {
    this.searchOrLookupQuery = '';
    this.applySearchOrFilter();
  }

  public async deleteSavedItinerary(id: string, event: Event) {
    event.stopPropagation();
    const confirmed = await this.showConfirm('Xóa lịch trình', 'Bạn có chắc chắn muốn xóa lịch trình này không?');
    if (confirmed) {
      // Check if it's a guest draft or stored in localStorage
      const isLocalDraft = !!localStorage.getItem(`greensteps_guest_draft_${id}`);
      if (isLocalDraft || !this.currentUser) {
        localStorage.removeItem(`greensteps_guest_draft_${id}`);
        try {
          const guestIds: string[] = JSON.parse(localStorage.getItem('greensteps_guest_itinerary_ids') || '[]');
          const updated = guestIds.filter(x => x !== id);
          localStorage.setItem('greensteps_guest_itinerary_ids', JSON.stringify(updated));
        } catch (e) { }
        if (localStorage.getItem('greensteps_working_itinerary_id') === id) {
          localStorage.removeItem('greensteps_working_itinerary_id');
        }
        this.showAlert('Đã xóa bản nháp trên máy này thành công!', 'success');
        this.loadSavedItinerariesList();
        return;
      }

      const success = await this.apiService.deleteItinerary(id);
      if (success) {
        if (localStorage.getItem('greensteps_working_itinerary_id') === id) {
          localStorage.removeItem('greensteps_working_itinerary_id');
        }
        this.showAlert('Đã xóa lịch trình thành công!', 'success');
        this.loadSavedItinerariesList();
      } else {
        this.showAlert('Xóa lịch trình thất bại!', 'error');
      }
    }
  }

  public openItinerary(id: string) {
    if (id && (id.startsWith('BKT-') || id.startsWith('BKS-') || id.startsWith('BKG_'))) {
      if (this.currentUser) {
        this.router.navigate(['/profile'], { queryParams: { section: 'tickets' } });
      } else {
        this.router.navigate(['/booking-lookup'], { queryParams: { code: id } });
      }
      return;
    }
    this.router.navigate(['/schedule', id]);
    this.isLoadingEditor = true;
    this.cdr.detectChanges();
  }

  public openCreateNewModal(customDest?: string) {
    this.isCreateNewModalOpen = true;
    const dest = customDest || this.newTripDestination || 'Đà Lạt';
    this.newTripDestination = dest;
    this.modalDest = dest;
    this.newTripName = `Hành trình khám phá ${dest}`;
    this.newTripOrigin = this.newTripOrigin || 'TP. Hồ Chí Minh';
    this.newTripStartDate = '';
    this.newTripEndDate = '';
    this.newTripDepartureTime = '07:30';
    this.newTripTransport = 'Xe khách Limousine';
    this.newTripFirstStop = '';
    this.newTripCompanionEmail = '';
    this.cdr.detectChanges();
  }

  public closeCreateNewModal() {
    this.isCreateNewModalOpen = false;
    if (!this.activeItinerary) {
      this.router.navigate(['/tours']);
    }
    this.cdr.detectChanges();
  }

  public onTripDatesChange() {
    this.cdr.detectChanges();
  }

  public get countdownNotice(): string {
    if (!this.newTripStartDate) return '';
    const today = new Date('2026-07-12'); // Fixed system today as July 12, 2026
    const start = new Date(this.newTripStartDate);
    const diffMs = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return `Chuyến đi của bạn còn ${diffDays} ngày nữa sẽ khởi hành (bắt đầu từ ${this.newTripStartDate}).`;
    } else if (diffDays === 0) {
      return `Chuyến đi khởi hành vào hôm nay!`;
    } else {
      return `Chuyến đi đã diễn ra vào ${Math.abs(diffDays)} ngày trước.`;
    }
  }

  public getCountdownLabel(iti: any): string | null {
    if (!iti.start_date) return null;
    const today = new Date('2026-07-12'); // Fixed system today as July 12, 2026
    const start = new Date(iti.start_date);
    const diffMs = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return `${diffDays} ngày tới`;
    } else if (diffDays === 0) {
      return 'Hôm nay';
    } else {
      return `Đã đi (${Math.abs(diffDays)} ngày trước)`;
    }
  }

  public async submitCreateNewTrip(event: Event) {
    event.preventDefault();
    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';

    let calculatedDays = 3;
    if (this.newTripStartDate && this.newTripEndDate) {
      const start = new Date(this.newTripStartDate);
      const end = new Date(this.newTripEndDate);
      if (end < start) {
        this.showAlert('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu!', 'warning');
        return;
      }
      calculatedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Auto-populate initial transit & first stop for Day 1
    const day1Activities: any[] = [];
    if (this.newTripDepartureTime || this.newTripTransport || this.newTripOrigin) {
      const originName = this.newTripOrigin.trim() || 'TP. Hồ Chí Minh';
      const transportName = this.newTripTransport || 'Xe khách Limousine';
      const depTime = this.newTripDepartureTime || '07:30';
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
    }

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

    const daysData = Array.from({ length: calculatedDays }, (_, i) => i === 0 && day1Activities.length > 0 ? day1Activities : []);

    const newIti = {
      id: 'iti_' + Date.now(),
      name: this.newTripName.trim() || `Hành trình khám phá ${this.newTripDestination}`,
      user_id: userId,
      destination: this.newTripDestination,
      origin: this.newTripOrigin.trim() || 'TP. Hồ Chí Minh',
      departure_time: this.newTripDepartureTime || '07:30',
      transport: this.newTripTransport || 'Xe khách Limousine',
      first_stop: this.newTripFirstStop.trim() || null,
      days: calculatedDays,
      totalCost: 0,
      totalCarbon: day1Activities.reduce((acc, a) => acc + (a.carbon || 0), 0),
      daysData: daysData,
      status: 'draft' as const,
      deposit_deadline: null,
      start_date: this.newTripStartDate || null,
      end_date: this.newTripEndDate || null,
      companion_email: this.newTripCompanionEmail.trim() || null
    };

    this.isLoadingList = true;
    this.isCreateNewModalOpen = false;
    this.cdr.detectChanges();

    if (!user) {
      // Guest mode: Save locally in browser localStorage
      const guestIti = {
        id: newIti.id,
        title: newIti.name,
        name: newIti.name,
        dest: this.mapDestToSlug(newIti.destination),
        destLabel: newIti.destination,
        destination: newIti.destination,
        origin: newIti.origin,
        departure_time: newIti.departure_time,
        transport: newIti.transport,
        first_stop: newIti.first_stop,
        days: Array.from({ length: calculatedDays }, (_, i) => ({
          title: `Ngày ${i + 1}`,
          activities: i === 0 && day1Activities.length > 0 ? day1Activities : []
        }))
      };
      try {
        localStorage.setItem(`greensteps_guest_draft_${newIti.id}`, JSON.stringify(guestIti));
        const guestIds: string[] = JSON.parse(localStorage.getItem('greensteps_guest_itinerary_ids') || '[]');
        if (!guestIds.includes(newIti.id)) {
          guestIds.unshift(newIti.id);
          localStorage.setItem('greensteps_guest_itinerary_ids', JSON.stringify(guestIds));
        }
      } catch (e) {
        console.warn('Could not save guest draft to localStorage:', e);
      }
      localStorage.setItem('greensteps_working_itinerary_id', newIti.id);
      this.isLoadingList = false;
      this.cdr.detectChanges();
      this.router.navigate(['/schedule', newIti.id]);
      return;
    }

    const success = await this.apiService.saveItinerary(newIti);
    this.isLoadingList = false;
    this.cdr.detectChanges();

    if (success) {
      if (this.newTripCompanionEmail.trim()) {
        const sender = this.authService.getCurrentUser();
        const senderName = sender ? (sender.fullname || sender.username) : 'Một người bạn';
        const inviteUrl = `${window.location.origin}/schedule/${newIti.id}?senderName=${encodeURIComponent(senderName)}`;
        this.apiService.inviteCollaborator(newIti.id, this.newTripCompanionEmail.trim(), inviteUrl)
          .then(() => console.log('Initial collaborator invites sent'))
          .catch(err => console.error('Initial invites failed:', err));
      }
      localStorage.setItem('greensteps_working_itinerary_id', newIti.id);
      this.router.navigate(['/schedule', newIti.id]);
    } else {
      this.showAlert('Không thể khởi tạo lịch trình mới!', 'error');
    }
  }

  public getItineraryDaysCount(iti: any): number {
    if (!iti) return 1;
    if (typeof iti.days === 'number') return iti.days;
    if (Array.isArray(iti.days)) return iti.days.length || 1;
    if (typeof iti.daysCount === 'number') return iti.daysCount;
    return 1;
  }

  private encodeShareSnapshot(iti: any): string {
    try {
      const src = (iti && Array.isArray(iti.days)) ? iti : this.activeItinerary;
      if (!src || !Array.isArray(src.days)) return '';
      const minPayload = {
        i: src.id,
        t: src.title || src.name || 'Lịch trình du lịch',
        d: src.destLabel || src.destination || 'Đà Lạt',
        y: src.days.map((day: any, idx: number) => ({
          n: day.dayNum || (idx + 1),
          a: (day.activities || []).map((act: any) => ({
            m: act.time || '08:00',
            t: act.title || act.name || 'Hoạt động',
            y: act.type || 'attraction',
            c: Number(act.cost) || 0,
            b: Number(act.carbon) || 0,
            la: act.lat,
            ln: act.lng
          }))
        }))
      };
      const jsonStr = JSON.stringify(minPayload);
      return encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    } catch {
      return '';
    }
  }

  private decodeShareSnapshot(snapParam: string): any | null {
    try {
      const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(snapParam))));
      const min = JSON.parse(jsonStr);
      if (!min || !Array.isArray(min.y)) return null;
      const destSlug = this.mapDestToSlug(min.d);
      return {
        id: min.i || 'iti_shared',
        title: min.t || 'Lịch trình được chia sẻ',
        dest: destSlug,
        destLabel: min.d || 'Đà Lạt',
        destination: min.d || 'Đà Lạt',
        days: min.y.map((day: any, idx: number) => ({
          dayNum: day.n || (idx + 1),
          title: `Ngày ${day.n || (idx + 1)}`,
          activities: (day.a || []).map((act: any, aIdx: number) => ({
            id: `act_snap_${idx}_${aIdx}`,
            time: act.m || '08:00',
            title: act.t || 'Hoạt động',
            type: act.y || 'attraction',
            cost: Number(act.c) || 0,
            carbon: Number(act.b) || 0,
            is_shared: act.y === 'lodging',
            lat: act.la,
            lng: act.ln
          }))
        }))
      };
    } catch {
      return null;
    }
  }

  // Share methods
  public async openShareModal(iti: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập trước khi chia sẻ lịch trình để lưu trữ và chia sẻ đến bạn bè nhé!', 'warning', () => {
        this.loginModalService.open();
      });
      return;
    }

    this.sharingItinerary = iti || this.activeItinerary;
    this.shareAllowClone = true;
    this.shareAllowCollab = false;
    this.updateSharePayload();
    this.isShareModalOpen = true;
    this.cdr.detectChanges();

    if (this.activeItinerary) {
      this.activeItinerary.user_id = user.id || (user as any)._id;
      this.saveItineraryToDb().catch(e => console.warn('Background save itinerary notice:', e));
    }
  }

  public onShareOptionsChanged() {
    this.updateSharePayload();
  }

  public updateSharePayload() {
    const targetId = this.sharingItinerary?.id || this.activeItinerary?.id;
    if (!targetId) return;
    const user = this.authService.getCurrentUser();
    const userName = user?.fullname || user?.username || 'Bạn';
    const tripName = this.sharingItinerary?.name || this.sharingItinerary?.title || this.activeItinerary?.title || 'Lịch trình du lịch';
    const destName = this.sharingItinerary?.destLabel || this.sharingItinerary?.destination || this.activeItinerary?.destLabel || 'Việt Nam';
    const snap = this.encodeShareSnapshot(this.sharingItinerary || this.activeItinerary);

    if (this.shareAllowCollab) {
      this.shareLink = `${window.location.origin}/schedule/${targetId}?join=1&collab=1&senderName=${encodeURIComponent(userName)}`;
      this.shareMessage = `🌿 ${userName} mời bạn cùng tham gia chỉnh sửa & thanh toán lịch trình "${tripName}" tại ${destName} trên GreenSteps!\nXem và tham gia tại: ${this.shareLink}`;
    } else {
      this.shareLink = snap
        ? `${window.location.origin}/schedule/${targetId}?s=${snap}`
        : `${window.location.origin}/schedule/${targetId}`;
      this.shareMessage = `Khám phá hành trình "${tripName}" tại ${destName} trên GreenSteps! 🌿\nXem chi tiết lịch trình tại: ${this.shareLink}`;
    }
    this.cdr.detectChanges();
  }

  public closeShareModal() {
    this.isShareModalOpen = false;
    this.sharingItinerary = null;
    this.shareMessage = '';
    this.cdr.detectChanges();
  }

  public async postToCommunity() {
    if (!this.sharingItinerary) return;
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập để chia sẻ!', 'warning', () => {
        this.loginModalService.open();
      });
      return;
    }

    try {
      const shareTripName = this.sharingItinerary.name || this.sharingItinerary.title || 'Lịch trình du lịch';
      const cover = this.getUnifiedCoverImage(this.sharingItinerary);
      const payload = {
        authorId: user.id || (user as any)._id || '',
        author: user.fullname || user.username || 'Thành viên GreenSteps',
        text: this.shareMessage?.trim() || `Khám phá lịch trình du lịch "${shareTripName}" cùng mình trên GreenSteps!`,
        rating: 5,
        tripName: shareTripName,
        dest: this.sharingItinerary.destination || this.sharingItinerary.dest || 'Việt Nam',
        days: this.getItineraryDaysCount(this.sharingItinerary),
        likes: 0,
        comments: 0,
        image: cover || null,
        images: cover ? [cover] : [],
        itineraryId: this.sharingItinerary.id,
        allowClone: this.shareAllowClone,
        allowCollab: this.shareAllowCollab
      };

      const res = await this.apiService.addCommunityPost(payload);
      if (res && res.success) {
        this.closeShareModal();
        this.showAlert('Đã chia sẻ lịch trình lên cộng đồng GreenSteps thành công!', 'success', () => {
          this.router.navigate(['/community']);
        });
      } else {
        this.showAlert(res?.message || 'Chia sẻ lên cộng đồng thất bại!', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showAlert('Đã xảy ra lỗi khi đăng bài!', 'error');
    }
  }

  public shareSocial(platform: 'facebook' | 'instagram' | 'zalo' | 'twitter' | 'messenger') {
    const link = this.shareLink || `${window.location.origin}/schedule/${this.sharingItinerary?.id || this.activeItinerary?.id || ''}`;
    const tripName = this.sharingItinerary?.name || this.sharingItinerary?.title || this.activeItinerary?.title || 'Lịch trình du lịch';
    const dest = this.sharingItinerary?.destLabel || this.sharingItinerary?.destination || this.activeItinerary?.destLabel || 'Việt Nam';
    const coverUrl = this.getUnifiedCoverImage(this.sharingItinerary || this.activeItinerary);
    const url = encodeURIComponent(link);

    if (platform === 'facebook') {
      const quote = `🌿 ${this.shareMessage || `Cùng mình trải nghiệm "${tripName}" tại ${dest} trên GreenSteps!`}\n\nXem hành trình tại: ${link}`;
      try { navigator.clipboard.writeText(quote); } catch (e) { }
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(quote)}`, '_blank', 'width=620,height=520');
      this.showAlert('Đã sao chép nội dung & hình ảnh vào bộ nhớ tạm! Bạn có thể dán vào bài viết Facebook.', 'info');
      return;
    }
    if (platform === 'zalo') {
      const zaloText = `${this.shareMessage || `Khám phá lịch trình du lịch xanh "${tripName}" tại ${dest}!`}\n\nXem chi tiết: ${link}`;
      try { navigator.clipboard.writeText(zaloText); } catch (e) { }
      window.open(`https://zalo.me/share?url=${url}`, '_blank', 'width=600,height=520');
      this.showAlert('Đã mở cửa sổ chia sẻ Zalo và sao chép toàn bộ thông tin lịch trình vào bộ nhớ tạm!', 'success');
      return;
    }
    if (platform === 'instagram') {
      const igCaption = `🌿 Hành trình xanh: ${tripName} tại ${dest}!\nLịch trình chi tiết: ${link}\n\n#GreenSteps #DuLichXanh #${this.mapDestToSlug(dest)}`;
      try { navigator.clipboard.writeText(igCaption); } catch (e) { }
      if (coverUrl) {
        this.downloadCoverImage(coverUrl, `greensteps-${this.mapDestToSlug(dest)}-cover.jpg`);
      }
      window.open('https://www.instagram.com/', '_blank');
      this.showAlert('Đã tải ảnh đại diện chuyến đi và sao chép nội dung bài đăng! Hãy tải ảnh lên Instagram và dán (Paste) nội dung nhé.', 'success');
      return;
    }
    if (platform === 'messenger') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=450');
      return;
    }
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(this.shareMessage || '')}&url=${url}`, '_blank', 'width=600,height=450');
  }

  public downloadCoverImage(url: string, filename: string = 'greensteps-cover.jpg') {
    if (!url) return;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('Cannot download cover photo directly:', e);
    }
  }

  public copyShareLink() {
    if (!this.shareLink) {
      const targetId = this.sharingItinerary?.id || this.activeItinerary?.id;
      this.shareLink = `${window.location.origin}/schedule/${targetId}`;
    }
    navigator.clipboard.writeText(this.shareLink);
    this.showAlert('Đã sao chép liên kết lịch trình vào bộ nhớ tạm! Bạn có thể gửi liên kết này cho bạn bè.', 'success');
  }

  public showAlert(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', callback?: () => void) {
    this.dialogTitle = type === 'success' ? 'Thành công' : (type === 'error' ? 'Lỗi' : 'Thông báo');
    this.dialogMessage = message;
    this.dialogType = type;
    this.dialogCallback = callback ? (confirmed) => { if (confirmed) callback(); } : null;

    if (type === 'warning') this.dialogIcon = 'bi-exclamation-triangle-fill text-amber-500';
    else if (type === 'error') this.dialogIcon = 'bi-x-circle-fill text-red-500';
    else if (type === 'success') this.dialogIcon = 'bi-check-circle-fill text-[#0E9F6E]';
    else this.dialogIcon = 'bi-info-circle-fill text-blue-500';

    this.dialogVisible = true;
    this.cdr.detectChanges();
  }

  public showConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogTitle = title;
      this.dialogMessage = message;
      this.dialogType = 'confirm';
      this.dialogIcon = 'bi-question-circle-fill text-[#0E9F6E]';
      this.dialogCallback = (confirmed) => {
        resolve(confirmed);
      };
      this.dialogVisible = true;
      this.cdr.detectChanges();
    });
  }

  public closeDialog(confirm: boolean) {
    this.dialogVisible = false;
    if (this.dialogCallback) {
      this.dialogCallback(confirm);
      this.dialogCallback = null;
    }
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
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

  public goBackToList() {
    localStorage.removeItem('greensteps_working_itinerary_id');
    this.router.navigate(['/profile'], { queryParams: { section: 'itineraries' } });
  }

  private mapDestToSlug(destName: string): string {
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

  private mapSlugToDestLabel(slug: string): string {
    const s = (slug || '').toLowerCase();
    if (s === "da-lat") return "Đà Lạt";
    if (s === "phu-yen") return "Phú Yên";
    if (s === "da-nang") return "Đà Nẵng";
    if (s === "hoi-an") return "Hội An";
    if (s === "vung-tau") return "Vũng Tàu";
    if (s === "ha-noi") return "Hà Nội";
    if (s === "phu-quoc") return "Phú Quốc";
    if (s === "nha-trang") return "Nha Trang";
    if (s === "ho-chi-minh") return "TP. Hồ Chí Minh";
    if (s === "hue") return "Huế";
    if (s === "quy-nhon") return "Quy Nhơn";
    if (s === "sapa") return "Sa Pa";
    if (s === "ninh-binh") return "Ninh Bình";
    if (s === "ha-long") return "Hạ Long";
    if (s === "can-tho") return "Cần Thơ";
    if (s === "phan-thiet") return "Phan Thiết";
    if (s === "hai-phong") return "Hải Phòng";
    return slug || "Đà Lạt";
  }

  private getCoordinatesForPlace(name: string, destSlug: string): { lat: number | undefined; lng: number | undefined } {
    const match = this.localServices.find(s =>
      (s.name || s.name_service || '').toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes((s.name || s.name_service || '').toLowerCase())
    );
    if (match && match.current_data && match.current_data.lat && match.current_data.lng) {
      return { lat: match.current_data.lat, lng: match.current_data.lng };
    }
    return { lat: undefined, lng: undefined };
  }

  private convertApiToEditorItinerary(apiIti: any): any {
    const destSlug = this.mapDestToSlug(apiIti.destination);
    const destLabel = apiIti.destination || this.mapSlugToDestLabel(destSlug);

    // Case 1: apiIti already contains structured days array (e.g. from localStorage or active draft)
    if (Array.isArray(apiIti.days) && apiIti.days.length > 0 && typeof apiIti.days[0] === 'object') {
      const normalizedDays = apiIti.days.map((dayObj: any, dIdx: number) => {
        const rawActs = Array.isArray(dayObj.activities) ? dayObj.activities : [];
        const normalizedActs = rawActs.map((act: any) => {
          let lat = act.lat;
          let lng = act.lng;
          if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || lat < 5 || lat > 30 || lng < 100 || lng > 115) {
            const coords = this.getCoordinatesForPlace(act.name || act.title, destSlug);
            lat = coords.lat;
            lng = coords.lng;
          }
          if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || lat < 5 || lat > 30 || lng < 100 || lng > 115) {
            lat = undefined;
            lng = undefined;
          }
          const title = act.title || act.name || "Hoạt động";
          let type = act.type || 'attraction';
          const isShared = act.is_shared !== undefined ? (act.is_shared === true || act.isShared === true) : this.checkIfSharedByDefault(title, type);
          const isPartner = act.is_partner !== undefined ? act.is_partner : (act.isPartner !== undefined ? act.isPartner : false);
          return {
            id: act.id || ('act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
            time: this.normalizeTimeTo24h(act.time || "08:00"),
            title: title,
            name: title,
            type: type,
            cost: Number(act.cost) || 0,
            priceUnknown: !!act.priceUnknown,
            note: act.note || '',
            carbon: Number(act.carbon) || 0,
            is_shared: isShared,
            lat: lat,
            lng: lng,
            img: act.img || (act.photos && act.photos[0]) || null,
            photos: act.photos || (act.img ? [act.img] : []),
            address: act.address || null,
            is_partner: isPartner,
            isPartner: isPartner,
            rating: act.rating || null,
            reviews: act.reviews || null,
            hasTimeConflict: !!act.hasTimeConflict,
            conflictReason: act.conflictReason || ''
          };
        });

        // Ensure chronological sorting
        normalizedActs.sort((a: any, b: any) => {
          return this.timeToMinutes(a.time || "00:00") - this.timeToMinutes(b.time || "00:00");
        });

        return {
          dayNum: dayObj.dayNum || (dIdx + 1),
          title: dayObj.title || `Ngày ${dIdx + 1}`,
          activities: normalizedActs,
          legTransports: dayObj.legTransports || {},
          legNotes: dayObj.legNotes || {}
        };
      });

      return {
        id: apiIti.id,
        title: apiIti.title || apiIti.name || "Lịch trình tự thiết kế",
        dest: destSlug,
        destLabel: destLabel,
        destination: destLabel,
        days: normalizedDays,
        status: apiIti.status || 'draft',
        deposit_deadline: apiIti.deposit_deadline || null,
        imageUrl: apiIti.imageUrl || apiIti.image_url || null,
        collaborators: apiIti.collaborators || [],
        generalNotes: apiIti.generalNotes || '',
        checklist: Array.isArray(apiIti.checklist) ? apiIti.checklist : []
      };
    }

    // Case 2: apiIti from backend with daysData / days_data
    const days: any[] = [];
    const rawDaysData = apiIti.daysData || apiIti.days_data || apiIti.data || [];
    const daysCount = typeof apiIti.days === 'number' ? apiIti.days : (rawDaysData.length || 1);

    for (let i = 0; i < daysCount; i++) {
      const activities: any[] = [];
      const rawActivities = rawDaysData[i] ? rawDaysData[i] : [];

      rawActivities.forEach((act: any) => {
        let lat = act.lat;
        let lng = act.lng;

        // Handle invalid coordinates (null, undefined, NaN, 0, or outside Vietnam)
        if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || lat < 5 || lat > 30 || lng < 100 || lng > 115) {
          const coords = this.getCoordinatesForPlace(act.name || act.title, destSlug);
          lat = coords.lat;
          lng = coords.lng;
        }

        // Ultimate fallback: Do not show on map if invalid or not found
        if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || lat < 5 || lat > 30 || lng < 100 || lng > 115) {
          lat = undefined;
          lng = undefined;
        }

        const title = act.title || act.name || "Hoạt động";

        let type = act.type;
        if (!type) {
          const icon = act.icon || '';
          if (icon.includes("building") || icon.includes("house")) type = "lodging";
          else if (icon.includes("cup") || icon.includes("utensils")) type = "dining";
          else if (icon.includes("car") || icon.includes("scooter") || icon.includes("bus") || icon.includes("bicycle")) type = "transport";
          else type = "attraction";
        }

        const isShared = act.is_shared !== undefined ? (act.is_shared === true || act.isShared === true) : this.checkIfSharedByDefault(title, type);
        const isPartner = act.is_partner !== undefined ? act.is_partner : (act.isPartner !== undefined ? act.isPartner : false);
        activities.push({
          id: act.id || ('act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
          time: this.normalizeTimeTo24h(act.time || "08:00"),
          title: title,
          name: title,
          type: type,
          cost: act.cost || 0,
          carbon: act.carbon || 0,
          is_shared: isShared,
          lat: lat,
          lng: lng,
          img: act.img || (act.photos && act.photos[0]) || null,
          photos: act.photos || (act.img ? [act.img] : []),
          address: act.address || null,
          is_partner: isPartner,
          isPartner: isPartner,
          priceUnknown: !!act.priceUnknown,
          note: act.note || '',
          rating: act.rating || null,
          reviews: act.reviews || null
        });
      });

      // Sort activities chronologically by time
      activities.sort((a: any, b: any) => {
        const timeA = this.timeToMinutes(a.time || "00:00");
        const timeB = this.timeToMinutes(b.time || "00:00");
        return timeA - timeB;
      });

      days.push({
        dayNum: i + 1,
        title: `Ngày ${i + 1}`,
        activities: activities
      });
    }

    if (days.length === 0) {
      days.push({
        dayNum: 1,
        title: 'Ngày 1',
        activities: []
      });
    }

    return {
      id: apiIti.id,
      title: apiIti.name || apiIti.title || "Lịch trình tự thiết kế",
      dest: destSlug,
      destLabel: destLabel,
      destination: destLabel,
      days: days,
      status: apiIti.status || 'draft',
      deposit_deadline: apiIti.deposit_deadline || null,
      imageUrl: apiIti.imageUrl || apiIti.image_url || null,
      collaborators: apiIti.collaborators || []
    };
  }

  private convertEditorToApiItinerary(editorIti: any): Itinerary {
    const daysData: any[][] = [];
    let totalCost = 0;
    let totalCarbon = 0;

    editorIti.days.forEach((day: any) => {
      const dayActivities: any[] = [];
      day.activities.forEach((act: any) => {
        totalCost += act.cost;
        totalCarbon += act.carbon;

        let icon = "bi-tree-fill";
        if (act.type === "lodging") icon = "bi-house-door-fill";
        else if (act.type === "dining") icon = "bi-cup-hot-fill";
        else if (act.type === "transport") icon = "bi-scooter";

        const isPartner = act.is_partner !== undefined ? act.is_partner : (act.isPartner !== undefined ? act.isPartner : false);
        dayActivities.push({
          id: act.id || ("act_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)),
          time: act.time,
          title: act.title || act.name,
          name: act.title || act.name,
          cost: act.cost,
          carbon: act.carbon,
          icon: icon,
          type: act.type,
          lat: act.lat,
          lng: act.lng,
          img: act.img || (act.photos && act.photos[0]) || null,
          photos: act.photos || (act.img ? [act.img] : []),
          address: act.address || null,
          is_partner: isPartner,
          isPartner: isPartner,
          note: act.note || null,
          rating: act.rating || null,
          reviews: act.reviews || null,
          priceUnknown: !!act.priceUnknown
        });
      });
      daysData.push(dayActivities);
    });

    const user = this.currentUser || this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || null) : null;

    return {
      id: editorIti.id || ("iti_" + Date.now()),
      name: editorIti.title,
      user_id: userId,
      destination: editorIti.destLabel,
      days: editorIti.days.length,
      totalCost: totalCost,
      totalCarbon: totalCarbon,
      daysData: daysData,
      status: editorIti.status || 'draft',
      deposit_deadline: editorIti.deposit_deadline || null,
      imageUrl: editorIti.imageUrl || null
    };
  }

  public async saveItineraryToDb() {
    if (!this.activeItinerary) return;
    this.isAutoSaving = true;
    this.cdr.detectChanges();

    // 1. If Guest (unauthenticated visitor): Save working draft to localStorage!
    // Never pollute backend DB or overwrite master templates like SCHHA011.
    if (!this.currentUser) {
      try {
        localStorage.setItem(`greensteps_guest_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
        const guestIds: string[] = JSON.parse(localStorage.getItem('greensteps_guest_itinerary_ids') || '[]');
        if (!guestIds.includes(this.activeItinerary.id)) {
          guestIds.unshift(this.activeItinerary.id);
          localStorage.setItem('greensteps_guest_itinerary_ids', JSON.stringify(guestIds));
        }
      } catch (e) {
        console.warn('Could not persist guest draft in localStorage:', e);
      }
      setTimeout(() => {
        this.isAutoSaving = false;
        this.cdr.detectChanges();
      }, 500);
      return;
    }

    // 2. Authenticated: serialize saves so parallel transactions never collide (MongoDB WriteConflict)
    this.lastLocalEditAt = Date.now();
    if (this.saveInFlight) {
      this.savePending = true;
      while (this.saveInFlight) {
        await new Promise(r => setTimeout(r, 150));
      }
      return;
    }
    this.saveInFlight = true;
    try {
      do {
        this.savePending = false;
        const apiIti = this.convertEditorToApiItinerary(this.activeItinerary);
        try {
          try {
            localStorage.setItem(`greensteps_user_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
          } catch (le) { }
          await this.apiService.saveItinerary(apiIti);
        } catch (e) {
          console.warn('Save failed, will retry with latest state:', e);
          await new Promise(r => setTimeout(r, 400));
          this.savePending = true;
          if (++this.saveRetryCount > 3) { this.savePending = false; }
        }
      } while (this.savePending);
      this.saveRetryCount = 0;
    } finally {
      this.saveInFlight = false;
      this.lastLocalEditAt = Date.now();
      setTimeout(() => {
        this.isAutoSaving = false;
        this.cdr.detectChanges();
      }, 400);
    }
  }

  private saveInFlight = false;
  private savePending = false;
  private saveRetryCount = 0;
  private lastLocalEditAt = 0;

  // Helper: Normalize carbon format to prevent double minus (--0.8 kg)
  public formatCarbon(carbon: any): string {
    if (carbon === undefined || carbon === null) return '-0.0 kg CO₂';
    const val = Math.abs(Number(carbon) || 0);
    return `-${val.toFixed(1).replace(/\.0$/, '')} kg CO₂`;
  }

  private favoritesSubscription?: Subscription;
  public loadFavoritePlaces() {
    if (!this.favoritesService) return;
    this.favoritesSubscription?.unsubscribe();
    this.favoritesSubscription = this.favoritesService.items$.subscribe(items => {
      this.favoritePlaces = items.filter(item => item.available && ['place', 'service'].includes(item.target_type)).map(item => ({
        name: item.name, title: item.name, type: item.place_type || 'explore', category: item.target_type === 'service' ? 'Dịch vụ' : 'Địa điểm',
        cost: item.price || 0, carbon: 0, img: item.image, lat: item.lat, lng: item.lng,
        _favoriteType: item.target_type, _favoriteId: item.target_id
      }));
      this.cdr.markForCheck();
    });
  }
  public isPlaceFavorite(place: any): boolean {
    if (!this.favoritesService || !place) return false;
    const ref = this.favoritesService.placeRef(place);
    return this.favoritesService.isSaved(ref.type, ref.id);
  }
  public async toggleFavoritePlace(place: any, event?: Event) {
    event?.stopPropagation();
    if (!place || !this.favoritesService) return;
    try {
      const ref = this.favoritesService.placeRef({ ...place, img: place.img || this.getPlacePlaceholderImage(place.name || place.title) });
      if (await this.favoritesService.toggle(ref)) this.showAlert(this.favoritesService.isSaved(ref.type, ref.id) ? 'Đã lưu vào Địa điểm yêu thích.' : 'Đã bỏ khỏi Địa điểm yêu thích.', 'success');
    } catch (error) { this.showAlert(this.favoritesService.message(error), 'error'); }
    this.cdr.markForCheck();
  }
  public async removeFavoritePlace(index: number, event?: Event) {
    event?.stopPropagation(); const place = this.favoritePlaces[index];
    if (!place || !this.favoritesService) return;
    try { await this.favoritesService.setSaved(place._favoriteType, place._favoriteId, false); } catch (error) { this.showAlert(this.favoritesService.message(error), 'error'); }
    this.cdr.markForCheck();
  }
  public readonly persistFavoriteItinerary = async () => {
    if (!this.activeItinerary || !this.currentUser) return;
    if (!await this.apiService.saveItinerary(this.convertEditorToApiItinerary(this.activeItinerary))) throw new Error('Không thể lưu lịch trình. Vui lòng thử lại.');
  };

  // Smart Scheduler Math & Validation
  public getDwellMinutesForType(type: string): number {
    switch (type) {
      case 'dining': return 60;
      case 'cafe': return 45;
      case 'lodging': return 30;
      case 'attraction':
      case 'explore':
      default: return 90;
    }
  }

  public getEstimatedTransitMinutes(fromAct?: any, toAct?: any, legIdx?: number): number {
    if (legIdx !== undefined && this.routeLegs[legIdx]?.durationMin) {
      return Math.max(5, Math.round(this.routeLegs[legIdx].durationMin));
    }
    if (fromAct?.lat && fromAct?.lng && toAct?.lat && toAct?.lng) {
      const dKm = this.getHaversineDistanceKm(fromAct.lat, fromAct.lng, toAct.lat, toAct.lng);
      return Math.max(10, Math.round((dKm / 30) * 60 + 5)); // 30km/h urban speed + 5 min buffer
    }
    return 15;
  }

  private getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public timeToMinutes(timeStr: string): number {
    if (!timeStr) return 8 * 60;
    const str = String(timeStr).trim().toUpperCase();
    const isPm = str.includes('PM') || str.includes('CH');
    const isAm = str.includes('AM') || str.includes('SA');
    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 8 * 60;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (isPm && h < 12) h += 12;
    else if (isAm && h === 12) h = 0;
    return h * 60 + m;
  }

  public minutesToTime(mins: number): string {
    const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  public normalizeTimeTo24h(timeStr: string): string {
    if (!timeStr) return "08:00";
    return this.minutesToTime(this.timeToMinutes(timeStr));
  }

  public checkTimeConflicts(dayIdx: number = this.activeDayIdx) {
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) {
      this.hasAnyTimeConflict = false;
      return;
    }
    const activities = this.activeItinerary.days[dayIdx].activities || [];
    let anyConflict = false;

    for (let i = 0; i < activities.length; i++) {
      const curr = activities[i];
      if (i === 0) {
        curr.hasTimeConflict = false;
        curr.conflictReason = null;
        continue;
      }

      const prev = activities[i - 1];
      const prevMins = this.timeToMinutes(prev.time);
      const currMins = this.timeToMinutes(curr.time);
      const dwellMins = this.getDwellMinutesForType(prev.type);
      const transitMin = this.getEstimatedTransitMinutes(prev, curr, i - 1);
      const minRequiredGap = dwellMins + transitMin;

      if (currMins <= prevMins) {
        curr.hasTimeConflict = true;
        curr.conflictReason = `Giờ bắt đầu (${curr.time}) trùng hoặc diễn ra trước điểm trước (${prev.time})`;
        anyConflict = true;
      } else if (currMins - prevMins < minRequiredGap) {
        curr.hasTimeConflict = true;
        curr.conflictReason = `Khoảng cách giờ quá ngắn (${currMins - prevMins} phút). Cần tối thiểu ~${minRequiredGap} phút (${dwellMins}p trải nghiệm + ${transitMin}p đi lại)`;
        anyConflict = true;
      } else {
        curr.hasTimeConflict = false;
        curr.conflictReason = null;
      }
    }

    this.hasAnyTimeConflict = anyConflict;
    this.cdr.detectChanges();
  }

  public autoAdjustIllogicalTimes(dayIdx: number = this.activeDayIdx) {
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) return;
    const activities = this.activeItinerary.days[dayIdx].activities || [];
    if (activities.length <= 1) return;

    for (let i = 1; i < activities.length; i++) {
      const prev = activities[i - 1];
      const curr = activities[i];
      const prevMins = this.timeToMinutes(prev.time);
      const dwellMins = this.getDwellMinutesForType(prev.type);
      const transitMin = this.getEstimatedTransitMinutes(prev, curr, i - 1);
      const minRequiredGap = dwellMins + transitMin;
      const currMins = this.timeToMinutes(curr.time);

      if (currMins <= prevMins || currMins - prevMins < minRequiredGap || curr.hasTimeConflict) {
        curr.time = this.minutesToTime(prevMins + minRequiredGap);
        curr.hasTimeConflict = false;
        curr.conflictReason = null;
      }
    }
    this.checkTimeConflicts(dayIdx);
    this.scheduleDeferredUpdates();
    this.showAlert('Đã tự động căn chỉnh lại mốc giờ chuẩn xác cho toàn bộ các điểm dừng!', 'success');
    this.cdr.detectChanges();
  }

  public sortCurrentDayByTime() {
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[this.activeDayIdx]) return;
    this.sortActivitiesByTime(this.activeDayIdx);
    this.checkTimeConflicts(this.activeDayIdx);
    this.scheduleDeferredUpdates();
    this.showAlert('Đã sắp xếp lại thứ tự các điểm theo trình tự thời gian!', 'success');
    this.cdr.detectChanges();
  }

  public fixSingleActivityTime(idx: number, event?: Event, dayIdx: number = this.activeDayIdx) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) return;
    const activities = this.activeItinerary.days[dayIdx].activities || [];
    if (idx <= 0 || idx >= activities.length) return;

    const prev = activities[idx - 1];
    const curr = activities[idx];
    const prevMins = this.timeToMinutes(prev.time);
    const dwellMins = this.getDwellMinutesForType(prev.type);
    const transitMin = this.getEstimatedTransitMinutes(prev, curr, idx - 1);
    const minRequiredGap = dwellMins + transitMin;
    const sensibleMins = prevMins + minRequiredGap;

    curr.time = this.minutesToTime(sensibleMins);
    curr.hasTimeConflict = false;
    curr.conflictReason = null;

    // Check cascade for subsequent activities
    for (let j = idx + 1; j < activities.length; j++) {
      const p = activities[j - 1];
      const c = activities[j];
      const pMins = this.timeToMinutes(p.time);
      const dMins = this.getDwellMinutesForType(p.type);
      const tMins = this.getEstimatedTransitMinutes(p, c, j - 1);
      const reqGap = dMins + tMins;
      const cMins = this.timeToMinutes(c.time);
      if (cMins - pMins < reqGap) {
        c.time = this.minutesToTime(pMins + reqGap);
      }
    }

    this.checkTimeConflicts(dayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.cdr.detectChanges();
  }

  public hasAnyConflictInEntireItinerary(): boolean {
    if (!this.activeItinerary || !this.activeItinerary.days) return false;
    let foundConflict = false;
    for (let d = 0; d < this.activeItinerary.days.length; d++) {
      this.checkTimeConflicts(d);
      const acts = this.activeItinerary.days[d]?.activities || [];
      if (acts.some((act: any) => act.hasTimeConflict)) {
        foundConflict = true;
      }
    }
    // Return check to currently active day
    this.checkTimeConflicts(this.activeDayIdx);
    return foundConflict;
  }

  public highlightFirstConflict() {
    if (!this.activeItinerary || !this.activeItinerary.days) return;
    for (let d = 0; d < this.activeItinerary.days.length; d++) {
      const acts = this.activeItinerary.days[d]?.activities || [];
      const conflictIdx = acts.findIndex((act: any) => act.hasTimeConflict);
      if (conflictIdx !== -1) {
        if (this.activeDayIdx !== d) {
          this.switchActiveDay(d);
        }
        setTimeout(() => {
          const targetEls = document.querySelectorAll('.timeline-item');
          const targetEl = targetEls[conflictIdx] as HTMLElement;
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('conflict-shake-focus');
            setTimeout(() => targetEl.classList.remove('conflict-shake-focus'), 1800);
          }
        }, 200);
        break;
      }
    }
  }

  public copyBookingCode() {
    if (this.createdBookingCode) {
      navigator.clipboard.writeText(this.createdBookingCode);
      this.showAlert('Đã sao chép mã đơn hàng: ' + this.createdBookingCode, 'success');
    }
  }

  public goToBookingLookup() {
    this.isBookingSuccessModalOpen = false;
    this.router.navigate(['/booking-lookup'], { queryParams: { code: this.createdBookingCode } });
  }

  public sortActivitiesByTime(dayIdx: number) {
    if (!this.activeItinerary || !this.activeItinerary.days[dayIdx]) return;
    this.activeItinerary.days[dayIdx].activities.sort((a: any, b: any) => {
      const timeA = this.timeToMinutes(a.time || "00:00");
      const timeB = this.timeToMinutes(b.time || "00:00");
      return timeA - timeB;
    });
  }

  public async onActivityTimeChanged(act?: any) {
    if (act) {
      act.is_custom_time = true;
    }
    this.checkTimeConflicts(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    await this.saveItineraryToDb();
  }

  private async loadItineraryToEditor(tourId: string) {
    const cleanId = (tourId || '').replace('iti_', '');
    if (this.activeItinerary && (this.activeItinerary.id === tourId || this.activeItinerary.id === cleanId || this.activeItinerary.id === `iti_${cleanId}`)) {
      this.isLoadingEditor = false;
      this.cdr.detectChanges();
      return;
    }

    const idVariants = [tourId, `iti_${cleanId}`, cleanId].filter(Boolean);

    // 0. Check URL self-contained share snapshot (?s=...) for 0ms cross-IP instant rendering
    const snapParam = this.route.snapshot.queryParamMap.get('s');
    if (snapParam) {
      const snapIti = this.decodeShareSnapshot(snapParam);
      if (snapIti) {
        this.isSampleItinerary = false;
        this.openEditorWithItinerary(snapIti);
        // Hydrate latest version from backend in background
        this.apiService.getItinerary(tourId, true).then(custom => {
          if (custom && Array.isArray(custom.daysData) && custom.daysData.some((d: any) => d?.length > 0)) {
            const fresh = this.convertApiToEditorItinerary(custom);
            this.openEditorWithItinerary(fresh);
          }
        }).catch(() => { });
        return;
      }
    }

    // 1. Check local working draft across variants
    for (const variant of idVariants) {
      try {
        const rawDraft = localStorage.getItem(`greensteps_user_draft_${variant}`) ||
          localStorage.getItem(`greensteps_guest_draft_${variant}`) ||
          localStorage.getItem(`greensteps_draft_${variant}`);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          if (parsed) {
            if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
              parsed.days = [{ dayNum: 1, title: 'Ngày 1', activities: [] }];
            }
            this.isSampleItinerary = variant.startsWith('SCH');
            this.openEditorWithItinerary(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn('Error reading local working draft:', e);
      }
    }

    // 2. Check if already loaded in savedItineraries memory list
    if (this.savedItineraries && this.savedItineraries.length > 0) {
      const foundInList = this.savedItineraries.find((x: any) => idVariants.includes(x.id));
      if (foundInList) {
        this.isSampleItinerary = false;
        const cloned = this.convertApiToEditorItinerary(foundInList);
        this.openEditorWithItinerary(cloned);
        return;
      }
    }

    if (tourId === 'new') {
      this.isSampleItinerary = false;
      this.isLoadingEditor = false;
      this.openCreateNewModal();
      return;
    }

    // 3. Try loading custom itinerary from backend using all variants (bypass cache for fresh shared data)
    for (const variant of idVariants) {
      try {
        const custom = await this.apiService.getItinerary(variant, true);
        if (custom) {
          this.isSampleItinerary = false;
          const cloned = this.convertApiToEditorItinerary(custom);
          this.openEditorWithItinerary(cloned);
          return;
        }
      } catch (err) { }
    }

    // 4. Load preset tours
    for (const variant of idVariants) {
      try {
        const preset = await this.apiService.getPresetTour(variant);
        if (preset) {
          this.isSampleItinerary = true;
          const cloned = this.convertApiToEditorItinerary(preset);
          cloned.title = preset.title;
          this.openEditorWithItinerary(cloned);
          return;
        }
      } catch (err) { }
    }

    // 4b. Deep scan all localStorage keys for any partial matches
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (idVariants.some(v => key.includes(v))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.days || parsed.daysData || parsed.title || parsed.name)) {
              this.isSampleItinerary = false;
              const converted = this.convertApiToEditorItinerary(parsed);
              this.openEditorWithItinerary(converted);
              return;
            }
          }
        }
      }
    } catch (e) { }

    // 5. If activeItinerary is already in place, do not show false alert
    if (this.activeItinerary) {
      this.isLoadingEditor = false;
      this.cdr.detectChanges();
      return;
    }

    // Graceful fallback: initialize an editable schedule draft so user is NEVER dead-ended!
    this.isLoadingEditor = false;
    const fallbackTour = {
      id: tourId,
      title: "Lịch trình tùy chỉnh của tôi",
      dest: "da-lat",
      destLabel: "Đà Lạt",
      days: [{ dayNum: 1, title: "Ngày 1", activities: [] }]
    };
    this.openEditorWithItinerary(fallbackTour);
    this.showAlert('Đã khởi tạo bản soạn thảo cho lịch trình này. Bạn có thể tự do thêm điểm đến.', 'info');
    this.cdr.detectChanges();
  }

  private openEditorWithItinerary(itinerary: any) {
    this.activeItinerary = itinerary;
    this.ensureItineraryCoordinates();
    this.activeDayIdx = 0;
    this.checkTimeConflicts(0);

    this.recalculateMetrics();

    // Load dynamic suggestions from backend
    this.loadDynamicRecommendations();

    // Fetch all destination services for local lookup
    const destLabel = itinerary.destLabel || this.mapSlugToDestLabel(itinerary.dest);
    this.apiService.getServicesByDestination(destLabel).then(services => {
      this.localServices = services || [];
    });

    // Defer Map initialization to let DOM render
    setTimeout(() => {
      this.initUniversalMap();
      this.isLoadingEditor = false;
      this.cdr.detectChanges();
    }, 150);

    // Auto-join collaborator if user is accessing shared itinerary
    this.checkAndJoinCollaborator(itinerary);

    // Start silent background synchronization polling
    this.startBackgroundSync();
  }

  private async checkAndJoinCollaborator(itinerary: any) {
    if (!itinerary || !itinerary.id || String(itinerary.id).startsWith('SCH-') || this.isSampleItinerary) return;
    const isJoinIntent = this.route.snapshot.queryParamMap.has('join') || this.route.snapshot.queryParamMap.has('collab');
    const senderName = this.route.snapshot.queryParamMap.get('senderName');
    const user = this.authService.getCurrentUser();

    if (!user) {
      if (isJoinIntent) {
        this.showAlert(
          `Bạn được ${senderName || 'bạn bè'} mời cùng tham gia chỉnh sửa và thanh toán lịch trình này! Vui lòng đăng nhập để hệ thống nhận diện tài khoản của bạn nhé.`,
          'info',
          () => { this.loginModalService.open(); }
        );
      }
      return;
    }

    const currentUserId = user.id || (user as any)._id;
    if (!currentUserId) return;

    const creatorId = itinerary.user_id || itinerary.userId;
    const isOwner = creatorId && String(creatorId) === String(currentUserId);
    const alreadyInCollabs = Array.isArray(itinerary.collaborators) && itinerary.collaborators.some((c: any) => String(c.id) === String(currentUserId));

    if (!alreadyInCollabs || isJoinIntent) {
      try {
        const cleanId = String(itinerary.id).replace(/^iti_/, '');
        const res = await this.apiService.joinItinerary(cleanId, currentUserId);
        if (res && res.success && Array.isArray(res.collaborators)) {
          if (this.activeItinerary) {
            this.activeItinerary.collaborators = res.collaborators;
            this.cdr.detectChanges();
          }
          if (isJoinIntent && !isOwner) {
            this.showAlert(`Bạn đã tham gia cùng chỉnh sửa lịch trình "${itinerary.title || itinerary.name || 'này'}" thành công!`, 'success');
          }
        }
      } catch (e) {
        console.warn('Auto join collaborator notice:', e);
      }
    }
  }

  public getVisibleCollaborators(): any[] {
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. Current User presence
    const user = this.authService.getCurrentUser();
    if (user) {
      const myId = String(user.id || (user as any)._id || 'me');
      seen.add(myId);
      list.push({
        id: myId,
        fullname: user.fullname || user.username || 'Bạn',
        username: user.username,
        avatarUrl: user.avatarUrl || (user as any).avatar_url || ''
      });
    }

    // 2. Sender / inviter presence from query param if opened from invite link
    const senderName = this.route.snapshot.queryParamMap.get('senderName');
    if (senderName && (!user || (user.fullname !== senderName && user.username !== senderName))) {
      seen.add('sender_' + senderName);
      list.push({
        id: 'sender_' + senderName,
        fullname: senderName,
        username: senderName,
        avatarUrl: ''
      });
    }

    // 3. Database synced collaborators from activeItinerary
    if (this.activeItinerary && Array.isArray(this.activeItinerary.collaborators)) {
      for (const col of this.activeItinerary.collaborators) {
        const id = String(col.id || col.username || col.fullname);
        if (!seen.has(id)) {
          seen.add(id);
          list.push(col);
        }
      }
    }

    // 4. Creator / Host if different from current user
    if (this.activeItinerary) {
      const ownerId = String(this.activeItinerary.user_id || this.activeItinerary.userId || '');
      if (ownerId && !seen.has(ownerId)) {
        seen.add(ownerId);
        list.push({
          id: ownerId,
          fullname: this.activeItinerary.author || this.activeItinerary.creatorName || 'Trưởng nhóm',
          username: this.activeItinerary.author || 'TruongNhom',
          avatarUrl: this.activeItinerary.creatorAvatar || '',
          isOwner: true
        });
      }
    }

    return list;
  }

  public async loadDynamicRecommendations() {
    if (!this.activeItinerary) return;
    const destLabel = this.activeItinerary.destLabel || this.activeItinerary.destination || this.mapSlugToDestLabel(this.activeItinerary.dest) || 'Đà Lạt';
    try {
      // Query only services matching the destination from the database
      const services = await this.apiService.getServicesByDestination(destLabel);

      let recsList: any[] = [];
      if (services && services.length > 0) {
        recsList = services.map(srv => {
          let recType = srv.type;
          if (recType === 'stay' || recType === 'lodging') recType = 'lodging';
          else if (recType === 'food' || recType === 'dining') recType = 'dining';

          const isPartner = srv.is_partner === true || srv.provider !== undefined || !!srv.partner_id;
          return {
            id: srv.id, service_id: srv.id,
            name: srv.name || srv.name_service,
            category: srv.current_data?.category || (srv.type === 'food' || srv.type === 'dining' ? 'Ăn uống' : srv.type === 'stay' || srv.type === 'lodging' ? 'Lưu trú' : 'Khám phá'),
            type: recType,
            cost: srv.cost,
            carbon: srv.carbon,
            img: srv.current_data?.img || this.getServiceFallbackImage(srv.type),
            lat: srv.current_data?.lat,
            lng: srv.current_data?.lng,
            is_partner: isPartner,
            isPartner: isPartner,
            badges: Array.from(new Set(Array.isArray(srv.badges) ? srv.badges : [srv.badges || 'green'])).filter(Boolean).slice(0, 1)
          };
        });
        // Always prioritize GreenSteps Partner services at the top of recommendations!
        recsList.sort((a, b) => (b.is_partner ? 1 : 0) - (a.is_partner ? 1 : 0));
      }

      this.allCombinedRecs = recsList;
    } catch (e) {
      console.error('Error loading recommendations from database', e);
      this.allCombinedRecs = [];
    }

    this.filterOutCurrentActivities();
    this.cdr.detectChanges();
    this.plotMapMarkers();
  }

  public setCategoryFilter(category: string) {
    this.activeCategoryFilter = category;
    this.filterOutCurrentActivities();
    this.cdr.detectChanges();
  }

  public filterOutCurrentActivities() {
    if (!this.activeItinerary) return;
    const currentActivityNames = new Set<string>();
    this.activeItinerary.days.forEach((day: any) => {
      if (day.activities) {
        day.activities.forEach((act: any) => {
          const name = (act.name || act.title || '').trim().toLowerCase();
          if (name) {
            currentActivityNames.add(name);
          }
        });
      }
    });

    this.dynamicRecs = this.allCombinedRecs.filter(rec => {
      const recName = (rec.name || '').trim().toLowerCase();
      for (const currentName of currentActivityNames) {
        if (recName === currentName || recName.includes(currentName) || currentName.includes(recName)) {
          return false; // hide duplicate
        }
      }
      if (this.activeCategoryFilter !== 'all') {
        const cat = this.activeCategoryFilter;
        if (cat === 'attraction' && rec.type !== 'explore' && rec.type !== 'attraction') return false;
        if (cat === 'dining' && rec.type !== 'dining' && rec.type !== 'food') return false;
        if (cat === 'cafe' && rec.type !== 'cafe' && !(rec.name || '').toLowerCase().includes('cafe') && !(rec.name || '').toLowerCase().includes('cà phê')) return false;
        if (cat === 'lodging' && rec.type !== 'lodging' && rec.type !== 'stay') return false;
        if (cat === 'transport' && rec.type !== 'transport' && !(rec.name || '').toLowerCase().includes('xe')) return false;
      }
      return true; // keep
    });
  }

  private getServiceFallbackImage(type: string): string {
    if (type === 'stay' || type === 'lodging') {
      return 'image/greensteps/da-lat/da-lat-nghi-duong-ven-ho-01.jpg';
    } else if (type === 'food' || type === 'dining' || type === 'cafe') {
      return 'image/greensteps/da-nang-hoi-an/hoi-an-ca-phe-dia-phuong-01.jpg';
    } else if (type === 'transport') {
      return 'image/greensteps/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg';
    }
    return 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg';
  }

  public switchActiveDay(dayIdx: number) {
    this.activeDayIdx = dayIdx;
    this.plotMapMarkers(true);
  }

  public getDayPreviewText(day: any): string {
    if (!day || !day.activities || day.activities.length === 0) {
      return 'Chưa có địa điểm';
    }
    return day.activities.slice(0, 3).map((a: any) => a.title).join(' • ');
  }

  public async addDayToItinerary() {
    if (!this.activeItinerary) return;
    if (!this.activeItinerary.days) {
      this.activeItinerary.days = [];
    }
    const newDayNum = this.activeItinerary.days.length + 1;
    this.activeItinerary.days.push({
      dayNum: newDayNum,
      title: "Ngày " + newDayNum,
      activities: []
    });
    this.activeDayIdx = newDayNum - 1;

    this.checkTimeConflicts(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.showAlert(`Đã thêm Ngày ${newDayNum} vào lịch trình!`, 'success');
    this.cdr.detectChanges();
  }

  public async deleteDay(idx: number, event: MouseEvent) {
    event.stopPropagation();
    if (!this.activeItinerary || this.activeItinerary.days.length <= 1) return;

    const confirmed = await this.showConfirm('Xóa ngày', `Bạn có chắc chắn muốn xóa Ngày ${idx + 1} khỏi lịch trình không?`);
    if (!confirmed) return;

    this.activeItinerary.days.splice(idx, 1);

    // Re-index remaining days
    this.activeItinerary.days.forEach((day: any, i: number) => {
      day.dayNum = i + 1;
      day.title = `Ngày ${i + 1}`;
    });

    // Reset activeDayIdx if out of range
    if (this.activeDayIdx >= this.activeItinerary.days.length) {
      this.activeDayIdx = this.activeItinerary.days.length - 1;
    } else if (this.activeDayIdx === idx && this.activeDayIdx > 0) {
      this.activeDayIdx = idx - 1;
    }

    this.plotMapMarkers();
    this.recalculateMetrics();
    await this.saveItineraryToDb();
  }

  public getActivityTypeLabel(type: string, title?: string): string {
    const t = (type || '').toLowerCase();
    const name = (title || '').toLowerCase();
    if (t === "lodging" || t === "stay" || /homestay|hotel|khách sạn|resort|nhà nghỉ|villa|nghỉ dưỡng|chỗ ở/.test(name)) return "Lưu trú";
    if (t === "dining" || t === "food" || /quán|nhà hàng|cà phê|cafe|bún|phở|lẩu|cơm|bánh|ẩm thực|ăn uống|món ngon/.test(name)) return "Ẩm thực";
    if (t === "shopping" || /mini go|siêu thị|chợ|tạp hóa|cửa hàng|mua sắm/.test(name)) return "Mua sắm / Siêu thị";
    if (t === "medical" || /bệnh viện|phòng khám|trạm y tế|tiệm thuốc|nha khoa/.test(name)) return "Y tế / Tiện ích";
    if (t === "transport" || /xe điện|xe ghép|bến xe|sân bay|ga tàu|di chuyển|thuê xe/.test(name)) return "Di chuyển";
    return "Tham quan";
  }

  public handleActivityImgError(event: any, act: any) {
    if (event?.target) {
      event.target.src = this.getPlacePlaceholderImage(act?.title || act?.name || '', act?.type, this.activeItinerary?.destLabel || this.activeItinerary?.destination);
    }
  }

  public handleRecImgError(event: any, rec: any) {
    if (event?.target) {
      event.target.src = this.getPlacePlaceholderImage(rec?.name || '', rec?.type, this.activeItinerary?.destLabel || this.activeItinerary?.destination);
    }
  }

  public handleFavImgError(event: any, fav: any) {
    if (event?.target) {
      event.target.src = this.getPlacePlaceholderImage(fav?.name || '', fav?.type, this.activeItinerary?.destLabel || this.activeItinerary?.destination);
    }
  }

  public handlePanelImgError(event: any, panel: any) {
    if (event?.target) {
      event.target.src = this.getPlacePlaceholderImage(panel?.title || panel?.name || '', panel?.type, this.activeItinerary?.destLabel || this.activeItinerary?.destination);
    }
  }

  public async deleteActivity(idx: number) {
    if (!this.activeItinerary) return;
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    activeDay.activities.splice(idx, 1);

    this.checkTimeConflicts(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    this.filterOutCurrentActivities();
    await this.saveItineraryToDb();
  }

  public moveActivity(idx: number, direction: number) {
    if (!this.activeItinerary) return;
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    const targetIdx = idx + direction;

    if (targetIdx < 0 || targetIdx >= activeDay.activities.length) return;

    const temp = activeDay.activities[idx];
    activeDay.activities[idx] = activeDay.activities[targetIdx];
    activeDay.activities[targetIdx] = temp;

    // Swap times
    const tempTime = activeDay.activities[idx].time;
    activeDay.activities[idx].time = activeDay.activities[targetIdx].time;
    activeDay.activities[targetIdx].time = tempTime;

    this.checkTimeConflicts(this.activeDayIdx);
    this.scheduleDeferredUpdates();
    this.cdr.detectChanges();
  }

  private stripVietnameseAccents(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  public onSearchInputKeyup() {
    this.onCustomPlaceTyping();
  }

  public formatPriceOrFree(item: any): string {
    if (item && item.cost !== undefined && item.cost !== null && Number(item.cost) > 0) {
      return new Intl.NumberFormat('vi-VN').format(Number(item.cost)) + '₫';
    }
    const text = `${item?.name || item?.title || ''} ${item?.category || ''} ${item?.type || ''}`.toLowerCase();
    const isCommercial = text.includes('hotel') || text.includes('khách sạn') || text.includes('homestay') ||
      text.includes('resort') || text.includes('villa') || text.includes('nhà nghỉ') ||
      text.includes('quán ăn') || text.includes('nhà hàng') || text.includes('cafe') ||
      text.includes('cà phê') || text.includes('quán nhậu') || text.includes('ẩm thực') ||
      text.includes('nước') || text.includes('công viên nước') || text.includes('khu du lịch') ||
      text.includes('vui chơi') || text.includes('vé');
    if (item?.cost === 0 || !isCommercial) {
      return '0₫ (Miễn phí)';
    }
    return 'Chưa có thông tin về giá';
  }

  public onCustomPlaceTyping() {
    const val = (this.customPlaceTitle || '').trim();
    if (!val || !this.activeItinerary) {
      this.customSearchSuggestions = [];
      return;
    }

    const qNorm = this.stripVietnameseAccents(val);

    // 1. PRIORITY 1: Partner Services & Curated GreenSteps Catalog matching keyword
    const partnerPool = [
      ...(this.localServices || []),
      ...(this.allCombinedRecs || [])
    ];
    const seenTitles = new Set<string>();
    const partnerMatches: any[] = [];

    for (const s of partnerPool) {
      const name = s.name || s.name_service || s.title || '';
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenTitles.has(key)) continue;
      if (this.stripVietnameseAccents(name).includes(qNorm) || this.stripVietnameseAccents(s.address || '').includes(qNorm)) {
        seenTitles.add(key);
        partnerMatches.push({
          name: name,
          name_service: name,
          title: name,
          category: s.type || 'explore',
          cost: s.cost !== undefined ? Number(s.cost) : 0,
          carbon: s.carbon !== undefined ? Number(s.carbon) : 0.8,
          lat: s.lat || (s.current_data && s.current_data.lat) || null,
          lng: s.lng || (s.current_data && s.current_data.lng) || null,
          isLocal: true,
          isPartner: true,
          address: s.address || (this.activeItinerary?.destLabel || 'Việt Nam')
        });
      }
      if (partnerMatches.length >= 4) break;
    }

    this.customSearchSuggestions = partnerMatches;
    this.cdr.detectChanges();

    // 2. PRIORITY 2: Debounced Map Places (Nominatim / Google Places) shown AFTER Partner matches
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(async () => {
      try {
        const destSlug = this.mapDestToSlug(this.activeItinerary.destination);
        const destLabel = this.mapSlugToDestLabel(destSlug);
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(val + ', ' + destLabel)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'GreenSteps/1.0' } });
        const data = await res.json();

        const osmMatches = (data || []).map((r: any) => {
          let placeType = "explore";
          if (r.type === "cafe" || r.type === "restaurant" || r.class === "amenity") {
            placeType = "dining";
          } else if (r.type === "hotel" || r.class === "tourism") {
            placeType = "lodging";
          }
          const title = r.display_name ? r.display_name.split(',')[0] : val;
          const resolved = this.resolvePlaceCost(title, { type: placeType }, null);
          return {
            name: title,
            name_service: title,
            title: title,
            category: placeType,
            cost: resolved.cost,
            priceUnknown: resolved.priceUnknown,
            lat: parseFloat(r.lat) || null,
            lng: parseFloat(r.lon) || null,
            address: r.display_name || '',
            isLocal: false,
            isPartner: false
          };
        });

        const combined = [...partnerMatches];
        osmMatches.forEach((osm: any) => {
          if (!combined.some(c => c.title.toLowerCase() === osm.title.toLowerCase())) {
            combined.push(osm);
          }
        });

        this.customSearchSuggestions = combined.slice(0, 7);
        this.cdr.detectChanges();
      } catch (e) {
        console.warn('Autocomplete suggest error:', e);
      }
    }, 280);
  }

  public selectSearchSuggestion(sug: any) {
    const placeName = sug.title || sug.name || sug.name_service;
    this.customPlaceTitle = placeName;
    this.customSearchSuggestions = [];
    const pType = sug.category || 'explore';
    const resolved = sug.isPartner
      ? { cost: sug.cost !== undefined ? sug.cost : 0, priceUnknown: false }
      : this.resolvePlaceCost(placeName, sug, null);

    this.selectedPlaceDetails = {
      title: placeName,
      type: pType,
      category: this.getCategoryLabel(pType),
      rating: sug.rating || 4.8,
      reviews: sug.reviews || 320,
      address: sug.address || (this.activeItinerary ? this.activeItinerary.destination + ', Việt Nam' : 'Việt Nam'),
      hours: 'Đang mở cửa · Đóng cửa vào 22:00',
      cost: resolved.cost,
      priceUnknown: resolved.priceUnknown,
      isPartner: !!sug.isPartner,
      carbon: sug.carbon || (pType === 'dining' ? 1.2 : (pType === 'lodging' ? 2.5 : 0.8)),
      lat: sug.lat,
      lng: sug.lng,
      img: sug.img || this.getPlacePlaceholderImage(placeName),
      description: sug.description || this.getPlaceWikiDescription(placeName),
      isActivity: false
    };
    this.openGooglePlacePanel(this.selectedPlaceDetails);

    if (sug.lat && sug.lng && this.map) {
      this.map.flyTo([sug.lat, sug.lng], 15, { duration: 0.8 });
      this.clearSearchMarkers();
      const marker = L.marker([sug.lat, sug.lng], {
        icon: L.divIcon({
          html: `<div class="map-leaflet-rec-pin map-leaflet-pin-red-pulse" style="background-color: #EF4444; border: 2.5px solid #FFFFFF; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239,68,68,0.5);"><i class="bi bi-geo-alt-fill" style="font-size: 13px;"></i></div>`,
          className: 'custom-div-icon-click-pin',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(this.map);
      this.searchMarkers.push(marker);
    }
    this.cdr.detectChanges();
  }

  public selectRecommendationForDetails(rec: any) {
    this.selectedPlaceDetails = {
      title: rec.name,
      type: rec.type,
      category: rec.category || this.getCategoryLabel(rec.type),
      rating: rec.rating || 4.8,
      reviews: rec.reviews || 680,
      address: rec.address || (this.activeItinerary ? this.activeItinerary.destination + ', Việt Nam' : 'Việt Nam'),
      hours: 'Đang mở cửa · Đóng cửa vào 21:30',
      cost: rec.cost,
      carbon: rec.carbon,
      lat: rec.lat,
      lng: rec.lng,
      img: rec.img || this.getPlacePlaceholderImage(rec.name),
      description: this.getPlaceWikiDescription(rec.name),
      isActivity: false
    };
    if (rec.lat && rec.lng && this.map) {
      this.map.flyTo([rec.lat, rec.lng], 15, { duration: 0.8 });
    }
    this.cdr.detectChanges();
  }

  public async focusAndRouteToPlace(place: any) {
    if (!place || !place.lat || !place.lng) return;
    const activeDay = this.activeItinerary?.days[this.activeDayIdx];
    const activitiesWithCoords = (activeDay?.activities || []).filter((a: any) => typeof a.lat === 'number' && typeof a.lng === 'number');

    let origin: any = null;
    let originName = '';
    if (activitiesWithCoords.length > 0) {
      const lastAct = activitiesWithCoords[activitiesWithCoords.length - 1];
      if (Math.abs(lastAct.lat - place.lat) > 0.0001 || Math.abs(lastAct.lng - place.lng) > 0.0001) {
        origin = { lat: lastAct.lat, lng: lastAct.lng };
        originName = lastAct.title || lastAct.name || '';
      }
    }
    if (!origin) {
      const destName = this.activeItinerary?.dest || 'Đà Nẵng';
      const center = this.cityCenters[destName] || [15.8801, 108.3380];
      origin = { lat: center[0], lng: center[1] };
      originName = 'Trung tâm ' + destName;
    }

    const destination = { lat: place.lat, lng: place.lng };

    try {
      const routeRes = await this.apiService.computeGoogleRoute(origin, destination);
      if (routeRes && routeRes.success) {
        this.ngZone.run(() => {
          if (this.activeGooglePlacePanel) {
            this.activeGooglePlacePanel.routeInfo = {
              distance: routeRes.distance,
              duration: routeRes.duration,
              steps: []
            };
          }

          // Draw polyline on Google Map
          if (this.isGoogleMaps && this.gmap && routeRes.encodedPolyline) {
            if (this.previewRouteLayer) {
              try { this.previewRouteLayer.setMap(null); } catch (e) { }
            }
            if (google.maps.geometry && google.maps.geometry.encoding) {
              const decodedPath = google.maps.geometry.encoding.decodePath(routeRes.encodedPolyline);
              this.previewRouteLayer = new google.maps.Polyline({
                path: decodedPath,
                strokeColor: '#0E9F6E',
                strokeWeight: 6,
                strokeOpacity: 0.9,
                map: this.gmap
              });
              const bounds = new google.maps.LatLngBounds();
              decodedPath.forEach((pt: any) => bounds.extend(pt));
              this.gmap.fitBounds(bounds);
            }
          }
          this.showAlert(`Chỉ đường Google Routes từ "${originName}" đến "${place.title}": khoảng ${routeRes.distance} (${routeRes.duration})`, 'success');
          this.cdr.detectChanges();
        });
        return;
      }
    } catch (e) {
      console.warn('Google Routes API error:', e);
    }

    if (this.isGoogleMaps && this.gmap) {
      this.gmap.panTo(destination);
      this.gmap.setZoom(16);
    }
  }

  public async addCustomPlaceToActiveDay() {
    const val = this.customPlaceTitle.trim();
    if (!val || !this.activeItinerary) return;

    this.customSearchSuggestions = [];

    // Search in localServices for a match (case-insensitive)
    const match = this.localServices.find(s =>
      (s.name || s.name_service || '').toLowerCase().includes(val.toLowerCase()) ||
      val.toLowerCase().includes((s.name || s.name_service || '').toLowerCase())
    );

    const time = this.getNextSuggestedTime();
    let title = val;
    let type = "explore";
    let cost = 50000;
    let carbon = 3;
    let lat: number | undefined;
    let lng: number | undefined;

    if (match) {
      title = match.name || match.name_service;
      type = match.type || "explore";
      cost = match.cost || 0;
      carbon = match.carbon || 0;
      const meta = match.current_data || {};
      lat = meta.lat || undefined;
      lng = meta.lng || undefined;
    } else {
      lat = undefined;
      lng = undefined;
    }

    // Ultimate fallback: Do not show on map if invalid or not found
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat < 5 || lat > 30 || lng < 100 || lng > 115) {
      lat = undefined;
      lng = undefined;
    }

    const newAct = {
      time: time,
      title: title,
      type: type,
      cost: cost,
      carbon: carbon,
      is_shared: this.checkIfSharedByDefault(title, type),
      lat: lat,
      lng: lng
    };

    this.activeItinerary.days[this.activeDayIdx].activities.push(newAct);
    this.customPlaceTitle = '';

    this.sortActivitiesByTime(this.activeDayIdx);
    this.checkTimeConflicts(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    await this.saveItineraryToDb();
  }

  public async addPoolItemToActiveDay(name: string, type: string, cost: number, carbon: number, lat?: number, lng?: number, img?: string, is_partner?: boolean) {
    console.log("addPoolItemToActiveDay called with:", { name, type, cost, carbon, lat, lng, img, is_partner });
    if (!this.activeItinerary || !name || !name.trim()) {
      console.warn("addPoolItemToActiveDay validation failed, activeItinerary:", this.activeItinerary, "name:", name);
      return;
    }

    let finalLat = lat;
    let finalLng = lng;
    let finalCost = cost;
    let finalCarbon = carbon;
    let finalType = type;

    // Search in localServices for a match if coordinates are not provided
    const match = this.localServices.find(s =>
      (s.name || s.name_service || '').toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes((s.name || s.name_service || '').toLowerCase())
    );

    if (match) {
      if ((finalCost === 0 || isNaN(finalCost)) && match.cost > 0) finalCost = match.cost;
      if ((finalCarbon === 0 || isNaN(finalCarbon)) && match.carbon > 0) finalCarbon = match.carbon;
      if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
        finalType = match.type || type;
        const meta = match.current_data || {};
        finalLat = meta.lat || undefined;
        finalLng = meta.lng || undefined;
      }
    }

    const destSlug = this.activeItinerary.dest || 'da-lat';
    const destLabel = this.activeItinerary.destLabel || this.mapSlugToDestLabel(destSlug);

    // Try samplePlacesRecs mapping
    if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
      const coords = this.getCoordinatesForPlace(name, destSlug);
      finalLat = coords.lat;
      finalLng = coords.lng;
    }

    // Geocoding online fallback
    if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
      const searchQuery = `${name}, ${destLabel}, Việt Nam`;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLng = parseFloat(data[0].lon);
        }
      } catch (e) {
        console.warn("Geocoding fallback failed:", e);
      }
    }

    // Ultimate fallback: Use city center
    if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng) || finalLat < 5 || finalLat > 30 || finalLng < 100 || finalLng > 115) {
      const center = this.cityCenters[destSlug] || [11.9404, 108.4373];
      finalLat = center[0];
      finalLng = center[1];
    }

    const greenMatch = this.findMatchingGreenStepsService(name, finalLat, finalLng);
    const resolvedIsPartner = is_partner !== undefined ? is_partner : (!!greenMatch || !!match);
    const resolvedImg = img || match?.current_data?.img || greenMatch?.current_data?.img || this.getPlacePlaceholderImage(name, finalType, destLabel);

    const newAct: any = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      time: this.getNextSuggestedTime(this.activeDayIdx, finalType, finalLat, finalLng),
      title: name,
      type: finalType,
      cost: finalCost,
      carbon: finalCarbon,
      is_shared: this.checkIfSharedByDefault(name, finalType),
      is_partner: resolvedIsPartner,
      isPartner: resolvedIsPartner,
      img: resolvedImg,
      lat: finalLat,
      lng: finalLng
    };

    this.activeItinerary.days[this.activeDayIdx].activities.push(newAct);

    this.sortActivitiesByTime(this.activeDayIdx);
    this.checkTimeConflicts(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    this.filterOutCurrentActivities();
    await this.saveItineraryToDb();
  }

  public async handleMapClick(lat: number, lng: number) {
    // 1. SMART POI SNAPPING: Check if click is near known spots in our itinerary, local services, or famous POIs
    let matchedSpot: any = null;
    let minDistance = 999999;

    // A. Check activities in current itinerary (all days)
    if (this.activeItinerary && this.activeItinerary.days) {
      this.activeItinerary.days.forEach((day: any, dIdx: number) => {
        (day.activities || []).forEach((act: any, aIdx: number) => {
          if (typeof act.lat === 'number' && typeof act.lng === 'number') {
            const d = Math.hypot(act.lat - lat, act.lng - lng);
            if (d < 0.02 && d < minDistance) { // within ~2 km
              minDistance = d;
              matchedSpot = {
                title: act.title || act.name,
                type: act.type || 'explore',
                category: this.getCategoryLabel(act.type || 'explore'),
                cost: act.cost,
                carbon: act.carbon,
                lat: act.lat,
                lng: act.lng,
                isActivity: (dIdx === this.activeDayIdx),
                index: aIdx
              };
            }
          }
        });
      });
    }

    // B. Check recommendations in allCombinedRecs
    if (!matchedSpot && this.allCombinedRecs && this.allCombinedRecs.length > 0) {
      this.allCombinedRecs.forEach((rec: any) => {
        if (typeof rec.lat === 'number' && typeof rec.lng === 'number') {
          const d = Math.hypot(rec.lat - lat, rec.lng - lng);
          if (d < 0.02 && d < minDistance) {
            minDistance = d;
            matchedSpot = {
              title: rec.name,
              type: rec.type || 'explore',
              category: rec.category || this.getCategoryLabel(rec.type || 'explore'),
              cost: rec.cost,
              carbon: rec.carbon,
              lat: rec.lat,
              lng: rec.lng,
              img: rec.img,
              isActivity: false
            };
          }
        }
      });
    }

    // C. Check famous destination landmarks lookup table (Hội An, Đà Lạt, Đà Nẵng, Phú Yên)
    if (!matchedSpot) {
      const knownLandmarks = [
        { name: "Rừng dừa Bảy Mẫu (Coconut Forest)", lat: 15.8778, lng: 108.3685, type: "explore", cost: 150000, carbon: 0.8, address: "Cẩm Thanh, TP. Hội An, Quảng Nam", desc: "Khu du lịch sinh thái rừng dừa nước Bảy Mẫu nổi tiếng với trải nghiệm ngồi thuyền thúng dạo quanh sông nước, câu cua và xem múa thúng điêu luyện." },
        { name: "Làng rau Trà Quế (Tra Que Village)", lat: 15.9056, lng: 108.3364, type: "explore", cost: 120000, carbon: 0.5, address: "Cẩm Hà, TP. Hội An, Quảng Nam", desc: "Làng nghề trồng rau truyền thống hơn 300 năm tuổi, nổi tiếng với các phương pháp canh tác hữu cơ bền vững." },
        { name: "Chùa Cầu Hội An", lat: 15.8771, lng: 108.3262, type: "explore", cost: 0, carbon: 0.2, address: "Đường Nguyễn Thị Minh Khai, P. Minh An, Hội An", desc: "Biểu tượng lịch sử văn hóa hơn 400 năm tuổi của đô thị cổ Hội An." },
        { name: "Phố cổ Hội An (Đèn lồng)", lat: 15.8775, lng: 108.3283, type: "explore", cost: 0, carbon: 0.2, address: "Minh An, TP. Hội An, Quảng Nam", desc: "Di sản Văn hóa Thế giới UNESCO với những dãy nhà cổ vàng rực rỡ và lồng đèn lung linh về đêm." },
        { name: "Hồ Xuân Hương Đà Lạt", lat: 11.9404, lng: 108.4452, type: "explore", cost: 0, carbon: 0.2, address: "Phường 1, TP. Đà Lạt, Lâm Đồng", desc: "Trái tim thơ mộng của thành phố ngàn hoa với không gian đi bộ và đạp xe sinh thái." },
        { name: "Quảng trường Lâm Viên", lat: 11.9360, lng: 108.4450, type: "explore", cost: 0, carbon: 0.2, address: "Trần Quốc Toản, Phường 10, TP. Đà Lạt", desc: "Biểu tượng nụ hoa Atiso và đóa hoa Dã Quỳ khổng lồ bằng kính màu đặc trưng Đà Lạt." },
        { name: "Chùa Linh Phước (Chùa Ve Chai)", lat: 11.9452, lng: 108.4988, type: "explore", cost: 0, carbon: 0.2, address: "Trại Mát, TP. Đà Lạt, Lâm Đồng", desc: "Ngôi chùa độc đáo bậc nhất với kiến trúc khảm sành sứ tinh xảo và tượng rồng dài 49 mét." },
        { name: "Hồ Tuyền Lâm", lat: 11.8906, lng: 108.4239, type: "explore", cost: 0, carbon: 0.5, address: "Phường 4, TP. Đà Lạt, Lâm Đồng", desc: "Khu du lịch sinh thái hồ nước ngọt lớn nhất Đà Lạt được bao bọc bởi rừng thông nguyên sinh." },
        { name: "Thác Datanla", lat: 11.9026, lng: 108.4485, type: "explore", cost: 180000, carbon: 0.8, address: "Đèo Prenn, Phường 3, TP. Đà Lạt", desc: "Ngọn thác hùng vĩ với máng trượt xuyên rừng thông dài nhất Đông Nam Á." },
        { name: "Cầu Rồng Đà Nẵng", lat: 16.0611, lng: 108.2274, type: "explore", cost: 0, carbon: 0.2, address: "An Hải Tây, Sơn Trà, TP. Đà Nẵng", desc: "Cây cầu độc nhất vô nhị bắc qua sông Hàn có khả năng phun lửa và phun nước vào cuối tuần." },
        { name: "Bà Nà Hills (Cầu Vàng)", lat: 15.9988, lng: 107.9965, type: "explore", cost: 900000, carbon: 2.0, address: "Hòa Phú, Hòa Vang, TP. Đà Nẵng", desc: "Kỳ quan Cầu Vàng nâng đỡ bởi bàn tay khổng lồ giữa mây trời và Làng Pháp cổ kính." }
      ];

      for (const lm of knownLandmarks) {
        const d = Math.hypot(lm.lat - lat, lm.lng - lng);
        if (d < 0.02) { // within ~2km of landmark
          matchedSpot = {
            title: lm.name,
            type: lm.type,
            category: 'Điểm tham quan sinh thái',
            cost: lm.cost,
            carbon: lm.carbon,
            lat: lm.lat,
            lng: lm.lng,
            address: lm.address,
            description: lm.desc,
            isActivity: false
          };
          break;
        }
      }
    }

    let placeName = 'Địa điểm chọn từ bản đồ';
    let placeType = 'explore';
    let snapLat = lat;
    let snapLng = lng;
    let addressText = (this.activeItinerary ? this.activeItinerary.destination + ', Việt Nam' : 'Việt Nam');
    let placeDesc = '';
    let placeCost = 50000;
    let placeCarbon = 1.0;
    let isAct = false;
    let actIndex: number | undefined = undefined;

    if (matchedSpot) {
      placeName = matchedSpot.title;
      placeType = matchedSpot.type || 'explore';
      snapLat = matchedSpot.lat || lat;
      snapLng = matchedSpot.lng || lng;
      addressText = matchedSpot.address || addressText;
      placeDesc = matchedSpot.description || this.getPlaceWikiDescription(placeName);
      placeCost = matchedSpot.cost || 50000;
      placeCarbon = matchedSpot.carbon || 1.0;
      isAct = !!matchedSpot.isActivity;
      actIndex = matchedSpot.index;
    } else {
      try {
        const data = await this.apiService.reverseGeocodeSerp(lat, lng);
        if (data && data.title && !data.title.includes('Địa điểm chọn')) {
          placeName = data.title;
          addressText = data.address || addressText;
          placeType = data.category || 'explore';
        }
      } catch (e) { }
      placeDesc = this.getPlaceWikiDescription(placeName);
    }

    const placeImg = this.getPlacePlaceholderImage(placeName);

    this.selectedPlaceDetails = {
      title: placeName,
      type: placeType,
      category: this.getCategoryLabel(placeType),
      rating: 4.8,
      reviews: 1420,
      cost: placeCost,
      carbon: placeCarbon,
      lat: snapLat,
      lng: snapLng,
      img: placeImg,
      description: placeDesc,
      address: addressText,
      hours: 'Đang mở cửa · Đóng cửa vào 18:30',
      isActivity: isAct,
      index: actIndex,
      isCustomMapClick: false
    };

    // Draw a prominent red pulse pin on the clicked coordinate
    this.clearSearchMarkers();
    const marker = L.marker([snapLat, snapLng], {
      icon: L.divIcon({
        html: `<div class="map-leaflet-rec-pin map-leaflet-pin-red-pulse" style="background-color: #EF4444; border: 2.5px solid #FFFFFF; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239,68,68,0.5);"><i class="bi bi-geo-alt-fill" style="font-size: 13px;"></i></div>`,
        className: 'custom-div-icon-click-pin',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }).addTo(this.map);

    this.searchMarkers.push(marker);
    if (this.map) {
      this.map.panTo([snapLat, snapLng]);
    }
    this.cdr.detectChanges();
  }

  public async addMapClickPlace() {
    const name = this.mapClickPlaceName.trim();
    if (!name || !this.selectedPlaceDetails) return;
    const lat = this.selectedPlaceDetails.lat;
    const lng = this.selectedPlaceDetails.lng;
    await this.addPoolItemToActiveDay(name, "explore", 0, 1, lat, lng);
    this.closePlaceDetails();
  }

  public startLocatingActivity(idx: number, event: MouseEvent) {
    event.stopPropagation();
    this.locatingActivityIdx = idx;

    if (!this.map) return;

    // Remove previous temporary marker if any
    if (this.positioningMarker) {
      try {
        this.map.removeLayer(this.positioningMarker);
      } catch (e) { }
    }

    // Place draggable marker at map center
    const center = this.map.getCenter();

    // Define a nice red draggable pin (cây kim)
    const redPinIcon = L.divIcon({
      html: `<div style="background-color: #EF4444; border: 2.5px solid #FFFFFF; color: #FFFFFF; font-weight: 800; font-size: 16px; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); margin-left: -16px; margin-top: -32px;">
              <i class="bi bi-geo-alt-fill" style="transform: rotate(45deg); display: block; font-size: 14px;"></i>
             </div>`,
      className: 'custom-draggable-pin',
      iconSize: [32, 32],
      iconAnchor: [0, 0]
    });

    this.positioningMarker = L.marker(center, {
      draggable: true,
      icon: redPinIcon
    }).addTo(this.map);

    // Open popup instructions inside it
    const popupContent = `
      <div style="padding: 6px; text-align: center; font-family: sans-serif; pointer-events: auto;">
        <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 11px; color: #1F2937;">📍 Kéo ghim đến vị trí</p>
        <button id="btnConfirmLeafletPos" style="background-color: #0E9F6E; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; cursor: pointer;">Xác nhận</button>
      </div>
    `;

    this.positioningMarker.bindPopup(popupContent, {
      closeOnClick: false,
      closeButton: false,
      autoClose: false
    }).openPopup();

    this.positioningMarker.on("popupopen", () => {
      const btn = document.getElementById("btnConfirmLeafletPos");
      if (btn) {
        btn.onclick = () => {
          this.confirmPositioningLocation();
        };
      }
    });

    this.cdr.detectChanges();
  }

  public confirmPositioningLocation() {
    if (this.locatingActivityIdx === null || !this.positioningMarker) return;
    const latlng = this.positioningMarker.getLatLng();

    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    const act = activeDay.activities[this.locatingActivityIdx];
    if (act) {
      act.lat = latlng.lat;
      act.lng = latlng.lng;
    }

    // Clean up
    if (this.map && this.positioningMarker) {
      try {
        this.map.removeLayer(this.positioningMarker);
      } catch (e) { }
    }
    this.positioningMarker = null;
    this.locatingActivityIdx = null;

    this.plotMapMarkers();
    this.recalculateMetrics();
    this.saveItineraryToDb();
  }

  public cancelLocatingActivity() {
    if (this.map && this.positioningMarker) {
      try {
        this.map.removeLayer(this.positioningMarker);
      } catch (e) { }
    }
    this.positioningMarker = null;
    this.locatingActivityIdx = null;
    this.cdr.detectChanges();
  }



  public getNextSuggestedTime(dayIdx: number = this.activeDayIdx, newType: string = 'explore', newLat?: number, newLng?: number): string {
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) return "08:00";
    const activeDay = this.activeItinerary.days[dayIdx];
    const acts = activeDay.activities || [];
    if (acts.length === 0) return "08:00";

    const lastAct = acts[acts.length - 1];
    const startMins = this.timeToMinutes(lastAct.time || "08:00");
    const dwellMins = this.getDwellMinutesForType(lastAct.type);
    const transitMins = this.getEstimatedTransitMinutes(lastAct, { lat: newLat, lng: newLng }, acts.length - 1);

    const nextMins = startMins + dwellMins + transitMins;
    if (nextMins >= 23 * 60 + 59) {
      return "23:30";
    }
    return this.minutesToTime(nextMins);
  }

  private recalculateMetrics() {
    if (!this.activeItinerary) return;

    let totalBudget = 0;
    let carbonSum = 0;

    this.activeItinerary.days.forEach((day: any) => {
      (day.activities || []).forEach((act: any) => {
        totalBudget += (Number(act.cost) || 0);
        carbonSum += (Number(act.carbon) || 0);
      });
      // Leg transports in this day
      if (day.legTransports) {
        Object.values(day.legTransports).forEach((lt: any) => {
          totalBudget += (Number(lt.price) || 0);
          carbonSum += (Number(lt.carbonSaved) || Number(lt.carbon) || 0);
        });
      }
      // Daily vehicle rental
      if (day.vehicleRental) {
        totalBudget += (Number(day.vehicleRental.price) || 0);
        carbonSum += (Number(day.vehicleRental.carbonSaved) || 0);
      }
    });

    // Departure transport (flight / coach)
    if (this.activeItinerary.departureTransport) {
      totalBudget += (Number(this.activeItinerary.departureTransport.price) || 0) * (Number(this.guestCount) || 1);
      carbonSum += (Number(this.activeItinerary.departureTransport.carbonSaved) || 0);
    }

    this.totalCost = totalBudget;
    this.totalCarbon = Math.round(carbonSum * 10) / 10;

    this.budgetProgressPct = Math.min((totalBudget / 8000000) * 100, 100);
    this.carbonProgressPct = Math.min((carbonSum / 80) * 100, 100);
    this.cdr.detectChanges();
  }


  // =========================================================================
  // UNIVERSAL MAP INITIALIZER (High-Performance Leaflet with Google Maps Styling)
  // =========================================================================
  public async initUniversalMap() {
    if (!this.activeItinerary) return;

    // Ensure activities have coordinates
    this.ensureItineraryCoordinates();

    // Google key rejected -> Leaflet immediately
    if ((window as any).__gm_auth_failed) {
      this.isGoogleMaps = false;
      this.initLeafletMap();
      return;
    }

    const isGoogleReady = await this.waitForGoogleMapsReady(4000);
    if (isGoogleReady && !(window as any).__gm_auth_failed) {
      this.initGoogleMap();
    } else {
      this.isGoogleMaps = false;
      this.initLeafletMap();
    }
  }

  private waitForGoogleMapsReady(timeoutMs: number = 4000): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
        return resolve(true);
      }
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }

  public lookupActivityCoordinates(title: string): { lat: number; lng: number } | null {
    if (!title) return null;
    const t = title.toLowerCase();
    if (t.includes('rừng dừa') || t.includes('coconut') || t.includes('bảy mẫu') || t.includes('thuyền thúng')) {
      return { lat: 15.8778, lng: 108.3685 };
    }
    if (t.includes('trà quế') || t.includes('tra que') || t.includes('làm vườn')) {
      return { lat: 15.9056, lng: 108.3364 };
    }
    if (t.includes('phố cổ') || t.includes('đèn lồng') || t.includes('chùa cầu')) {
      return { lat: 15.8775, lng: 108.3283 };
    }
    if (t.includes('homestay') || t.includes('khách sạn') || t.includes('nhận phòng')) {
      return { lat: 15.8790, lng: 108.3240 };
    }
    if (t.includes('hồ xuân hương')) {
      return { lat: 11.9404, lng: 108.4452 };
    }
    if (t.includes('lâm viên')) {
      return { lat: 11.9360, lng: 108.4450 };
    }
    if (t.includes('datanla')) {
      return { lat: 11.9026, lng: 108.4485 };
    }
    if (t.includes('cầu rồng')) {
      return { lat: 16.0611, lng: 108.2274 };
    }
    if (t.includes('bà nà') || t.includes('cầu vàng')) {
      return { lat: 15.9988, lng: 107.9965 };
    }
    if (t.includes('sơn trà') || t.includes('linh ứng')) {
      return { lat: 16.1004, lng: 108.2778 };
    }
    if (t.includes('tân định')) {
      return { lat: 10.7885, lng: 106.6908 };
    }
    if (t.includes('huỳnh hoa') || t.includes('bánh mì huynh hoa')) {
      return { lat: 10.7716, lng: 106.6924 };
    }
    return null;
  }

  public ensureItineraryCoordinates() {
    if (!this.activeItinerary || !this.activeItinerary.days) return;
    this.activeItinerary.days.forEach((day: any) => {
      (day.activities || []).forEach((act: any) => {
        if (typeof act.lat !== 'number' || typeof act.lng !== 'number') {
          const coords = this.lookupActivityCoordinates(act.title || act.name);
          if (coords) {
            act.lat = coords.lat;
            act.lng = coords.lng;
          }
        }
      });
    });
  }

  private initGoogleMap() {
    try {
      const dest = this.activeItinerary?.dest || this.activeItinerary?.destination || this.activeItinerary?.destLabel;
      const centerCoords = this.getDestinationCenterCoords(dest);
      const center = { lat: centerCoords[0], lng: centerCoords[1] };
      const mapDiv = document.getElementById('leafletMap');
      if (!mapDiv) return;

      // Clean up previous Leaflet map if exists
      if (this.map) {
        try { this.map.remove(); } catch (e) { }
        this.map = null;
      }
      // Remove any lingering Leaflet classes or styles
      mapDiv.innerHTML = '';
      mapDiv.className = '';

      this.isGoogleMaps = true;
      (window as any)['gm_authFailure'] = () => {
        console.warn('Google Maps authentication failure. Reverting to backup engine.');
        this.isGoogleMaps = false;
        this.initLeafletMap();
      };
      const mapOptions = {
        center: center,
        zoom: 13,
        gestureHandling: 'greedy', // Direct scrollwheel zoom and drag, eliminating the grey "Use ctrl + scroll" overlay
        scrollwheel: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_LEFT
        },
        streetViewControl: true,
        zoomControl: true,
        fullscreenControl: false
      };

      this.gmap = new google.maps.Map(mapDiv, mapOptions);
      this.placesService = new google.maps.places.PlacesService(this.gmap);
      // Google DirectionsService replaced with official Routes API v2 via backend proxy

      // 1. NATIVE POI CLICK LISTENER: Click ANY POI (Coconut Forest, restaurant, hotel, church...)
      this.gmap.addListener('click', (e: any) => {
        if (e.placeId) {
          e.stop(); // Stop default infoWindow
          this.ngZone.run(() => {
            this.fetchGooglePlaceDetails(e.placeId, e.latLng);
          });
        } else if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          this.ngZone.run(() => {
            this.handleMapClick(lat, lng);
          });
        }
      });

      // 2. Attach Google Places Autocomplete with retry
      this.setupGoogleAutocomplete();

      this.plotMapMarkers(true);
    } catch (err) {
      console.warn("Failed to initialize Google Maps JS API, falling back to Leaflet:", err);
      this.isGoogleMaps = false;
      this.initUniversalMap();
    }
  }

  public setupGoogleAutocomplete() {
    // Disabled native Google .pac-container widget to prevent "This page can't load Google Maps correctly" popup.
    // We use our own Hybrid Search Dropdown (Partner services first, Map places second).
  }

  public resolvePlaceCost(title: string, place?: any, greenMatch?: any): { cost: number; priceUnknown: boolean } {
    if (greenMatch && greenMatch.cost !== undefined && greenMatch.cost !== null) {
      return { cost: Number(greenMatch.cost) || 0, priceUnknown: false };
    }
    if (place && place.cost !== undefined && place.cost !== null && !place.priceUnknown && place.isPartner) {
      return { cost: Number(place.cost) || 0, priceUnknown: false };
    }

    const t = this.stripVietnameseAccents(title || '');
    // Known ticketed attractions
    if (t.includes('ba na')) return { cost: 900000, priceUnknown: false };
    if (t.includes('cu lao cham')) return { cost: 650000, priceUnknown: false };
    if (t.includes('rung dua') || t.includes('bay mau') || t.includes('thuyen thung')) return { cost: 150000, priceUnknown: false };
    if (t.includes('tra que')) return { cost: 100000, priceUnknown: false };
    if (t.includes('ngu hanh son')) return { cost: 40000, priceUnknown: false };
    if (t.includes('langbiang')) return { cost: 50000, priceUnknown: false };
    if (t.includes('datanla')) return { cost: 150000, priceUnknown: false };
    if (t.includes('thung lung tinh yeu')) return { cost: 250000, priceUnknown: false };
    if (t.includes('ganh da dia') || t.includes('ghenh da dia')) return { cost: 40000, priceUnknown: false };
    if (t.includes('bai xep')) return { cost: 20000, priceUnknown: false };
    if (t.includes('thap nhan')) return { cost: 20000, priceUnknown: false };

    // Known free public places
    const freeKeywords = [
      'cau rong', 'song han', 'pho co', 'chua cau', 'ho xuan huong', 'quang truong', 'lam vien',
      'chua ', 'nha tho', 'bai bien', 'my khe', 'an bang', 'cong vien', 'cho dem', 'deo ', 'ho tay', 'ho guom'
    ];
    if (freeKeywords.some(k => t.includes(k))) {
      return { cost: 0, priceUnknown: false };
    }

    if (place && place.price_level) {
      return { cost: Number(place.price_level) * 50000, priceUnknown: false };
    }

    // Unknown price from external map -> do not hardcode 120k, mark as priceUnknown
    return { cost: 0, priceUnknown: true };
  }

  public async fetchGooglePlaceDetails(placeId: string, fallbackLatLng?: any) {
    if (!placeId) {
      if (fallbackLatLng) this.handleMapClick(fallbackLatLng.lat ? fallbackLatLng.lat() : fallbackLatLng[0], fallbackLatLng.lng ? fallbackLatLng.lng() : fallbackLatLng[1]);
      return;
    }

    try {
      const place = await this.apiService.getGooglePlaceDetails(placeId);
      if (place) {
        this.ngZone.run(() => {
          this.populateRealGooglePlacePanel(place, fallbackLatLng);
        });
        return;
      }
    } catch (e) {
      console.warn('Backend getGooglePlaceDetails error:', e);
    }

    if (fallbackLatLng) {
      this.handleMapClick(fallbackLatLng.lat ? fallbackLatLng.lat() : fallbackLatLng[0], fallbackLatLng.lng ? fallbackLatLng.lng() : fallbackLatLng[1]);
    }
  }

  public findMatchingGreenStepsService(name: string, lat?: number, lng?: number): any | null {
    if (!name) return null;
    const cleanName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // 1. Check in localServices (from database)
    if (this.localServices && this.localServices.length > 0) {
      for (const s of this.localServices) {
        const sName = (s.name || s.name_service || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (sName && (cleanName.includes(sName) || sName.includes(cleanName))) {
          return { ...s, source: 'database', isPartner: true };
        }
        if (lat && lng && s.lat && s.lng) {
          const dist = this.calculateDistanceMeters(lat, lng, s.lat, s.lng);
          if (dist < 120) {
            return { ...s, source: 'database', isPartner: true };
          }
        }
      }
    }

    // 2. Check in current itinerary activities (any day)
    if (this.activeItinerary?.days) {
      for (const d of this.activeItinerary.days) {
        for (const act of (d.activities || [])) {
          const actName = (act.title || act.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          if (actName && (cleanName.includes(actName) || actName.includes(cleanName))) {
            return { ...act, source: 'itinerary', isPartner: true };
          }
          if (lat && lng && act.lat && act.lng) {
            const dist = this.calculateDistanceMeters(lat, lng, act.lat, act.lng);
            if (dist < 100) {
              return { ...act, source: 'itinerary', isPartner: true };
            }
          }
        }
      }
    }

    // 3. Check in predefined landmarks (famous verified green places)
    const landmarks = this.getFamousDestinationLandmarks();
    for (const lm of landmarks) {
      const lmName = (lm.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (lmName && (cleanName.includes(lmName) || lmName.includes(cleanName))) {
        return { ...lm, source: 'landmark', isPartner: true };
      }
      if (lat && lng && lm.lat && lm.lng) {
        const dist = this.calculateDistanceMeters(lat, lng, lm.lat, lm.lng);
        if (dist < 150) {
          return { ...lm, source: 'landmark', isPartner: true };
        }
      }
    }

    return null;
  }

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  public populateRealGooglePlacePanel(place: any, fallbackLatLng?: any) {
    if (!place) return;

    let lat = 0;
    let lng = 0;
    if (typeof place.lat === 'number' && typeof place.lng === 'number') {
      lat = place.lat;
      lng = place.lng;
    } else if (place.geometry && place.geometry.location) {
      lat = typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat;
      lng = typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng;
    } else if (fallbackLatLng) {
      lat = typeof fallbackLatLng.lat === 'function' ? fallbackLatLng.lat() : (fallbackLatLng.lat || fallbackLatLng[0] || 0);
      lng = typeof fallbackLatLng.lng === 'function' ? fallbackLatLng.lng() : (fallbackLatLng.lng || fallbackLatLng[1] || 0);
    }

    const title = place.title || place.name || 'Địa điểm Google Maps';

    // 1. REAL GOOGLE PHOTOS
    let photoUrls: string[] = [];
    if (Array.isArray(place.photos) && place.photos.length > 0) {
      if (typeof place.photos[0] === 'string') {
        photoUrls = place.photos;
      } else {
        place.photos.forEach((ph: any) => {
          if (typeof ph?.getUrl === 'function') {
            photoUrls.push(ph.getUrl({ maxWidth: 800, maxHeight: 600 }));
          } else if (ph?.url) {
            photoUrls.push(ph.url);
          }
        });
      }
    }
    const mainImg = photoUrls.length > 0 ? photoUrls[0] : (place.img || this.getPlacePlaceholderImage(title));

    // 2. REAL GOOGLE OPENING HOURS
    let openStatus = place.hours || 'Đang mở cửa';
    let isClosed = false;
    let weekdayText: string[] = place.weekdayText || [];
    if (place.opening_hours) {
      try {
        if (typeof place.opening_hours.isOpen === 'function') {
          isClosed = !place.opening_hours.isOpen();
          openStatus = isClosed ? 'Đã đóng cửa' : 'Đang mở cửa';
        }
        weekdayText = weekdayText.length > 0 ? weekdayText : (place.opening_hours.weekday_text || []);
      } catch (e) { }
    }

    // 3. REAL CATEGORY LABEL
    const cat = place.category || this.getCategoryLabelFromGoogleTypes(place.types);

    // 4. REAL GOOGLE USER REVIEWS
    let realReviews: any[] = [];
    if (Array.isArray(place.googleReviews) && place.googleReviews.length > 0) {
      realReviews = place.googleReviews;
    } else if (Array.isArray(place.reviews) && place.reviews.length > 0) {
      place.reviews.forEach((r: any) => {
        realReviews.push({
          author: r.author_name || r.author || 'Khách Google Maps',
          photo: r.profile_photo_url || r.photo || '',
          rating: r.rating || 5,
          time: r.relative_time_description || r.time || 'Gần đây',
          text: r.text || 'Trải nghiệm du lịch tuyệt vời.'
        });
      });
    }

    // 5. Check if place already in active day
    const activeDay = this.activeItinerary?.days[this.activeDayIdx];
    const existingIdx = (activeDay?.activities || []).findIndex((a: any) =>
      (a.title && a.title.toLowerCase() === title.toLowerCase()) ||
      (a.lat && Math.abs(a.lat - lat) < 0.001 && Math.abs(a.lng - lng) < 0.001)
    );

    // SMART MATCHING: Reconcile Google Place with GreenSteps DB Services
    const greenMatch = this.findMatchingGreenStepsService(title, lat, lng);
    const isPartner = !!greenMatch;

    // SOURCE OF TRUTH: If matched with GreenSteps, ALWAYS prioritize GreenSteps official pricing and carbon!
    const resolvedPrice = this.resolvePlaceCost(title, place, greenMatch);
    const cost = resolvedPrice.cost;
    const priceUnknown = resolvedPrice.priceUnknown;

    const carbon = greenMatch?.carbon !== undefined
      ? greenMatch.carbon
      : (place.carbon !== undefined ? place.carbon : (cat.includes('Ăn') ? 0.4 : (cat.includes('Lưu') ? 2.5 : 0.8)));

    const finalType = greenMatch?.type || place.type || this.getTypeFromGoogleTypes(place.types);

    this.activeGooglePlacePanel = {
      isPartner: isPartner,
      greenMatch: greenMatch,
      title: title,
      place_id: place.id || place.place_id || null,
      type: place.type || this.getTypeFromGoogleTypes(place.types),
      category: cat,
      rating: place.rating || 4.7,
      reviews: place.reviewsCount ?? place.user_ratings_total ?? (realReviews.length > 0 ? realReviews.length * 150 : 340),
      googleReviews: realReviews,
      cost: cost,
      priceUnknown: priceUnknown,
      carbon: carbon,
      lat: lat,
      lng: lng,
      img: mainImg,
      photos: photoUrls,
      address: place.address || place.formatted_address || (title + ', ' + (this.activeItinerary?.dest || 'Hội An')),
      phone: place.phone || place.formatted_phone_number || '',
      website: place.website || '',
      googleMapsUrl: place.url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(title),
      hours: openStatus,
      isClosed: isClosed,
      weekdayText: weekdayText,
      description: place.description || 'Địa điểm chính thức từ Google Maps: ' + (place.address || place.formatted_address || title) + '.',
      isActivity: existingIdx !== -1,
      activityIdx: existingIdx,
      itemRef: existingIdx !== -1 ? activeDay.activities[existingIdx] : null
    };
    this.activePlaceTab = 'overview';
    this.selectedPlaceDetails = null;

    // Pin & Pan on Google Maps
    if (this.isGoogleMaps && this.gmap && lat && lng) {
      this.gmap.panTo({ lat, lng });
      this.gmap.setZoom(16);
      this.clearSearchMarkers();
      const pin = new google.maps.Marker({
        position: { lat, lng },
        map: this.gmap,
        animation: google.maps.Animation.DROP,
        title: title
      });
      pin.addListener('click', () => {
        this.ngZone.run(() => {
          this.openGooglePlacePanel(this.activeGooglePlacePanel);
        });
      });
      this.searchMarkers.push(pin);
    }
    this.cdr.detectChanges();
  }

  public getCategoryLabelFromGoogleTypes(types: string[]): string {
    if (!types || !types.length) return 'Điểm tham quan sinh thái';
    if (types.includes('restaurant') || types.includes('food') || types.includes('meal_takeaway')) return 'Quán ăn / Ẩm thực địa phương';
    if (types.includes('cafe') || types.includes('bakery')) return 'Quán cà phê / Trà sinh thái';
    if (types.includes('lodging') || types.includes('hotel')) return 'Khách sạn / Eco Homestay';
    if (types.includes('tourist_attraction') || types.includes('point_of_interest')) return 'Điểm tham quan / Di sản';
    if (types.includes('place_of_worship') || types.includes('church') || types.includes('hindu_temple')) return 'Di tích tâm linh / Nhà thờ';
    if (types.includes('park') || types.includes('natural_feature')) return 'Công viên / Khu sinh thái';
    return 'Điểm tham quan sinh thái';
  }

  public getTypeFromGoogleTypes(types: string[]): string {
    if (!types || !types.length) return 'explore';
    if (types.includes('restaurant') || types.includes('food') || types.includes('cafe')) return 'dining';
    if (types.includes('lodging') || types.includes('hotel')) return 'lodging';
    if (types.includes('transit_station') || types.includes('bus_station')) return 'transport';
    return 'explore';
  }

  public selectGooglePlaceDetails(place: any, fallbackLatLng?: any) {
    let photoUrl = '';
    if (place.photos && place.photos.length > 0) {
      try {
        photoUrl = place.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 });
      } catch (e) { }
    }
    if (!photoUrl) {
      photoUrl = this.getPlacePlaceholderImage(place.name);
    }

    const lat = place.geometry?.location?.lat() || (fallbackLatLng ? fallbackLatLng.lat() : 0);
    const lng = place.geometry?.location?.lng() || (fallbackLatLng ? fallbackLatLng.lng() : 0);

    let openStatus = 'Đang mở cửa · Mở cửa cả ngày';
    let isClosed = false;
    if (place.opening_hours) {
      try {
        isClosed = !place.opening_hours.isOpen();
        openStatus = isClosed ? 'Đã đóng cửa' : 'Đang mở cửa';
      } catch (e) { }
    }

    let catLabel = 'Điểm tham quan';
    let placeType = 'explore';
    let cost = 100000;
    let carbon = 0.8;

    if (place.types) {
      if (place.types.includes('restaurant') || place.types.includes('food') || place.types.includes('cafe') || place.types.includes('bakery')) {
        catLabel = 'Quán ăn / Cà phê';
        placeType = 'dining';
        cost = 45000;
        carbon = 0.4;
      } else if (place.types.includes('lodging') || place.types.includes('hotel')) {
        catLabel = 'Khách sạn / Lưu trú';
        placeType = 'lodging';
        cost = 650000;
        carbon = 2.5;
      } else if (place.types.includes('church') || place.types.includes('place_of_worship')) {
        catLabel = 'Di tích tâm linh / Nhà thờ';
        placeType = 'explore';
        cost = 0;
        carbon = 0.2;
      }
    }

    // Drop marker on Google Maps
    this.clearSearchMarkers();
    if (this.isGoogleMaps && this.gmap) {
      const pin = new google.maps.Marker({
        position: { lat, lng },
        map: this.gmap,
        animation: google.maps.Animation.DROP,
        title: place.name
      });
      this.searchMarkers.push(pin);
      this.gmap.panTo({ lat, lng });
    }

    this.selectedPlaceDetails = {
      title: place.name,
      type: placeType,
      category: catLabel,
      rating: place.rating || 4.7,
      reviews: place.user_ratings_total || 850,
      cost: cost,
      carbon: carbon,
      lat: lat,
      lng: lng,
      img: photoUrl,
      address: place.formatted_address || '',
      hours: openStatus,
      isClosed: isClosed,
      description: `Địa điểm ${place.name} trên Google Maps với ${place.user_ratings_total || 0} lượt đánh giá thực tế.`,
      isActivity: false
    };

    this.cdr.detectChanges();
  }

  // LEAFLET MAP HANDLERS
  private initLeafletMap() {
    if (!this.activeItinerary) return;

    const dest = this.activeItinerary.dest;
    const center = this.cityCenters[dest] || [11.9404, 108.4373];

    // Clear previous map if initialized
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) { }
      this.map = null;
    }

    try {
      this.map = L.map('leafletMap', {
        zoomControl: false,
        attributionControl: false
      }).setView(center, 12);

      // Google Maps road map style
      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(this.map);


      this.map.on("click", (e: any) => {
        if (this.locatingActivityIdx !== null && e.latlng) {
          const idx = this.locatingActivityIdx;
          const activeDay = this.activeItinerary.days[this.activeDayIdx];
          if (activeDay && activeDay.activities[idx]) {
            activeDay.activities[idx].lat = e.latlng.lat;
            activeDay.activities[idx].lng = e.latlng.lng;
            this.locatingActivityIdx = null;
            this.plotMapMarkers();
            this.recalculateMetrics();
            this.saveItineraryToDb();
          }
        } else if (e.latlng) {
          this.handleMapClick(e.latlng.lat, e.latlng.lng);
        } else {
          this.closePlaceDetails();
        }
      });

      this.plotMapMarkers(true);
    } catch (err) {
      console.warn("Leaflet library not ready or loaded:", err);
    }
  }


  public showHoverPopover(place: any, event: any) {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    let x = 0;
    let y = 0;
    if (event && event.containerPoint) {
      x = event.containerPoint.x;
      y = event.containerPoint.y;
    } else if (event && event.originalEvent) {
      const mapEl = document.getElementById('leafletMap');
      const rect = mapEl ? mapEl.getBoundingClientRect() : { left: 0, top: 0 };
      x = event.originalEvent.clientX - rect.left;
      y = event.originalEvent.clientY - rect.top;
    }

    this.hoverPopoverPos = {
      x: Math.max(16, Math.min((window.innerWidth - 300), x - 135)),
      y: Math.max(16, y - 270)
    };

    const imgUrl = place.img || this.getPlacePlaceholderImage(place.title || place.name);
    this.hoveredPlace = {
      title: place.title || place.name,
      type: place.type || 'explore',
      category: place.category || this.getCategoryLabel(place.type || 'explore'),
      rating: place.rating || 4.8,
      reviews: place.reviews || 1420,
      hours: place.hours || 'Đang mở cửa · Đóng cửa lúc 18:30',
      cost: place.cost || 0,
      carbon: place.carbon || 0.8,
      img: imgUrl,
      lat: place.lat,
      lng: place.lng,
      isActivity: !!place.isActivity,
      index: place.index,
      isClosed: !!place.isClosed
    };
    this.cdr.detectChanges();
  }

  public hideHoverPopover(delay: number = 200) {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    this.hoverTimeout = setTimeout(() => {
      this.hoveredPlace = null;
      this.cdr.detectChanges();
    }, delay);
  }

  public keepHoverPopover() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  public getFamousDestinationLandmarks(): any[] {
    const dest = (this.activeItinerary?.destination || '').toLowerCase();
    const all = [
      // Hội An & Đà Nẵng
      { name: "Rừng dừa Bảy Mẫu (Coconut Forest)", lat: 15.8778, lng: 108.3685, type: "explore", category: "Điểm tham quan sinh thái", cost: 150000, carbon: 0.8, address: "Cẩm Thanh, TP. Hội An, Quảng Nam", desc: "Khu du lịch sinh thái rừng dừa nước Bảy Mẫu nổi tiếng với trải nghiệm ngồi thuyền thúng dạo quanh sông nước, câu cua và xem múa thúng điêu luyện.", rating: 4.8, reviews: 3420, icon: "bi-camera-fill", color: "#8B5CF6", city: "hoi an" },
      { name: "Làng rau Trà Quế (Tra Que Village)", lat: 15.9056, lng: 108.3364, type: "explore", category: "Làng nghề truyền thống", cost: 120000, carbon: 0.5, address: "Cẩm Hà, TP. Hội An, Quảng Nam", desc: "Làng nghề trồng rau truyền thống hơn 300 năm tuổi, nổi tiếng với các phương pháp canh tác hữu cơ bền vững.", rating: 4.7, reviews: 1250, icon: "bi-tree-fill", color: "#10B981", city: "hoi an" },
      { name: "Chùa Cầu Hội An", lat: 15.8771, lng: 108.3262, type: "explore", category: "Di sản lịch sử", cost: 0, carbon: 0.2, address: "Đường Nguyễn Thị Minh Khai, P. Minh An, Hội An", desc: "Biểu tượng lịch sử văn hóa hơn 400 năm tuổi của đô thị cổ Hội An.", rating: 4.6, reviews: 8900, icon: "bi-bank2", color: "#EF4444", city: "hoi an" },
      { name: "Phố cổ Hội An (Đèn lồng)", lat: 15.8775, lng: 108.3283, type: "explore", category: "Di sản UNESCO", cost: 0, carbon: 0.2, address: "Minh An, TP. Hội An, Quảng Nam", desc: "Di sản Văn hóa Thế giới UNESCO với những dãy nhà cổ vàng rực rỡ và lồng đèn lung linh về đêm.", rating: 4.9, reviews: 15200, icon: "bi-stars", color: "#F59E0B", city: "hoi an" },
      { name: "Bánh Mì Phượng Hội An", lat: 15.8792, lng: 108.3315, type: "dining", category: "Ẩm thực địa phương", cost: 35000, carbon: 0.4, address: "2B Phan Chu Trinh, Cẩm Châu, Hội An", desc: "Tiệm bánh mì trứ danh từng được đầu bếp Anthony Bourdain ca ngợi là bánh mì ngon nhất thế giới.", rating: 4.4, reviews: 9400, icon: "bi-cup-hot-fill", color: "#F97316", city: "hoi an" },
      { name: "Faifo Coffee Hội An", lat: 15.8774, lng: 108.3298, type: "dining", category: "Quán cà phê view đẹp", cost: 45000, carbon: 0.3, address: "130 Trần Phú, Minh An, Hội An", desc: "Quán cafe trên tầng thượng với góc nhìn toàn cảnh ngắm mái ngói rêu phong phố cổ Hội An.", rating: 4.5, reviews: 4200, icon: "bi-cup-fill", color: "#B45309", city: "hoi an" },
      { name: "Cầu Rồng Đà Nẵng", lat: 16.0611, lng: 108.2274, type: "explore", category: "Kỳ quan kiến trúc", cost: 0, carbon: 0.2, address: "An Hải Tây, Sơn Trà, TP. Đà Nẵng", desc: "Cây cầu độc nhất vô nhị bắc qua sông Hàn có khả năng phun lửa và phun nước vào cuối tuần.", rating: 4.8, reviews: 13900, icon: "bi-fire", color: "#F97316", city: "da nang" },
      { name: "Bà Nà Hills (Cầu Vàng)", lat: 15.9988, lng: 107.9965, type: "explore", category: "Khu du lịch sinh thái", cost: 900000, carbon: 2.0, address: "Hòa Phú, Hòa Vang, TP. Đà Nẵng", desc: "Kỳ quan Cầu Vàng nâng đỡ bởi bàn tay khổng lồ giữa mây trời và Làng Pháp cổ kính.", rating: 4.8, reviews: 24500, icon: "bi-cloud-sun", color: "#F59E0B", city: "da nang" },

      // TP. Hồ Chí Minh
      { name: "Nhà Thờ Giáo Xứ Tân Định", lat: 10.7885, lng: 106.6908, type: "explore", category: "Nhà thờ Công giáo", cost: 0, carbon: 0.2, address: "289 Hai Bà Trưng, Phường 8, Quận 3, TP. Hồ Chí Minh", desc: "Nhà thờ màu hồng độc đáo mang phong cách kiến trúc Gothic và Roman cổ kính.", rating: 4.4, reviews: 9169, icon: "bi-building", color: "#EC4899", hours: "Đã đóng cửa · Mở cửa lúc 7:30", isClosed: true, city: "ho chi minh" },
      { name: "Bánh Mì Huynh Hoa", lat: 10.7716, lng: 106.6924, type: "dining", category: "Cửa hàng sandwich / Bánh mì", cost: 65000, carbon: 0.4, address: "26 Lê Thị Riêng, P. Bến Thành, Quận 1, TP. Hồ Chí Minh", desc: "Tiệm bánh mì nổi tiếng bậc nhất Sài Gòn với nhân pate và thịt nguội đầy đặn.", rating: 4.5, reviews: 7838, icon: "bi-cup-hot-fill", color: "#F97316", city: "ho chi minh" },
      { name: "Chợ Bến Thành", lat: 10.7725, lng: 106.6980, type: "explore", category: "Chợ truyền thống", cost: 0, carbon: 0.3, address: "Đường Lê Lợi, P. Bến Thành, Quận 1, TP. Hồ Chí Minh", desc: "Biểu tượng giao thương lâu đời và sầm uất bậc nhất Sài Gòn.", rating: 4.2, reviews: 31200, icon: "bi-bag-fill", color: "#10B981", city: "ho chi minh" },

      // Đà Lạt
      { name: "Hồ Xuân Hương Đà Lạt", lat: 11.9404, lng: 108.4452, type: "explore", category: "Thắng cảnh thiên nhiên", cost: 0, carbon: 0.2, address: "Phường 1, TP. Đà Lạt, Lâm Đồng", desc: "Trái tim thơ mộng của thành phố ngàn hoa với không gian đi bộ và đạp xe sinh thái.", rating: 4.8, reviews: 11200, icon: "bi-water", color: "#0EA5E9", city: "da lat" },
      { name: "Quảng trường Lâm Viên", lat: 11.9360, lng: 108.4450, type: "explore", category: "Quảng trường công cộng", cost: 0, carbon: 0.2, address: "Trần Quốc Toản, Phường 10, TP. Đà Lạt", desc: "Biểu tượng nụ hoa Atiso và đóa hoa Dã Quỳ khổng lồ bằng kính màu đặc trưng Đà Lạt.", rating: 4.6, reviews: 8400, icon: "bi-flower1", color: "#10B981", city: "da lat" },
      { name: "Chùa Linh Phước (Chùa Ve Chai)", lat: 11.9452, lng: 108.4988, type: "explore", category: "Công trình tâm linh", cost: 0, carbon: 0.2, address: "Trại Mát, TP. Đà Lạt, Lâm Đồng", desc: "Ngôi chùa độc đáo bậc nhất với kiến trúc khảm sành sứ tinh xảo và tượng rồng dài 49 mét.", rating: 4.7, reviews: 9800, icon: "bi-bank2", color: "#8B5CF6", city: "da lat" }
    ];

    if (dest.includes('hội an') || dest.includes('đà nẵng')) {
      return all.filter(item => item.city === 'hoi an' || item.city === 'da nang');
    } else if (dest.includes('đà lạt')) {
      return all.filter(item => item.city === 'da lat');
    } else if (dest.includes('hồ chí minh') || dest.includes('sài gòn')) {
      return all.filter(item => item.city === 'ho chi minh');
    }
    return all.slice(0, 10);
  }

  public async plotGoogleRoutePath(coordinates: number[][]) {
    if (!coordinates || coordinates.length < 2) return;
    try {
      const origin = { lat: coordinates[0][0], lng: coordinates[0][1] };
      const dest = { lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] };
      const waypoints = coordinates.slice(1, -1).map(c => ({ lat: c[0], lng: c[1] }));

      const res: any = await this.apiService.computeGoogleRoute(origin, dest, waypoints);
      if (res && res.encodedPolyline && typeof google !== 'undefined' && google.maps && google.maps.geometry) {
        const decodedPath = google.maps.geometry.encoding.decodePath(res.encodedPolyline);
        if (this.dailyRouteLayer) {
          try { this.dailyRouteLayer.setMap(null); } catch (e) { }
        }
        const isDimmed = !!this.activeLegDirections;
        this.dailyRouteLayer = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: isDimmed ? '#94A3B8' : '#0E9F6E',
          strokeOpacity: isDimmed ? 0.22 : 0.88,
          strokeWeight: isDimmed ? 3 : 5,
          zIndex: isDimmed ? 5 : 10,
          map: this.gmap
        });
      }
    } catch (e) {
      console.warn('Google route computation error:', e);
    }
  }

  private plotMapMarkers(shouldFit: boolean = false) {
    if (!this.activeItinerary || !this.activeItinerary.days || this.activeItinerary.days.length === 0) return;
    if (this.activeDayIdx < 0 || this.activeDayIdx >= this.activeItinerary.days.length) {
      this.activeDayIdx = 0;
    }

    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    if (!activeDay) return;
    if (!Array.isArray(activeDay.activities)) {
      activeDay.activities = [];
    }
    const coordinates: any[] = [];

    // =========================================================================
    // A. GOOGLE MAPS ENGINE PLOTTING
    // =========================================================================
    if (this.isGoogleMaps && this.gmap) {
      if (this.gMarkers && this.gMarkers.length > 0) {
        this.gMarkers.forEach(m => {
          try { m.setMap(null); } catch (e) { }
        });
        this.gMarkers = [];
      }

      if (this.gDirectionsRenderer) {
        try { this.gDirectionsRenderer.set('directions', null); } catch (e) { }
      }

      const gBounds = new google.maps.LatLngBounds();

      // 1. Plot Activities
      activeDay.activities.forEach((act: any, idx: number) => {
        if (typeof act.lat === "number" && typeof act.lng === "number") {
          const pos = { lat: act.lat, lng: act.lng };
          coordinates.push([act.lat, act.lng]);
          gBounds.extend(pos);

          const gmarker = new google.maps.Marker({
            position: pos,
            map: this.gmap,
            label: {
              text: `${idx + 1}`,
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: '11px'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 13,
              fillColor: '#184A37',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.5
            },
            title: act.title
          });

          gmarker.addListener('mouseover', () => {
            this.highlightMapPin(idx, true);
          });
          gmarker.addListener('mouseout', () => {
            this.highlightMapPin(idx, false);
            this.hideHoverPopover();
          });

          gmarker.addListener('click', () => {
            this.ngZone.run(() => {
              this.openGooglePlacePanel(act);
            });
          });

          this.gMarkers.push(gmarker);
        }
      });

      // 2. Plot Real Directions via Google Routes API (v2)
      if (coordinates.length > 1) {
        this.plotGoogleRoutePath(coordinates);
      }

      if (shouldFit) {
        if (coordinates.length === 0) {
          const dest = this.activeItinerary?.dest || this.activeItinerary?.destination || this.activeItinerary?.destLabel;
          const centerCoords = this.getDestinationCenterCoords(dest);
          this.gmap.setCenter({ lat: centerCoords[0], lng: centerCoords[1] });
          this.gmap.setZoom(13);
        } else if (coordinates.length === 1) {
          this.gmap.setCenter({ lat: coordinates[0][0], lng: coordinates[0][1] });
          this.gmap.setZoom(15);
        } else {
          this.gmap.fitBounds(gBounds);
          const listener = google.maps.event.addListener(this.gmap, 'idle', () => {
            if (this.gmap && this.gmap.getZoom() > 16) {
              this.gmap.setZoom(16);
            }
            if (listener) google.maps.event.removeListener(listener);
          });
        }
      }
      return;
    }

    // =========================================================================
    // B. LEAFLET FALLBACK ENGINE PLOTTING
    // =========================================================================
    if (!this.map) return;

    if (this.leafletMarkers && this.leafletMarkers.length > 0) {
      this.leafletMarkers.forEach(m => {
        try { this.map.removeLayer(m); } catch (e) { }
      });
    }
    this.leafletMarkers = [];

    if (this.polyline) {
      try { this.map.removeLayer(this.polyline); } catch (e) { }
      this.polyline = null;
    }

    // 1. PLOT ACTIVE ITINERARY ACTIVITIES (Numbered pins)
    activeDay.activities.forEach((act: any, idx: number) => {
      if (typeof act.lat === "number" && typeof act.lng === "number") {
        const latlng: number[] = [act.lat, act.lng];
        coordinates.push(latlng);

        const customIcon = L.divIcon({
          html: `<div class="map-leaflet-pin" style="background-color: #184A37; border: 2.5px solid #FFFFFF; color: #FFFFFF; font-weight: 800; font-size: 11px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); cursor: pointer;">${idx + 1}</div>`,
          className: 'custom-div-icon',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker(latlng, { icon: customIcon }).addTo(this.map);

        marker.on("mouseover", (e: any) => {
          this.showHoverPopover({
            title: act.title,
            type: act.type,
            cost: act.cost,
            carbon: act.carbon,
            lat: act.lat,
            lng: act.lng,
            time: act.time,
            isActivity: true,
            index: idx
          }, e);
        });
        marker.on("mouseout", () => this.hideHoverPopover());

        marker.on("click", () => {
          this.focusTimelineItem(act.title);
          this.selectedPlaceDetails = {
            title: act.title,
            type: act.type,
            category: this.getCategoryLabel(act.type),
            rating: 4.8,
            reviews: 640,
            cost: act.cost,
            carbon: act.carbon,
            lat: act.lat,
            lng: act.lng,
            time: act.time,
            hours: 'Đang mở cửa · Đóng cửa lúc 18:30',
            address: this.activeItinerary.destination + ', Việt Nam',
            img: this.getPlacePlaceholderImage(act.title),
            description: this.getPlaceWikiDescription(act.title),
            isActivity: true,
            index: idx
          };
          this.cdr.detectChanges();
        });

        this.leafletMarkers.push(marker);
      }
    });

    // 2. PLOT LOCAL SUGGESTIONS
    const recs = this.dynamicRecs || [];
    recs.forEach((rec: any) => {
      const isAlreadyAdded = activeDay.activities.some((act: any) => act.title === rec.name);
      if (isAlreadyAdded) return;

      if (typeof rec.lat === "number" && typeof rec.lng === "number") {
        const latlng: number[] = [rec.lat, rec.lng];

        let iconHtml = '<i class="bi bi-geo-alt-fill"></i>';
        let bgColor = '#0E9F6E';
        if (rec.type === 'dining') {
          iconHtml = '<i class="bi bi-cup-hot-fill" style="font-size: 12px;"></i>';
          bgColor = '#F97316';
        } else if (rec.type === 'lodging') {
          iconHtml = '<i class="bi bi-house-door-fill" style="font-size: 12px;"></i>';
          bgColor = '#3B82F6';
        } else if (rec.type === 'explore' || rec.type === 'attraction') {
          iconHtml = '<i class="bi bi-tree-fill" style="font-size: 12px;"></i>';
          bgColor = '#14B8A6';
        }

        const customIcon = L.divIcon({
          html: `<div class="map-leaflet-rec-pin" style="background-color: ${bgColor}; border: 2px solid #FFFFFF; color: #FFFFFF; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); cursor: pointer;">${iconHtml}</div>`,
          className: 'custom-div-icon-rec',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker(latlng, { icon: customIcon }).addTo(this.map);

        marker.on("mouseover", (e: any) => {
          this.showHoverPopover({
            title: rec.name,
            type: rec.type,
            category: rec.category || this.getCategoryLabel(rec.type),
            cost: rec.cost,
            carbon: rec.carbon,
            lat: rec.lat,
            lng: rec.lng,
            img: rec.img,
            rating: 4.8,
            reviews: 1250,
            hours: 'Đang mở cửa · Đóng cửa lúc 21:00',
            isActivity: false
          }, e);
        });
        marker.on("mouseout", () => this.hideHoverPopover());

        marker.on("click", () => {
          this.selectedPlaceDetails = {
            title: rec.name,
            type: rec.type,
            category: rec.category || this.getCategoryLabel(rec.type),
            rating: 4.8,
            reviews: 1250,
            cost: rec.cost,
            carbon: rec.carbon,
            lat: rec.lat,
            lng: rec.lng,
            img: rec.img || this.getPlacePlaceholderImage(rec.name),
            hours: 'Đang mở cửa · Đóng cửa lúc 21:00',
            address: this.activeItinerary.destination + ', Việt Nam',
            description: this.getPlaceWikiDescription(rec.name),
            isActivity: false
          };
          this.cdr.detectChanges();
        });

        this.leafletMarkers.push(marker);
      }
    });

    // 3. PLOT FAMOUS DESTINATION LANDMARKS
    const famousLandmarks = this.getFamousDestinationLandmarks();
    famousLandmarks.forEach((lm: any) => {
      const isAlreadyAdded = activeDay.activities.some((act: any) =>
        (act.title && act.title.toLowerCase().includes(lm.name.toLowerCase())) ||
        lm.name.toLowerCase().includes(act.title.toLowerCase())
      );
      if (isAlreadyAdded) return;
      const isRec = recs.some((r: any) => r.name.toLowerCase().includes(lm.name.toLowerCase()));
      if (isRec) return;

      const latlng: number[] = [lm.lat, lm.lng];
      const customIcon = L.divIcon({
        html: `<div class="map-leaflet-rec-pin" style="background-color: ${lm.color || '#8B5CF6'}; border: 2.5px solid #FFFFFF; color: #FFFFFF; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.25); cursor: pointer;"><i class="bi ${lm.icon || 'bi-camera-fill'}" style="font-size: 13px;"></i></div>`,
        className: 'custom-div-icon-poi',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(latlng, { icon: customIcon }).addTo(this.map);

      marker.on("mouseover", (e: any) => {
        this.showHoverPopover({
          title: lm.name,
          type: lm.type,
          category: lm.category || 'Điểm tham quan nổi bật',
          cost: lm.cost,
          carbon: lm.carbon,
          lat: lm.lat,
          lng: lm.lng,
          img: lm.img || this.getPlacePlaceholderImage(lm.name),
          rating: lm.rating || 4.8,
          reviews: lm.reviews || 3200,
          hours: lm.hours || 'Đang mở cửa · Đóng cửa lúc 18:30',
          isClosed: !!lm.isClosed,
          isActivity: false
        }, e);
      });
      marker.on("mouseout", () => this.hideHoverPopover());

      marker.on("click", () => {
        this.selectedPlaceDetails = {
          title: lm.name,
          type: lm.type,
          category: lm.category || 'Điểm tham quan nổi bật',
          rating: lm.rating || 4.8,
          reviews: lm.reviews || 3200,
          cost: lm.cost,
          carbon: lm.carbon,
          lat: lm.lat,
          lng: lm.lng,
          img: lm.img || this.getPlacePlaceholderImage(lm.name),
          description: lm.desc || this.getPlaceWikiDescription(lm.name),
          address: lm.address || (this.activeItinerary.destination + ', Việt Nam'),
          hours: lm.hours || 'Đang mở cửa · Đóng cửa lúc 18:30',
          isActivity: false
        };
        this.cdr.detectChanges();
      });

      this.leafletMarkers.push(marker);
    });

    // 4. Draw route path using OSRM
    if (coordinates.length > 1) {
      const coordsQuery = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
      fetch(`https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data && data.routes && data.routes[0]) {
            const routeGeo = data.routes[0].geometry;
            if (this.polyline) {
              try { this.map.removeLayer(this.polyline); } catch (e) { }
            }
            this.polyline = L.geoJSON(routeGeo, {
              style: {
                color: '#0E9F6E',
                weight: 4.5,
                opacity: 0.85
              }
            }).addTo(this.map);

            if (data.routes[0].legs && Array.isArray(data.routes[0].legs)) {
              this.routeLegs = {};
              data.routes[0].legs.forEach((leg: any, legIdx: number) => {
                this.routeLegs[legIdx] = {
                  distanceKm: +(leg.distance / 1000).toFixed(1),
                  durationMin: Math.max(3, Math.round(leg.duration / 60))
                };
              });
              this.cdr.detectChanges();
            }
          }
        })
        .catch(() => { });
    }

    if (shouldFit && coordinates.length > 0) {
      try {
        const bounds = L.latLngBounds(coordinates);
        this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
      } catch (e) { }
    }
  }

  private drawStraightPolyline(coordinates: any[]) {
    if (this.polyline) {
      try { this.map.removeLayer(this.polyline); } catch (e) { }
    }
    this.polyline = L.polyline(coordinates, {
      color: '#0E9F6E',
      weight: 3.5,
      dashArray: '5, 8',
      opacity: 0.8
    }).addTo(this.map);
  }

  public getTravelGapText(idx: number): string {
    if (!this.activeItinerary) return '';
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    if (!activeDay || !activeDay.activities || idx >= activeDay.activities.length - 1) return '';

    const act1 = activeDay.activities[idx];
    const act2 = activeDay.activities[idx + 1];

    if (typeof act1.lat !== 'number' || typeof act1.lng !== 'number' ||
      typeof act2.lat !== 'number' || typeof act2.lng !== 'number') {
      return '15 phút di chuyển';
    }

    // Haversine formula to calculate distance between two GPS coordinates
    const R = 6371; // Radius of the Earth in km
    const dLat = (act2.lat - act1.lat) * Math.PI / 180;
    const dLng = (act2.lng - act1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(act1.lat * Math.PI / 180) * Math.cos(act2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    // If real road route distance & duration from OSRM is ready, use it!
    if (this.routeLegs && this.routeLegs[idx]) {
      const leg = this.routeLegs[idx];
      return `${leg.durationMin} phút di chuyển (khoảng ${leg.distanceKm} km)`;
    }

    // Fallback: Haversine distance
    const speedKmh = 30;
    let durationMins = Math.round((distance / speedKmh) * 60);
    if (durationMins < 5) durationMins = 5;

    return `${durationMins} phút di chuyển (khoảng ${distance.toFixed(1)} km)`;
  }

  public highlightMapPin(idx: number, highlight: boolean) {
    // 1. Google Maps Engine
    if (this.isGoogleMaps && this.gmap && this.gMarkers && this.gMarkers[idx]) {
      const gmarker = this.gMarkers[idx];
      const activeDay = this.activeItinerary?.days[this.activeDayIdx];
      const act = activeDay?.activities[idx];

      if (highlight && act) {
        // Radiant glowing mint ring on hover
        gmarker.setZIndex(999);
        gmarker.setOpacity(1.0);
        gmarker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: '#059669', // Bright emerald fill
          fillOpacity: 1.0,
          strokeColor: '#34D399', // Radiant light mint glow border
          strokeWeight: 5.5 // Prominent glowing ring
        });
        // User rule: Only show info popup when inspecting route directions
        if (this.activeLegDirections) {
          this.showPinInfoBubble(act, idx, gmarker);
        }
      } else if (!highlight) {
        if (this.gInfoWindow) {
          this.gInfoWindow.close();
        }

        // Restore marker style based on whether route inspection is active
        if (this.activeLegDirections) {
          const isLegEndpoint = (idx === this.activeLegDirections.fromIdx || idx === this.activeLegDirections.toIdx);
          if (isLegEndpoint) {
            gmarker.setZIndex(300);
            gmarker.setOpacity(1.0);
            gmarker.setIcon({
              path: google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: '#059669',
              fillOpacity: 1.0,
              strokeColor: '#FFFFFF',
              strokeWeight: 3.5
            });
          } else {
            gmarker.setZIndex(1);
            gmarker.setOpacity(0.25);
            gmarker.setIcon({
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#94A3B8',
              fillOpacity: 0.45,
              strokeColor: '#E2E8F0',
              strokeWeight: 1.5
            });
          }
        } else {
          // Normal state
          gmarker.setZIndex(idx + 1);
          gmarker.setOpacity(1.0);
          gmarker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: '#184A37',
            fillOpacity: 1.0,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5
          });
        }
      }
      return;
    }

    // 2. Leaflet Fallback Engine
    const marker = this.leafletMarkers[idx];
    if (!marker || typeof marker.getElement !== 'function') return;
    const el = marker.getElement();
    if (!el) return;
    const pin = el.querySelector(".map-leaflet-pin");
    if (pin) {
      if (highlight) {
        pin.style.boxShadow = "0 0 0 4.5px rgba(52, 211, 153, 0.6), 0 4px 12px rgba(0,0,0,0.2)";
        pin.style.borderColor = "#34D399";
        pin.style.backgroundColor = "#059669";
        pin.style.transform = "scale(1.18)";
      } else {
        pin.style.boxShadow = "var(--shadow-sm)";
        pin.style.borderColor = "#FFFFFF";
        pin.style.backgroundColor = "#184A37";
        pin.style.transform = "none";
      }
    }
  }

  // SerpApi Google Maps Search & Interaction
  public async searchPlaceOnMap() {
    const query = this.mapSearchQuery.trim();
    if (!query || !this.activeItinerary) return;

    // Sync search queries
    this.customPlaceTitle = query;
    this.customSearchSuggestions = [];

    this.isAutoSaving = true; // show a small loader indicator
    this.cdr.detectChanges();

    try {
      const results = await this.apiService.searchSerpPlaces(query, this.activeItinerary.destination);
      this.isAutoSaving = false;
      this.cdr.detectChanges();

      if (results && results.length > 0) {
        this.renderSearchPins(results);
      } else {
        this.showAlert('Không tìm thấy địa điểm này ở ' + this.activeItinerary.destination, 'warning');
      }
    } catch (e) {
      this.isAutoSaving = false;
      this.cdr.detectChanges();
      console.error('Search error:', e);
    }
  }

  public async searchSidebarPlaceOnMap() {
    const query = (this.customPlaceTitle || '').trim();
    if (!query) return;

    this.isAutoSaving = true;
    this.cdr.detectChanges();

    try {
      const dest = this.activeItinerary?.destLabel || this.activeItinerary?.dest || 'Hội An';
      const fullQuery = `${query} ${dest}`;

      // 1. First check local catalog services
      const localMatches = (this.localServices || []).filter(s =>
        (s.name || s.name_service || '').toLowerCase().includes(query.toLowerCase())
      );

      if (localMatches.length > 0) {
        const topLocal = localMatches[0];
        const placeObj = {
          title: topLocal.name || topLocal.name_service,
          type: topLocal.type || 'explore',
          cost: topLocal.cost || 50000,
          carbon: topLocal.carbon || 1.5,
          lat: topLocal.lat || (topLocal.current_data && topLocal.current_data.lat) || undefined,
          lng: topLocal.lng || (topLocal.current_data && topLocal.current_data.lng) || undefined,
          address: topLocal.address || dest,
          img: topLocal.img || this.getPlacePlaceholderImage(topLocal.name || topLocal.name_service)
        };
        this.isAutoSaving = false;
        this.openGooglePlacePanel(placeObj);
        if (placeObj.lat && placeObj.lng) {
          if (this.isGoogleMaps && this.gmap) {
            this.gmap.panTo({ lat: placeObj.lat, lng: placeObj.lng });
            this.gmap.setZoom(16);
          } else if (this.map) {
            this.map.flyTo([placeObj.lat, placeObj.lng], 16);
          }
        }
        this.cdr.detectChanges();
        return;
      }

      // 2. Query Google Places backend proxy
      let results = await this.apiService.searchGooglePlaces(fullQuery);

      // 3. Fallback to OpenStreetMap Nominatim if Google Places returns empty
      if (!results || results.length === 0) {
        try {
          const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query + ', ' + dest)}`;
          const osmRes = await fetch(osmUrl, { headers: { 'User-Agent': 'GreenSteps/1.0' } });
          const osmData = await osmRes.json();
          if (osmData && osmData.length > 0) {
            results = osmData.map((r: any) => ({
              title: r.display_name ? r.display_name.split(',')[0] : query,
              name: r.display_name ? r.display_name.split(',')[0] : query,
              address: r.display_name,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
              type: (r.type === 'cafe' || r.type === 'restaurant') ? 'dining' : ((r.type === 'hotel') ? 'lodging' : 'explore')
            }));
          }
        } catch (osmErr) {
          console.warn('OSM search fallback error:', osmErr);
        }
      }

      this.isAutoSaving = false;

      if (results && results.length > 0) {
        this.clearSearchMarkers();
        if (this.isGoogleMaps && this.gmap) {
          const bounds = new google.maps.LatLngBounds();
          results.slice(0, 6).forEach((p: any) => {
            if (p.lat && p.lng) {
              const pos = { lat: p.lat, lng: p.lng };
              bounds.extend(pos);
              const marker = new google.maps.Marker({
                position: pos,
                map: this.gmap,
                title: p.title || p.name,
                animation: google.maps.Animation.DROP
              });
              marker.addListener('click', () => {
                this.ngZone.run(() => {
                  this.openGooglePlacePanel(p);
                });
              });
              this.searchMarkers.push(marker);
            }
          });
          if (results.length > 1) {
            this.gmap.fitBounds(bounds);
          } else if (results[0].lat && results[0].lng) {
            this.gmap.panTo({ lat: results[0].lat, lng: results[0].lng });
            this.gmap.setZoom(16);
          }
        } else if (this.map) {
          this.renderSearchPins(results);
        }
        // Open panel with the top match
        this.openGooglePlacePanel(results[0]);
      } else {
        this.showAlert(`Không tìm thấy địa điểm "${query}". Bạn có thể nhập chi tiết để thêm mới.`, 'warning');
      }
    } catch (e) {
      this.isAutoSaving = false;
      console.error('Search error:', e);
    }
    this.cdr.detectChanges();
  }

  public renderSearchPins(results: any[]) {
    // Clear old search markers
    this.clearSearchMarkers();

    if (this.isGoogleMaps && this.gmap) {
      const gBounds = new google.maps.LatLngBounds();
      results.forEach((item, idx) => {
        if (!item.lat || !item.lng) return;
        const pos = { lat: item.lat, lng: item.lng };
        gBounds.extend(pos);

        const pin = new google.maps.Marker({
          position: pos,
          map: this.gmap,
          label: `${idx + 1}`,
          title: item.title
        });

        pin.addListener('click', () => {
          this.selectGooglePlaceDetails({
            name: item.title,
            formatted_address: item.address,
            rating: item.rating,
            user_ratings_total: item.reviews,
            geometry: { location: { lat: () => item.lat, lng: () => item.lng } }
          });
        });

        this.searchMarkers.push(pin);
      });

      this.gmap.fitBounds(gBounds);
      return;
    }

    if (!this.map) return;
    const bounds = L.latLngBounds([]);

    results.forEach((item, idx) => {
      if (!item.lat || !item.lng) return;

      const lat = item.lat;
      const lng = item.lng;
      bounds.extend([lat, lng]);

      // Create red search pin with pulse animation
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div class="map-leaflet-rec-pin map-leaflet-pin-red-pulse" style="background-color: #EF4444; border: 2px solid #FFFFFF; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md);"><span style="font-size: 11px; font-weight: bold;">${idx + 1}</span></div>`,
          className: 'custom-div-icon-search-pin',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      }).addTo(this.map);

      // Create popup content
      const popupContent = `
        <div style="font-family: var(--font-main); width: 220px; font-size: 13px; line-height: 1.4;">
          ${item.thumbnail ? `<img src="${item.thumbnail}" style="width:100%; height:110px; object-fit:cover; border-radius:8px; margin-bottom:8px;">` : ''}
          <h4 style="font-weight:700; margin:0 0 4px 0; color:var(--text-primary); font-size:14px;">${item.title}</h4>
          ${item.rating ? `
            <div style="color:#f59e0b; font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
              <i class="bi bi-star-fill" style="color: #F59E0B;"></i> ${item.rating} <span>(${item.reviews || 0} đánh giá)</span>
            </div>
          ` : ''}
          <p style="margin:0 0 8px 0; color:#3D5A46; font-size:11px;">${item.address || ''}</p>
          ${item.hours ? `<p style="margin:0 0 8px 0; color:#047857; font-weight:600; font-size:11px;">${item.hours}</p>` : ''}
          <button id="add-search-pin-${idx}" style="width:100%; height:32px; background:#047857; color:white; border:none; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px; transition: background 0.2s;">Thêm vào lịch trình</button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`add-search-pin-${idx}`);
        if (btn) {
          btn.onclick = (e) => {
            e.preventDefault();
            this.addSearpedPlaceToItinerary(item);
            marker.closePopup();
          };
        }
      });

      this.searchMarkers.push(marker);
    });

    if (this.map && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  public addSearpedPlaceToItinerary(item: any) {
    if (!this.activeItinerary) return;
    const time = this.getNextSuggestedTime();
    const type = item.category || 'explore';
    let cost = type === "dining" ? 80000 : (type === "lodging" ? 500000 : 30000);
    let carbon = type === "dining" ? 2 : 4;

    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    if (!activeDay.activities) activeDay.activities = [];
    activeDay.activities.push({
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      time: time,
      title: item.title,
      name: item.title,
      img: item.img || null,
      cost: cost,
      carbon: carbon,
      icon: type === 'lodging' ? 'bi-house-door-fill' : (type === 'dining' ? 'bi-cup-hot-fill' : 'bi-tree-fill'),
      type: type,
      lat: item.lat,
      lng: item.lng
    });

    this.plotMapMarkers();
    this.saveItineraryToDb();

    // Show toast-like feedback
    this.showAlert('Đã thêm "' + item.title + '" vào lịch trình ngày ' + (this.activeDayIdx + 1), 'success');
  }

  public clearSearchMarkers() {
    if (this.searchMarkers && this.searchMarkers.length > 0) {
      this.searchMarkers.forEach(m => {
        try {
          if (typeof m.setMap === 'function') {
            m.setMap(null);
          } else if (this.map && typeof this.map.removeLayer === 'function') {
            this.map.removeLayer(m);
          }
        } catch (e) { }
      });
      this.searchMarkers = [];
      this.cdr.detectChanges();
    }
  }


  public getBucketListCount(): number {
    let total = 0;
    this.customLists.forEach(l => {
      total += l.places.length;
    });
    return total;
  }

  public isDraggingCard: boolean = false;
  private deferredUpdateTimer: any = null;

  public scheduleDeferredUpdates() {
    if (this.deferredUpdateTimer) {
      clearTimeout(this.deferredUpdateTimer);
    }
    this.deferredUpdateTimer = setTimeout(() => {
      this.plotMapMarkers();
      this.recalculateMetrics();
      this.saveItineraryToDb();
    }, 280);
  }

  // Ergonomic Drag & Drop Handlers with Smooth Gap & Dashed Indicator
  public onGripMouseDown(idx: number) {
    this.canDragItem = true;
    this.dragSrcIdx = idx;
  }

  public onDragStart(event: DragEvent, idx: number) {
    if (this.isItineraryLocked()) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement;
    if (target && target.closest('input, button, select, textarea, .act-icon-btn, .time-input-wrap, .btn-conflict-quick-fix')) {
      event.preventDefault();
      return;
    }
    this.isDraggingCard = true;
    this.dragSrcIdx = idx;
    this.canDragItem = true;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', idx.toString());
    }
    const currentTarget = event.currentTarget as HTMLElement;
    if (currentTarget) {
      currentTarget.classList.add('dragging-item');
    }
  }

  public onDragOver(event: DragEvent, idx: number) {
    event.preventDefault();
    if (this.isItineraryLocked()) return;
    if (this.dragSrcIdx !== null && this.dragSrcIdx !== idx) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      const targetEl = event.currentTarget as HTMLElement;
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        let newPos: 'before' | 'after';
        if (this.activeTimelineViewMode === 'pipeline') {
          const relX = event.clientX - rect.left;
          newPos = relX < rect.width / 2 ? 'before' : 'after';
        } else {
          const relY = event.clientY - rect.top;
          newPos = relY < rect.height / 2 ? 'before' : 'after';
        }
        if (this.dragTargetIdx !== idx || this.dragDropPosition !== newPos) {
          this.dragTargetIdx = idx;
          this.dragDropPosition = newPos;
          this.cdr.detectChanges();
        }
      }
    }
  }

  public onDragOverPlaceholder(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  public onDragLeave(event: DragEvent, idx: number) {
    const currentTarget = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }
    if (relatedTarget && relatedTarget.closest('.drag-placeholder-slot')) {
      return; // Keep placeholder slot open when hovering directly inside the placeholder slot!
    }
    if (relatedTarget && relatedTarget.closest('#timelineList')) {
      return; // Keep slot stable while dragging within the timeline list
    }
    if (this.dragTargetIdx === idx) {
      this.dragTargetIdx = null;
      this.dragDropPosition = null;
      this.cdr.detectChanges();
    }
  }

  public onDrop(event: DragEvent, targetIdx: number) {
    event.preventDefault();
    if (this.isItineraryLocked()) return;
    const srcIdx = this.dragSrcIdx;
    const position = this.dragDropPosition || 'after';

    if (srcIdx !== null && this.activeItinerary) {
      const activeDay = this.activeItinerary.days[this.activeDayIdx];
      if (activeDay && activeDay.activities && activeDay.activities.length > 1) {
        let insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
        if (srcIdx < insertIdx) {
          insertIdx--;
        }

        if (srcIdx !== insertIdx && insertIdx >= 0 && insertIdx < activeDay.activities.length) {
          const [movedItem] = activeDay.activities.splice(srcIdx, 1);
          activeDay.activities.splice(insertIdx, 0, movedItem);

          // Fast local recalculation:
          this.checkTimeConflicts(this.activeDayIdx);
          // Defer heavy Google Maps API & DB save so drop is 60 FPS zero-latency:
          this.scheduleDeferredUpdates();
        }
      }
    }
    this.dragSrcIdx = null;
    this.dragTargetIdx = null;
    this.dragDropPosition = null;
    this.canDragItem = false;
    this.isDraggingCard = false;
    this.cdr.detectChanges();
  }

  public onDragEnd(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    if (target) {
      target.classList.remove('dragging-item');
    }
    this.dragSrcIdx = null;
    this.dragTargetIdx = null;
    this.dragDropPosition = null;
    this.canDragItem = false;
    this.isDraggingCard = false;
    this.cdr.detectChanges();
  }

  // Cross-Day Drag & Drop Handlers
  public onDragOverDay(event: DragEvent, targetDayIdx: number) {
    if (this.dragSrcIdx === null || targetDayIdx === this.activeDayIdx || this.isItineraryLocked()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.crossDayDropTargetIdx !== targetDayIdx) {
      this.crossDayDropTargetIdx = targetDayIdx;
      this.cdr.detectChanges();
    }
  }

  public onDragLeaveDay(event: DragEvent, targetDayIdx: number) {
    if (this.crossDayDropTargetIdx === targetDayIdx) {
      this.crossDayDropTargetIdx = null;
      this.cdr.detectChanges();
    }
  }

  public onDropOnDay(event: DragEvent, targetDayIdx: number) {
    event.preventDefault();
    if (this.dragSrcIdx === null || targetDayIdx === this.activeDayIdx || this.isItineraryLocked()) return;
    if (!this.activeItinerary || !this.activeItinerary.days) return;

    const sourceDay = this.activeItinerary.days[this.activeDayIdx];
    const targetDay = this.activeItinerary.days[targetDayIdx];
    if (!sourceDay || !targetDay) return;

    const [movedItem] = sourceDay.activities.splice(this.dragSrcIdx, 1);
    if (!targetDay.activities) targetDay.activities = [];
    targetDay.activities.push(movedItem);

    // Keep times as is, check conflicts:
    this.checkTimeConflicts(this.activeDayIdx);
    this.checkTimeConflicts(targetDayIdx);
    this.switchActiveDay(targetDayIdx);
    this.scheduleDeferredUpdates();

    this.crossDayDropTargetIdx = null;
    this.dragSrcIdx = null;
    this.canDragItem = false;
    this.isDraggingCard = false;
    this.cdr.detectChanges();
  }

  // View Mode & Pipeline Zoom Handlers
  public switchTimelineViewMode(mode: 'timeline' | 'pipeline') {
    this.activeTimelineViewMode = mode;
    try {
      localStorage.setItem('greensteps_timeline_view_mode', mode);
    } catch (e) { }
    this.cdr.detectChanges();
    if (mode === 'pipeline') {
      setTimeout(() => {
        const vp = document.querySelector('.pipeline-canvas-viewport');
        if (vp) vp.scrollLeft = 0;
      }, 50);
    }
  }

  public scrollToPipelineStation(sIdx: number) {
    const viewport = document.querySelector('.pipeline-canvas-viewport');
    const cards = document.querySelectorAll('.pipeline-node-card');
    if (viewport && cards[sIdx]) {
      const cardEl = cards[sIdx] as HTMLElement;
      const targetLeft = cardEl.offsetLeft - (viewport.clientWidth / 2) + (cardEl.clientWidth / 2);
      viewport.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }

  public scrollPipelineStep(direction: number) {
    const viewport = document.querySelector('.pipeline-canvas-viewport');
    if (viewport) {
      viewport.scrollBy({ left: direction * 280, behavior: 'smooth' });
    }
  }

  public zoomPipeline(delta: number) {
    this.pipelineZoomScale = Math.min(1.5, Math.max(0.7, parseFloat((this.pipelineZoomScale + delta).toFixed(1))));
  }

  public resetPipelineZoom() {
    this.pipelineZoomScale = 1.0;
  }

  // Map detail card actions
  public async addPlaceFromMap(details: any, targetDayIdx?: number) {
    if (!this.activeItinerary || !details) return;
    const dayIdx = typeof targetDayIdx === 'number' ? targetDayIdx : this.activeDayIdx;
    const activeDay = this.activeItinerary.days[dayIdx];
    if (!activeDay) return;
    if (!activeDay.activities) activeDay.activities = [];

    // Check smart matching for GreenSteps priority & resolve real price
    const greenMatch = this.findMatchingGreenStepsService(details.title, details.lat, details.lng);
    const resolvedPrice = this.resolvePlaceCost(details.title, details, greenMatch);
    const cost = resolvedPrice.cost;
    const priceUnknown = resolvedPrice.priceUnknown;

    const currentDest = this.activeItinerary?.destLabel || this.activeItinerary?.destination || this.mapSlugToDestLabel(this.activeItinerary?.dest) || 'Đà Lạt';

    // Smart type detection from Google types & keywords
    const lowerTitle = (details.title || '').toLowerCase();
    const rawTypes = Array.isArray(details.types) ? details.types.map((t: string) => t.toLowerCase()) : [];
    let inferredType = greenMatch?.type || details.type;

    if (rawTypes.some((t: string) => ['restaurant', 'food', 'cafe', 'bar', 'meal_takeaway', 'bakery', 'supermarket', 'grocery_or_supermarket', 'grocery_store', 'store'].includes(t)) ||
      /quán|nhà hàng|cà phê|cafe|bún|phở|lẩu|cơm|bánh|ẩm thực|ăn uống|mini go|siêu thị|chợ/.test(lowerTitle)) {
      inferredType = 'dining';
    } else if (rawTypes.some((t: string) => ['lodging', 'hotel', 'motel', 'resort', 'hostel', 'guest_house'].includes(t)) ||
      /homestay|hotel|khách sạn|resort|nhà nghỉ|villa|nghỉ dưỡng/.test(lowerTitle)) {
      inferredType = 'lodging';
    } else if (rawTypes.some((t: string) => ['transit_station', 'bus_station', 'airport', 'taxi_stand'].includes(t)) ||
      /xe|bến xe|sân bay|ga tàu|di chuyển/.test(lowerTitle)) {
      inferredType = 'transport';
    } else if (!inferredType || inferredType === 'explore') {
      inferredType = 'attraction';
    }

    const type = inferredType;
    const carbon = greenMatch?.carbon !== undefined ? greenMatch.carbon : (details.carbon !== undefined ? details.carbon : 0.8);
    const isPartner = !!greenMatch || !!details.isPartner;
    const time = this.getNextSuggestedTime(dayIdx, type, details.lat, details.lng);
    const img = (details.photos && details.photos.length > 0 && details.photos[0])
      ? details.photos[0]
      : (details.img && !details.img.includes('hoi-an-pho-co-den-long-02.jpg'))
        ? details.img
        : this.getPlacePlaceholderImage(details.title, type, currentDest);
    const address = details.address || this.getPlaceAddress(details.title);

    const newAct: any = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      time: time,
      title: details.title,
      type: type,
      cost: cost,
      priceUnknown: priceUnknown,
      note: '',
      carbon: carbon,
      is_shared: this.checkIfSharedByDefault(details.title, type),
      lat: details.lat,
      lng: details.lng,
      img: img,
      address: address,
      rating: details.rating || 4.8,
      reviews: details.reviews || 250,
      place_id: details.place_id || null,
      isPartner: isPartner
    };

    activeDay.activities.push(newAct);
    this.sortActivitiesByTime(dayIdx);
    this.checkTimeConflicts(dayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    this.filterOutCurrentActivities();
    await this.saveItineraryToDb();

    if (this.activeGooglePlacePanel && (this.activeGooglePlacePanel.title === details.title || this.activeGooglePlacePanel.place_id === details.place_id)) {
      this.activeGooglePlacePanel.isActivity = true;
      this.activeGooglePlacePanel.itemRef = newAct;
    }

    this.focusTimelineItem(details.title);

    if (priceUnknown) {
      const wantCustomPrice = await this.showConfirm(
        'Chưa có dữ liệu về giá',
        `Địa danh "${details.title}" hiện chưa có dữ liệu giá vé trong hệ thống (tạm tính 0đ). Bạn có muốn tự điền chi phí dự kiến cho địa điểm này không?`
      );
      if (wantCustomPrice) {
        this.startEditActivityPrice(newAct);
      }
    } else {
      this.showAlert(`Đã thêm "${details.title}" vào Ngày ${dayIdx + 1}!`, 'success');
    }
    this.cdr.detectChanges();
  }

  public async deletePlaceFromMap(index: number) {
    if (!this.activeItinerary) return;
    await this.deleteActivity(index);
    this.closePlaceDetails();
  }

  private focusTimelineItem(name: string) {
    const el = document.getElementById('timelineList');
    if (!el) return;
    const cards = el.querySelectorAll('.timeline-item');
    cards.forEach(cardEl => {
      const titleEl = cardEl.querySelector('.activity-card-title');
      if (titleEl && titleEl.textContent === name) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const actCard = cardEl.querySelector('.activity-card') as HTMLElement;
        if (actCard) {
          actCard.style.transform = "scale(1.02)";
          actCard.style.borderColor = "#2563EB";
          setTimeout(() => {
            actCard.style.transform = "none";
            actCard.style.borderColor = "var(--border-color)";
          }, 1200);
        }
      }
    });
  }

  // AI RECOMMENDATION CHAT
  public toggleAiChat() {
    this.isAiChatOpen = !this.isAiChatOpen;
  }

  public async sendAiMessage(promptText?: string) {
    const text = (promptText || this.aiInputText).trim();
    if (!text || !this.activeItinerary) return;

    this.aiMessages.push({ text: text, isOutgoing: true });
    this.aiInputText = '';
    this.isAiThinking = true;
    this.cdr.detectChanges();

    try {
      const activeDay = this.activeItinerary.days[this.activeDayIdx];
      const res = await this.apiService.sendAiMessage(
        text,
        this.activeItinerary.destLabel || this.activeItinerary.destination || 'Đà Lạt',
        activeDay ? activeDay.activities : []
      );
      this.aiMessages.push({
        text: res.reply,
        isOutgoing: false,
        rec: res.recommendation,
        action: res.action
      });
    } catch (e) {
      console.error('AI Chat error:', e);
      const error = e as any;
      const catalogUnavailable = error?.error?.code === 'CHAT_CATALOG_UNAVAILABLE'
        || error?.error?.error === 'DatabaseUnavailable';
      this.aiMessages.push({
        text: catalogUnavailable ? 'Danh mục du lịch hiện chưa truy cập được nên trợ lý chưa thể xác minh tour, dịch vụ hoặc giá. Lịch trình của bạn vẫn có thể được chỉnh sửa; vui lòng thử tư vấn lại sau.' : "Xin lỗi, trợ lý AI đang bận hoặc gặp lỗi kết nối. Hãy thử lại sau nhé!",
        isOutgoing: false
      });
    } finally {
      this.isAiThinking = false;
      this.cdr.detectChanges();

      // Auto scroll to bottom
      setTimeout(() => {
        const area = document.getElementById('aiMessagesArea');
        if (area) {
          area.scrollTop = area.scrollHeight;
        }
      }, 100);
    }
  }

  public triggerAutoAdjustTimes() {
    this.autoAdjustIllogicalTimes(this.activeDayIdx);
    this.aiMessages.push({
      text: "✅ Đã tự động điều chỉnh lại các mốc thời gian trên timeline ngày hôm nay hợp lý!",
      isOutgoing: false
    });
    this.cdr.detectChanges();
    setTimeout(() => {
      const area = document.getElementById('aiMessagesArea');
      if (area) area.scrollTop = area.scrollHeight;
    }, 100);
  }

  // WALLET & CHECKOUT MODAL
  public async reloadWalletInfo() {
    const user = this.authService.getCurrentUser();
    if (user) {
      const wallet = await this.apiService.getWalletInfo(user.id || user._id || '');
      this.walletBalance = wallet.balance;
      this.walletRegistered = wallet.registered;
      this.cdr.detectChanges();
    }
  }

  public async handleActivateWallet() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập!', 'warning');
      return;
    }
    const userId = user.id || user._id || '';
    const res = await this.apiService.activateWallet(userId);
    if (res && res.success) {
      this.walletBalance = res.balance;
      this.walletRegistered = true;
      this.showAlert('Kích hoạt ví GreenSteps thành công! Bạn nhận được quà tặng chào mừng 200.000đ.', 'success');
      this.cdr.detectChanges();
    } else {
      this.showAlert('Kích hoạt ví thất bại!', 'error');
    }
  }

  public openCheckout(isItinerary: boolean = true) {
    this.isCheckoutModalOpen = true;
    this.isItineraryPay = isItinerary;
    this.checkoutItems = [];

    if (this.activeItinerary && this.activeItinerary.days) {
      this.activeItinerary.days.forEach((day: any) => {
        (day.activities || []).forEach((act: any) => {
          const isPartner = act.is_partner === true || act.isPartner === true || act.source === 'partner' || (act.provider && act.provider !== 'Google Maps');
          const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
          const actCost = Number(act.cost) || 0;
          const totalActCost = isShared ? actCost : (actCost * this.guestCount);
          this.checkoutItems.push({
            title: `${day.title || 'Ngày'}: ${act.title || act.name}`,
            cost: totalActCost,
            isPartner: Boolean(isPartner),
            depositRequired: Boolean(isPartner && totalActCost > 0)
          } as any);
        });
        if (day.legTransports) {
          Object.values(day.legTransports).forEach((lt: any) => {
            if (lt && lt.price) {
              this.checkoutItems.push({
                title: `${day.title}: Xe chặng (${lt.provider} - ${lt.vehicleName})`,
                cost: Number(lt.price) || 0,
                isPartner: true,
                depositRequired: true
              } as any);
            }
          });
        }
        if (day.vehicleRental && day.vehicleRental.price) {
          this.checkoutItems.push({
            title: `${day.title}: Thuê xe (${day.vehicleRental.provider} - ${day.vehicleRental.vehicleName})`,
            cost: Number(day.vehicleRental.price) || 0,
            isPartner: true,
            depositRequired: true
          } as any);
        }
      });
    }

    if (this.activeItinerary && this.activeItinerary.departureTransport && this.activeItinerary.departureTransport.price) {
      const dt = this.activeItinerary.departureTransport;
      const count = this.guestCount || 1;
      this.checkoutItems.push({
        title: `Vé xuất phát: ${dt.provider} (${dt.name}) x ${count} vé`,
        cost: (Number(dt.price) || 0) * count,
        isPartner: true,
        depositRequired: true
      } as any);
    }

    this.checkoutTotal = this.itineraryDepositAmount > 0 ? this.itineraryDepositAmount : this.itineraryFinalTotal;
    if (!this.currentUser) {
      this.checkoutPaymentMethod = 'qr';
    } else {
      this.checkoutPaymentMethod = this.walletRegistered ? 'wallet' : 'qr';
    }
    this.reloadWalletInfo();
    this.cdr.detectChanges();
  }

  public triggerCheckout() {
    if (!this.activeItinerary) return;

    if (this.hasAnyConflictInEntireItinerary()) {
      this.showAlert('Thời gian lịch trình chưa phù hợp, vui lòng kiểm tra lại.', 'warning');
      this.highlightFirstConflict();
      return;
    }

    const daysLength = (this.activeItinerary.days && this.activeItinerary.days.length) ? this.activeItinerary.days.length : 3;
    const checkIn = this.activeItinerary.start_date || this.activeItinerary.startDate || new Date().toISOString().split('T')[0];
    const checkOutDate = new Date(`${checkIn}T12:00:00`);
    checkOutDate.setDate(checkOutDate.getDate() + Math.max(daysLength - 1, 1));
    const checkOut = this.activeItinerary.end_date || this.activeItinerary.endDate || checkOutDate.toISOString().split('T')[0];

    const subtotal = this.itinerarySubtotalCost;
    const discount = this.itineraryDiscountAmount;
    const vat = this.itineraryVatAmount;
    const total = this.itineraryFinalTotal;
    const deposit = this.itineraryDepositAmount;
    const remaining = this.itineraryRemainingAmount;

    const pricingSnapshot = {
      subtotal,
      discount,
      vat,
      total,
      deposit,
      remaining,
      guestCount: this.guestCount || 1
    };

    const bookingContext = {
      hotelId: `hotel_${this.activeItinerary.destLabel || this.activeItinerary.destination || 'greensteps'}`.toLowerCase().replace(/\s+/g, '_'),
      roomId: 'premium_double_window',
      tourId: this.activeItinerary.id,
      bookingType: 'itinerary',
      checkIn,
      checkOut,
      guestCount: this.guestCount || 1,
      roomCount: 1,
      pricingSnapshot: JSON.stringify(pricingSnapshot)
    };

    try {
      localStorage.setItem('greensteps_itinerary_pricing_snapshot', JSON.stringify(pricingSnapshot));
      localStorage.setItem('greensteps_booking_context', JSON.stringify(bookingContext));
      localStorage.setItem('greensteps_active_itinerary_checkout', JSON.stringify(this.activeItinerary));
      localStorage.setItem(`greensteps_guest_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
    } catch (e) {
      console.warn('Could not store booking context:', e);
    }

    if (deposit <= 0) {
      void this.saveItineraryToDb();
      this.showAlert('Đã lưu hành trình chuyến đi thành công! Các địa điểm tự túc sẽ thanh toán trực tiếp tại điểm đến.', 'success');
      return;
    }

    this.router.navigate(['/booking'], { queryParams: bookingContext });
  }

  public get itineraryPerPersonCost(): number {
    let cost = 0;
    if (this.activeItinerary && this.activeItinerary.days) {
      this.activeItinerary.days.forEach((day: any) => {
        if (day && day.activities) {
          day.activities.forEach((act: any) => {
            const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
            if (act.cost > 0 && !isShared) {
              cost += act.cost;
            }
          });
        }
      });
    }
    // Departure transport per person
    if (this.activeItinerary && this.activeItinerary.departureTransport && this.activeItinerary.departureTransport.price) {
      cost += Number(this.activeItinerary.departureTransport.price) || 0;
    }
    return cost;
  }

  public get itineraryFlatCost(): number {
    let cost = 0;
    if (this.activeItinerary && this.activeItinerary.days) {
      this.activeItinerary.days.forEach((day: any) => {
        if (day && day.activities) {
          day.activities.forEach((act: any) => {
            const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
            if (act.cost > 0 && isShared) {
              cost += act.cost;
            }
          });
        }
        // Leg transports in this day (flat cost per vehicle)
        if (day.legTransports) {
          Object.values(day.legTransports).forEach((lt: any) => {
            if (lt && lt.price) cost += Number(lt.price) || 0;
          });
        }
        // Daily vehicle rental
        if (day.vehicleRental && day.vehicleRental.price) {
          cost += Number(day.vehicleRental.price) || 0;
        }
      });
    }
    return cost;
  }

  public get itineraryTotalCost(): number {
    return (this.itineraryPerPersonCost * this.guestCount) + this.itineraryFlatCost;
  }

  public get itinerarySubtotalCost(): number {
    return this.itineraryTotalCost || this.totalCost || 0;
  }

  public get itineraryDiscountAmount(): number {
    const subtotal = this.itinerarySubtotalCost;
    return subtotal >= 1000000 ? 50000 : 0;
  }

  public get itineraryVatAmount(): number {
    const taxable = Math.max(0, this.itinerarySubtotalCost - this.itineraryDiscountAmount);
    return Math.round(taxable * 0.08);
  }

  public get itineraryFinalTotal(): number {
    return this.itinerarySubtotalCost - this.itineraryDiscountAmount + this.itineraryVatAmount;
  }

  public get itineraryPartnerCost(): number {
    let cost = 0;
    if (this.activeItinerary && this.activeItinerary.days) {
      this.activeItinerary.days.forEach((day: any) => {
        if (day && day.activities) {
          day.activities.forEach((act: any) => {
            const isPartner = act.is_partner === true || act.isPartner === true || act.source === 'partner' || (act.provider && act.provider !== 'Google Maps') || !!this.findMatchingGreenStepsService(act.title, act.lat, act.lng);
            if (isPartner && Number(act.cost) > 0) {
              const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
              if (isShared) {
                cost += Number(act.cost);
              } else {
                cost += Number(act.cost) * this.guestCount;
              }
            }
          });
        }
        if (day.legTransports) {
          Object.values(day.legTransports).forEach((lt: any) => {
            if (lt && lt.price) cost += Number(lt.price) || 0;
          });
        }
        if (day.vehicleRental && day.vehicleRental.price) {
          cost += Number(day.vehicleRental.price) || 0;
        }
      });
    }
    if (this.activeItinerary?.departureTransport?.price) {
      cost += Number(this.activeItinerary.departureTransport.price) * this.guestCount;
    }
    return cost;
  }

  public get itineraryDepositAmount(): number {
    // Chỉ thu cọc 30% đối với các dịch vụ của ĐỐI TÁC GREENSTEPS
    const partnerCost = this.itineraryPartnerCost;
    if (partnerCost <= 0) return 0;
    return Math.round(partnerCost * 0.3);
  }

  public get itineraryRemainingAmount(): number {
    return this.itineraryFinalTotal - this.itineraryDepositAmount;
  }

  public toggleActivityShared(act: any) {
    if (this.isItineraryLocked()) return;
    const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
    act.is_shared = !isShared;
    this.saveItineraryToDb();
  }

  // =========================================================================
  // REAL TRANSPORT SERVICE INTEGRATION (Đối tác vận tải GreenSteps)
  // =========================================================================

  public getLegTransport(dayIdx: number, legIdx: number): any {
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) return null;
    const day = this.activeItinerary.days[dayIdx];
    return day.legTransports ? (day.legTransports[legIdx] || null) : null;
  }

  public getLegDistanceKm(dayIdx: number, idx: number): number {
    if (!this.activeItinerary) return 5;
    const activeDay = this.activeItinerary.days[dayIdx];
    if (!activeDay || !activeDay.activities || idx >= activeDay.activities.length - 1) return 5;
    if (this.routeLegs && this.routeLegs[idx] && this.routeLegs[idx].distanceKm) {
      return Number(this.routeLegs[idx].distanceKm) || 5;
    }
    const act1 = activeDay.activities[idx];
    const act2 = activeDay.activities[idx + 1];
    if (typeof act1?.lat === 'number' && typeof act1?.lng === 'number' && typeof act2?.lat === 'number' && typeof act2?.lng === 'number') {
      const R = 6371;
      const dLat = (act2.lat - act1.lat) * Math.PI / 180;
      const dLng = (act2.lng - act1.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(act1.lat * Math.PI / 180) * Math.cos(act2.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.max(1, Math.round(R * c * 10) / 10);
    }
    return 5;
  }

  public openLegTransportModal(legIdx: number, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.activeItinerary) return;
    this.transportModalMode = 'leg';
    this.activeLegBookingIdx = legIdx;
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    const act1 = activeDay?.activities?.[legIdx];
    const act2 = activeDay?.activities?.[legIdx + 1];
    this.activeLegOriginName = act1?.title || 'Điểm đón';
    this.activeLegDestName = act2?.title || 'Điểm đến';
    this.activeLegDistanceKm = this.getLegDistanceKm(this.activeDayIdx, legIdx);
    const startM = this.timeToMinutes(act1?.time || '08:00');
    const dwellM = this.getDwellMinutesForType(act1?.type || 'attraction');
    this.activeLegEstimatedTime = this.minutesToTime(startM + dwellM);
    this.transportFilterTab = 'all';
    this.loadAvailableLegTransports();
    this.isTransportModalOpen = true;
    this.cdr.detectChanges();
  }

  public openDepartureTransportModal() {
    if (!this.activeItinerary) return;
    this.transportModalMode = 'departure';
    this.activeLegBookingIdx = null;
    this.transportFilterTab = 'all';
    this.loadAvailableDepartureTransports();
    this.isTransportModalOpen = true;
    this.cdr.detectChanges();
  }

  public openDailyRentalModal(dayIdx: number) {
    if (!this.activeItinerary) return;
    this.transportModalMode = 'rental';
    this.activeDayIdx = dayIdx;
    this.transportFilterTab = 'all';
    this.loadAvailableRentalTransports();
    this.isTransportModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeTransportModal() {
    this.isTransportModalOpen = false;
    this.cdr.detectChanges();
  }

  public setTransportFilterTab(tab: string) {
    this.transportFilterTab = tab;
  }

  public get filteredTransportOptions(): any[] {
    if (!this.availableTransportOptions) return [];
    if (this.transportFilterTab === 'all') return this.availableTransportOptions;
    return this.availableTransportOptions.filter(opt => {
      if (opt.category === this.transportFilterTab || opt.vehicleType === this.transportFilterTab || opt.type === this.transportFilterTab) return true;
      return false;
    });
  }

  public confirmChooseTransport(opt: any) {
    if (this.transportModalMode === 'leg') {
      this.selectLegTransport(opt);
    } else if (this.transportModalMode === 'departure') {
      this.selectDepartureTransport(opt);
    } else if (this.transportModalMode === 'rental') {
      this.selectDailyRental(opt);
    }
  }

  public selectLegTransport(option: any) {
    if (!this.activeItinerary || this.activeLegBookingIdx === null) return;
    const day = this.activeItinerary.days[this.activeDayIdx];
    if (!day) return;
    if (!day.legTransports) day.legTransports = {};
    day.legTransports[this.activeLegBookingIdx] = {
      ...option,
      legIdx: this.activeLegBookingIdx,
      distanceKm: this.activeLegDistanceKm,
      pickupTime: this.activeLegEstimatedTime,
      bookedAt: new Date().toISOString()
    };
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.closeTransportModal();
    this.showAlert(`Đã đặt trước xe "${option.vehicleName}" (${option.provider}) cho chặng di chuyển!`, 'success');
    this.cdr.detectChanges();
  }

  public removeLegTransport(dayIdx: number, legIdx: number, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) return;
    const day = this.activeItinerary.days[dayIdx];
    if (day.legTransports && day.legTransports[legIdx]) {
      delete day.legTransports[legIdx];
      this.recalculateMetrics();
      this.saveItineraryToDb();
      this.showAlert('Đã hủy đặt xe cho chặng này.', 'info');
      this.cdr.detectChanges();
    }
  }

  public selectDepartureTransport(option: any) {
    if (!this.activeItinerary) return;
    this.activeItinerary.departureTransport = {
      ...option,
      bookedAt: new Date().toISOString()
    };
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.closeTransportModal();
    this.showAlert(`Đã chọn vé xuất phát "${option.provider} - ${option.name}"!`, 'success');
    this.cdr.detectChanges();
  }

  public removeDepartureTransport() {
    if (!this.activeItinerary) return;
    delete this.activeItinerary.departureTransport;
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.showAlert('Đã gỡ vé phương tiện xuất phát.', 'info');
    this.cdr.detectChanges();
  }

  public selectDailyRental(option: any) {
    if (!this.activeItinerary) return;
    const day = this.activeItinerary.days[this.activeDayIdx];
    if (!day) return;
    day.vehicleRental = {
      ...option,
      bookedAt: new Date().toISOString()
    };
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.closeTransportModal();
    this.showAlert(`Đã đặt thuê "${option.vehicleName}" cho ${day.title}!`, 'success');
    this.cdr.detectChanges();
  }

  public removeDailyRental(dayIdx: number) {
    if (!this.activeItinerary || !this.activeItinerary.days || !this.activeItinerary.days[dayIdx]) return;
    const day = this.activeItinerary.days[dayIdx];
    delete day.vehicleRental;
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.showAlert('Đã hủy thuê xe cho ngày này.', 'info');
    this.cdr.detectChanges();
  }

  public getTransportIcon(type: string): string {
    switch (type) {
      case 'flight':
        return 'bi bi-airplane';
      case 'coach':
      case 'bus':
        return 'bi bi-bus-front';
      case 'electric_car':
      case 'taxi':
      case 'car':
        return 'bi bi-ev-front';
      case 'electric_motorbike':
      case 'bike':
      case 'motorbike':
      case 'bicycle':
        return 'bi bi-bicycle';
      default:
        return 'bi bi-car-front';
    }
  }

  public switchLegPanelTab(tab: 'book' | 'directions') {
    this.legPanelTab = tab;
    this.showVehiclePolicyView = false;
    this.isLegTimePickerOpen = false;
    this.cdr.detectChanges();
  }

  public setLegVehicleCategory(cat: 'car' | 'motorbike') {
    this.legVehicleCategory = cat;
    const list = this.filteredLegVehicles;
    if (list.length > 0) {
      this.selectedLegVehicle = list[0];
    }
    this.cdr.detectChanges();
  }

  public get filteredLegVehicles(): any[] {
    if (!this.availableTransportOptions) return [];
    return this.availableTransportOptions.filter(v => v.category === this.legVehicleCategory);
  }

  public selectLegVehicleOption(v: any) {
    this.selectedLegVehicle = v;
    this.cdr.detectChanges();
  }

  public get legPaymentMethodLabel(): string {
    const item = this.legPaymentMethods[this.legPaymentMethodIdx];
    return item ? (typeof item === 'string' ? item : item.name) : 'Ví GreenSteps';
  }

  public toggleLegPaymentDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.isLegPaymentDropdownOpen = !this.isLegPaymentDropdownOpen;
    this.isLegVoucherDropdownOpen = false;
    this.cdr.detectChanges();
  }

  public selectLegPaymentMethod(idx: number, event?: Event) {
    if (event) event.stopPropagation();
    this.legPaymentMethodIdx = idx;
    this.isLegPaymentDropdownOpen = false;
    this.cdr.detectChanges();
  }

  public toggleLegVoucherDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.isLegVoucherDropdownOpen = !this.isLegVoucherDropdownOpen;
    this.isLegPaymentDropdownOpen = false;
    this.cdr.detectChanges();
  }

  public selectLegVoucher(idx: number, event?: Event) {
    if (event) event.stopPropagation();
    this.legVoucherIdx = idx;
    this.isLegVoucherDropdownOpen = false;
    this.cdr.detectChanges();
  }

  public onDragOverTravelGap(event: DragEvent, fromIdx: number) {
    event.preventDefault();
    if (this.isItineraryLocked()) return;
    if (this.dragSrcIdx !== null) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const newTarget = fromIdx + 1;
      if (this.dragTargetIdx !== newTarget || this.dragDropPosition !== 'before') {
        this.dragTargetIdx = newTarget;
        this.dragDropPosition = 'before';
        this.cdr.detectChanges();
      }
    }
  }

  public onDragLeaveTravelGap(event: DragEvent, fromIdx: number) {
    // Keep placeholder open
  }

  public onDropTravelGap(event: DragEvent, fromIdx: number) {
    event.preventDefault();
    if (this.dragSrcIdx === null || this.isItineraryLocked()) return;
    this.onDrop(event, fromIdx + 1);
  }


  public cycleLegPaymentMethod() {
    this.legPaymentMethodIdx = (this.legPaymentMethodIdx + 1) % this.legPaymentMethods.length;
    this.cdr.detectChanges();
  }

  public get legVoucherLabel(): string {
    return this.legVouchers[this.legVoucherIdx]?.label || 'Voucher';
  }

  public get legVoucherDiscount(): number {
    return this.legVouchers[this.legVoucherIdx]?.discount || 0;
  }

  public cycleLegVoucher() {
    this.legVoucherIdx = (this.legVoucherIdx + 1) % this.legVouchers.length;
    this.cdr.detectChanges();
  }

  public getLegOptionFinalPrice(basePrice: number): number {
    return Math.max(10000, (Number(basePrice) || 0) - this.legVoucherDiscount);
  }

  public toggleLegTimePicker() {
    this.isLegTimePickerOpen = !this.isLegTimePickerOpen;
    this.cdr.detectChanges();
  }

  public findMotorbikeDriver() {
    this.legVehicleCategory = 'motorbike';
    const bikes = this.filteredLegVehicles;
    if (bikes.length > 0) {
      this.selectedLegVehicle = bikes[0];
      this.selectedLegVehicle.driverStatus = 'Tài xế cách 250m';
    }
    this.showAlert('Đã tìm thấy tài xế xe ôm điện gần điểm xuất phát!', 'info');
    this.cdr.detectChanges();
  }

  public bookSelectedLegVehicle() {
    if (!this.activeItinerary || !this.activeLegDirections) return;
    const legIdx = this.activeLegDirections.fromIdx;
    const option = this.selectedLegVehicle || this.filteredLegVehicles[0];
    if (!option) return;

    const day = this.activeItinerary.days[this.activeDayIdx];
    if (!day) return;
    if (!day.legTransports) day.legTransports = {};

    const finalPrice = this.getLegOptionFinalPrice(option.price);
    day.legTransports[legIdx] = {
      ...option,
      price: finalPrice,
      legIdx: legIdx,
      distanceKm: this.activeLegDistanceKm,
      pickupTime: this.legPickupTime || '09:00',
      paymentMethod: this.legPaymentMethodLabel,
      voucher: this.legVoucherDiscount > 0 ? this.legVoucherLabel : null,
      bookedAt: new Date().toISOString()
    };

    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.showAlert(`Đã đặt trước "${option.provider} - ${option.vehicleName}" (Đón lúc ${this.legPickupTime})!`, 'success');
    this.cdr.detectChanges();
  }

  public startGpsDirections() {
    if (!this.activeLegDirections) return;
    this.isGpsNavigating = true;
    this.cdr.detectChanges();

    const { fromCoords, toCoords, fromIdx, toIdx } = this.activeLegDirections;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.ngZone.run(() => {
            const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            this.renderGpsPositionOnMap(userCoords, toCoords, fromIdx, toIdx);
            this.showAlert('Đã bật định vị GPS và bắt đầu dẫn đường trực tiếp trên bản đồ!', 'success');
            this.cdr.detectChanges();
          });
        },
        () => {
          this.ngZone.run(() => {
            // Fallback to origin coords if browser blocks geolocation permission
            this.renderGpsPositionOnMap(fromCoords, toCoords, fromIdx, toIdx);
            this.showAlert('Đã kích hoạt chế độ dẫn đường GPS từ điểm xuất phát của chặng!', 'info');
            this.cdr.detectChanges();
          });
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      this.renderGpsPositionOnMap(fromCoords, toCoords, fromIdx, toIdx);
      this.showAlert('Đã kích hoạt chế độ dẫn đường cho chặng!', 'info');
    }
  }

  private renderGpsPositionOnMap(originCoords: { lat: number; lng: number }, destCoords: { lat: number; lng: number }, fromIdx: number, toIdx: number) {
    if (this.isGoogleMaps && this.gmap && typeof google !== 'undefined' && google.maps) {
      if (this.gpsUserMarker) {
        try { this.gpsUserMarker.setMap(null); } catch (e) { }
      }
      this.gpsUserMarker = new google.maps.Marker({
        position: originCoords,
        map: this.gmap,
        title: 'Vị trí định vị GPS',
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#184A37',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        }
      });
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(originCoords);
      bounds.extend(destCoords);
      this.gmap.fitBounds(bounds, { top: 70, right: 400, bottom: 70, left: 70 });
    } else if (this.map && typeof L !== 'undefined') {
      if (this.gpsUserMarker) {
        try { this.map.removeLayer(this.gpsUserMarker); } catch (e) { }
      }
      this.gpsUserMarker = L.circleMarker([originCoords.lat, originCoords.lng], {
        radius: 9,
        fillColor: '#184A37',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      }).addTo(this.map);
      this.map.fitBounds([
        [originCoords.lat, originCoords.lng],
        [destCoords.lat, destCoords.lng]
      ], { padding: [50, 50] });
    }
  }

  private loadAvailableLegTransports() {
    const km = Math.max(1, this.activeLegDistanceKm);
    const taxi4Price = Math.max(35000, Math.round(km * 12500 / 1000) * 1000);
    const taxi7Price = Math.max(50000, Math.round(km * 15500 / 1000) * 1000);
    const limo9Price = Math.max(85000, Math.round(km * 18000 / 1000) * 1000);
    const bikePrice = Math.max(18000, Math.round(km * 5500 / 1000) * 1000);
    const klaraPrice = Math.max(24000, Math.round(km * 6500 / 1000) * 1000);
    const evoPrice = Math.max(20000, Math.round(km * 6000 / 1000) * 1000);

    this.availableTransportOptions = [
      // Danh mục Ô tô (category: 'car')
      {
        id: 'car_xanhsm_4',
        provider: 'Xanh SM Taxi',
        vehicleName: 'VinFast VF e34 (Sedan 4 chỗ)',
        vehicleType: 'electric_car',
        category: 'car',
        capacity: 4,
        price: taxi4Price,
        carbonSaved: Math.round(km * 0.12 * 10) / 10,
        description: 'Đón tận nơi đúng giờ, xe điện không phát thải.'
      },
      {
        id: 'car_xanhsm_7',
        provider: 'Xanh SM Luxury',
        vehicleName: 'VinFast VF 8 (SUV 7 chỗ VIP)',
        vehicleType: 'electric_car',
        category: 'car',
        capacity: 7,
        price: taxi7Price,
        carbonSaved: Math.round(km * 0.15 * 10) / 10,
        description: 'Khoang xe rộng rãi, chứa nhiều hành lý.'
      },
      {
        id: 'car_moclo_9',
        provider: 'Mộc Lộ Travel',
        vehicleName: 'Limousine Dcar 9 chỗ',
        vehicleType: 'car',
        category: 'car',
        capacity: 9,
        price: limo9Price,
        carbonSaved: Math.round(km * 0.16 * 10) / 10,
        description: 'Ghế massage rộng rãi, phù hợp nhóm gia đình.'
      },
      {
        id: 'car_suoingoc_16',
        provider: 'Suối Ngọc Move',
        vehicleName: 'Minibus sinh thái 16 chỗ',
        vehicleType: 'bus',
        category: 'car',
        capacity: 16,
        price: 35000,
        carbonSaved: Math.round(km * 0.18 * 10) / 10,
        description: 'Tuyến cố định kết nối các điểm du lịch.'
      },
      // Danh mục Xe máy (category: 'motorbike')
      {
        id: 'bike_xanhsm_1',
        provider: 'Xanh SM Bike',
        vehicleName: 'Xe ôm điện VinFast Feliz S',
        vehicleType: 'electric_motorbike',
        category: 'motorbike',
        capacity: 1,
        price: bikePrice,
        carbonSaved: Math.round(km * 0.08 * 10) / 10,
        description: 'Di chuyển nhanh chóng, tài xế bản địa.'
      },
      {
        id: 'bike_lamay_2',
        provider: 'Lá Mây Mobility',
        vehicleName: 'Xe máy điện VinFast Klara S',
        vehicleType: 'electric_motorbike',
        category: 'motorbike',
        capacity: 2,
        price: klaraPrice,
        carbonSaved: Math.round(km * 0.09 * 10) / 10,
        description: 'Giao xe tận điểm đón, kèm 2 mũ bảo hiểm.'
      },
      {
        id: 'bike_doimay_3',
        provider: 'Đồi Mây Wheels',
        vehicleName: 'Xe máy điện VinFast Evo200',
        vehicleType: 'electric_motorbike',
        category: 'motorbike',
        capacity: 2,
        price: evoPrice,
        carbonSaved: Math.round(km * 0.09 * 10) / 10,
        description: 'Pin LFP dung lượng cao, chạy êm trên đồi dốc.'
      }
    ];
  }

  private loadAvailableDepartureTransports() {
    const dest = (this.activeItinerary?.destLabel || this.activeItinerary?.destination || this.mapSlugToDestLabel(this.activeItinerary?.dest) || 'Đà Lạt').toLowerCase();

    if (dest.includes('đà nẵng') || dest.includes('hội an') || dest.includes('quảng nam')) {
      this.availableTransportOptions = [
        {
          provider: 'Vietnam Airlines',
          name: 'Chuyến bay đến Đà Nẵng (DAD)',
          code: 'VN-128 (SGN/HAN ⇄ DAD)',
          type: 'flight',
          category: 'flight',
          departureTime: '06:30',
          arrivalTime: '07:50',
          price: 1350000,
          carbonSaved: 14.5,
          baggage: 'Bao gồm 23kg ký gửi + 12kg xách tay, trung chuyển xe điện Hội An.'
        },
        {
          provider: 'Đường sắt Việt Nam',
          name: 'Tàu Di sản Miền Trung (Heritage Train)',
          code: 'SE-ECO-03',
          type: 'train',
          category: 'coach',
          departureTime: '19:00 (Đêm trước)',
          arrivalTime: '06:30 (Ga Đà Nẵng)',
          price: 680000,
          carbonSaved: 22.0,
          baggage: 'Toa giường nằm máy lạnh, ngắm đèo Hải Vân hùng vĩ.'
        },
        {
          provider: 'Phương Trang FUTA',
          name: 'Limousine Tuyến Đà Nẵng - Hội An',
          code: 'FUTA-DNH-09',
          type: 'coach',
          category: 'coach',
          departureTime: '07:00',
          arrivalTime: '08:00',
          price: 180000,
          carbonSaved: 15.0,
          baggage: 'Ghế ngồi massage, đón trả tận nơi trung tâm phố cổ.'
        }
      ];
    } else if (dest.includes('phú yên') || dest.includes('tuy hòa')) {
      this.availableTransportOptions = [
        {
          provider: 'Vietnam Airlines',
          name: 'Chuyến bay đến Sân bay Tuy Hòa (TTH)',
          code: 'VN-1650 (SGN/HAN ⇄ TTH)',
          type: 'flight',
          category: 'flight',
          departureTime: '07:15',
          arrivalTime: '08:25',
          price: 1290000,
          carbonSaved: 13.5,
          baggage: 'Bao gồm 23kg hành lý ký gửi, hỗ trợ xe đưa đón Ghềnh Đá Đĩa.'
        },
        {
          provider: 'Đường sắt Việt Nam',
          name: 'Tàu Thống Nhất SE3 đến Ga Tuy Hòa',
          code: 'SE3-PY',
          type: 'train',
          category: 'coach',
          departureTime: '21:00 (Đêm trước)',
          arrivalTime: '06:15 (Ga Tuy Hòa)',
          price: 590000,
          carbonSaved: 24.5,
          baggage: 'Giường nằm khoang 4 êm ái, xe đưa đón tận khách sạn.'
        },
        {
          provider: 'Thuận Thảo Eco',
          name: 'Limousine Cao Cấp Sài Gòn ⇄ Tuy Hòa',
          code: 'TT-ECO-VIP',
          type: 'coach',
          category: 'coach',
          departureTime: '19:30 (Đêm trước)',
          arrivalTime: '05:30 (Sáng hôm sau)',
          price: 360000,
          carbonSaved: 17.5,
          baggage: 'Phòng nằm đơn VIP, cổng sạc Type-C, nước suối và khăn lạnh.'
        }
      ];
    } else if (dest.includes('sa pa') || dest.includes('lào cai')) {
      this.availableTransportOptions = [
        {
          provider: 'Đường sắt Việt Nam',
          name: 'Tàu Du Lịch Hà Nội ⇄ Lào Cai',
          code: 'SP3-SAPA',
          type: 'train',
          category: 'coach',
          departureTime: '21:30 (Ga Hà Nội)',
          arrivalTime: '05:45 (Ga Lào Cai)',
          price: 550000,
          carbonSaved: 26.0,
          baggage: 'Giường nằm khoang 4 tiêu chuẩn du lịch, kèm xe bus lên Sa Pa.'
        },
        {
          provider: 'Eco Sapa Limousine',
          name: 'Limousine Dcar 9 Chỗ Cao Tốc Nội Bài - Sa Pa',
          code: 'ES-DCAR-01',
          type: 'coach',
          category: 'coach',
          departureTime: '06:30',
          arrivalTime: '11:45',
          price: 420000,
          carbonSaved: 16.0,
          baggage: 'Đón tận nơi tại Hà Nội/Sân bay Nội Bài, ghế massage.'
        }
      ];
    } else {
      // Đà Lạt / Lâm Đồng default
      this.availableTransportOptions = [
        {
          provider: 'Vietnam Airlines',
          name: 'Chuyến bay đến Sân bay Liên Khương (DLI)',
          code: 'VN-1380 (SGN/HAN ⇄ DLI)',
          type: 'flight',
          category: 'flight',
          departureTime: '06:30',
          arrivalTime: '07:45',
          price: 1250000,
          carbonSaved: 14.5,
          baggage: 'Bao gồm 23kg hành lý ký gửi + 12kg xách tay, trung chuyển xe bus sân bay.'
        },
        {
          provider: 'Phương Trang Eco',
          name: 'Limousine Giường Nằm FUTA Sài Gòn ⇄ Đà Lạt',
          code: 'FUTA-DL-08',
          type: 'coach',
          category: 'coach',
          departureTime: '22:30 (Đêm trước)',
          arrivalTime: '05:30 (Sáng Ngày 1)',
          price: 320000,
          carbonSaved: 18.2,
          baggage: 'Giường nằm massage cao cấp, nước uống, wifi, cổng sạc điện thoại.'
        },
        {
          provider: 'Mộc Lộ Travel',
          name: 'Xe Limousine Dcar 9 chỗ Đà Lạt',
          code: 'ML-DL-92',
          type: 'coach',
          category: 'coach',
          departureTime: '05:30',
          arrivalTime: '11:45',
          price: 380000,
          carbonSaved: 16.5,
          baggage: 'Đón tận nơi tại trung tâm, ngắm cảnh đèo Bảo Lộc thơ mộng.'
        }
      ];
    }
  }

  private loadAvailableRentalTransports() {
    this.availableTransportOptions = [
      {
        provider: 'Lá Mây Mobility',
        vehicleName: 'Xe máy điện VinFast Feliz S',
        vehicleType: 'electric_motorbike',
        category: 'electric_motorbike',
        price: 120000,
        deposit: 300000,
        carbonSaved: 4.5,
        condition: 'Pin LFP chạy 200km/lần sạc. Giao nhận xe tại khách sạn, kèm 2 nón bảo hiểm.'
      },
      {
        provider: 'Đồi Mây Wheels',
        vehicleName: 'Xe máy điện VinFast Klara S',
        vehicleType: 'electric_motorbike',
        category: 'electric_motorbike',
        price: 150000,
        deposit: 500000,
        carbonSaved: 5.2,
        condition: 'Kiểu dáng thời trang, cốp rộng chứa 2 nón bảo hiểm, hỗ trợ đổi pin nhanh.'
      },
      {
        provider: 'Suối Ngọc Move',
        vehicleName: 'Ô tô điện VinFast VF e34 (5 chỗ tự lái)',
        vehicleType: 'electric_car',
        category: 'electric_car',
        price: 750000,
        deposit: 2000000,
        carbonSaved: 12.8,
        condition: 'Bảo hiểm vật chất 2 chiều đầy đủ. Sạc miễn phí tại hệ thống trạm V-Green.'
      },
      {
        provider: 'Gió Đồi Shuttle',
        vehicleName: 'Xe đạp trợ lực điện Eco-Glide',
        vehicleType: 'bicycle',
        category: 'bicycle',
        price: 60000,
        deposit: 100000,
        carbonSaved: 2.1,
        condition: 'Phù hợp dạo phố, ngắm cảnh chậm rãi, có giỏ xe tiện lợi và khóa chống trộm.'
      }
    ];
  }

  // =========================================================================
  // ACCORDION EXPANSION & GOOGLE MAPS CARD SYNC (Option 3)
  // =========================================================================
  public expandedActivityIdx: number | null = null;

  public toggleExpandActivity(idx: number, act: any, event?: Event) {
    try {
      if (event) {
        const target = event.target as HTMLElement;
        if (target.closest('.activity-card-controls') || target.closest('input') || target.closest('button') || target.closest('.act-exp-btn')) {
          return;
        }
      }
      if (this.expandedActivityIdx === idx) {
        this.expandedActivityIdx = null;
      } else {
        this.expandedActivityIdx = idx;
        this.focusActivityOnMap(act);
      }
      this.cdr.detectChanges();
    } catch (err) {
      console.warn('Error toggling expand activity:', err);
    }
  }

  public focusActivityOnMap(act: any, event?: Event) {
    try {
      if (event) event.stopPropagation();
      if (!act) return;
      const coords = (typeof act.lat === 'number' && typeof act.lng === 'number')
        ? { lat: act.lat, lng: act.lng }
        : this.lookupActivityCoordinates(act.title || act.name);

      if (coords) {
        if (this.isGoogleMaps && this.gmap) {
          try {
            this.gmap.panTo(coords);
            this.gmap.setZoom(16);
          } catch (e) { }
        } else if (this.map) {
          try {
            this.map.flyTo([coords.lat, coords.lng], 16, { duration: 0.8 });
          } catch (e) { }
        }

        const imgUrl = this.getPlacePlaceholderImage(act.title || act.name);
        this.openGooglePlacePanel(act);
      }
    } catch (err) {
      console.warn('focusActivityOnMap error:', err);
    }
  }

  public async openDirectionsForActivity(act: any, idx?: number, event?: Event) {
    if (event) event.stopPropagation();
    const activeDay = this.activeItinerary?.days[this.activeDayIdx];
    const activities = activeDay?.activities || [];
    const currentIdx = typeof idx === 'number' ? idx : activities.indexOf(act);

    if (currentIdx > 0) {
      await this.openLegDirections(currentIdx - 1);
    } else if (activities.length > 1) {
      await this.openLegDirections(0);
    } else {
      const coords = (typeof act.lat === 'number' && typeof act.lng === 'number')
        ? { lat: act.lat, lng: act.lng }
        : this.lookupActivityCoordinates(act.title || act.name);
      if (coords) {
        await this.openGooglePlacePanel(act);
      }
    }
  }

  public async openLegDirections(fromIdx: number, travelMode: 'DRIVE' | 'TWO_WHEELER' | 'WALK' = 'DRIVE') {
    if (!this.activeItinerary) return;
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    if (!activeDay || !activeDay.activities || fromIdx >= activeDay.activities.length - 1) return;

    const fromAct = activeDay.activities[fromIdx];
    const toAct = activeDay.activities[fromIdx + 1];

    const fromCoords = (typeof fromAct.lat === 'number' && typeof fromAct.lng === 'number')
      ? { lat: fromAct.lat, lng: fromAct.lng }
      : this.lookupActivityCoordinates(fromAct.title || fromAct.name);

    const toCoords = (typeof toAct.lat === 'number' && typeof toAct.lng === 'number')
      ? { lat: toAct.lat, lng: toAct.lng }
      : this.lookupActivityCoordinates(toAct.title || toAct.name);

    if (!fromCoords || !toCoords) {
      this.showAlert('Không tìm thấy toạ độ GPS của địa điểm để chỉ đường', 'warning');
      return;
    }

    const gMode = travelMode === 'TWO_WHEELER' ? 'two_wheeler' : travelMode === 'WALK' ? 'walking' : 'driving';
    const deepLink = `https://www.google.com/maps/dir/?api=1&origin=${fromCoords.lat},${fromCoords.lng}&destination=${toCoords.lat},${toCoords.lng}&travelmode=${gMode}`;

    this.activeLegDirections = {
      fromIdx,
      toIdx: fromIdx + 1,
      fromTitle: fromAct.title || fromAct.name || 'Điểm xuất phát',
      fromAddress: fromAct.address || this.getPlaceAddress(fromAct.title || fromAct.name),
      fromCoords,
      toTitle: toAct.title || toAct.name || 'Điểm đến',
      toAddress: toAct.address || this.getPlaceAddress(toAct.title || toAct.name),
      toCoords,
      distance: `${this.getLegDistanceKm(this.activeDayIdx, fromIdx)} km`,
      duration: '15 phút',
      travelMode,
      steps: [],
      isLoading: true,
      googleMapsUrl: deepLink
    };

    // Initialize Tab 1 (Đặt trước xe) for this leg
    this.activeLegBookingIdx = fromIdx;
    this.activeLegDistanceKm = this.getLegDistanceKm(this.activeDayIdx, fromIdx);
    const startM = this.timeToMinutes(fromAct.time || '08:00');
    const dwellM = this.getDwellMinutesForType(fromAct.type || 'attraction');
    this.legPickupTime = this.minutesToTime(startM + dwellM);
    this.showVehiclePolicyView = false;
    this.isLegTimePickerOpen = false;
    this.isGpsNavigating = false;
    this.loadAvailableLegTransports();

    const existingBooking = this.getLegTransport(this.activeDayIdx, fromIdx);
    if (existingBooking) {
      this.legVehicleCategory = existingBooking.category === 'motorbike' ? 'motorbike' : 'car';
      this.legPickupTime = existingBooking.pickupTime || this.legPickupTime;
      const found = this.availableTransportOptions.find(o => o.id === existingBooking.id || o.vehicleName === existingBooking.vehicleName);
      this.selectedLegVehicle = found || this.filteredLegVehicles[0] || null;
    } else {
      this.selectedLegVehicle = this.filteredLegVehicles[0] || null;
    }

    // Close single place panel so directions panel takes priority
    this.activeGooglePlacePanel = null;
    this.applyFocusDimStates(fromIdx, fromIdx + 1);
    this.cdr.detectChanges();

    try {
      const res = await this.apiService.computeGoogleRoute(fromCoords, toCoords, undefined, travelMode);
      if (res && res.success) {
        this.activeLegDirections.distance = res.distance;
        this.activeLegDirections.duration = res.duration;
        this.activeLegDirections.steps = res.steps || [];
        this.activeLegDirections.isLoading = false;

        const parsedKm = parseFloat(String(res.distance).replace(',', '.'));
        if (!isNaN(parsedKm) && parsedKm > 0) {
          this.activeLegDistanceKm = parsedKm;
          const prevSelectedId = this.selectedLegVehicle?.id;
          this.loadAvailableLegTransports();
          this.selectedLegVehicle = this.availableTransportOptions.find(o => o.id === prevSelectedId) || this.filteredLegVehicles[0] || null;
        }

        // Draw bold vibrant active leg polyline on map
        if (this.isGoogleMaps && this.gmap && res.encodedPolyline) {
          if (this.activeLegLayer) {
            try { this.activeLegLayer.setMap(null); } catch (e) { }
          }
          if (typeof google !== 'undefined' && google.maps && google.maps.geometry && google.maps.geometry.encoding) {
            const decodedPath = google.maps.geometry.encoding.decodePath(res.encodedPolyline);
            this.activeLegLayer = new google.maps.Polyline({
              path: decodedPath,
              geodesic: true,
              strokeColor: '#059669', // Vibrant fresh emerald active route
              strokeOpacity: 1.0,
              strokeWeight: 7, // Bold, prominent stroke
              map: this.gmap,
              zIndex: 200
            });

            const bounds = new google.maps.LatLngBounds();
            decodedPath.forEach((pt: any) => bounds.extend(pt));
            // Ensure padding accounts for right directions panel (360px)
            this.gmap.fitBounds(bounds, { top: 60, right: 390, bottom: 60, left: 60 });
          }
        }
        this.applyFocusDimStates(fromIdx, fromIdx + 1);
      } else {
        this.activeLegDirections.isLoading = false;
      }
    } catch (err) {
      console.warn('computeGoogleRoute error:', err);
      if (this.activeLegDirections) this.activeLegDirections.isLoading = false;
    }
    this.applyFocusDimStates(fromIdx, fromIdx + 1);
    this.cdr.detectChanges();
  }

  public async switchLegTravelMode(mode: 'DRIVE' | 'TWO_WHEELER' | 'WALK') {
    if (!this.activeLegDirections) return;
    this.activeLegDirections.travelMode = mode;
    this.activeLegDirections.isLoading = true;

    const { fromCoords, toCoords, fromIdx, toIdx } = this.activeLegDirections;
    const gMode = mode === 'TWO_WHEELER' ? 'two_wheeler' : mode === 'WALK' ? 'walking' : 'driving';
    this.activeLegDirections.googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${fromCoords.lat},${fromCoords.lng}&destination=${toCoords.lat},${toCoords.lng}&travelmode=${gMode}`;
    this.applyFocusDimStates(fromIdx, toIdx);
    this.cdr.detectChanges();

    try {
      const res = await this.apiService.computeGoogleRoute(fromCoords, toCoords, undefined, mode);
      if (res && res.success) {
        this.activeLegDirections.distance = res.distance;
        this.activeLegDirections.duration = res.duration;
        this.activeLegDirections.steps = res.steps || [];
        this.activeLegDirections.isLoading = false;

        const parsedKm = parseFloat(String(res.distance).replace(',', '.'));
        if (!isNaN(parsedKm) && parsedKm > 0) {
          this.activeLegDistanceKm = parsedKm;
          const prevSelectedId = this.selectedLegVehicle?.id;
          this.loadAvailableLegTransports();
          this.selectedLegVehicle = this.availableTransportOptions.find(o => o.id === prevSelectedId) || this.filteredLegVehicles[0] || null;
        }

        if (this.isGoogleMaps && this.gmap && res.encodedPolyline) {
          if (this.activeLegLayer) {
            try { this.activeLegLayer.setMap(null); } catch (e) { }
          }
          if (typeof google !== 'undefined' && google.maps && google.maps.geometry && google.maps.geometry.encoding) {
            const decodedPath = google.maps.geometry.encoding.decodePath(res.encodedPolyline);
            this.activeLegLayer = new google.maps.Polyline({
              path: decodedPath,
              geodesic: true,
              strokeColor: '#059669',
              strokeOpacity: 1.0,
              strokeWeight: 7,
              map: this.gmap,
              zIndex: 200
            });
            const bounds = new google.maps.LatLngBounds();
            decodedPath.forEach((pt: any) => bounds.extend(pt));
            this.gmap.fitBounds(bounds, { top: 60, right: 390, bottom: 60, left: 60 });
          }
        }
        this.applyFocusDimStates(fromIdx, toIdx);
      }
    } catch (err) {
      console.warn('switchLegTravelMode error:', err);
    } finally {
      if (this.activeLegDirections) this.activeLegDirections.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  public async swapLegDirections() {
    if (!this.activeLegDirections) return;
    const dir = this.activeLegDirections;
    const tempTitle = dir.fromTitle;
    const tempAddr = dir.fromAddress;
    const tempCoords = dir.fromCoords;

    dir.fromTitle = dir.toTitle;
    dir.fromAddress = dir.toAddress;
    dir.fromCoords = dir.toCoords;

    dir.toTitle = tempTitle;
    dir.toAddress = tempAddr;
    dir.toCoords = tempCoords;

    await this.switchLegTravelMode(dir.travelMode);
  }

  public applyFocusDimStates(fromIdx: number, toIdx: number) {
    // 1. Google Maps Engine
    if (this.isGoogleMaps && this.gMarkers && this.gMarkers.length > 0) {
      this.gMarkers.forEach((m: any, i: number) => {
        if (i === fromIdx || i === toIdx) {
          // Highlight active origin & destination pins (1 & 2)
          m.setOpacity(1.0);
          m.setZIndex(300);
          m.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 16,
            fillColor: '#059669', // Bright emerald
            fillOpacity: 1.0,
            strokeColor: '#FFFFFF',
            strokeWeight: 3.5
          });
        } else {
          // Clear dimming for inactive pins (3, 4, 5...)
          m.setOpacity(0.25);
          m.setZIndex(1);
          m.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#94A3B8', // Desaturated muted slate
            fillOpacity: 0.45,
            strokeColor: '#E2E8F0',
            strokeWeight: 1.5
          });
        }
      });

      // Dim the full daily circuit line so active leg stands out distinctly
      if (this.dailyRouteLayer) {
        this.dailyRouteLayer.setOptions({
          strokeColor: '#94A3B8',
          strokeOpacity: 0.22,
          strokeWeight: 3,
          zIndex: 5
        });
      }
    }

    // 2. Leaflet Fallback Engine
    if (this.leafletMarkers && this.leafletMarkers.length > 0) {
      this.leafletMarkers.forEach((m: any, i: number) => {
        if (i === fromIdx || i === toIdx) {
          m.setOpacity(1.0);
          if (m.setZIndexOffset) m.setZIndexOffset(1000);
        } else {
          m.setOpacity(0.25);
          if (m.setZIndexOffset) m.setZIndexOffset(0);
        }
      });
      if (this.polyline) {
        this.polyline.setStyle({ color: '#94A3B8', opacity: 0.22, weight: 3 });
      }
    }
  }

  public restoreNormalStates() {
    // 1. Google Maps Engine
    if (this.isGoogleMaps && this.gMarkers && this.gMarkers.length > 0) {
      this.gMarkers.forEach((m: any, i: number) => {
        m.setOpacity(1.0);
        m.setZIndex(i + 1);
        m.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: '#184A37', // Organic earthy forest green
          fillOpacity: 1.0,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5
        });
      });

      if (this.dailyRouteLayer) {
        this.dailyRouteLayer.setOptions({
          strokeColor: '#0E9F6E', // Vibrant fresh emerald
          strokeOpacity: 0.88,
          strokeWeight: 5,
          zIndex: 10
        });
      }
    }

    // 2. Leaflet Fallback Engine
    if (this.leafletMarkers && this.leafletMarkers.length > 0) {
      this.leafletMarkers.forEach((m: any, i: number) => {
        m.setOpacity(1.0);
        if (m.setZIndexOffset) m.setZIndexOffset(i + 1);
      });
      if (this.polyline) {
        this.polyline.setStyle({ color: '#0E9F6E', opacity: 0.88, weight: 5 });
      }
    }
  }

  public closeLegDirections() {
    this.activeLegDirections = null;
    this.isGpsNavigating = false;
    if (this.gpsUserMarker) {
      try {
        if (this.isGoogleMaps && this.gpsUserMarker.setMap) this.gpsUserMarker.setMap(null);
        else if (this.map && this.map.removeLayer) this.map.removeLayer(this.gpsUserMarker);
      } catch (e) { }
      this.gpsUserMarker = null;
    }
    if (this.activeLegLayer) {
      try { this.activeLegLayer.setMap(null); } catch (e) { }
      this.activeLegLayer = null;
    }
    this.restoreNormalStates();
    if (this.isGoogleMaps && this.gmap && this.gMarkers && this.gMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      this.gMarkers.forEach((m: any) => bounds.extend(m.getPosition()));
      this.gmap.fitBounds(bounds);
    }
    this.cdr.detectChanges();
  }


  public showPinInfoBubble(act: any, idx: number, marker: any) {
    if (!this.isGoogleMaps || !this.gmap) return;
    if (!this.gInfoWindow) {
      this.gInfoWindow = new google.maps.InfoWindow({
        disableAutoPan: true
      });
    }
    const costText = act.cost === 0 ? 'Miễn phí' : (Number(act.cost).toLocaleString('vi-VN') + '₫');
    const imgUrl = act.img || this.getPlacePlaceholderImage(act.title || act.name);
    const bubbleId = 'gm-bubble-card-' + idx;
    const content = `
      <div id="${bubbleId}" style="font-family: inherit; width: 210px; padding: 3px; border-radius: 8px; color: #192520; box-sizing: border-box; cursor: pointer;">
        <div style="position: relative; width: 100%; height: 92px; border-radius: 6px; overflow: hidden; margin-bottom: 6px; background: #0F172A;">
          <img src="${imgUrl}" alt="${act.title || act.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='image/greensteps/da-nang-hoi-an/hoi-an-pho-co-den-long-01.jpg'" />
          <span style="position: absolute; top: 6px; left: 6px; width: 22px; height: 22px; border-radius: 50%; background: #166534; border: 1.5px solid #fff; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${idx + 1}</span>
        </div>
        <div style="font-size: 12.5px; font-weight: 700; color: #0F172A; line-height: 1.35; margin-bottom: 3px;">${act.title || act.name}</div>
        <div style="display: flex; align-items: center; gap: 5px; font-size: 11px; color: #64748B; margin-bottom: 5px;">
          <span style="font-weight: 700; color: #0F172A;">${costText}</span>
          <span>·</span>
          <span style="font-weight: 700; color: #059669;">${this.formatCarbon(act.carbon)}</span>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #059669;">Bấm xem chi tiết & đường đi →</div>
      </div>
    `;
    this.gInfoWindow.setContent(content);
    this.gInfoWindow.open({
      anchor: marker,
      map: this.gmap,
      shouldFocus: false
    });
    if (typeof google !== 'undefined' && google.maps && google.maps.event) {
      google.maps.event.addListenerOnce(this.gInfoWindow, 'domready', () => {
        const el = document.getElementById(bubbleId);
        if (el) {
          el.onclick = () => {
            this.ngZone.run(() => {
              this.openGooglePlacePanel(act);
            });
          };
        }
      });
    }
  }

  public getStepIconClass(maneuver?: string): string {
    if (!maneuver) return 'bi-arrow-up-circle-fill';
    const m = maneuver.toLowerCase();
    if (m.includes('left')) return 'bi-arrow-90deg-left';
    if (m.includes('right')) return 'bi-arrow-90deg-right';
    if (m.includes('u_turn')) return 'bi-arrow-counterclockwise';
    if (m.includes('straight')) return 'bi-arrow-up-circle-fill';
    if (m.includes('depart')) return 'bi-geo-alt-fill';
    return 'bi-arrow-up-circle-fill';
  }

  public bounceActivityPin(idx: number) {
    this.highlightMapPin(idx, true);
  }

  public getPlaceAddress(title: string): string {
    const dest = this.activeItinerary?.destLabel || this.activeItinerary?.destination || '';
    const destLower = dest.toLowerCase();
    if (!title) return dest || 'Việt Nam';
    const t = title.toLowerCase();

    if (t.includes('rừng dừa') || t.includes('bảy mẫu') || t.includes('coconut') || t.includes('thuyền thúng')) {
      return 'Thôn Vạn Lăng, Xã Cẩm Thanh, TP. Hội An';
    }
    if (t.includes('trà quế')) {
      return 'Làng rau Trà Quế, Cẩm Hà, TP. Hội An';
    }
    if (t.includes('phố cổ') || t.includes('chùa cầu')) {
      return 'Phường Minh An, TP. Hội An';
    }
    if (t.includes('hồ xuân hương') || t.includes('lâm viên')) {
      return 'Phường 10, TP. Đà Lạt, Lâm Đồng';
    }
    if (t.includes('gành đá đĩa') || t.includes('ghềnh đá đĩa')) {
      return 'Xã An Ninh Đông, Huyện Tuy An, Phú Yên';
    }
    if (t.includes('bãi xép')) {
      return 'Xã An Chấn, Huyện Tuy An, Phú Yên';
    }
    if (t.includes('mũi điện') || t.includes('bãi môn')) {
      return 'Xã Hòa Tâm, Thị xã Đông Hòa, Phú Yên';
    }
    if (t.includes('vũng rô')) {
      return 'Xã Hòa Xuân Nam, Thị xã Đông Hòa, Phú Yên';
    }
    if (t.includes('tháp nhạn') || t.includes('nghinh phong')) {
      return 'TP. Tuy Hòa, Phú Yên';
    }
    if (destLower.includes('phú yên')) {
      return 'Tuy An, Phú Yên';
    }
    if (destLower.includes('đà lạt')) {
      return 'TP. Đà Lạt, Lâm Đồng';
    }
    if (destLower.includes('hội an')) {
      return 'TP. Hội An, Quảng Nam';
    }
    if (destLower.includes('đà nẵng')) {
      return 'TP. Đà Nẵng';
    }
    return dest || 'Việt Nam';
  }

  public getActivityDetailedDesc(act: any): string {
    if (!act) return '';
    const title = act.title || act.name || '';
    const wiki = this.getPlaceWikiDescription(title);
    if (wiki && wiki.length > 20) return wiki;
    const dest = this.activeItinerary?.destLabel || this.activeItinerary?.destination || 'Hội An';
    return 'Điểm đến trải nghiệm nổi bật tại ' + dest + ', đạt chứng nhận phát thải thấp và thân thiện với môi trường tự nhiên.';
  }

  public scrollToSuggestions() {
    const el = document.querySelector('.suggestions-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private checkIfSharedByDefault(name: string, type: string): boolean {
    if (!name) return type === 'lodging';
    const lowerName = name.toLowerCase();
    const groupKeywords = [
      'lẩu', 'mâm', 'combo', 'bbq', 'nướng bàn', 'nguyên con', 'bàn ăn', 'phòng',
      'homestay', 'khách sạn', 'hotel', 'villa', 'thuê xe', 'xe taxi', 'taxi',
      'ô tô', 'car', 'xe hơi', 'vé trọn gói cả đoàn', 'bữa ăn gia đình'
    ];
    return type === 'lodging' || groupKeywords.some(keyword => lowerName.includes(keyword));
  }

  public incrementGuests() {
    this.guestCount++;
  }

  public decrementGuests() {
    if (this.guestCount > 1) {
      this.guestCount--;
    }
  }

  public onGuestCountChange() {
    if (this.guestCount < 1) {
      this.guestCount = 1;
    }
  }

  public onCardNumberChange() {
    const cleanNum = this.cardNumber.replace(/\s+/g, '');
    if (!cleanNum) {
      this.cardError = 'Số thẻ này không hợp lệ';
    } else if (!/^\d{16}$/.test(cleanNum)) {
      this.cardError = 'Số thẻ này không hợp lệ';
    } else {
      this.cardError = '';
    }
    this.cdr.detectChanges();
  }

  public validateContactInfo(): boolean {
    if (!this.checkoutLastName.trim() || !this.checkoutFirstName.trim() || !this.checkoutEmail.trim() || !this.checkoutPhone.trim()) {
      this.showAlert('Vui lòng nhập đầy đủ thông tin liên hệ (Họ, Tên, Email, Số điện thoại) để xác nhận đặt cọc!', 'warning');
      return false;
    }
    return true;
  }

  public async payWithCreditCard() {
    if (!this.validateContactInfo()) return;
    this.onCardNumberChange();
    if (this.cardError) {
      this.showAlert('Thông tin thẻ tín dụng chưa hợp lệ. Vui lòng kiểm tra lại!', 'warning');
      return;
    }

    if (!this.cardHolderName.trim()) {
      this.cardError = 'Tên chủ thẻ không được để trống';
      this.showAlert('Tên chủ thẻ không được để trống!', 'warning');
      return;
    }

    this.isWaitingApproval = true;
    this.cdr.detectChanges();

    setTimeout(async () => {
      this.isWaitingApproval = false;
      this.activeItinerary.status = 'deposited';
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + 7);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      this.activeItinerary.deposit_deadline = `${yyyy}-${mm}-${dd}`;
      await this.saveItineraryToDb();
      this.closeCheckout();
      this.showAlert(`Thanh toán bằng Thẻ Tín Dụng thành công! Đã đặt cọc và khóa lịch trình. Hạn hủy miễn phí trước ngày ${dd}/${mm}/${yyyy}.`, 'success');
      this.cdr.detectChanges();
    }, 1500);
  }

  public async payWithLater() {
    if (!this.validateContactInfo()) return;

    this.isWaitingApproval = true;
    this.cdr.detectChanges();

    setTimeout(async () => {
      this.isWaitingApproval = false;
      this.activeItinerary.status = 'deposited';
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + 7);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      this.activeItinerary.deposit_deadline = `${yyyy}-${mm}-${dd}`;
      await this.saveItineraryToDb();
      this.closeCheckout();
      this.showAlert(`Đã xác nhận Giữ Chỗ & Thanh Toán Sau thành công! Lịch trình đã được giữ chỗ và khóa sửa đổi. Vui lòng hoàn tất thanh toán trước ngày ${dd}/${mm}/${yyyy}.`, 'success');
      this.cdr.detectChanges();
    }, 1500);
  }

  public closeCheckout() {
    this.isCheckoutModalOpen = false;
  }

  public isActivatingWallet = false;

  public async activateWalletInline() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập để gửi yêu cầu kích hoạt ví!', 'warning');
      return;
    }
    this.isActivatingWallet = true;
    try {
      const res = await this.apiService.activateWallet(user.id || user._id || '');
      this.isActivatingWallet = false;
      if (res.success) {
        this.showAlert(
          'Yêu cầu kích hoạt ví GreenSteps của bạn đã được gửi thành công! Quà tặng 200.000đ sẽ được cộng khi Admin phê duyệt.',
          'info'
        );

      } else {
        this.showAlert('Gửi yêu cầu thất bại: ' + res.message, 'error');
      }
    } catch (e) {
      this.isActivatingWallet = false;
      this.showAlert('Gửi yêu cầu kích hoạt ví thất bại.', 'error');
    }
  }

  public setDepositAmount(amount: number) {
    this.depositAmount = amount;
  }

  public async showDepositQr() {
    if (!this.depositAmount || this.depositAmount <= 0) {
      this.showAlert('Vui lòng nhập số tiền nạp hợp lệ!', 'warning');
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập!', 'warning');
      return;
    }
    const userId = user.id || user._id || '';
    const username = user.username || 'USER';

    this.qrPaymentNote = `NAP VI ${username}`.toUpperCase();
    this.qrCodeUrl = `https://img.vietqr.io/image/970422-0392851304-compact.jpg?amount=${this.depositAmount}&addInfo=${encodeURIComponent(this.qrPaymentNote)}&accountName=KIEU%20HOANG%20DUONG`;

    this.isQrVisible = true;
    this.cdr.detectChanges();

    try {
      const res = await this.apiService.depositMoney(userId, this.depositAmount);
      if (res.success) {
        // Start polling balance changes
        const initialBalance = this.walletBalance;
        const interval = setInterval(async () => {
          const wInfo = await this.apiService.getWalletInfo(userId);
          if (wInfo && wInfo.balance > initialBalance) {
            clearInterval(interval);
            this.isQrVisible = false;
            this.walletBalance = wInfo.balance;
            this.cdr.detectChanges();
            this.showAlert(`Nạp tiền thành công! Số dư ví: ${wInfo.balance.toLocaleString('vi-VN')}đ`, 'success');
          }
        }, 2500);

        setTimeout(() => {
          clearInterval(interval);
        }, 900000);
      } else {
        this.isQrVisible = false;
        this.showAlert(res.message || 'Giao dịch bị từ chối.', 'error');
      }
    } catch (e: any) {
      this.isQrVisible = false;
      this.showAlert('Giao dịch bị từ chối hoặc có lỗi xảy ra.', 'error');
    }
    this.cdr.detectChanges();
  }

  public async showPaymentQr() {
    if (this.checkoutTotal === 0) {
      this.showAlert('Lịch trình trống hoặc toàn bộ dịch vụ đều miễn phí!', 'info');
      return;
    }
    if (!this.validateContactInfo()) return;

    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '') : '';
    const customerName = `${this.checkoutLastName.trim()} ${this.checkoutFirstName.trim()}`;
    const cleanPhone = this.checkoutPhone.trim().replace(/\D/g, '').slice(-4) || 'GUEST';
    const username = user?.username ? user.username.toUpperCase() : `KHACH ${cleanPhone}`;

    this.qrPaymentNote = `THANH TOAN ${username}`.toUpperCase();
    this.qrCodeUrl = `https://img.vietqr.io/image/970422-0392851304-compact.jpg?amount=${this.checkoutTotal}&addInfo=${encodeURIComponent(this.qrPaymentNote)}&accountName=KIEU%20HOANG%20DUONG`;

    this.isQrVisible = true;
    this.cdr.detectChanges();

    if (userId) {
      try {
        const res = await this.apiService.payItineraryQr(userId, this.activeItinerary.id, this.checkoutTotal);
        if (res.success) {
          const interval = setInterval(async () => {
            const custom = await this.apiService.getItinerary(this.activeItinerary.id);
            if (custom && custom.status === 'deposited') {
              clearInterval(interval);
              this.isQrVisible = false;
              this.isCheckoutModalOpen = false;
              this.activeItinerary.status = 'deposited';
              this.activeItinerary.deposit_deadline = custom.deposit_deadline;
              this.createdBookingCode = 'BKT-' + Date.now().toString().slice(-6);
              this.createdBookingCustomerName = customerName;
              this.createdBookingPhone = this.checkoutPhone.trim();
              this.createdBookingEmail = this.checkoutEmail.trim();
              this.isBookingSuccessModalOpen = true;
              this.cdr.detectChanges();
            }
          }, 2500);

          setTimeout(() => {
            clearInterval(interval);
          }, 900000);
        }
      } catch (e: any) {
        console.warn('QR polling initiation:', e);
      }
    }
  }

  public async confirmQrPaid() {
    this.isWaitingApproval = true;
    this.cdr.detectChanges();

    const customerName = `${this.checkoutLastName.trim()} ${this.checkoutFirstName.trim()}`;
    let bookingCode = 'BKT-' + Date.now().toString().slice(-6);

    try {
      // Create official booking via API
      const bookingRes = await this.apiService.createBooking({
        type: 'itinerary',
        targetId: this.activeItinerary.id,
        bookingDate: this.activeItinerary.start_date || new Date().toISOString().split('T')[0],
        checkOutDate: this.activeItinerary.end_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        guests: this.guestCount || 1,
        paymentMethod: 'vietqr',
        customerId: this.currentUser?.id || this.currentUser?._id || undefined,
        customerName: customerName,
        customerPhone: this.checkoutPhone.trim(),
        customerEmail: this.checkoutEmail.trim()
      });

      if (bookingRes && (bookingRes.bookingCode || bookingRes.bookingId)) {
        bookingCode = bookingRes.bookingCode || bookingRes.bookingId || bookingCode;
      }
    } catch (e) {
      console.warn('Booking API fallback to local receipt code:', e);
    }

    this.activeItinerary.status = 'deposited';
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + 7);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    this.activeItinerary.deposit_deadline = `${yyyy}-${mm}-${dd}`;
    await this.saveItineraryToDb();

    this.createdBookingCode = bookingCode;
    this.createdBookingCustomerName = customerName;
    this.createdBookingPhone = this.checkoutPhone.trim();
    this.createdBookingEmail = this.checkoutEmail.trim();

    this.isWaitingApproval = false;
    this.isQrVisible = false;
    this.isCheckoutModalOpen = false;
    this.isBookingSuccessModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeQrModal() {
    this.isQrVisible = false;
  }

  public cancelWaitingApproval() {
    this.isWaitingApproval = false;
    this.cdr.detectChanges();
  }

  public getUnifiedCoverImage(iti?: any): string {
    const target = iti || this.activeItinerary;
    if (!target) return 'image/52627caa0015b2f833fbdc632d37dc82.jpg';

    // 1. If custom uploaded image (Base64 data, uploaded URL, or dedicated cover cache)
    let img = target.imageUrl || target.image_url;
    if (!img && target.id) {
      try {
        img = localStorage.getItem(`greensteps_cover_${target.id}`);
      } catch { }
    }
    if (img && typeof img === 'string') {
      const trimmed = img.trim();
      if (trimmed !== '' && trimmed !== 'image/Viet Nam.png' && !trimmed.endsWith('/Viet Nam.png') && trimmed !== 'undefined' && trimmed !== 'null') {
        if (trimmed.startsWith('/uploads/')) {
          return this.apiService.resolveCommunityMediaUrl(trimmed);
        }
        return trimmed;
      }
    }

    // 2. Otherwise normalize destination name / title / destSlug
    const rawText = `${target.dest || ''} ${target.destLabel || ''} ${target.destination || ''} ${target.title || ''} ${target.name || ''}`;
    const norm = this.stripVietnameseAccents(rawText);

    if (norm.includes('da lat') || norm.includes('dalat') || norm.includes('tuyen lam') || norm.includes('lam dong')) {
      return 'image/cb4fbf769d60d911e13c255f7fb39dcc.jpg';
    }
    if (norm.includes('phu yen') || norm.includes('phuyen') || norm.includes('tuy hoa') || norm.includes('ganh da dia')) {
      return 'image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg';
    }
    if (norm.includes('da nang') || norm.includes('danang') || norm.includes('hoi an') || norm.includes('hoian') || norm.includes('quang nam')) {
      return 'image/52627caa0015b2f833fbdc632d37dc82.jpg';
    }
    return 'image/52627caa0015b2f833fbdc632d37dc82.jpg';
  }

  public getItineraryCoverImage(): string {
    return this.getUnifiedCoverImage(this.activeItinerary);
  }

  private compressCoverDataUrl(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 1280;
          const maxH = 720;
          let w = img.width || maxW;
          let h = img.height || maxH;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          if (h > maxH) {
            w = Math.round((w * maxH) / h);
            h = maxH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  public async onCoverFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file || !this.activeItinerary) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const rawData = reader.result as string;
      const base64Data = await this.compressCoverDataUrl(rawData);
      try {
        // Apply immediately so user sees 0ms update and persist locally right away
        this.activeItinerary.imageUrl = base64Data;
        try {
          localStorage.setItem(`greensteps_cover_${this.activeItinerary.id}`, base64Data);
          localStorage.setItem(`greensteps_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
          localStorage.setItem(`greensteps_user_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
          localStorage.setItem(`greensteps_guest_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
        } catch (e) { }
        this.cdr.detectChanges();

        const uploadRes = await this.apiService.uploadImageBase64(base64Data, 'post');
        const persistedUrl = (uploadRes && uploadRes.success && uploadRes.url) ? uploadRes.url : base64Data;
        this.activeItinerary.imageUrl = persistedUrl;
        try {
          localStorage.setItem(`greensteps_cover_${this.activeItinerary.id}`, persistedUrl);
          localStorage.setItem(`greensteps_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
          localStorage.setItem(`greensteps_user_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
          localStorage.setItem(`greensteps_guest_draft_${this.activeItinerary.id}`, JSON.stringify(this.activeItinerary));
        } catch (e) { }
        if (this.savedItineraries && Array.isArray(this.savedItineraries)) {
          const found = this.savedItineraries.find(x => x.id === this.activeItinerary.id);
          if (found) {
            found.imageUrl = persistedUrl;
          }
        }
        await this.saveItineraryToDb();
        this.showAlert('Đã cập nhật và đồng bộ ảnh bìa lịch trình!', 'success');
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Upload cover failed:', err);
        this.showAlert('Đã lưu ảnh bìa trên trình duyệt!', 'info');
      }
    };
    reader.readAsDataURL(file);
  }

  // Collaborator Invitation & Multi-Email / Community / Social actions
  public async openInviteFriendModal() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập trước khi mời bạn bè cùng tham gia lịch trình này nhé!', 'warning', () => {
        this.loginModalService.open();
      });
      return;
    }
    this.isInviteFriendModalOpen = true;
    this.inviteEmails = '';
    this.inviteEmailChipList = [];
    this.isSendingInvites = false;
    this.cdr.detectChanges();

    if (this.activeItinerary) {
      this.activeItinerary.user_id = user.id || user._id;
      this.saveItineraryToDb().catch(e => console.warn('Background save itinerary notice:', e));
    }
  }

  public closeInviteFriendModal() {
    this.isInviteFriendModalOpen = false;
    this.inviteEmails = '';
    this.inviteEmailChipList = [];
    this.cdr.detectChanges();
  }

  public addInviteEmailFromInput(event?: Event) {
    if (event) event.preventDefault();
    const raw = (this.inviteEmails || '').trim();
    if (!raw) return;
    const parts = raw.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    for (const p of parts) {
      if (!this.inviteEmailChipList.includes(p)) {
        this.inviteEmailChipList.push(p);
      }
    }
    this.inviteEmails = '';
    this.cdr.detectChanges();
  }

  public removeInviteEmailChip(idx: number) {
    this.inviteEmailChipList.splice(idx, 1);
    this.cdr.detectChanges();
  }

  public getTotalPendingInviteCount(): number {
    const typed = (this.inviteEmails || '').split(/[,;\s]+/).filter(e => e.trim().includes('@')).length;
    return this.inviteEmailChipList.length + typed;
  }

  private getCollaboratorInviteLink(): string {
    if (!this.activeItinerary) return `${window.location.origin}/schedule`;
    const user = this.authService.getCurrentUser();
    const senderName = user ? (user.fullname || user.username) : 'Một người bạn';
    const snap = this.encodeShareSnapshot(this.activeItinerary);
    const snapQuery = snap ? `&s=${snap}` : '';
    return `${window.location.origin}/schedule/${this.activeItinerary.id}?senderName=${encodeURIComponent(senderName)}${snapQuery}`;
  }

  public async sendCollaboratorInvites() {
    this.addInviteEmailFromInput();
    if (!this.activeItinerary || this.inviteEmailChipList.length === 0) {
      this.showAlert('Vui lòng nhập ít nhất 1 địa chỉ email hợp lệ!', 'warning');
      return;
    }

    this.isSendingInvites = true;
    this.cdr.detectChanges();

    const inviteUrl = this.getCollaboratorInviteLink();
    const allEmailsCsv = this.inviteEmailChipList.join(', ');

    try {
      const res = await this.apiService.inviteCollaborator(
        this.activeItinerary.id,
        allEmailsCsv,
        inviteUrl
      );
      this.isSendingInvites = false;
      if (res && res.success) {
        const count = this.inviteEmailChipList.length;
        this.closeInviteFriendModal();
        this.showAlert(res.message || `Đã gửi lời mời đồng hành tới ${count} địa chỉ Gmail thành công!`, 'success');
      } else {
        this.showAlert(res?.message || 'Gửi lời mời thất bại!', 'error');
      }
    } catch (e: any) {
      this.isSendingInvites = false;
      this.showAlert(e?.error?.message || 'Đã xảy ra lỗi khi gửi lời mời.', 'error');
    }
  }

  public shareActiveItineraryToCommunity() {
    if (!this.activeItinerary) return;
    this.closeInviteFriendModal();
    const mapped = {
      id: this.activeItinerary.id,
      name: this.activeItinerary.title || this.activeItinerary.name,
      destination: this.activeItinerary.destLabel || this.activeItinerary.destination,
      days: this.activeItinerary.days?.length || 1
    };
    this.openShareModal(mapped, new Event('click'));
  }

  public shareInviteSocial(platform: 'facebook' | 'instagram' | 'zalo' | 'messenger') {
    const inviteLink = this.getCollaboratorInviteLink();
    const url = encodeURIComponent(inviteLink);
    const title = encodeURIComponent(`Cùng mình lên lịch trình "${this.activeItinerary?.title || 'Du lịch xanh'}" trên GreenSteps nhé!`);
    if (platform === 'facebook' || platform === 'messenger') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${title}`, '_blank', 'width=620,height=480');
      return;
    }
    if (platform === 'zalo') {
      navigator.clipboard.writeText(inviteLink);
      window.open(`https://sp.zalo.me/plugins/sdk?url=${url}`, '_blank', 'width=600,height=520');
      this.showAlert('Đã sao chép liên kết mời & mở cửa sổ chia sẻ Zalo!', 'success');
      return;
    }
    if (platform === 'instagram') {
      navigator.clipboard.writeText(inviteLink);
      window.open('https://www.instagram.com/', '_blank');
      this.showAlert('Đã sao chép liên kết mời bạn đồng hành! Bạn có thể dán gửi ngay qua Instagram Direct hoặc Story.', 'success');
      return;
    }
  }

  public copyInviteLink() {
    const inviteLink = this.getCollaboratorInviteLink();
    navigator.clipboard.writeText(inviteLink);
    this.showAlert('Đã sao chép liên kết mời bạn đồng hành vào bộ nhớ tạm!', 'success');
  }

  private startBackgroundSync() {
    this.stopBackgroundSync();
    this.backgroundSyncInterval = setInterval(async () => {
      if (!this.activeItinerary || this.isAutoSaving || this.isCheckoutModalOpen || this.isSampleItinerary || !this.currentUser) return;
      // Do not pull server state while local edits are still being persisted
      if (this.saveInFlight || this.savePending || Date.now() - this.lastLocalEditAt < 6000) return;

      try {
        const fresh = await this.apiService.getItinerary(this.activeItinerary.id, true);
        if (fresh) {
          // 1. Update collaborators
          const localCollabsStr = JSON.stringify(this.activeItinerary.collaborators || []);
          const freshCollabsStr = JSON.stringify(fresh.collaborators || []);
          if (localCollabsStr !== freshCollabsStr) {
            this.activeItinerary.collaborators = fresh.collaborators || [];
            this.cdr.detectChanges();
          }

          // 2. Update cover image
          if (this.activeItinerary.imageUrl !== fresh.imageUrl) {
            this.activeItinerary.imageUrl = fresh.imageUrl;
            this.cdr.detectChanges();
          }

          // 3. Update title
          if (this.activeItinerary.title !== fresh.name) {
            this.activeItinerary.title = fresh.name;
            this.cdr.detectChanges();
          }

          // 4. Update activities with race-condition guard
          const freshEditor = this.convertApiToEditorItinerary(fresh);
          const localDaysStr = JSON.stringify(this.activeItinerary.days);
          const freshDaysStr = JSON.stringify(freshEditor.days);

          const totalLocalActs = (this.activeItinerary.days || []).reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0);
          const totalFreshActs = (freshEditor.days || []).reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0);

          // Bulletproof protection: Never overwrite existing local activities with an empty backend snapshot
          if (totalLocalActs > 0 && totalFreshActs === 0) {
            return;
          }

          // Semantic check: Only update activities if real data (not ephemeral IDs) has changed
          const isSameContent = this.areDaysSemanticallyEqual(this.activeItinerary.days, freshEditor.days);
          if (!isSameContent) {
            const currentDayIdx = this.activeDayIdx;
            this.activeItinerary.days = freshEditor.days;
            this.activeDayIdx = currentDayIdx < freshEditor.days.length ? currentDayIdx : 0;

            this.recalculateMetrics();
            this.plotMapMarkers();
            this.cdr.detectChanges();
          }
        }
      } catch (e) {
        console.warn('Silent background sync skipped (network/offline):', e);
      }
    }, 20000);
  }

  private areDaysSemanticallyEqual(daysA: any[], daysB: any[]): boolean {
    if (!daysA && !daysB) return true;
    if (!daysA || !daysB) return false;
    if (daysA.length !== daysB.length) return false;
    for (let i = 0; i < daysA.length; i++) {
      const actsA = daysA[i]?.activities || [];
      const actsB = daysB[i]?.activities || [];
      if (actsA.length !== actsB.length) return false;
      for (let j = 0; j < actsA.length; j++) {
        const a = actsA[j];
        const b = actsB[j];
        if (!a || !b) return false;
        if (a.title !== b.title || a.time !== b.time || a.cost !== b.cost || a.type !== b.type || a.lat !== b.lat || a.lng !== b.lng) {
          return false;
        }
      }
    }
    return true;
  }

  private stopBackgroundSync() {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
    }
  }

  public async payCheckoutItinerary() {
    if (!this.activeItinerary) return;

    if (this.checkoutTotal === 0) {
      this.showAlert('Lịch trình trống hoặc toàn bộ dịch vụ đều miễn phí!', 'info');
      return;
    }

    if (this.walletBalance < this.checkoutTotal) {
      this.showAlert('Số dư ví không đủ! Vui lòng quét mã QR thanh toán trực tiếp.', 'warning');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập để thanh toán!', 'warning');
      return;
    }
    if (!this.validateContactInfo()) return;

    // Call pay direct (triggers backend console approval)
    this.isWaitingApproval = true;
    this.cdr.detectChanges();
    const userId = user.id || user._id || '';

    try {
      const res = await this.apiService.payItinerary(userId, this.activeItinerary.id, this.checkoutTotal);
      if (res.success) {
        this.walletBalance = res.balance;
        this.activeItinerary.status = 'deposited';
        // Set deposit deadline as today + 7 days
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + 7);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        this.activeItinerary.deposit_deadline = `${yyyy}-${mm}-${dd}`;
        await this.saveItineraryToDb();
        this.closeCheckout();
        this.showAlert(`Thanh toán thành công! Đã đặt cọc và khóa lịch trình. Hạn hủy miễn phí trước ngày ${dd}/${mm}/${yyyy}.`, 'success');
      } else {
        this.showAlert(res.message || 'Thanh toán bị từ chối.', 'error');
      }
    } catch (e: any) {
      this.showAlert(e.error?.message || 'Thanh toán bị từ chối hoặc hết hạn phê duyệt.', 'error');
    } finally {
      this.isWaitingApproval = false;
      this.cdr.detectChanges();
    }
  }

  // Custom categorized list builder methods
  public addNewCustomList() {
    const title = prompt("Nhập tên danh mục tự chọn mới (ví dụ: 'Quán Cafe đẹp', 'Điểm chụp ảnh'):");
    if (title && title.trim()) {
      this.customLists.push({ title: title.trim(), places: [] });
      this.cdr.detectChanges();
    }
  }

  public addPlaceToCustomList(listIdx: number, val: string) {
    if (!val || !val.trim()) return;
    this.customLists[listIdx].places.push({ title: val.trim() });
    this.cdr.detectChanges();
  }

  public async deleteCustomList(listIdx: number) {
    const ok = await this.showConfirm('Xóa danh mục', `Bạn có chắc chắn muốn xóa danh mục "${this.customLists[listIdx].title}" không?`);
    if (ok) {
      this.customLists.splice(listIdx, 1);
      this.cdr.detectChanges();
    }
  }

  public deletePlaceFromCustomList(listIdx: number, placeIdx: number) {
    this.customLists[listIdx].places.splice(placeIdx, 1);
    this.cdr.detectChanges();
  }

  // =========================================================================
  // DRAGGABLE DIRECTIONS PANEL & UNIFIED MODE SWITCHER
  // =========================================================================
  public startDraggingDirectionsPanel(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX - this.dirPanelOffsetX;
    const startY = event.clientY - this.dirPanelOffsetY;

    const onMove = (e: MouseEvent) => {
      this.dirPanelOffsetX = e.clientX - startX;
      this.dirPanelOffsetY = Math.max(-10, e.clientY - startY);
      this.cdr.detectChanges();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  public onSelectUnifiedLegMode(mode: 'DRIVE' | 'TWO_WHEELER' | 'WALK') {
    if (mode === 'DRIVE') {
      this.setLegVehicleCategory('car');
      this.switchLegTravelMode('DRIVE');
    } else if (mode === 'TWO_WHEELER') {
      this.setLegVehicleCategory('motorbike');
      this.switchLegTravelMode('TWO_WHEELER');
    } else if (mode === 'WALK') {
      this.legPanelTab = 'directions';
      this.switchLegTravelMode('WALK');
    }
  }

  // =========================================================================
  // FAVORITE PLACE TOGGLE FROM GOOGLE MAPS PANEL
  // =========================================================================
  public isPlaceFavorited(place: any): boolean {
    if (!place) return false;
    const title = (place.title || place.name || '').toLowerCase();
    return (this.favoritePlaces || []).some((f: any) => (f.name || '').toLowerCase() === title);
  }

  public toggleFavoritePlaceFromMap(place: any) {
    if (!place) return;
    const title = place.title || place.name || '';
    const existingIdx = (this.favoritePlaces || []).findIndex((f: any) => (f.name || '').toLowerCase() === title.toLowerCase());
    if (existingIdx !== -1) {
      this.favoritePlaces.splice(existingIdx, 1);
      place.isSaved = false;
      this.showAlert(`Đã bỏ "${title}" khỏi danh sách Yêu thích.`, 'info');
    } else {
      this.favoritePlaces.push({
        name: title,
        type: place.type || 'explore',
        category: place.category || 'Địa điểm yêu thích',
        cost: Number(place.cost) || 0,
        carbon: Number(place.carbon) || 0.5,
        lat: place.lat,
        lng: place.lng,
        img: place.img || this.getPlacePlaceholderImage(title)
      });
      place.isSaved = true;
      this.showAlert(`Đã lưu "${title}" vào mục Yêu thích!`, 'success');
    }
    try {
      localStorage.setItem('greensteps_fav_places', JSON.stringify(this.favoritePlaces));
    } catch (e) { }
    this.cdr.detectChanges();
  }

  // =========================================================================
  // INLINE ACTIVITY PRICE EDITOR
  // =========================================================================
  public startEditActivityPrice(act: any) {
    if (!act || this.isItineraryLocked()) return;
    if (!act.id) act.id = 'act_' + Date.now();
    this.editingPriceActId = act.id;
    this.tempActivityPrice = Number(act.cost) || 0;
    this.cdr.detectChanges();
  }

  public saveEditedActivityPrice(act: any) {
    if (!act) return;
    act.cost = Math.max(0, Number(this.tempActivityPrice) || 0);
    act.priceUnknown = false;
    this.editingPriceActId = null;
    this.recalculateMetrics();
    this.saveItineraryToDb();
    this.cdr.detectChanges();
  }

  // =========================================================================
  // ACTIVITY COMMENTS, LEG NOTES & ITINERARY NOTES MODAL
  // =========================================================================
  public toggleActivityNote(act: any) {
    if (!act || this.isItineraryLocked()) return;
    if (!act.id) act.id = 'act_' + Date.now();
    this.editingNoteActId = this.editingNoteActId === act.id ? null : act.id;
    this.cdr.detectChanges();
  }

  public saveActivityNote(act: any) {
    this.editingNoteActId = null;
    this.saveItineraryToDb();
    this.cdr.detectChanges();
  }

  public getLegNote(dayIdx: number, legIdx: number): string {
    const day = this.activeItinerary?.days?.[dayIdx];
    if (!day || !day.legNotes) return '';
    return day.legNotes[legIdx] || '';
  }

  public toggleLegNoteEditor(legIdx: number) {
    if (this.editingLegNoteIdx === legIdx) {
      this.editingLegNoteIdx = null;
    } else {
      this.editingLegNoteIdx = legIdx;
      this.tempLegNoteText = this.getLegNote(this.activeDayIdx, legIdx);
    }
    this.cdr.detectChanges();
  }

  public saveLegNote(dayIdx: number, legIdx: number) {
    const day = this.activeItinerary?.days?.[dayIdx];
    if (!day) return;
    if (!day.legNotes) day.legNotes = {};
    const trimmed = (this.tempLegNoteText || '').trim();
    if (trimmed) {
      day.legNotes[legIdx] = trimmed;
    } else {
      delete day.legNotes[legIdx];
    }
    this.editingLegNoteIdx = null;
    this.saveItineraryToDb();
    this.cdr.detectChanges();
  }

  public openItineraryNotesModal() {
    if (!this.activeItinerary) return;
    if (!this.activeItinerary.generalNotes) this.activeItinerary.generalNotes = '';
    if (!Array.isArray(this.activeItinerary.checklist) || this.activeItinerary.checklist.length === 0) {
      this.activeItinerary.checklist = [
        { text: 'Giấy tờ tùy thân (CCCD / Hộ chiếu)', done: false },
        { text: 'Bình nước cá nhân giảm rác thải nhựa', done: false },
        { text: 'Sạc dự phòng & thuốc cá nhân', done: false }
      ];
    }
    this.isItineraryNotesModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeItineraryNotesModal() {
    this.isItineraryNotesModalOpen = false;
    this.cdr.detectChanges();
  }

  public getItineraryChecklist(): { text: string; done: boolean }[] {
    if (!this.activeItinerary) return [];
    if (!Array.isArray(this.activeItinerary.checklist)) this.activeItinerary.checklist = [];
    return this.activeItinerary.checklist;
  }

  public addChecklistItem() {
    const text = (this.newChecklistItemText || '').trim();
    if (!text || !this.activeItinerary) return;
    if (!Array.isArray(this.activeItinerary.checklist)) this.activeItinerary.checklist = [];
    this.activeItinerary.checklist.push({ text, done: false });
    this.newChecklistItemText = '';
    this.saveItineraryNotes();
  }

  public removeChecklistItem(idx: number) {
    if (!this.activeItinerary || !Array.isArray(this.activeItinerary.checklist)) return;
    this.activeItinerary.checklist.splice(idx, 1);
    this.saveItineraryNotes();
  }

  public getAllActivityAndLegNotes(): { label: string; text: string }[] {
    const out: { label: string; text: string }[] = [];
    if (!this.activeItinerary || !this.activeItinerary.days) return out;
    this.activeItinerary.days.forEach((d: any, dIdx: number) => {
      const dayTitle = d.title || `Ngày ${dIdx + 1}`;
      (d.activities || []).forEach((a: any) => {
        if (a.note && a.note.trim()) {
          out.push({ label: `${dayTitle} · ${a.title}`, text: a.note.trim() });
        }
      });
      if (d.legNotes) {
        Object.keys(d.legNotes).forEach((k: string) => {
          const lIdx = Number(k);
          const noteText = d.legNotes[k];
          const fromTitle = d.activities?.[lIdx]?.title || `Trạm ${lIdx + 1}`;
          const toTitle = d.activities?.[lIdx + 1]?.title || `Trạm ${lIdx + 2}`;
          if (noteText) {
            out.push({ label: `${dayTitle} · Chặng ${fromTitle} → ${toTitle}`, text: noteText });
          }
        });
      }
    });
    return out;
  }

  public saveItineraryNotes() {
    this.saveItineraryToDb();
    this.cdr.detectChanges();
  }

  public saveAndCloseItineraryNotes() {
    this.saveItineraryToDb();
    this.isItineraryNotesModalOpen = false;
    this.showAlert('Đã lưu sổ tay ghi chú & checklist hành trình!', 'success');
    this.cdr.detectChanges();
  }

  public alertNotesDev() {
    this.openItineraryNotesModal();
  }

  public alertPlacesDev() {
    this.scrollToSuggestions();
  }

  // Drag-to-resize panel layout handler
  public startResizing(event: MouseEvent, type: 'left' | 'right') {
    event.preventDefault();
    this.isResizing = true;
    this.resizeType = type;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isResizing) return;
      if (this.resizeType === 'left') {
        const newWidth = moveEvent.clientX;
        if (newWidth >= 160 && newWidth <= 420) {
          this.sidebarWidth = newWidth;
          this.cdr.detectChanges();
        }
      } else {
        const containerWidth = window.innerWidth;
        const mapWidthPx = containerWidth - moveEvent.clientX;
        const pct = (mapWidthPx / containerWidth) * 100;
        if (pct >= 22 && pct <= 62) {
          this.mapWidthPct = pct;
          this.cdr.detectChanges();
        }
      }
    };

    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      if (this.isGoogleMaps && this.gmap && typeof google !== 'undefined') {
        const center = this.gmap.getCenter();
        google.maps.event.trigger(this.gmap, 'resize');
        if (center) this.gmap.setCenter(center);
      } else if (this.map && typeof this.map.invalidateSize === 'function') {
        this.map.invalidateSize();
      }
      this.cdr.detectChanges();
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Place Details Bottom Sheet Helpers
  public getCategoryLabel(type: string): string {
    if (type === 'dining') return 'Ẩn thực / Nhà hàng';
    if (type === 'lodging') return 'Lưu trú / Homestay';
    if (type === 'transport') return 'Di chuyển xanh';
    return 'Địa điểm tham quan';
  }

  public getPlaceWikiDescription(name: string): string {
    if (!name) return "";
    if (name.includes("Hồ Xuân Hương")) return "Hồ Xuân Hương là một hồ nước nhân tạo tuyệt đẹp nằm giữa trung tâm thành phố Đà Lạt, là biểu tượng thơ mộng thu hút hàng triệu lượt du khách ghé thăm mỗi năm.";
    if (name.includes("Lẩu bò Ba Toa")) return "Lẩu bò Ba Toa quán gỗ nổi tiếng với hương vị lẩu bò truyền thống đậm đà, thịt bò tươi ngon, ăn kèm rau xanh tươi của Đà Lạt.";
    if (name.includes("Thác Datanla")) return "Thác Datanla là ngọn thác nổi tiếng với các trò chơi máng trượt xuyên rừng, đu dây vượt thác đầy tính mạo hiểm và thân thiện với thiên nhiên.";
    if (name.includes("Gành Đá Đĩa")) return "Gành Đá Đĩa là kỳ quan thiên nhiên độc nhất vô nhị tại Phú Yên với các cột đá hình lăng trụ xếp chồng lên nhau như những chiếc đĩa khổng lồ.";
    if (name.includes("Mắt cá ngừ")) return "Mắt cá ngừ đại dương bà Tám là món ăn đặc sản trứ danh của tỉnh Phú Yên, hầm thuốc bắc bổ dưỡng thơm ngon.";
    if (name.includes("Bà Nà Hills")) return "Bà Nà Hills nổi tiếng với Cầu Vàng khổng lồ được nâng đỡ bởi đôi bàn tay đá, khu vui chơi giải trí hàng đầu Việt Nam.";
    return "Địa danh du lịch nổi tiếng với cảnh quan thiên nhiên trong lành, cam kết giảm thiểu khí thải carbon, bảo tồn văn hóa và môi trường địa phương.";
  }

  public getPlacePlaceholderImage(name: string, type?: string, dest?: string): string {
    const n = (name || '').trim();
    if (!n) return "image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg";
    const lower = n.toLowerCase();
    const targetDest = (dest || this.activeItinerary?.destLabel || this.activeItinerary?.destination || this.mapSlugToDestLabel(this.activeItinerary?.dest) || '').toLowerCase();

    // 1. Specific Landmark overrides
    if (lower.includes('bà nà') || lower.includes('cầu vàng')) return 'image/greensteps/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg';
    if (lower.includes('cầu rồng')) return 'image/greensteps/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg';
    if (lower.includes('chùa cầu')) return 'image/greensteps/da-nang-hoi-an/hoi-an-chua-cau-01.jpg';
    if (lower.includes('trà quế') || lower.includes('làng rau')) return 'image/greensteps/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg';
    if (lower.includes('bảy mẫu') || lower.includes('rừng dừa')) return 'image/greensteps/da-nang-hoi-an/hoi-an-song-hoai-hoa-dang-01.jpg';
    if (lower.includes('sơn trà') || lower.includes('linh ứng')) return 'image/greensteps/da-nang-hoi-an/da-nang-son-tra-rung-xanh-01.jpg';
    if (lower.includes('mỹ khê') || lower.includes('an bàng')) return 'image/greensteps/da-nang-hoi-an/da-nang-bien-my-khe-01.jpg';

    if (lower.includes('xuân hương')) return 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg';
    if (lower.includes('tuyền lâm')) return 'image/greensteps/da-lat/da-lat-ho-tuyen-lam-01.jpg';
    if (lower.includes('lâm viên')) return 'image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg';
    if (lower.includes('datanla') || lower.includes('prenn')) return 'image/greensteps/da-lat/da-lat-thac-nuoc-01.jpg';
    if (lower.includes('linh phước') || lower.includes('ve chai')) return 'image/greensteps/da-lat/da-lat-chua-linh-phuoc-01.jpg';
    if (lower.includes('vườn hoa')) return 'image/greensteps/da-lat/da-lat-vuon-hoa-01.jpg';

    if (lower.includes('gành đá đĩa') || lower.includes('ghềnh đá đĩa')) return 'image/greensteps/phu-yen/phu-yen-bai-da-ven-bien-01.jpg';
    if (lower.includes('bãi xép') || lower.includes('hoa vàng')) return 'image/greensteps/phu-yen/phu-yen-bai-xep-checkin-01.jpg';
    if (lower.includes('tháp nhạn') || lower.includes('nghinh phong')) return 'image/greensteps/phu-yen/phu-yen-thap-nghinh-phong-01.jpg';
    if (lower.includes('vũng rô') || lower.includes('làng chài') || lower.includes('homestay')) return 'image/greensteps/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg';
    if (lower.includes('mũi điện') || lower.includes('bãi môn')) return 'image/greensteps/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg';

    // 2. Hash-based deterministic index to ensure diversity within category
    const hash = n.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) & 0x7fffffff, 0);

    // 3. Category Pools
    const isFood = type === 'dining' || /quán|ăn|ẩm thực|cà phê|cafe|bún|phở|lẩu|cơm|bánh/.test(lower);
    const isShopping = type === 'shopping' || /mini go|siêu thị|chợ|tạp hóa|cửa hàng|mua sắm/.test(lower);
    const isMedical = type === 'medical' || /bệnh viện|phòng khám|trạm y tế|tiệm thuốc|nha khoa/.test(lower);
    const isStay = type === 'lodging' || /homestay|hotel|khách sạn|resort|nhà nghỉ|villa|nghỉ dưỡng/.test(lower);
    const isTransport = type === 'transport' || /xe điện|xe ghép|bến xe|sân bay|ga tàu|di chuyển|thuê xe/.test(lower);

    if (isMedical) {
      return 'image/greensteps/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg';
    }
    if (isTransport) {
      return 'image/greensteps/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg';
    }
    if (isShopping) {
      return 'image/greensteps/da-nang-hoi-an/hoi-an-ca-phe-dia-phuong-01.jpg';
    }

    // Đà Lạt pool
    if (targetDest.includes('đà lạt') || targetDest.includes('da lat') || targetDest.includes('lâm đồng')) {
      if (isFood) {
        const dalatFood = [
          'image/greensteps/da-lat/da-lat-vuon-hoa-01.jpg',
          'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg',
          'image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg'
        ];
        return dalatFood[hash % dalatFood.length];
      }
      if (isStay) {
        const dalatStay = [
          'image/greensteps/da-lat/da-lat-nghi-duong-ven-ho-01.jpg',
          'image/greensteps/da-lat/da-lat-rung-thong-san-may-01.jpg',
          'image/greensteps/da-lat/da-lat-ho-tuyen-lam-01.jpg'
        ];
        return dalatStay[hash % dalatStay.length];
      }
      const dalatAttractions = [
        'image/greensteps/da-lat/da-lat-thac-nuoc-01.jpg',
        'image/greensteps/da-lat/da-lat-chua-linh-phuoc-01.jpg',
        'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg',
        'image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg',
        'image/greensteps/da-lat/da-lat-rung-thong-san-may-01.jpg'
      ];
      return dalatAttractions[hash % dalatAttractions.length];
    }

    // Phú Yên pool
    if (targetDest.includes('phú yên') || targetDest.includes('phu yen') || targetDest.includes('tuy hòa')) {
      if (isStay) {
        return 'image/greensteps/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg';
      }
      const phuyenPool = [
        'image/greensteps/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
        'image/greensteps/phu-yen/phu-yen-thap-nghinh-phong-01.jpg',
        'image/greensteps/phu-yen/phu-yen-bai-da-ven-bien-01.jpg',
        'image/greensteps/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg',
        'image/greensteps/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg'
      ];
      return phuyenPool[hash % phuyenPool.length];
    }

    // Đà Nẵng / Hội An pool
    if (targetDest.includes('đà nẵng') || targetDest.includes('hội an') || targetDest.includes('quảng nam')) {
      if (isFood) {
        const hoianFood = [
          'image/greensteps/da-nang-hoi-an/hoi-an-ca-phe-dia-phuong-01.jpg',
          'image/greensteps/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg'
        ];
        return hoianFood[hash % hoianFood.length];
      }
      if (isStay) {
        const hoianStay = [
          'image/greensteps/da-nang-hoi-an/da-nang-bien-my-khe-01.jpg',
          'image/greensteps/da-nang-hoi-an/hoi-an-pho-co-01.jpg',
          'image/greensteps/da-nang-hoi-an/da-nang-son-tra-rung-xanh-01.jpg'
        ];
        return hoianStay[hash % hoianStay.length];
      }
      const hoianAttractions = [
        'image/greensteps/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg',
        'image/greensteps/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg',
        'image/greensteps/da-nang-hoi-an/hoi-an-chua-cau-01.jpg',
        'image/greensteps/da-nang-hoi-an/da-nang-son-tra-rung-xanh-01.jpg',
        'image/greensteps/da-nang-hoi-an/da-nang-bien-my-khe-01.jpg'
      ];
      return hoianAttractions[hash % hoianAttractions.length];
    }

    // Sa Pa pool
    if (targetDest.includes('sa pa') || targetDest.includes('lào cai')) {
      const sapaPool = [
        'image/greensteps/sa-pa/sa-pa-ruong-bac-thang-01.jpg',
        'image/greensteps/sa-pa/sa-pa-fansipan-01.jpg',
        'image/greensteps/sa-pa/sa-pa-nui-ham-rong-01.jpg',
        'image/greensteps/sa-pa/sa-pa-ban-cat-cat-01.jpg'
      ];
      return sapaPool[hash % sapaPool.length];
    }

    // General fallback
    const generalPool = [
      'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg',
      'image/greensteps/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg',
      'image/greensteps/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
      'image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg',
      'image/greensteps/da-nang-hoi-an/hoi-an-chua-cau-01.jpg'
    ];
    return generalPool[hash % generalPool.length];
  }


  public async openGooglePlacePanel(item: any, event?: Event) {
    if (this.isDraggingCard) return;
    if (event) event.stopPropagation();
    if (!item) return;

    const title = item.title || item.name || '';
    const currentDest = this.activeItinerary?.destLabel || this.activeItinerary?.destination || this.mapSlugToDestLabel(this.activeItinerary?.dest) || 'Đà Lạt';
    const coords = (typeof item.lat === 'number' && typeof item.lng === 'number')
      ? { lat: item.lat, lng: item.lng }
      : this.lookupActivityCoordinates(title);

    const greenMatch = this.findMatchingGreenStepsService(title, coords?.lat, coords?.lng);
    const resolvedPrice = item.cost !== undefined
      ? { cost: Number(item.cost) || 0, priceUnknown: !!item.priceUnknown }
      : this.resolvePlaceCost(title, item, greenMatch);

    // Initial render so panel pops open immediately
    this.activeGooglePlacePanel = {
      title: title,
      place_id: item.place_id || null,
      type: item.type || 'explore',
      category: item.category || this.getActivityTypeLabel(item.type) || 'Điểm tham quan sinh thái',
      rating: item.rating || 4.8,
      reviews: item.reviews || item.user_ratings_total || 250,
      googleReviews: item.googleReviews || [],
      cost: resolvedPrice.cost,
      priceUnknown: resolvedPrice.priceUnknown,
      carbon: item.carbon || 0.8,
      img: item.img || (item.photos && item.photos[0]) || this.getPlacePlaceholderImage(title, item.type, currentDest),
      photos: item.photos || [],
      lat: coords?.lat,
      lng: coords?.lng,
      address: item.address || this.getPlaceAddress(title),
      description: item.description || this.getActivityDetailedDesc(item),
      hours: item.hours || 'Đang mở cửa · Mở cửa cả ngày',
      weekdayText: item.weekdayText || [],
      phone: item.phone || '',
      website: item.website || '',
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`,
      isActivity: item.isActivity !== undefined ? item.isActivity : true,
      isPartner: item.isPartner !== undefined ? item.isPartner : (item.is_partner !== undefined ? item.is_partner : !!this.findMatchingGreenStepsService(title, coords?.lat, coords?.lng)),
      itemRef: item
    };

    if (coords && this.isGoogleMaps && this.gmap) {
      try {
        this.gmap.panTo(coords);
        this.gmap.setZoom(16);
      } catch (e) { }
    }

    this.activePlaceTab = 'overview';
    this.selectedPlaceDetails = null;
    this.cdr.detectChanges();

    // FETCH 100% REAL GOOGLE DATA VIA PLACES API
    try {
      const q = title.length > 8 ? title : `${title} ${currentDest}`;
      const realPlaces = await this.apiService.searchGooglePlaces(q);
      if (realPlaces && realPlaces.length > 0) {
        const rp = realPlaces[0];
        this.ngZone.run(() => {
          if (this.activeGooglePlacePanel) {
            // Keep curated activity title intact; do NOT overwrite with arbitrary nearby store results!
            if (!this.activeGooglePlacePanel.title) {
              this.activeGooglePlacePanel.title = rp.title || title;
            }
            this.activeGooglePlacePanel.place_id = rp.id;
            this.activeGooglePlacePanel.rating = rp.rating || 4.8;
            this.activeGooglePlacePanel.reviews = rp.reviewsCount || 0;
            this.activeGooglePlacePanel.googleReviews = rp.googleReviews || [];
            this.activeGooglePlacePanel.address = rp.address || this.activeGooglePlacePanel.address;
            this.activeGooglePlacePanel.phone = rp.phone || '';
            this.activeGooglePlacePanel.website = rp.website || '';
            this.activeGooglePlacePanel.hours = rp.hours || 'Đang mở cửa';
            this.activeGooglePlacePanel.weekdayText = rp.weekdayText || [];
            if (item.img) {
              this.activeGooglePlacePanel.img = item.img;
            } else if (rp.photos && rp.photos.length > 0 && !this.activeGooglePlacePanel.img) {
              this.activeGooglePlacePanel.photos = rp.photos;
              this.activeGooglePlacePanel.img = rp.photos[0];
            }
            // DO NOT mutate category or type of curated itinerary activities!
            if (!item.type && !item.isActivity && rp.types && Array.isArray(rp.types)) {
              if (rp.types.some((t: string) => ['restaurant', 'food', 'cafe', 'supermarket', 'store', 'grocery_store'].includes(t))) {
                this.activeGooglePlacePanel.category = 'Quán ăn / Ẩm thực địa phương';
                this.activeGooglePlacePanel.type = 'dining';
              } else if (rp.types.some((t: string) => ['lodging', 'hotel', 'motel', 'resort'].includes(t))) {
                this.activeGooglePlacePanel.category = 'Cơ sở lưu trú sinh thái';
                this.activeGooglePlacePanel.type = 'lodging';
              }
            }
            if (rp.lat && rp.lng) {
              this.activeGooglePlacePanel.lat = rp.lat;
              this.activeGooglePlacePanel.lng = rp.lng;
            }
            this.cdr.detectChanges();
          }
        });
      }
    } catch (e) {
      console.warn('Real Google Place fetch error:', e);
    }
  }

  public trackByActId(index: number, act: any): string {
    return act?.id || (act?.title ? `${act.title}_${index}` : `act_${index}`);
  }


  public sharePlace(place: any) {
    if (!place) return;
    const shareUrl = place.googleMapsUrl || window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${place.title} - ${place.address || ''} (${shareUrl})`);
      this.showAlert(`Đã sao chép liên kết địa điểm "${place.title}" vào clipboard!`, 'success');
    } else {
      this.showAlert(`Địa điểm: ${place.title}`, 'info');
    }
  }

  public deleteActivityFromPanel() {
    if (!this.activeGooglePlacePanel) return;
    const activeDay = this.activeItinerary?.days[this.activeDayIdx];
    if (!activeDay || !activeDay.activities) return;

    const target = this.activeGooglePlacePanel.itemRef;
    let idx = -1;
    if (target) {
      idx = activeDay.activities.indexOf(target);
    }
    if (idx === -1) {
      idx = activeDay.activities.findIndex((a: any) => a.title === this.activeGooglePlacePanel.title);
    }
    if (idx !== -1) {
      const removed = activeDay.activities.splice(idx, 1);
      this.recalculateMetrics();
      this.plotMapMarkers();
      this.saveItineraryToDb();
      this.closeGooglePlacePanel();
      this.showAlert(`Đã xóa "${removed[0]?.title || 'hoạt động'}" khỏi lịch trình`, 'info');
      this.cdr.detectChanges();
    }
  }

  public closeGooglePlacePanel() {
    this.activeGooglePlacePanel = null;
    this.selectedPlaceDetails = null;
    this.cdr.detectChanges();
  }

  public closePlaceDetails() {
    this.selectedPlaceDetails = null;
    this.cdr.detectChanges();
  }

  public startSheetResizing(event: MouseEvent) {
    event.preventDefault();
    this.isSheetResizing = true;
    const startHeight = this.sheetHeight;
    const startY = event.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isSheetResizing) return;
      const dy = startY - moveEvent.clientY;
      const newHeight = startHeight + dy;
      if (newHeight > 140 && newHeight < 480) {
        this.sheetHeight = newHeight;
        this.cdr.detectChanges();
      }
    };

    const onMouseUp = () => {
      this.isSheetResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  public startMetricsResizing(event: MouseEvent) {
    event.preventDefault();
    this.isMetricsResizing = true;
    const startHeight = this.metricsHeight;
    const startY = event.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isMetricsResizing) return;
      const dy = startY - moveEvent.clientY;
      const newHeight = startHeight + dy;
      if (newHeight > 70 && newHeight < 360) {
        this.metricsHeight = newHeight;
        this.cdr.detectChanges();
      }
    };

    const onMouseUp = () => {
      this.isMetricsResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  public isItineraryLocked(): boolean {
    if (this.isSampleItinerary) return false;
    if (this.activeItinerary && (this.activeItinerary.id?.startsWith('BKT-') || this.activeItinerary.id?.startsWith('BKS-'))) {
      return true;
    }
    return false;
  }

  public getCanCancelDeposit(iti: any): boolean {
    if (!iti) return false;
    if (iti.isTourBooking) return false;
    if (!iti.deposit_deadline) return false;
    const today = new Date();
    const deadline = new Date(iti.deposit_deadline);
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    return today <= deadline;
  }

  public async cancelDeposit(iti: any, event: Event) {
    event.stopPropagation();
    if (!iti.deposit_deadline) {
      this.showAlert('Không tìm thấy thời hạn hủy hợp lệ!', 'error');
      return;
    }
    const today = new Date();
    const deadline = new Date(iti.deposit_deadline);
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    if (today > deadline) {
      this.showAlert(`Đã quá thời hạn hủy đặt cọc miễn phí (Hạn chót: ${iti.deposit_deadline}). Bạn không thể hủy lịch trình này.`, 'error');
      return;
    }

    const confirmCancel = await this.showConfirm('Hủy đặt cọc', `Bạn có chắc chắn muốn hủy đặt cọc lịch trình "${iti.name}"? Số tiền đặt cọc sẽ được hoàn lại ví.`);
    if (confirmCancel) {
      iti.status = 'cancelled';
      const success = await this.apiService.saveItinerary(this.convertEditorToApiItinerary(iti));
      if (success) {
        this.showAlert('Hủy đặt cọc thành công! Lịch trình đã chuyển về trạng thái Hủy.', 'success');
        await this.loadSavedItinerariesList();
      } else {
        this.showAlert('Hủy đặt cọc thất bại. Vui lòng thử lại!', 'error');
      }
    }
  }
}

export { ScheduleEditorComponent as ScheduleEditor };
