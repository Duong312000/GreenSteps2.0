import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
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
})
export class ScheduleEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  public currentUser: any = null;
  public activeItinerary: any = null; // Internal Editor representation
  public activeDayIdx: number = 0;
  public walletBalance: number = 5000000;
  public walletRegistered: boolean = false;
  public customPlaceTitle: string = '';
  public isListMode: boolean = false;
  public savedItineraries: any[] = [];
  public isLoadingList: boolean = false;
  public isCreateModalOpen: boolean = false;
  public modalDest: string = 'Đà Lạt';
  public modalDays: number = 3;

  // New Create Itinerary Modal variables
  public isCreateNewModalOpen: boolean = false;
  public newTripName: string = '';
  public newTripDestination: string = 'Đà Lạt';
  public newTripStartDate: string = '';
  public newTripEndDate: string = '';
  public newTripCompanionEmail: string = '';

  // Share Itinerary variables
  public isShareModalOpen: boolean = false;
  public sharingItinerary: any = null;
  public shareMessage: string = '';
  public shareLink: string = '';

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
    'Đà Nẵng - Hội An': [16.047079, 108.206230]
  };

  // Maps properties
  private map: any = null;
  private leafletMarkers: any[] = [];
  private polyline: any = null;
  private positioningMarker: any = null;

  // AI chat properties
  public isAiChatOpen: boolean = false;
  public aiMessages: { text: string; isOutgoing: boolean; rec?: any }[] = [];
  public aiInputText: string = '';
  public isAiThinking: boolean = false;
  public mapClickPlaceName: string = '';
  public locatingActivityIdx: number | null = null;
  public customSearchSuggestions: any[] = [];
  public isAutoSaving: boolean = false;
  public searchMarkers: any[] = [];
  private typingTimeout: any = null;


  // Checkout modal properties
  public isCheckoutModalOpen: boolean = false;
  public isItineraryPay: boolean = false;
  public checkoutItems: { title: string; cost: number }[] = [];
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

  // Resizer Panel properties
  public sidebarWidth: number = 252;
  public mapWidthPct: number = 42;
  private isResizing: boolean = false;
  private resizeType: 'left' | 'right' = 'left';

  // Bottom Sheet Details properties
  public selectedPlaceDetails: any = null;
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

  // Custom categorized list builder properties
  public customLists: { title: string; places: { title: string }[] }[] = [
    { title: 'Nhà hàng cần thử', places: [] },
    { title: 'Khách sạn tham khảo', places: [] }
  ];

  // Cities centers for map coordinates fallbacks
  private cityCenters: { [key: string]: number[] } = {
    "da-lat": [11.9404, 108.4373],
    "phu-yen": [13.0882, 109.3025],
    "da-nang": [16.0544, 108.2022]
  };

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private loginModalService: LoginModalService,
    private cdr: ChangeDetectorRef
  ) {}

  public openLoginModal() {
    this.loginModalService.open();
  }

  ngOnInit() {
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
      text: "Xin chào! Tôi là trợ lý hành trình xanh của GreenSteps. Hãy cho tôi biết bạn đang muốn đi đâu hoặc muốn ăn gì ở khu vực này, tôi sẽ gợi ý các điểm đến giảm thiểu phát thải carbon thấp nhất cho bạn!",
      isOutgoing: false
    });
    this.cdr.detectChanges();
  }

  ngAfterViewInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isListMode = false;
        this.loadItineraryToEditor(id);
        localStorage.setItem('greensteps_working_itinerary_id', id);
      } else {
        this.isListMode = true;
        this.activeItinerary = null;
        this.loadSavedItinerariesList();
      }
    });
  }

  ngOnDestroy() {
    this.stopBackgroundSync();
    this.clearSearchMarkers();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }


  public async loadSavedItinerariesList() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.savedItineraries = [];
      this.isLoadingList = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingList = true;
    this.cdr.detectChanges();
    try {
      const userId = user.id || user._id || '';
      const customs = await this.apiService.getItineraries(userId);
      const bookings: any[] = await this.apiService.getBookings(undefined, userId);
      
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
            bookingStatusText: b.status === 'confirmed' ? 'Đã xác nhận' : (b.status === 'deposit' ? 'Đã đặt cọc' : (b.status === 'completed' ? 'Đã hoàn thành' : 'Đang chuẩn bị'))
          };
        });

      this.savedItineraries = [...customs, ...depositedToursMapped];
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingList = false;
      this.cdr.detectChanges();
    }
  }

  public async deleteSavedItinerary(id: string, event: Event) {
    event.stopPropagation();
    const confirmed = await this.showConfirm('Xóa lịch trình', 'Bạn có chắc chắn muốn xóa lịch trình này không?');
    if (confirmed) {
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
      this.router.navigate(['/profile'], { queryParams: { section: 'tickets' } });
      return;
    }
    this.router.navigate(['/schedule', id]);
  }

  public openCreateNewModal() {
    this.isCreateNewModalOpen = true;
    this.newTripName = '';
    this.newTripDestination = 'Đà Lạt';
    this.newTripStartDate = '';
    this.newTripEndDate = '';
    this.newTripCompanionEmail = '';
    this.cdr.detectChanges();
  }

  public closeCreateNewModal() {
    this.isCreateNewModalOpen = false;
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

    const daysData = Array.from({ length: calculatedDays }, () => []);

    const newIti = {
      id: 'iti_' + Date.now(),
      name: this.newTripName.trim() || `Hành trình khám phá ${this.newTripDestination}`,
      user_id: userId,
      destination: this.newTripDestination,
      days: calculatedDays,
      totalCost: 0,
      totalCarbon: 0,
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

    const success = await this.apiService.saveItinerary(newIti);
    this.isLoadingList = false;
    this.cdr.detectChanges();

    if (success) {
      if (this.newTripCompanionEmail.trim()) {
        const sender = this.authService.getCurrentUser();
        const senderName = sender ? (sender.fullname || sender.username) : 'Một người bạn';
        const inviteUrl = `${window.location.origin}/?inviteItineraryId=${newIti.id}&senderName=${encodeURIComponent(senderName)}`;
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

  // Share methods
  public openShareModal(iti: any, event: Event) {
    event.stopPropagation();
    this.sharingItinerary = iti;
    this.isShareModalOpen = true;
    this.shareMessage = `Khám phá hành trình xanh của tôi tại ${iti.destination} trên GreenSteps! 🌿`;
    this.shareLink = `${window.location.origin}/schedule/${iti.id}`;
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
      this.showAlert('Vui lòng đăng nhập để chia sẻ!', 'warning');
      return;
    }
    
    try {
      const payload = {
        authorId: user.id || user._id || '',
        author: user.fullname || 'Thành viên GreenSteps',
        text: this.shareMessage,
        rating: 5,
        tripName: this.sharingItinerary.name,
        dest: this.sharingItinerary.destination,
        days: this.sharingItinerary.days,
        likes: 0,
        comments: 0,
        image: null,
        itineraryId: this.sharingItinerary.id
      };
      
      const ok = await this.apiService.addCommunityPost(payload);
      if (ok) {
        this.closeShareModal();
        this.showAlert('Đã chia sẻ lịch trình lên cộng đồng GreenSteps thành công!', 'success', () => {
          this.router.navigate(['/community']);
        });
      } else {
        this.showAlert('Chia sẻ lên cộng đồng thất bại!', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showAlert('Đã xảy ra lỗi khi đăng bài!', 'error');
    }
  }

  public shareSocial(platform: 'facebook' | 'twitter' | 'messenger') {
    const url = encodeURIComponent(this.shareLink);
    const text = encodeURIComponent(this.shareMessage);
    let shareUrl = '';
    if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    } else if (platform === 'messenger') {
      shareUrl = `https://www.facebook.com/dialog/send?app_id=2108319696129542&link=${url}&redirect_uri=${url}`;
    } else {
      shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    }
    window.open(shareUrl, '_blank', 'width=600,height=400');
  }

  public copyShareLink() {
    navigator.clipboard.writeText(this.shareLink);
    this.showAlert('Đã sao chép liên kết chia sẻ vào bộ nhớ tạm!', 'success');
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
    this.router.navigate(['/schedule']);
  }

  private mapDestToSlug(destName: string): string {
    if (!destName) return "da-lat";
    const normalized = destName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (normalized.includes("dalat") || normalized.includes("da lat")) return "da-lat";
    if (normalized.includes("phu yen")) return "phu-yen";
    if (normalized.includes("da nang") || normalized.includes("hoi an")) return "da-nang";
    return "da-lat";
  }

  private mapSlugToDestLabel(slug: string): string {
    if (slug === "da-lat") return "Đà Lạt";
    if (slug === "phu-yen") return "Phú Yên";
    if (slug === "da-nang") return "Đà Nẵng - Hội An";
    return "Đà Lạt";
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
    
    const days: any[] = [];
    const rawDaysData = apiIti.daysData || apiIti.days_data || apiIti.data || [];
    const daysCount = apiIti.days || rawDaysData.length || 1;
    
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
        activities.push({
          id: act.id || ('act_' + Date.now() + '_' + Math.random().toString(36).substring(2,7)),
          time: act.time || "08:00",
          title: title,
          type: type,
          cost: act.cost || 0,
          carbon: act.carbon || 0,
          is_shared: isShared,
          lat: lat,
          lng: lng
        });
      });
      
      // Sort activities chronologically by time
      activities.sort((a: any, b: any) => {
        const timeA = a.time || "00:00";
        const timeB = b.time || "00:00";
        return timeA.localeCompare(timeB);
      });
      
      days.push({
        dayNum: i + 1,
        title: `Ngày ${i + 1}`,
        activities: activities
      });
    }
    
    return {
      id: apiIti.id,
      title: apiIti.name || "Lịch trình tự thiết kế",
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
        
        dayActivities.push({
          id: "act_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          time: act.time,
          name: act.title,
          cost: act.cost,
          carbon: act.carbon,
          icon: icon,
          type: act.type,
          lat: act.lat,
          lng: act.lng
        });
      });
      daysData.push(dayActivities);
    });
    
    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';

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
    const apiIti = this.convertEditorToApiItinerary(this.activeItinerary);
    try {
      await this.apiService.saveItinerary(apiIti);
      setTimeout(() => {
        this.isAutoSaving = false;
        this.cdr.detectChanges();
      }, 800);
    } catch (e) {
      this.isAutoSaving = false;
      this.cdr.detectChanges();
    }
  }

  public sortActivitiesByTime(dayIdx: number) {
    if (!this.activeItinerary || !this.activeItinerary.days[dayIdx]) return;
    this.activeItinerary.days[dayIdx].activities.sort((a: any, b: any) => {
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return timeA.localeCompare(timeB);
    });
  }

  public async onActivityTimeChanged() {
    this.sortActivitiesByTime(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    await this.saveItineraryToDb();
  }

  private async loadItineraryToEditor(tourId: string) {
    if (tourId === 'new') {
      const newTour = {
        id: "iti_" + Date.now(),
        title: "Lịch trình trống của tôi",
        dest: "da-lat",
        destLabel: "Đà Lạt",
        days: [
          {
            dayNum: 1,
            title: "Ngày 1",
            activities: []
          }
        ]
      };
      this.openEditorWithItinerary(newTour);
      await this.saveItineraryToDb();
      return;
    }

    // Try loading custom itinerary first
    const custom = await this.apiService.getItinerary(tourId);
    if (custom) {
      const cloned = this.convertApiToEditorItinerary(custom);
      this.openEditorWithItinerary(cloned);
      return;
    }

    // Load preset tours
    const preset = await this.apiService.getPresetTour(tourId);
    if (preset) {
      const cloned = this.convertApiToEditorItinerary(preset);
      cloned.title = preset.title;
      this.openEditorWithItinerary(cloned);
    } else {
      this.showAlert('Không tìm thấy lịch trình này, đang quay về danh sách!', 'warning');
      this.router.navigate(['/schedule']);
    }
    this.cdr.detectChanges();
  }

  private openEditorWithItinerary(itinerary: any) {
    this.activeItinerary = itinerary;
    this.activeDayIdx = 0;

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
      this.initLeafletMap();
    }, 100);

    // Start silent background synchronization polling
    this.startBackgroundSync();
  }

  public async loadDynamicRecommendations() {
    if (!this.activeItinerary) return;
    const destLabel = this.activeItinerary.destLabel || this.mapSlugToDestLabel(this.activeItinerary.dest);
    try {
      // Query only services matching the destination from the database
      const services = await this.apiService.getServicesByDestination(destLabel);
      
      let recsList: any[] = [];
      if (services && services.length > 0) {
        recsList = services.map(srv => {
          let recType = srv.type;
          if (recType === 'stay' || recType === 'lodging') recType = 'lodging';
          else if (recType === 'food' || recType === 'dining') recType = 'dining';
          
          return {
            name: srv.name || srv.name_service,
            category: srv.current_data?.category || (srv.type === 'food' || srv.type === 'dining' ? 'Ăn uống' : srv.type === 'stay' || srv.type === 'lodging' ? 'Lưu trú' : 'Khám phá'),
            type: recType,
            cost: srv.cost,
            carbon: srv.carbon,
            img: srv.current_data?.img || this.getServiceFallbackImage(srv.type),
            lat: srv.current_data?.lat,
            lng: srv.current_data?.lng,
            badges: srv.badges || ['green']
          };
        });
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
      return true; // keep
    });
  }

  private getServiceFallbackImage(type: string): string {
    if (type === 'stay' || type === 'lodging') {
      return 'image/1dc8619487310884c9d631d689ece1e7.jpg';
    } else if (type === 'food' || type === 'dining') {
      return 'image/2eee566424c1f35fbeacf85496b4b6e7.jpg';
    }
    return 'image/Viet Nam.png';
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
    const newDayNum = this.activeItinerary.days.length + 1;
    this.activeItinerary.days.push({
      dayNum: newDayNum,
      title: "Ngày " + newDayNum,
      activities: []
    });
    this.activeDayIdx = newDayNum - 1;

    this.plotMapMarkers();
    await this.saveItineraryToDb();
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

  public getActivityTypeLabel(type: string): string {
    if (type === "lodging") return "Nơi lưu trú";
    if (type === "dining") return "Ăn uống";
    if (type === "transport") return "Di chuyển";
    return "Điểm tham quan";
  }

  public async deleteActivity(idx: number) {
    if (!this.activeItinerary) return;
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    activeDay.activities.splice(idx, 1);

    this.plotMapMarkers();
    this.recalculateMetrics();
    this.filterOutCurrentActivities();
    await this.saveItineraryToDb();
  }

  public async moveActivity(idx: number, direction: number) {
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

    this.plotMapMarkers();
    await this.saveItineraryToDb();
  }

  public onCustomPlaceTyping() {
    const val = this.customPlaceTitle.trim();
    if (!val || !this.activeItinerary) {
      this.customSearchSuggestions = [];
      return;
    }

    // Filter local services instantly
    const localMatches = this.localServices.filter(s => 
      (s.name || s.name_service || '').toLowerCase().includes(val.toLowerCase())
    ).slice(0, 3).map(s => ({
      name: s.name || s.name_service,
      name_service: s.name || s.name_service,
      title: s.name || s.name_service,
      category: s.type || 'explore',
      lat: s.lat || (s.current_data && s.current_data.lat) || null,
      lng: s.lng || (s.current_data && s.current_data.lng) || null,
      isLocal: true,
      address: s.address || ''
    }));

    this.customSearchSuggestions = localMatches;

    // Debounce Nominatim API call for external suggestions
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
          return {
            name: r.display_name ? r.display_name.split(',')[0] : val,
            name_service: r.display_name ? r.display_name.split(',')[0] : val,
            title: r.display_name ? r.display_name.split(',')[0] : val,
            category: placeType,
            lat: parseFloat(r.lat) || null,
            lng: parseFloat(r.lon) || null,
            address: r.display_name || '',
            isLocal: false
          };
        });

        // Combine local and external matches, filtering duplicates
        const combined = [...localMatches];
        osmMatches.forEach((osm: any) => {
          if (!combined.some(c => c.title.toLowerCase() === osm.title.toLowerCase())) {
            combined.push(osm);
          }
        });
        
        this.customSearchSuggestions = combined.slice(0, 6);
        this.cdr.detectChanges();
      } catch (e) {
        console.warn('Autocomplete suggest error:', e);
      }
    }, 500);
  }

  public selectSearchSuggestion(sug: any) {
    this.customPlaceTitle = sug.title || sug.name || sug.name_service;
    this.customSearchSuggestions = [];
    
    // Add directly to active day
    const time = this.getNextSuggestedTime();
    const type = sug.category || 'explore';
    let cost = type === "dining" ? 80000 : (type === "lodging" ? 500000 : 30000);
    let carbon = type === "dining" ? 2 : 4;
    
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    if (!activeDay.activities) activeDay.activities = [];
    activeDay.activities.push({
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2,7),
      time: time,
      name: this.customPlaceTitle,
      cost: cost,
      carbon: carbon,
      icon: type === 'lodging' ? 'bi-house-door-fill' : (type === 'dining' ? 'bi-cup-hot-fill' : 'bi-tree-fill'),
      type: type,
      is_shared: this.checkIfSharedByDefault(this.customPlaceTitle, type),
      lat: sug.lat,
      lng: sug.lng
    });
    
    this.customPlaceTitle = '';
    this.plotMapMarkers();
    this.saveItineraryToDb();
    
    if (sug.lat && sug.lng && this.map) {
      this.map.panTo([sug.lat, sug.lng]);
      this.map.setZoom(15);
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
    this.plotMapMarkers();
    this.recalculateMetrics();
    await this.saveItineraryToDb();
  }

  public async addPoolItemToActiveDay(name: string, type: string, cost: number, carbon: number, lat?: number, lng?: number) {
    console.log("addPoolItemToActiveDay called with:", { name, type, cost, carbon, lat, lng });
    if (!this.activeItinerary || !name || !name.trim()) {
      console.warn("addPoolItemToActiveDay validation failed, activeItinerary:", this.activeItinerary, "name:", name);
      return;
    }
    const time = this.getNextSuggestedTime();

    let finalLat = lat;
    let finalLng = lng;
    let finalCost = cost;
    let finalCarbon = carbon;
    let finalType = type;

    // Search in localServices for a match if coordinates are not provided
    if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
      const match = this.localServices.find(s => 
        (s.name || s.name_service || '').toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes((s.name || s.name_service || '').toLowerCase())
      );

      if (match) {
        finalType = match.type || type;
        finalCost = match.cost || 0;
        finalCarbon = match.carbon || 0;
        const meta = match.current_data || {};
        finalLat = meta.lat || undefined;
        finalLng = meta.lng || undefined;
      }
    }

    const destSlug = this.activeItinerary.dest || 'da-lat';

    // Try samplePlacesRecs mapping
    if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
      const coords = this.getCoordinatesForPlace(name, destSlug);
      finalLat = coords.lat;
      finalLng = coords.lng;
    }

    // Geocoding online fallback
    if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
      const destLabel = this.activeItinerary.destLabel || this.mapSlugToDestLabel(destSlug);
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

    const newAct = {
      time: time,
      title: name,
      type: finalType,
      cost: finalCost,
      carbon: finalCarbon,
      is_shared: this.checkIfSharedByDefault(name, finalType),
      lat: finalLat,
      lng: finalLng
    };
    
    this.activeItinerary.days[this.activeDayIdx].activities.push(newAct);

    this.sortActivitiesByTime(this.activeDayIdx);
    this.plotMapMarkers();
    this.recalculateMetrics();
    this.filterOutCurrentActivities();
    await this.saveItineraryToDb();
  }

  public async handleMapClick(lat: number, lng: number) {
    this.selectedPlaceDetails = {
      title: "Đang tải thông tin địa điểm...",
      type: "explore",
      cost: 0,
      carbon: 1,
      lat: lat,
      lng: lng,
      isActivity: false,
      isCustomMapClick: true
    };
    this.mapClickPlaceName = 'Đang tải...';
    this.cdr.detectChanges();

    try {
      const data = await this.apiService.reverseGeocodeSerp(lat, lng);
      
      let placeName = 'Địa điểm chọn từ bản đồ';
      let placeType = 'explore';
      let snapLat = lat;
      let snapLng = lng;
      let addressText = '';

      if (data) {
        placeName = data.title || 'Địa điểm chọn từ bản đồ';
        snapLat = data.lat || lat;
        snapLng = data.lng || lng;
        placeType = data.category || 'explore';
        addressText = data.address || '';
      }

      this.selectedPlaceDetails = {
        title: placeName,
        type: placeType,
        cost: placeType === "dining" ? 80000 : (placeType === "lodging" ? 500000 : 30000),
        carbon: placeType === "dining" ? 2 : 4,
        lat: snapLat,
        lng: snapLng,
        isActivity: false,
        isCustomMapClick: true
      };
      this.mapClickPlaceName = placeName;

      // Draw a snapped red marker with pulse animation
      this.clearSearchMarkers();
      const marker = L.marker([snapLat, snapLng], {
        icon: L.divIcon({
          html: `<div class="map-leaflet-rec-pin map-leaflet-pin-red-pulse" style="background-color: #EF4444; border: 2px solid #FFFFFF; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md);"><i class="bi bi-geo-alt-fill" style="font-size: 12px;"></i></div>`,
          className: 'custom-div-icon-click-pin',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      }).addTo(this.map);

      // Bind popup
      const popupContent = `
        <div style="font-family: var(--font-main); width: 220px; font-size: 13px; line-height: 1.4;">
          <h4 style="font-weight:700; margin:0 0 6px 0; color:var(--text-primary); font-size:14px;">${placeName}</h4>
          <p style="margin:0 0 8px 0; color:#3D5A46; font-size:11px;">${addressText}</p>
          <button id="add-click-pin" style="width:100%; height:32px; background:#047857; color:white; border:none; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px;">Thêm vào lịch trình</button>
        </div>
      `;
      marker.bindPopup(popupContent).openPopup();

      marker.on('popupopen', () => {
        const btn = document.getElementById('add-click-pin');
        if (btn) {
          btn.onclick = (e) => {
            e.preventDefault();
            this.addSearpedPlaceToItinerary({
              title: placeName,
              category: placeType,
              lat: snapLat,
              lng: snapLng
            });
            marker.closePopup();
          };
        }
      });

      this.searchMarkers.push(marker);
      this.cdr.detectChanges();

    } catch (e) {
      console.warn('Reverse geocoding error:', e);
      this.selectedPlaceDetails = {
        title: "Địa điểm chọn từ bản đồ",
        type: "explore",
        cost: 0,
        carbon: 1,
        lat: lat,
        lng: lng,
        isActivity: false,
        isCustomMapClick: true
      };
      this.mapClickPlaceName = 'Địa điểm chọn từ bản đồ';
      this.cdr.detectChanges();
    }
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
      } catch (e) {}
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
      } catch (e) {}
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
      } catch (e) {}
    }
    this.positioningMarker = null;
    this.locatingActivityIdx = null;
    this.cdr.detectChanges();
  }



  private getNextSuggestedTime(): string {
    if (!this.activeItinerary) return "08:00";
    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    if (activeDay.activities.length === 0) return "08:00";

    const lastAct = activeDay.activities[activeDay.activities.length - 1];
    const timeParts = lastAct.time.split(":");
    let hour = parseInt(timeParts[0]) + 2;
    if (hour >= 22) hour = 21;
    return `${hour.toString().padStart(2, "0")}:00`;
  }

  private recalculateMetrics() {
    if (!this.activeItinerary) return;

    let totalBudget = 0;
    let carbonSum = 0;

    this.activeItinerary.days.forEach((day: any) => {
      day.activities.forEach((act: any) => {
        totalBudget += act.cost;
        carbonSum += act.carbon;
      });
    });

    this.totalCost = totalBudget;
    this.totalCarbon = carbonSum;

    this.budgetProgressPct = Math.min((totalBudget / 8000000) * 100, 100);
    this.carbonProgressPct = Math.min((carbonSum / 80) * 100, 100);
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
      } catch (e) {}
      this.map = null;
    }

    try {
      this.map = L.map('leafletMap', {
        zoomControl: false
      }).setView(center, 12);

      // Google Maps road map style
      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
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

  private plotMapMarkers(shouldFit: boolean = false) {
    if (!this.map || !this.activeItinerary) return;

    // Clear previous markers
    if (this.leafletMarkers && this.leafletMarkers.length > 0) {
      this.leafletMarkers.forEach(m => {
        try {
          this.map.removeLayer(m);
        } catch (e) {}
      });
    }
    this.leafletMarkers = [];

    if (this.polyline) {
      try {
        this.map.removeLayer(this.polyline);
      } catch (e) {}
      this.polyline = null;
    }

    const activeDay = this.activeItinerary.days[this.activeDayIdx];
    const coordinates: any[] = [];

    // 1. PLOT ACTIVE ITINERARY ACTIVITIES (Numbered pins)
    activeDay.activities.forEach((act: any, idx: number) => {
      if (typeof act.lat === "number" && typeof act.lng === "number") {
        const latlng: number[] = [act.lat, act.lng];
        coordinates.push(latlng);

        const customIcon = L.divIcon({
          html: `<div class="map-leaflet-pin" style="background-color: #184A37; border: 2.5px solid #FFFFFF; color: #FFFFFF; font-weight: 800; font-size: 11px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">${idx + 1}</div>`,
          className: 'custom-div-icon',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker(latlng, { icon: customIcon }).addTo(this.map);
        
        marker.on("click", () => {
          this.focusTimelineItem(act.title);
          this.selectedPlaceDetails = {
            title: act.title,
            type: act.type,
            cost: act.cost,
            carbon: act.carbon,
            lat: act.lat,
            lng: act.lng,
            time: act.time,
            isActivity: true,
            index: idx
          };
          this.cdr.detectChanges();
        });

        this.leafletMarkers.push(marker);
      }
    });

    // 2. PLOT LOCAL SUGGESTIONS (Eco recommendation markers with visual categories)
    const recs = this.dynamicRecs;
    
    recs.forEach((rec: any) => {
      const isAlreadyAdded = activeDay.activities.some((act: any) => act.title === rec.name);
      if (isAlreadyAdded) return;

      if (typeof rec.lat === "number" && typeof rec.lng === "number") {
        const latlng: number[] = [rec.lat, rec.lng];
        
        let iconHtml = '<i class="bi bi-geo-alt-fill"></i>';
        let bgColor = '#0E9F6E';
        if (rec.type === 'dining') {
          iconHtml = '<i class="bi bi-cup-hot-fill" style="font-size: 12px;"></i>';
          bgColor = '#F97316'; // Orange for food
        } else if (rec.type === 'lodging') {
          iconHtml = '<i class="bi bi-house-door-fill" style="font-size: 12px;"></i>';
          bgColor = '#3B82F6'; // Blue for hotel
        } else if (rec.type === 'explore' || rec.type === 'attraction') {
          iconHtml = '<i class="bi bi-tree-fill" style="font-size: 12px;"></i>';
          bgColor = '#14B8A6'; // Teal accent for attractions
        }

        const customIcon = L.divIcon({
          html: `<div class="map-leaflet-rec-pin" style="background-color: ${bgColor}; border: 2px solid #FFFFFF; color: #FFFFFF; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">${iconHtml}</div>`,
          className: 'custom-div-icon-rec',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker(latlng, { icon: customIcon }).addTo(this.map);
        
        marker.on("click", () => {
          this.selectedPlaceDetails = {
            title: rec.name,
            type: rec.type,
            cost: rec.cost,
            carbon: rec.carbon,
            lat: rec.lat,
            lng: rec.lng,
            isActivity: false
          };
          this.cdr.detectChanges();
        });

        this.leafletMarkers.push(marker);
      }
    });

    // Draw route path using OSRM
    if (coordinates.length > 1) {
      const coordsQuery = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
      fetch(`https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data && data.routes && data.routes[0]) {
            const routeGeo = data.routes[0].geometry;
            if (this.polyline) {
              try { this.map.removeLayer(this.polyline); } catch (e) {}
            }
            this.polyline = L.geoJSON(routeGeo, {
              style: {
                color: '#0E9F6E',
                weight: 4,
                opacity: 0.8
              }
            }).addTo(this.map);
          } else {
            this.drawStraightPolyline(coordinates);
          }
        })
        .catch(err => {
          console.error("OSRM Routing error, falling back to straight lines:", err);
          this.drawStraightPolyline(coordinates);
        });
    }

    if (coordinates.length > 0 && shouldFit) {
      const bounds = L.latLngBounds(coordinates);
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private drawStraightPolyline(coordinates: any[]) {
    if (this.polyline) {
      try { this.map.removeLayer(this.polyline); } catch (e) {}
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

    // Estimate travel time: average speed 30 km/h for driving, min 5 minutes
    const speedKmh = 30;
    let durationMins = Math.round((distance / speedKmh) * 60);
    if (durationMins < 5) durationMins = 5;

    return `${durationMins} phút di chuyển (khoảng ${distance.toFixed(1)} km)`;
  }

  public highlightMapPin(idx: number, highlight: boolean) {
    const marker = this.leafletMarkers[idx];
    if (!marker || typeof marker.getElement !== 'function') return;
    const el = marker.getElement();
    if (!el) return;
    const pin = el.querySelector(".map-leaflet-pin");
    if (pin) {
      if (highlight) {
        pin.style.backgroundColor = "#14B8A6";
        pin.style.transform = "scale(1.25)";
        pin.style.boxShadow = "0 4px 12px rgba(20,184,166,0.4)";
      } else {
        pin.style.backgroundColor = "#184A37";
        pin.style.transform = "none";
        pin.style.boxShadow = "var(--shadow-sm)";
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
    const query = this.customPlaceTitle.trim();
    if (!query || !this.activeItinerary) return;

    // Sync search queries
    this.mapSearchQuery = query;
    this.customSearchSuggestions = [];

    this.isAutoSaving = true;
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
      console.error('Sidebar search error:', e);
    }
  }

  public renderSearchPins(results: any[]) {
    // Clear old search markers
    this.clearSearchMarkers();

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
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2,7),
      time: time,
      name: item.title,
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
    this.searchMarkers.forEach(m => this.map.removeLayer(m));
    this.searchMarkers = [];
    this.cdr.detectChanges();
  }


  public getBucketListCount(): number {
    let total = 0;
    this.customLists.forEach(l => {
      total += l.places.length;
    });
    return total;
  }

  // HTML5 Drag and Drop Handlers
  private dragSrcIdx: number | null = null;

  public onDragStart(event: DragEvent, idx: number) {
    if (this.isItineraryLocked()) {
      event.preventDefault();
      return;
    }
    this.dragSrcIdx = idx;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', idx.toString());
    }
    const target = event.target as HTMLElement;
    target.classList.add('dragging-item');
  }

  public onDragOver(event: DragEvent, idx: number) {
    event.preventDefault();
    if (this.isItineraryLocked()) return;
    if (this.dragSrcIdx !== null && this.dragSrcIdx !== idx) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  }

  public onDrop(event: DragEvent, targetIdx: number) {
    event.preventDefault();
    if (this.isItineraryLocked()) return;
    const srcIdx = this.dragSrcIdx;
    if (srcIdx !== null && srcIdx !== targetIdx && this.activeItinerary) {
      const activeDay = this.activeItinerary.days[this.activeDayIdx];
      const movedItem = activeDay.activities[srcIdx];
      activeDay.activities.splice(srcIdx, 1);
      activeDay.activities.splice(targetIdx, 0, movedItem);

      this.reorderActivityTimes(activeDay.activities);
      this.plotMapMarkers();
      this.saveItineraryToDb();
    }
    this.dragSrcIdx = null;
  }

  public onDragEnd(event: DragEvent) {
    const target = event.target as HTMLElement;
    target.classList.remove('dragging-item');
    this.dragSrcIdx = null;
  }

  private reorderActivityTimes(activities: any[]) {
    const times = activities.map(act => act.time).sort();
    activities.forEach((act, idx) => {
      act.time = times[idx] || "08:00";
    });
  }

  // Map detail card actions
  public async addPlaceFromMap(details: any) {
    if (!this.activeItinerary) return;
    await this.addPoolItemToActiveDay(details.title, details.type, details.cost, details.carbon, details.lat, details.lng);
    this.closePlaceDetails();
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

  public async sendAiMessage() {
    const text = this.aiInputText.trim();
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
        rec: res.recommendation
      });
    } catch (e) {
      console.error('Gemini error:', e);
      this.aiMessages.push({
        text: "Xin lỗi, trợ lý AI đang bận hoặc gặp lỗi kết nối. Hãy thử lại sau nhé!",
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

  public openCheckout() {
    this.isCheckoutModalOpen = true;
    this.isItineraryPay = false;
    this.checkoutItems = [];
    this.checkoutTotal = 0;
    this.reloadWalletInfo();
  }

  public triggerCheckout() {
    if (!this.activeItinerary) return;
    this.router.navigate(['/booking'], {
      queryParams: {
        bookingType: 'itinerary',
        itineraryId: this.activeItinerary.id,
        tourId: this.activeItinerary.id,
        checkIn: this.activeItinerary.start_date || '2026-07-15',
        checkOut: this.activeItinerary.end_date || '2026-07-18',
        guestCount: this.guestCount
      }
    });
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
      });
    }
    return cost;
  }

  public get itineraryTotalCost(): number {
    return (this.itineraryPerPersonCost * this.guestCount) + this.itineraryFlatCost;
  }

  public toggleActivityShared(act: any) {
    if (this.isItineraryLocked()) return;
    const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
    act.is_shared = !isShared;
    this.saveItineraryToDb();
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
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Vui lòng đăng nhập!', 'warning');
      return;
    }
    if (!this.validateContactInfo()) return;
    const userId = user.id || user._id || '';
    const username = user.username || 'USER';

    this.qrPaymentNote = `THANH TOAN ${username}`.toUpperCase();
    this.qrCodeUrl = `https://img.vietqr.io/image/970422-0392851304-compact.jpg?amount=${this.checkoutTotal}&addInfo=${encodeURIComponent(this.qrPaymentNote)}&accountName=KIEU%20HOANG%20DUONG`;

    this.isQrVisible = true;
    this.cdr.detectChanges();

    try {
      const res = await this.apiService.payItineraryQr(userId, this.activeItinerary.id, this.checkoutTotal);
      if (res.success) {
        // Start polling status changes
        const interval = setInterval(async () => {
          const custom = await this.apiService.getItinerary(this.activeItinerary.id);
          if (custom && custom.status === 'deposited') {
            clearInterval(interval);
            this.isQrVisible = false;
            this.isCheckoutModalOpen = false;
            this.activeItinerary.status = 'deposited';
            this.activeItinerary.deposit_deadline = custom.deposit_deadline;
            this.cdr.detectChanges();
            this.showAlert('Thanh toán đặt cọc lịch trình thành công!', 'success');
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

  public closeQrModal() {
    this.isQrVisible = false;
  }

  public cancelWaitingApproval() {
    this.isWaitingApproval = false;
    this.cdr.detectChanges();
  }

  public getItineraryCoverImage(): string {
    if (!this.activeItinerary) return 'image/Viet Nam.png';
    if (this.activeItinerary.imageUrl) return this.activeItinerary.imageUrl;
    
    const dest = (this.activeItinerary.dest || '').toLowerCase();
    const destLabel = (this.activeItinerary.destLabel || this.activeItinerary.destination || '').toLowerCase();
    
    if (dest.includes('da-lat') || dest.includes('dalat') || destLabel.includes('đà lạt') || destLabel.includes('da lat')) {
      return 'image/cb4fbf769d60d911e13c255f7fb39dcc.jpg';
    }
    if (dest.includes('phu-yen') || dest.includes('phuyen') || destLabel.includes('phú yên') || destLabel.includes('phu yen')) {
      return 'image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg';
    }
    if (dest.includes('da-nang') || dest.includes('danang') || destLabel.includes('đà nẵng') || destLabel.includes('da nang') ||
        dest.includes('hoi-an') || dest.includes('hoian') || destLabel.includes('hội an') || destLabel.includes('hoi an')) {
      return 'image/da38f44902391ce9a9e4f0fd4b69fb04.jpg';
    }
    return 'image/Viet Nam.png';
  }

  public async onCoverFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file || !this.activeItinerary) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        const uploadRes = await this.apiService.uploadImageBase64(base64Data, 'post');
        if (uploadRes && uploadRes.success && uploadRes.url) {
          this.activeItinerary.imageUrl = uploadRes.url;
          await this.saveItineraryToDb();
          this.cdr.detectChanges();
        } else {
          this.showAlert('Tải ảnh bìa lên thất bại!', 'error');
        }
      } catch (err) {
        console.error('Upload cover failed:', err);
        this.showAlert('Tải ảnh bìa lên thất bại!', 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  // Collaborator Invitation actions
  public openInviteFriendModal() {
    this.isInviteFriendModalOpen = true;
    this.inviteEmails = '';
    this.isSendingInvites = false;
    this.cdr.detectChanges();
  }

  public closeInviteFriendModal() {
    this.isInviteFriendModalOpen = false;
    this.inviteEmails = '';
    this.cdr.detectChanges();
  }

  private getCollaboratorInviteLink(): string {
    if (!this.activeItinerary) return window.location.origin;
    const user = this.authService.getCurrentUser();
    const senderName = user ? (user.fullname || user.username) : 'Một người bạn';
    return `${window.location.origin}/?inviteItineraryId=${this.activeItinerary.id}&senderName=${encodeURIComponent(senderName)}`;
  }

  public async sendCollaboratorInvites() {
    if (!this.activeItinerary || !this.inviteEmails.trim()) {
      this.showAlert('Vui lòng nhập địa chỉ email hợp lệ!', 'warning');
      return;
    }

    this.isSendingInvites = true;
    this.cdr.detectChanges();

    const inviteUrl = this.getCollaboratorInviteLink();

    try {
      const res = await this.apiService.inviteCollaborator(
        this.activeItinerary.id,
        this.inviteEmails.trim(),
        inviteUrl
      );
      this.isSendingInvites = false;
      if (res && res.success) {
        this.closeInviteFriendModal();
        this.showAlert(res.message || 'Đã gửi lời mời qua email thành công!', 'success');
      } else {
        this.showAlert(res.message || 'Gửi lời mời thất bại!', 'error');
      }
    } catch (e: any) {
      this.isSendingInvites = false;
      this.showAlert(e.error?.message || 'Đã xảy ra lỗi khi gửi lời mời.', 'error');
    }
  }

  public shareInviteSocial(platform: 'facebook' | 'messenger') {
    const inviteLink = this.getCollaboratorInviteLink();
    const url = encodeURIComponent(inviteLink);
    if (platform === 'facebook' || platform === 'messenger') {
      const shareUrl = `https://www.facebook.com/dialog/send?app_id=2108319696129542&link=${url}&redirect_uri=${url}`;
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }

  public copyInviteLink() {
    const inviteLink = this.getCollaboratorInviteLink();
    navigator.clipboard.writeText(inviteLink);
    this.showAlert('Đã sao chép liên kết mời gửi qua Messenger/Zalo!', 'success');
  }

  private startBackgroundSync() {
    this.stopBackgroundSync();
    this.backgroundSyncInterval = setInterval(async () => {
      if (!this.activeItinerary || this.isAutoSaving || this.isCheckoutModalOpen) return;
      
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

          // 4. Update activities
          const freshEditor = this.convertApiToEditorItinerary(fresh);
          const localDaysStr = JSON.stringify(this.activeItinerary.days);
          const freshDaysStr = JSON.stringify(freshEditor.days);
          
          if (localDaysStr !== freshDaysStr) {
            const currentDayIdx = this.activeDayIdx;
            this.activeItinerary.days = freshEditor.days;
            this.activeDayIdx = currentDayIdx < freshEditor.days.length ? currentDayIdx : 0;
            
            this.recalculateMetrics();
            this.plotMapMarkers();
            this.cdr.detectChanges();
          }
        }
      } catch (e) {
        console.error('Background sync failed:', e);
      }
    }, 4000);
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

  public alertNotesDev() {
    this.showAlert('Tính năng Ghi chú hành trình tự do đang phát triển! Bạn có thể lưu trữ ghi chú của mình ở đây.', 'info');
  }

  public alertPlacesDev() {
    this.showAlert('Tính năng lưu trữ các địa điểm đã ghim đang được phát triển!', 'info');
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
        if (newWidth > 200 && newWidth < 450) {
          this.sidebarWidth = newWidth;
          this.cdr.detectChanges();
        }
      } else {
        const containerWidth = window.innerWidth;
        const mapWidthPx = containerWidth - moveEvent.clientX;
        const pct = (mapWidthPx / containerWidth) * 100;
        if (pct > 20 && pct < 60) {
          this.mapWidthPct = pct;
          this.cdr.detectChanges();
          if (this.map) {
            if (typeof this.map.invalidateSize === 'function') {
              this.map.invalidateSize();
            } else if (typeof google !== 'undefined') {
              google.maps.event.trigger(this.map, 'resize');
            }
          }
        }
      }
    };

    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

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

  public getPlacePlaceholderImage(name: string): string {
    if (!name) return "image/Viet Nam.png";
    if (name.includes("Hồ Xuân Hương")) return "image/1dc8619487310884c9d631d689ece1e7.jpg";
    if (name.includes("Phú Yên") || name.includes("Gành Đá Đĩa")) return "image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg";
    if (name.includes("Lẩu bò") || name.includes("Datanla")) return "image/cb4fbf769d60d911e13c255f7fb39dcc.jpg";
    return "image/Viet Nam.png";
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
    return this.activeItinerary && this.activeItinerary.status === 'deposited';
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
