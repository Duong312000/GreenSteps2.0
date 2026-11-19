import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { TrackingService } from '../../services/tracking.service';
import { Tour, Itinerary, ServiceRoom, ServiceAmenity, ServicePolicyGroup, ServiceNearbyGroup, ServiceNearbyPlace, TourPhotoCredit } from '../../models/models';
import { ServiceDetailSeoService } from '../../services/service-detail-seo.service';
import { ToastService } from '../../services/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { bookingDate } from '../../utils/booking-date';
import { flashSaleTotal } from '../../utils/flash-sale-price';

@Component({
  selector: 'app-tour-detail',
  standalone: false,
  templateUrl: './tour-detail.html',
  styleUrls: ['./tour-detail.css']
})
export class TourDetailComponent implements OnInit, OnDestroy {
  public activeTour: Tour | null = null;
  public ecoAssessment: any = null;
  public slideImages: string[] = [];
  public activeSlideIndex: number = 0;
  public isPageLoading: boolean = true;
  public loadError = false;
  public isPhotoGalleryOpen: boolean = false;

  public reviewsList: any[] = [];
  public filteredReviews: any[] = [];
  public reviewLoadError = false;
  public reviewEligibilityError = false;
  public isReviewsLoading = false;
  public isReviewEligibilityLoading = false;
  public isSubmittingReview = false;
  public activeFilter: string = 'Tất cả';
  public activeSort: string = 'Mới nhất';
  public likedReviewsSet: Set<string> = new Set();
  public currentUser: any = null;
  public replyInputs: { [commentId: string]: string } = {};
  public activeReplyTarget: { [commentId: string]: boolean } = {};
  public newReviewRating: number = 5;
  public newReviewText: string = '';
  public reviewBookings: any[] = [];
  public selectedReviewBookingId = '';

  public galleryPhotoUrl: string = '';
  public activeDayIndex: number = 0;
  public activeInfoTab: 'overview' | 'rooms' | 'included' | 'itinerary' | 'policy' | 'reviews' | 'location' = 'overview';
  public isServiceDetail: boolean = false;
  public checkOutDate = bookingDate(1);
  public selectedRoomId = '';
  public roomQuantities: Record<string, number> = {};
  public bookingError = '';
  public isCloningTrip = false;
  public roomAmenityFilter = '';
  public locationCategory = 'all';
  private detailDisposed = false;
  private detailRequestSequence = 0;
  ngOnDestroy() { this.detailDisposed = true; this.seo.clear(); }
  private mapQuery = '';
  private trustedMapUrl?: SafeResourceUrl;

  public amenityName(item: ServiceAmenity): string { return typeof item === 'string' ? item : item.name; }
  public amenityFee(item: ServiceAmenity): string { return typeof item === 'string' ? '' : item.fee || ''; }
  public amenityAvailable(item: ServiceAmenity): boolean { return typeof item === 'string' || item.available !== false; }
  public amenityNote(item: ServiceAmenity): string { return typeof item === 'string' ? '' : item.note || ''; }
  public get popularAmenities(): ServiceAmenity[] {
    return this.activeTour?.popularAmenities?.length ? this.activeTour.popularAmenities
      : (this.activeTour?.amenityGroups || []).flatMap(group => group.items).filter(item => this.amenityAvailable(item)).slice(0, 8);
  }
  public get policyGroups(): ServicePolicyGroup[] {
    if (this.activeTour?.policyGroups?.length) return this.activeTour.policyGroups;
    return (this.activeTour?.policies || []).map((line, index) => ({ title: index === 0 ? 'Thông tin chung' : `Điều khoản ${index}`, lines: [line] }));
  }
  public get nearbyGroups(): ServiceNearbyGroup[] {
    if (this.activeTour?.nearbyGroups?.length) return this.activeTour.nearbyGroups;
    return this.activeTour?.nearby?.length ? [{ name: 'Điểm nổi bật', items: this.activeTour.nearby.map(name => ({ name })) }] : [];
  }
  public get nearbyPreview() { return this.nearbyGroups.flatMap(group => group.items.map(item => ({ ...item, category: group.name }))).slice(0, 6); }
  public get nearbyPlaceCount(): number { return this.nearbyGroups.reduce((count, group) => count + group.items.length, 0); }
  public distanceLabel(place: ServiceNearbyPlace): string {
    return typeof place.distanceKm === 'number' && Number.isFinite(place.distanceKm) && place.distanceKm > 0
      ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(place.distanceKm) + ' km' : place.distance || 'Chưa có số liệu';
  }
  public directionsTo(place: ServiceNearbyPlace): string {
    return 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api: '1',
      origin: this.activeTour?.nearbyOrigin || this.locationQuery,
      destination: place.mapQuery || `${place.name}, ${this.activeTour?.destination || ''}`,
      travelmode: place.travelMode || 'driving' }).toString();
  }
  public travelModeLabel(mode?: string): string { return mode === 'walking' ? 'đi bộ' : mode === 'bicycling' ? 'đạp xe' : 'đi xe'; }
  public get greenFeatures() {
    if (this.activeTour?.greenFeatures?.length) return this.activeTour.greenFeatures;
    if (this.ecoAssessment?.highlights?.length) {
      return this.ecoAssessment.highlights.map((h: string) => ({ title: h, description: '' }));
    }
    return [];
  }
  public get policyTimes(): { checkIn?: string; checkOut?: string } {
    const text = this.policyGroups.flatMap(group => group.lines).join(' ');
    return { checkIn: text.match(/nhận phòng\s*(?:từ|sau|lúc)?\s*(\d{1,2}[:h]\d{2})/i)?.[1]?.replace('h', ':'),
      checkOut: text.match(/trả phòng\s*(?:trước|đến|lúc)?\s*(\d{1,2}[:h]\d{2})/i)?.[1]?.replace('h', ':') };
  }
  public get hasCancellationPolicy(): boolean {
    return this.policyGroups.some(group => /hủy|hoàn tiền|hoàn cọc/i.test([group.title, ...group.lines].join(' ')));
  }
  public infoIcon(label: string): string {
    const value = label.toLocaleLowerCase('vi');
    const groups: [RegExp, string][] = [
      [/internet|wi-?fi|kết nối/, 'bi-wifi'], [/ngôn ngữ/, 'bi-globe2'],
      [/an toàn|an ninh/, 'bi-shield-check'], [/đỗ xe|giao thông|di chuyển/, 'bi-car-front'],
      [/lễ tân|hành lý|hỗ trợ/, 'bi-person-workspace'], [/dọn|vệ sinh|giặt/, 'bi-basket'],
      [/nhà hàng|ăn|bữa sáng|thực phẩm/, 'bi-cup-hot'], [/nhận.*trả|giờ|thời gian/, 'bi-clock'],
      [/trẻ em|gia đình/, 'bi-people'], [/giường|cũi|phòng nghỉ/, 'bi-house-door'],
      [/cọc|thanh toán|hoàn|hủy/, 'bi-credit-card'], [/thú cưng|động vật/, 'bi-heart'],
      [/tuổi|giấy tờ/, 'bi-person-vcard'], [/mua sắm/, 'bi-bag'],
      [/điểm|tham quan|xung quanh/, 'bi-geo-alt'], [/năng lượng|điện/, 'bi-lightning-charge'],
      [/nước/, 'bi-droplet'], [/rác|tái|nhựa/, 'bi-recycle'], [/địa phương|cộng đồng/, 'bi-people'],
      [/xanh|môi trường|thiên nhiên|sinh thái/, 'bi-leaf']
    ];
    return groups.find(([pattern]) => pattern.test(value))?.[1] || 'bi-grid';
  }

  public get isLodging(): boolean {
    return !!this.activeTour?.isService && ['lưu trú', 'stay', 'lodging'].includes((this.activeTour.type || '').toLowerCase());
  }

  public get rooms(): ServiceRoom[] { return this.activeTour?.rooms || []; }
  public get activePhotoCredit() {
    const image = this.slideImages[this.activeSlideIndex] || '';
    return this.activeTour?.photoMetadata?.find(photo => photo.path.replace(/^\//, '') === image.replace(/^\//, '')) || null;
  }
  public photoSrcSet(photo?: TourPhotoCredit | null): string | null {
    const variants = photo?.responsiveVariants || [];
    return variants.length ? variants.map(variant => `${variant.path} ${variant.width}w`).join(', ') : null;
  }
  public get bookingAvailable(): boolean { return this.activeTour?.bookingEnabled !== false; }
  public imageFallback(event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('/image/service-photo-pending.svg')) img.src = 'image/service-photo-pending.svg';
  }
  public get filteredRooms(): ServiceRoom[] {
    return this.rooms.filter(room => !this.roomAmenityFilter || room.amenities?.includes(this.roomAmenityFilter));
  }
  public get roomAmenities(): string[] {
    return [...new Set(this.rooms.flatMap(room => room.amenities || []))];
  }
  public get selectedRoom(): ServiceRoom | undefined { return this.rooms.find(room => room.id === this.selectedRoomId); }
  public get stayNights(): number {
    return Math.max(1, Math.round((Date.parse(this.checkOutDate) - Date.parse(this.bookingDate)) / 86400000) || 1);
  }
  public get minCheckOutDate(): string { return bookingDate(1, new Date(`${this.bookingDate}T12:00:00`)); }
  public validateStayDates() {
    this.validateBookingDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.checkOutDate) || this.checkOutDate < this.minCheckOutDate) this.checkOutDate = this.minCheckOutDate;
    this.bookingError = '';
  }
  public roomOptions(room: ServiceRoom): number[] {
    return Number.isSafeInteger(room.available_rooms) && Number(room.available_rooms) > 0
      ? Array.from({ length: Number(room.available_rooms) }, (_, i) => i + 1) : [];
  }
  public canBookRoom(room: ServiceRoom): boolean {
    return !!room.id && Number.isSafeInteger(room.price_per_night) && Number(room.price_per_night) >= 0
      && this.roomOptions(room).length > 0 && Number(room.capacity) > 0;
  }
  public selectRoom(room: ServiceRoom) {
    this.selectedRoomId = room.id;
    this.roomQuantities[room.id] ||= 1;
    this.bookingError = '';
    void this.refreshBookingQuote();
  }
  public async bookRoom(room: ServiceRoom, event: Event) {
    this.selectRoom(room);
    await this.submitBooking(event);
  }
  public get locationQuery(): string {
    const tour = this.activeTour;
    if (tour?.latitude != null && tour.longitude != null) return `${tour.latitude},${tour.longitude}`;
    if (!tour?.isService) {
      const activity = tour?.data?.flat().find(item => item.lat != null && item.lng != null);
      if (activity) return `${activity.lat},${activity.lng}`;
    }
    return tour?.nearbyOrigin || (tour?.address ? [tour.title, tour.address].join(', ') : '');
  }
  public get mapLink(): string { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.locationQuery)}`; }
  public get mapEmbedUrl() {
    if (this.mapQuery !== this.locationQuery || !this.trustedMapUrl) {
      this.mapQuery = this.locationQuery;
      this.trustedMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://maps.google.com/maps?q=${encodeURIComponent(this.locationQuery)}&output=embed`);
    }
    return this.trustedMapUrl;
  }

  // Booking details
  public bookingDate: string = bookingDate();
  public bookingPricingSnapshot: any = null;
  public bookingPriceLoading = false;
  public bookingPriceError = false;
  private bookingPriceRequest = 0;
  public get minBookingDate(): string { return bookingDate(); }
  public validateBookingDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.bookingDate) || this.bookingDate < this.minBookingDate) this.bookingDate = this.minBookingDate;
  }
  public bookingGuests: number = 2;
  public bookingAdults: number = 2;
  public bookingChildren: number = 0;
  public copiedVoucher: string | null = null;
  public copyVoucher(code: string, event: Event) {
    event.stopPropagation();
    navigator.clipboard?.writeText(code);
    this.copiedVoucher = code;
    setTimeout(() => {
      if (this.copiedVoucher === code) this.copiedVoucher = null;
    }, 2500);
  }

  // Dynamic reviews rating statistics
  public getRatingCount(stars: number): number {
    if (!this.reviewsList || this.reviewsList.length === 0) {
      return 0;
    }
    return this.reviewsList.filter(r => Math.round(r.rating) === stars).length;
  }

  public getRatingPercentage(stars: number): number {
    if (!this.reviewsList || this.reviewsList.length === 0) {
      return 0;
    }
    return Math.round((this.getRatingCount(stars) / this.reviewsList.length) * 100);
  }

  /** Root reviews that carry a star rating */
  public get ratedReviews(): any[] {
    return (this.reviewsList || []).filter(r => !r.parentCommentId && r.rating !== null && r.rating !== undefined && Number(r.rating) > 0);
  }

  public get totalReviewsCount(): number {
    return this.ratedReviews.length;
  }

  public get totalCommentsCount(): number {
    return (this.reviewsList || []).length;
  }

  public get averageScore(): number {
    const rated = this.ratedReviews;
    if (!rated.length) return 0;
    const sum = rated.reduce((acc, r) => acc + Number(r.rating), 0);
    return Number((sum / rated.length).toFixed(1));
  }

  public get currentUserId(): string {
    return this.currentUser?.id || this.currentUser?._id || '';
  }

  /** A user may rate a tour/service only once; further posts are plain comments */
  public get hasUserRated(): boolean {
    const uid = this.currentUserId;
    return !!uid && this.ratedReviews.some(r => (r.user?.id || r.userId) === uid);
  }

  public setNewReviewRating(star: number) {
    if (this.hasUserRated) return;
    this.newReviewRating = this.newReviewRating === star ? 0 : star;
  }

  public getStarClass(index: number, score: number): string {
    if (score >= index) return 'bi-star-fill';
    if (score >= index - 0.5) return 'bi-star-half';
    return 'bi-star';
  }

  public get ratingText(): string {
    const score = this.averageScore;
    if (!this.totalReviewsCount) return 'Chưa có đánh giá';
    if (score >= 4.7) return 'Tuyệt vời';
    if (score >= 4.3) return 'Rất tốt';
    if (score >= 3.8) return 'Tốt';
    return 'Trung bình';
  }

  public get formattedCarbon(): string {
    if (!this.activeTour || this.activeTour.carbon === undefined || this.activeTour.carbon === null) return '';
    const num = Number(this.activeTour.carbon);
    if (isNaN(num) || num === 0) return '0kg CO₂';
    const absVal = Math.abs(num);
    return `-${absVal}kg CO₂`;
  }

  public get tourHighlights(): string[] {
    if (!Array.isArray(this.activeTour?.highlights) || this.activeTour.highlights.length === 0) return [];
    if (this.activeTour?.highlights && Array.isArray(this.activeTour.highlights) && this.activeTour.highlights.length > 0) {
      return this.activeTour.highlights;
    }
    if (this.activeTour?.is_demo) return [];
    return [
      'Lịch trình thong thả, có nhiều thời gian nghỉ ngơi thoải mái',
      'Ưu tiên trải nghiệm văn hóa và ẩm thực bản địa sạch',
      'Hướng dẫn viên thân thiện, chu đáo và am hiểu sinh thái',
      'Có thể cá nhân hóa lại các hoạt động theo mong muốn của bạn'
    ];
  }

  public get tourIncluded(): string[] {
    if (!Array.isArray(this.activeTour?.included) || this.activeTour.included.length === 0) return [];
    if (this.activeTour?.included && Array.isArray(this.activeTour.included) && this.activeTour.included.length > 0) {
      return this.activeTour.included;
    }
    if (this.activeTour?.is_demo) return [];
    return [
      'Phương tiện di chuyển xanh theo lịch trình đã xác nhận',
      'Vé vào cổng các điểm tham quan chính trong tour',
      'Hướng dẫn viên đồng hành chuyên nghiệp, thân thiện',
      'Bảo hiểm du lịch theo quy định'
    ];
  }

  public get tourExcluded(): string[] {
    if (!Array.isArray(this.activeTour?.excluded) || this.activeTour.excluded.length === 0) return [];
    if (this.activeTour?.excluded && Array.isArray(this.activeTour.excluded) && this.activeTour.excluded.length > 0) {
      return this.activeTour.excluded;
    }
    if (this.activeTour?.is_demo) return [];
    return [
      'Chi tiêu cá nhân ngoài chương trình (mua sắm quà lưu niệm...)',
      'Các bữa ăn uống tự do ngoài các bữa chính trong hành trình',
      'Phụ phí phòng đơn nếu có nhu cầu ở riêng'
    ];
  }

  public get tourGuarantees(): any[] {
    if (!Array.isArray(this.activeTour?.guarantees) || this.activeTour.guarantees.length === 0) return [];
    const raw = (this.activeTour?.guarantees && Array.isArray(this.activeTour.guarantees) && this.activeTour.guarantees.length > 0)
      ? this.activeTour.guarantees
      : ['Giữ chỗ 7 ngày', 'Đổi ngày miễn phí', 'Hoàn tiền 100% nếu hủy trước 48h', 'Cam kết giảm phát thải'];
    return raw.map((g: any) => {
      if (typeof g === 'string') {
        return { title: g, desc: 'Chính sách bảo vệ quyền lợi du khách của GreenSteps', icon: 'bi-shield-check' };
      }
      return g;
    });
  }

  public get tourVouchers(): any[] {
    if (!Array.isArray(this.activeTour?.vouchers) || this.activeTour.vouchers.length === 0) return [];
    const raw = (this.activeTour?.vouchers && Array.isArray(this.activeTour.vouchers) && this.activeTour.vouchers.length > 0)
      ? this.activeTour.vouchers
      : [
          { code: 'NETZERO50', discount: 50000, title: 'Giảm 50k', description: 'Giảm 50k cho tour sinh thái' },
          { code: 'GREEN100', discount: 100000, title: 'Giảm 100k', description: 'Giảm 100k cho đơn từ 2 triệu' },
          { code: 'ECOSUMMER', discount: 150000, title: 'Giảm 150k', description: 'Ưu đãi hè xanh giảm 150.000đ' }
        ];
    return raw.map((v: any) => ({
      ...v,
      title: v.title || (v.discount ? `Giảm ${Math.round(v.discount / 1000)}k` : 'Ưu đãi xanh'),
      description: v.description || v.title || 'Mã giảm giá trực tiếp'
    }));
  }

  public activeAssuranceOpen: boolean = false;
  public toggleAssurance() {
    this.activeAssuranceOpen = !this.activeAssuranceOpen;
  }

  public get tourPolicies(): Array<{ step?: string; title: string; desc: string }> {
    if (!Array.isArray(this.activeTour?.policy) || this.activeTour.policy.length === 0) return [];
    if (this.activeTour?.policy && Array.isArray(this.activeTour.policy) && this.activeTour.policy.length > 0) {
      return this.activeTour.policy.map((p: any, idx: number) => {
        if (typeof p === 'string') {
          return { step: '0' + (idx + 1), title: `Chính sách ${idx + 1}`, desc: p };
        }
        return p;
      });
    }
    return [
      {
        step: '01',
        title: 'Giữ chỗ miễn phí 7 ngày',
        desc: 'Bạn có thể đặt trước để giữ chỗ mà không mất phí trong 7 ngày đầu, dễ dàng lên kế hoạch cùng gia đình.'
      },
      {
        step: '02',
        title: 'Đổi ngày linh hoạt',
        desc: 'Hỗ trợ đổi ngày khởi hành không giới hạn số lần trước 48 giờ so với lịch trình dự kiến.'
      },
      {
        step: '03',
        title: 'Hoàn hủy minh bạch',
        desc: 'Hoàn 100% tiền đặt cọc nếu hủy trước 48 giờ. Đội ngũ GreenSteps đồng hành hỗ trợ 24/7.'
      }
    ];
  }

  public get tourStyle(): string {
    return this.activeTour?.style || 'Chưa phân loại';
  }

  public get tourGroupSize(): string {
    return this.activeTour?.group_size || 'Chưa xác nhận';
  }

  public get tourFitnessLevel(): string {
    return this.activeTour?.fitness_level || 'Chưa xác nhận';
  }

  public itineraryPhotoFor(activity: { name?: string } | undefined): TourPhotoCredit | undefined {
    const activityName = this.normalizeLandmark(activity?.name || '');
    if (!activityName || !this.activeTour?.is_demo) return undefined;
    const genericWords = new Set(['bai', 'ban', 'bo', 'canh', 'co', 'danh', 'dao', 'ho', 'khu', 'pho', 'quan', 'the', 'thang', 'tuyen', 'vuc']);
    return (this.activeTour.photoMetadata || []).find(photo => {
      if (photo.relevance?.type !== 'exact_landmark') return false;
      const landmark = this.normalizeLandmark((photo.subjectLocation || '').split(',')[0]);
      const terms = landmark.split(/\s+/).filter(term => term.length > 1 && !genericWords.has(term));
      return terms.length > 0 && terms.every(term => activityName.includes(term));
    });
  }

  private normalizeLandmark(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Fallback slider images by destination
  private destinationImages: { [key: string]: string[] } = {
    "Đà Lạt": [
      "image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg",
      "image/greensteps/da-lat/da-lat-rung-thong-01.jpg",
      "image/greensteps/da-lat/da-lat-rung-thong-san-may-01.jpg",
      "image/greensteps/da-lat/da-lat-ho-tuyen-lam-01.jpg",
      "image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg",
      "image/greensteps/da-lat/da-lat-vuon-hoa-01.jpg",
      "image/greensteps/da-lat/da-lat-thac-nuoc-01.jpg"
    ],
    "Phú Yên": [
      "image/greensteps/phu-yen/phu-yen-bai-bien-dua-01.jpg",
      "image/greensteps/phu-yen/phu-yen-bai-da-ven-bien-01.jpg",
      "image/greensteps/phu-yen/phu-yen-bai-xep-checkin-01.jpg",
      "image/greensteps/phu-yen/phu-yen-bien-trong-01.jpg",
      "image/greensteps/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg",
      "image/greensteps/phu-yen/phu-yen-thap-nghinh-phong-01.jpg",
      "image/greensteps/phu-yen/phu-yen-canh-quan-xanh-01.jpg"
    ],
    "Đà Nẵng": [
      "image/greensteps/da-nang-hoi-an/da-nang-bien-my-khe-toan-canh-01.jpg",
      "image/greensteps/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg",
      "image/greensteps/da-nang-hoi-an/da-nang-cau-rong-phun-lua-01.jpg",
      "image/greensteps/da-nang-hoi-an/da-nang-bien-my-khe-01.jpg",
      "image/greensteps/da-nang-hoi-an/da-nang-ba-na-hills-lang-phap-01.jpg"
    ],
    "Đà Nẵng - Hội An": [
      "image/greensteps/da-nang-hoi-an/da-nang-bien-my-khe-toan-canh-01.jpg",
      "image/greensteps/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg",
      "image/greensteps/da-nang-hoi-an/da-nang-cau-rong-phun-lua-01.jpg",
      "image/greensteps/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg",
      "image/greensteps/da-nang-hoi-an/hoi-an-chua-cau-01.jpg",
      "image/greensteps/da-nang-hoi-an/hoi-an-pho-co-den-long-01.jpg",
      "image/greensteps/da-nang-hoi-an/hoi-an-song-hoai-ban-dem-01.jpg"
    ]
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private seo: ServiceDetailSeoService,
    private trackingService: TrackingService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      const previousUserId = this.currentUserId;
      this.currentUser = user;
      if (previousUserId !== this.currentUserId) {
        this.reviewBookings = [];
        this.selectedReviewBookingId = '';
      }
      if (this.activeTour) void this.loadReviewEligibility();
    });

    const liked = JSON.parse(localStorage.getItem('greensteps_liked_reviews') || '[]');
    this.likedReviewsSet = new Set<string>(liked);

    this.route.queryParamMap.subscribe(params => {
      const reviewId = params.get('review') || params.get('comment');
      if (reviewId) {
        this.activeInfoTab = 'reviews';
        this.scrollToTargetReview(reviewId);
      }
    });

    this.route.fragment.subscribe(fragment => {
      if (fragment === 'reviews-section' || fragment === 'reviews') {
        this.activeInfoTab = 'reviews';
        this.scrollToReviews();
      } else if (fragment?.startsWith('comment-') || fragment?.startsWith('review-')) {
        const id = fragment.replace(/^(comment-|review-)/, '');
        this.activeInfoTab = 'reviews';
        this.scrollToTargetReview(id);
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      const requestSequence = ++this.detailRequestSequence;
      if (id) {
        void this.loadDetail(id, requestSequence);
      } else {
        this.activeTour = null;
        this.loadError = false;
        this.isPageLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private async loadDetail(id: string, requestSequence: number): Promise<void> {
    this.isPageLoading = true;
    this.loadError = false;
    this.reviewsList = [];
    this.filteredReviews = [];
    this.reviewBookings = [];
    this.selectedReviewBookingId = '';
    this.reviewLoadError = false;
    this.reviewEligibilityError = false;
    this.isReviewsLoading = true;
    this.isReviewEligibilityLoading = true;
    this.activeInfoTab = 'overview';
    this.selectedRoomId = '';
    this.roomQuantities = {};
    this.locationCategory = 'all';
    this.bookingError = '';
    const isService = this.route.snapshot.routeConfig?.path?.startsWith('services') ||
      this.route.snapshot.routeConfig?.path?.startsWith('service-detail') ||
      id.toLowerCase().startsWith('srv_') || id.toLowerCase().startsWith('srv-');

    try {
      let nextTour: Tour | null;
      if (isService) {
        nextTour = await this.apiService.getServiceAsTour(id, this.route.snapshot.queryParamMap?.get('flashSale') || undefined);
        if (!nextTour) nextTour = await this.apiService.getPresetTour(id);
      } else {
        nextTour = await this.apiService.getPresetTour(id);
        if (!nextTour) nextTour = await this.apiService.getServiceAsTour(id);
      }
      if (this.detailDisposed || requestSequence !== this.detailRequestSequence) return;

      this.activeTour = nextTour;
      this.bookingPricingSnapshot = null;
      this.ecoAssessment = null;
      this.isServiceDetail = !!nextTour?.isService || isService;
      if (nextTour?.isService) this.seo.update(nextTour);
      else this.seo.clear();
      if (nextTour) {
        await this.refreshBookingQuote();
        const targetKind: 'tour' | 'service' = this.isServiceDetail ? 'service' : 'tour';
        this.trackingService.trackTargetView(targetKind, nextTour.id);
        void this.apiService.getEcoAssessment(targetKind, nextTour.id).then(assessment => {
          if (!this.detailDisposed && requestSequence === this.detailRequestSequence && assessment) {
            this.ecoAssessment = assessment;
            this.cdr.detectChanges();
          }
        });
        this.setupSlides();
        void this.loadReviews(id, requestSequence).then(() => {
          if (!this.detailDisposed && requestSequence === this.detailRequestSequence) {
            void this.loadReviewEligibility(requestSequence, id);
          }
        });
      } else {
        this.seo.clear();
        this.loadError = true;
        this.isReviewsLoading = false;
        this.isReviewEligibilityLoading = false;
      }
    } catch {
      if (this.detailDisposed || requestSequence !== this.detailRequestSequence) return;
      this.activeTour = null;
      this.loadError = true;
      this.seo.clear();
    } finally {
      if (!this.detailDisposed && requestSequence === this.detailRequestSequence) {
        this.isPageLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  public retryDetail(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.loadDetail(id, ++this.detailRequestSequence);
  }


  public onThumbError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target && !target.src.includes('travel-placeholder.svg')) target.src = 'image/greensteps/travel-placeholder.svg';
  }

  public onHeroError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target && !target.src.includes('travel-placeholder.svg')) target.src = 'image/greensteps/travel-placeholder.svg';
  }

  private setupSlides() {
    if (!this.activeTour) return;
    const demoPlaceholder = 'image/greensteps/travel-placeholder.svg';
    const verifiedDemoCover = this.activeTour.photoMetadata?.find(photo =>
      photo.path === (this.activeTour?.image || this.activeTour?.image_url)
      && photo.verificationStatus === 'verified'
      && photo.path.startsWith('image/greensteps/tours/')
    )?.path;
    const coverImage = (this.activeTour.is_demo
      ? (verifiedDemoCover || demoPlaceholder)
      : (this.activeTour.image || this.activeTour.image_url || 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg')).replace(/^\//, '');
    const galleryImages = (this.activeTour.is_demo
      ? (this.activeTour.photoMetadata || []).filter(photo => photo.verificationStatus === 'verified' && photo.path.startsWith('image/greensteps/tours/')).map(photo => photo.path)
      : (this.activeTour.gallery || []))
      .map((image: string) => (image || '').replace(/^\//, '')).filter(Boolean);
    let rawImages = Array.from(new Set([coverImage, ...galleryImages]));

    if (this.activeTour.isService) {
      if (!galleryImages.length && !this.activeTour.sourceUrls?.length) {
        const destination = this.activeTour.destination || 'Đà Lạt';
        const images = this.destinationImages[destination] || this.destinationImages['Đà Lạt'] || [];
        rawImages = Array.from(new Set([coverImage, ...images.slice(0, 4)]));
      }
      this.slideImages = rawImages.filter(image => !this.isLowQualityGalleryImage(image));
      if (!this.slideImages.length) this.slideImages = [coverImage];
      this.activeSlideIndex = 0;
      return;
    }

    if (!galleryImages.length && !this.activeTour.is_demo) {
      const destination = this.activeTour.destination || 'Đà Lạt';
      const images = this.destinationImages[destination] || this.destinationImages['Đà Lạt'] || [];
      rawImages = Array.from(new Set([coverImage, ...images]));
    }
    this.slideImages = rawImages.filter(image => !this.isLowQualityGalleryImage(image)).slice(0, 5);
    if (!this.slideImages.length) this.slideImages = [coverImage];
    this.activeSlideIndex = 0;
  }

  private localTourImage(fileName: string): string {
    const tourId = (this.activeTour?.id || '').toLowerCase();
    return tourId ? `image/tours/${tourId}/${fileName}` : `image/Viet Nam.png`;
  }

  public setSlide(index: number) {
    this.activeSlideIndex = index;
  }

  private isLowQualityGalleryImage(img: string): boolean {
    return img.includes('e8b896896439701c1ff79d65290703b0') ||
      img.includes('68e15971da05ec82c116fe191abb8c7f') ||
      img.includes('7c9e14a82698a594dd914369bfb8eaa5') ||
      img.includes('4302842f8d693c25238f2141964a64b2');
  }

  public selectGalleryPhoto(index: number, event?: Event) {
    event?.stopPropagation();
    this.activeSlideIndex = index;
    this.galleryPhotoUrl = this.slideImages[index] || this.slideImages[0] || '';
    this.cdr.detectChanges();
  }

  public openPhotoGallery(index: number = this.activeSlideIndex) {
    this.activeSlideIndex = index;
    this.galleryPhotoUrl = this.slideImages[index] || this.slideImages[0] || '';
    this.isPhotoGalleryOpen = true;
    this.cdr.detectChanges();
  }

  public closePhotoGallery() {
    this.isPhotoGalleryOpen = false;
    this.galleryPhotoUrl = '';
  }

  public setDay(index: number) {
    this.activeDayIndex = index;
  }

  public scrollToTab(tab: 'overview' | 'rooms' | 'included' | 'itinerary' | 'policy' | 'reviews' | 'location') {
    this.activeInfoTab = tab;
    setTimeout(() => {
      const el = document.querySelector('.gs-tabs-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  public setInfoTab(tab: 'overview' | 'rooms' | 'included' | 'itinerary' | 'policy' | 'reviews' | 'location') {
    this.activeInfoTab = tab;
  }

  public scrollToReviews() {
    this.activeInfoTab = 'reviews';
    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.getElementById('reviews-section') ||
                 document.getElementById('detail-reviews') ||
                 document.getElementById('reviews') ||
                 document.getElementById('tab-reviews');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }

  public scrollToTargetReview(reviewId: string) {
    this.activeInfoTab = 'reviews';
    this.cdr.detectChanges();
    const tryScroll = (attemptsLeft: number) => {
      const el = document.getElementById('comment-' + reviewId) ||
                 document.getElementById('review-' + reviewId) ||
                 document.getElementById(reviewId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('comment-highlight-pulse');
        setTimeout(() => el.classList.remove('comment-highlight-pulse'), 3000);
      } else if (attemptsLeft > 0) {
        setTimeout(() => tryScroll(attemptsLeft - 1), 250);
      } else {
        this.scrollToReviews();
      }
    };
    setTimeout(() => tryScroll(6), 200);
  }


  public isCommercialCategory(item: any = this.activeTour): boolean {
    const text = `${item?.name || item?.title || ''} ${item?.category || ''} ${item?.type || ''}`.toLowerCase();
    return text.includes('hotel') || text.includes('khách sạn') || text.includes('homestay') ||
           text.includes('resort') || text.includes('villa') || text.includes('nhà nghỉ') ||
           text.includes('quán ăn') || text.includes('nhà hàng') || text.includes('cafe') ||
           text.includes('cà phê') || text.includes('quán nhậu') || text.includes('ẩm thực') ||
           text.includes('nước') || text.includes('công viên nước') || text.includes('khu du lịch') ||
           text.includes('vui chơi') || text.includes('vé');
  }

  public get priceDisplayLabel(): string {
    if (!this.activeTour) return 'Chưa có thông tin về giá';
    if (this.activeTour.cost !== undefined && this.activeTour.cost !== null && Number(this.activeTour.cost) > 0) {
      return new Intl.NumberFormat('vi-VN').format(Number(this.activeTour.cost)) + 'đ';
    }
    if (this.activeTour.cost === 0 || !this.isCommercialCategory(this.activeTour)) {
      return '0đ (Miễn phí)';
    }
    return 'Chưa có thông tin về giá';
  }

  public get totalPrice(): number {
    if (!this.activeTour) return 0;
    if (this.bookingPricingSnapshot && (!this.isLodging || this.selectedRoom)) return Number(this.bookingPricingSnapshot.total || 0);
    if (this.isLodging) return this.selectedRoom
      ? this.roomSalePrice(this.selectedRoom) * (this.roomQuantities[this.selectedRoom.id] || 1) * this.stayNights : 0;
    return flashSaleTotal(this.activeTour.cost, this.totalGuests, this.activeTour.flashSale);
  }
  public roomSalePrice(room: ServiceRoom): number {
    const quantity = this.roomQuantities[room.id] || 1;
    const units = quantity * this.stayNights;
    return flashSaleTotal(Number(room.price_per_night || 0), units, this.activeTour?.flashSale, quantity) / units;
  }
  public get originalBookingTotal(): number {
    return this.isLodging && this.selectedRoom
      ? Number(this.selectedRoom.price_per_night || 0) * (this.roomQuantities[this.selectedRoom.id] || 1) * this.stayNights
      : (this.activeTour?.cost || 0) * this.totalGuests;
  }
  public get previewRoomPrice(): number {
    const prices = this.rooms.filter(room => this.canBookRoom(room)).map(room => Number(room.price_per_night));
    return prices.length ? Math.min(...prices) : Number(this.activeTour?.cost || 0);
  }
  public get displayedPrice(): number {
    return this.isLodging && !this.selectedRoom
      ? flashSaleTotal(this.previewRoomPrice, 1, this.activeTour?.flashSale, 1) : this.totalPrice;
  }
  public get displayedOriginalPrice(): number {
    return this.isLodging && !this.selectedRoom ? this.previewRoomPrice : this.originalBookingTotal;
  }
  public get hasDisplayedSale(): boolean {
    return !!this.activeTour?.flashSale && this.displayedPrice < this.displayedOriginalPrice;
  }

  public get totalGuests(): number {
    return Number(this.bookingAdults) + Number(this.bookingChildren);
  }

  public async refreshBookingQuote(): Promise<void> {
    const tour = this.activeTour;
    if (!tour?.id) return;
    const requestId = ++this.bookingPriceRequest;
    this.bookingPriceLoading = true;
    this.bookingPriceError = false;
    try {
      const isService = Boolean(tour.isService);
      const type = isService ? 'service' : tour.id.startsWith('iti_') ? 'itinerary' : 'tour';
      const quote = await this.apiService.getBookingQuote({
        type,
        targetId: tour.id,
        guests: this.totalGuests,
        addonIds: [],
        paymentMethod: 'sepay',
        roomId: this.isLodging ? this.selectedRoomId : undefined,
        roomCount: this.isLodging ? (this.roomQuantities[this.selectedRoomId] || 1) : undefined,
        bookingDate: this.bookingDate,
        checkOutDate: this.isLodging ? this.checkOutDate : undefined,
        flashSaleId: tour.flashSale?.id
      });
      if (requestId === this.bookingPriceRequest && quote?.success && quote.pricing) {
        this.bookingPricingSnapshot = quote.pricing;
        if (Number.isSafeInteger(Number(quote.pricing.unitTourPrice)) && Number(quote.pricing.unitTourPrice) >= 0) {
          tour.cost = Number(quote.pricing.unitTourPrice);
        }
      }
    } catch {
      if (requestId === this.bookingPriceRequest) {
        this.bookingPricingSnapshot = null;
        this.bookingPriceError = true;
      }
    } finally {
      if (requestId === this.bookingPriceRequest) {
        this.bookingPriceLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  public get adultOptions(): number[] {
    const limit = this.activeTour?.maxCapacity || 10;
    return Array.from({ length: limit }, (_, i) => i + 1);
  }

  public get childrenOptions(): number[] {
    const limit = this.activeTour?.maxCapacity || 10;
    return Array.from({ length: limit }, (_, i) => i);
  }

  public get displayOldCost(): number {
    if (!this.activeTour) return 0;
    if (this.activeTour.flashSale) return this.activeTour.cost;
    return Number(this.activeTour.oldCost || this.activeTour.old_cost || 0);
  }

  public get displayNights(): number {
    if (this.activeTour?.isService) return 0;
    return Math.max((this.activeTour?.days || 1) - 1, 1);
  }

  public get detailKindLabel(): string {
    if (!this.activeTour?.isService) return 'Tour GreenSteps';
    return this.activeTour.type || 'Dịch vụ GreenSteps';
  }

  public get detailEntityLabel(): string {
    return this.activeTour?.isService ? 'dịch vụ' : 'tour';
  }

  public get detailBookingLabel(): string {
    if (!this.bookingAvailable) return 'Liên hệ cơ sở';
    if (this.isLodging) return this.selectedRoom ? 'Đặt phòng' : 'Chọn phòng';
    return this.activeTour?.isService ? 'Đặt Dịch Vụ Ngay' : 'Đặt Cọc Tour Ngay';
  }

  public get detailBookingLabelLower(): string {
    if (!this.bookingAvailable) return 'liên hệ cơ sở';
    return this.activeTour?.isService ? 'đặt dịch vụ ngay' : 'đặt cọc tour ngay';
  }

  public get detailConsultTitle(): string {
    return this.activeTour?.isService
      ? 'Bạn cần tư vấn thêm trước khi đặt dịch vụ?'
      : 'Bạn cần tư vấn thêm trước khi đặt tour?';
  }

  public get detailConsultCopy(): string {
    return this.activeTour?.isService
      ? 'GreenSteps sẽ làm rõ lịch phục vụ, điều kiện đặt chỗ, hoàn hủy và các lưu ý để bạn chọn dịch vụ phù hợp.'
      : 'GreenSteps sẽ làm rõ điều kiện đổi ngày, hoàn hủy và thanh toán để bạn đặt tour tự tin hơn.';
  }

  public get detailBackQueryType(): string {
    const type = (this.activeTour?.type || '').toLowerCase();
    if (type.includes('luu') || type.includes('lưu') || type.includes('tru') || type.includes('trú')) return 'stay';
    if (type.includes('phuong') || type.includes('phương') || type.includes('tien') || type.includes('tiện')) return 'transport';
    if (type.includes('an') || type.includes('ăn') || type.includes('uong') || type.includes('uống')) return 'food';
    return 'attraction';
  }

  public async cloneAndEditTrip() {
    if (!this.activeTour || this.isCloningTrip) return;
    this.isCloningTrip = true;

    try {
      const user = this.authService.getCurrentUser();
      const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';

      const safeData = Array.isArray(this.activeTour.data) && this.activeTour.data.length > 0
        ? JSON.parse(JSON.stringify(this.activeTour.data))
        : [[]];

      const newItiId = "iti_" + Date.now();
      const title = (this.activeTour.title || "Lịch trình tùy chỉnh") + " (Tùy chỉnh)";
      const destination = this.activeTour.destination || "Đà Lạt";
      const daysCount = this.activeTour.days || safeData.length || 1;
      const totalCost = Number(this.activeTour.cost) || 0;
      const totalCarbon = Number(this.activeTour.carbon) || 0;

      const newIti: Itinerary = {
        id: newItiId,
        name: title,
        user_id: userId,
        destination: destination,
        days: daysCount,
        totalCost: totalCost,
        totalCarbon: totalCarbon,
        daysData: safeData
      };

      // 1. Convert to editor format and save to localStorage immediately for 0ms instant loading
      const destSlug = this.mapDestToSlug(destination);

      const editorDays = safeData.map((acts: any[], idx: number) => ({
        dayNum: idx + 1,
        title: `Ngày ${idx + 1}`,
        activities: acts || []
      }));

      const draftPayload = {
        id: newItiId,
        title: title,
        dest: destSlug,
        destLabel: destination,
        destination: destination,
        days: editorDays.length > 0 ? editorDays : [{ dayNum: 1, title: 'Ngày 1', activities: [] }],
        daysData: safeData,
        status: 'draft',
        imageUrl: this.activeTour.image || null,
        totalCost: totalCost,
        totalCarbon: totalCarbon
      };

      try {
        localStorage.setItem(`greensteps_draft_${newItiId}`, JSON.stringify(draftPayload));
        localStorage.setItem(`greensteps_user_draft_${newItiId}`, JSON.stringify(draftPayload));
        localStorage.setItem(`greensteps_guest_draft_${newItiId}`, JSON.stringify(draftPayload));
        localStorage.setItem('greensteps_working_itinerary_id', newItiId);
      } catch (storageErr) {
        console.warn('LocalStorage draft write warning:', storageErr);
      }

      // 2. Sync to backend asynchronously in background
      this.apiService.saveItinerary(newIti).catch(e => console.warn('Background save itinerary error:', e));

      // 3. Navigate immediately to schedule editor
      await this.router.navigate(['/schedule', newItiId]);
    } catch (err) {
      console.error('Error cloning trip:', err);
    } finally {
      this.isCloningTrip = false;
    }
  }

  public async submitBooking(event: Event) {
    event.preventDefault();
    if (!this.activeTour) return;

    this.bookingError = '';
    if (!this.bookingAvailable) {
      this.activeInfoTab = 'overview';
      this.bookingError = 'Dịch vụ chưa mở đặt chỗ trên GreenSteps. Vui lòng chọn dịch vụ khác hoặc thử lại sau.';
      return;
    }
    if (this.isLodging) {
      this.validateStayDates();
      const room = this.selectedRoom;
      if (!room || !this.canBookRoom(room)) {
        this.activeInfoTab = 'rooms';
        this.bookingError = 'Vui lòng chọn phòng có thông tin giá và số lượng được xác nhận.';
        return;
      }
      const quantity = this.roomQuantities[room.id] || 1;
      if (!this.roomOptions(room).includes(quantity) || this.totalGuests > Number(room.capacity) * quantity) {
        this.activeInfoTab = 'rooms';
        this.bookingError = 'Số phòng hoặc sức chứa chưa phù hợp với số khách. Vui lòng điều chỉnh lựa chọn.';
        return;
      }
    } else if (this.activeTour.maxCapacity && this.totalGuests > this.activeTour.maxCapacity) {
      this.bookingError = 'Tổng số khách vượt quá sức chứa của dịch vụ.';
      return;
    }

    this.validateBookingDate();
    const checkIn = this.bookingDate;
    const checkOutDate = new Date(`${checkIn}T12:00:00`);
    checkOutDate.setDate(checkOutDate.getDate() + Math.max(this.activeTour.days - 1, 1));
    const checkOut = this.isLodging ? this.checkOutDate : bookingDate(0, checkOutDate);

    if (this.bookingPriceLoading) {
      this.bookingError = 'Đang cập nhật báo giá. Vui lòng đợi rồi thử lại.';
      return;
    }
    if (!this.bookingPricingSnapshot) await this.refreshBookingQuote();
    if (!this.bookingPricingSnapshot) {
      this.bookingError = 'Chưa thể xác nhận giá từ hệ thống. Vui lòng thử lại sau.';
      return;
    }

    const bookingContext = {
      roomId: this.isLodging ? this.selectedRoomId : '',
      tourId: this.activeTour.isService ? undefined : this.activeTour.id,
      serviceId: this.activeTour.isService ? this.activeTour.id : undefined,
      flashSaleId: this.activeTour.flashSale?.id,
      checkIn,
      checkOut,
      guestCount: this.totalGuests,
      roomCount: this.isLodging ? (this.roomQuantities[this.selectedRoomId] || 1) : 1
    };

    localStorage.setItem('greensteps_booking_context', JSON.stringify(bookingContext));
    this.trackingService.trackAction('book_click');
    this.router.navigate(['/booking'], { queryParams: bookingContext });
  }

  // REVIEWS & COMMENTS FEATURE INTEGRATION
  public async loadReviews(tourId: string, requestSequence = this.detailRequestSequence) {
    this.reviewLoadError = false;
    this.isReviewsLoading = true;
    try {
      let reviews;
      if (this.activeTour?.isService || (tourId && (tourId.toLowerCase().startsWith('srv_') || tourId.toLowerCase().startsWith('srv-') || tourId.startsWith('SRV_')))) {
        reviews = await this.apiService.getServiceReviews(tourId);
      } else {
        reviews = await this.apiService.getTourReviews(tourId);
      }
      if (this.detailDisposed || requestSequence !== this.detailRequestSequence || this.route.snapshot.paramMap.get('id') !== tourId) return;
      this.reviewsList = reviews;
      this.isReviewsLoading = false;
    } catch {
      if (this.detailDisposed || requestSequence !== this.detailRequestSequence || this.route.snapshot.paramMap.get('id') !== tourId) return;
      this.reviewsList = [];
      this.reviewLoadError = true;
      this.isReviewsLoading = false;
    }
    this.applyFilterAndSort();
    this.cdr.detectChanges();
  }

  public async loadReviewEligibility(requestSequence = this.detailRequestSequence, tourId = this.activeTour?.id || '') {
    this.reviewEligibilityError = false;
    this.isReviewEligibilityLoading = true;
    const userId = this.currentUser?.id || this.currentUser?._id;
    if (!userId || this.currentUser?.role !== 'traveler' || !this.activeTour) {
      this.reviewBookings = [];
      this.selectedReviewBookingId = '';
      this.isReviewEligibilityLoading = false;
      return;
    }
    const type = this.activeTour.isService ? 'service' : 'tour';
    let bookings: any[];
    try {
      bookings = await this.apiService.getBookingsForReviewEligibility(userId);
    } catch {
      if (this.detailDisposed || requestSequence !== this.detailRequestSequence || this.route.snapshot.paramMap.get('id') !== tourId || this.currentUserId !== userId) return;
      this.reviewBookings = [];
      this.selectedReviewBookingId = '';
      this.reviewEligibilityError = true;
      this.isReviewEligibilityLoading = false;
      return;
    }
    if (this.detailDisposed || requestSequence !== this.detailRequestSequence || this.route.snapshot.paramMap.get('id') !== tourId || this.currentUserId !== userId || this.activeTour?.id !== tourId) return;
    const alreadyReviewed = new Set(this.reviewsList.map(review => review.bookingId).filter(Boolean));
    this.reviewBookings = bookings.filter((booking: any) =>
      booking.status === 'completed' && booking.type === type && booking.targetId === this.activeTour?.id && !alreadyReviewed.has(booking.id)
    );
    this.selectedReviewBookingId = this.reviewBookings[0]?.id || '';
    this.isReviewEligibilityLoading = false;
  }

  public applyFilterAndSort() {
    let list = [...this.reviewsList];

    // 1. Filter
    if (this.activeFilter === 'Gia đình có trẻ nhỏ') {
      list = list.filter(r => /gia đình|bé|trẻ|con|nhỏ|đứa|family/i.test(r.text));
    } else if (this.activeFilter === 'Lịch trình xanh') {
      list = list.filter(r => /lịch trình|xanh|môi trường|bảo vệ|eco/i.test(r.text));
    } else if (this.activeFilter === 'Hướng dẫn viên') {
      list = list.filter(r => /hướng dẫn|hdv|guide|phục vụ|nhân viên/i.test(r.text));
    } else if (this.activeFilter === 'Ẩm thực') {
      list = list.filter(r => /ăn|uống|ẩm thực|nhà hàng|món|ngon|đặc sản/i.test(r.text));
    } else if (this.activeFilter === 'Có ảnh') {
      list = list.filter(r => r.image_url || r.imageUrl);
    }

    // 2. Sort
    if (this.activeSort === 'Mới nhất') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (this.activeSort === 'Đánh giá cao nhất') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    this.filteredReviews = list;
  }

  public setFilter(filterName: string) {
    this.activeFilter = filterName;
    this.applyFilterAndSort();
    this.cdr.detectChanges();
  }

  public setSort(event: any) {
    this.activeSort = event.target.value;
    this.applyFilterAndSort();
    this.cdr.detectChanges();
  }

  public async handleLikeComment(commentId: string) {
    if (this.likedReviewsSet.has(commentId)) return;

    const res = await this.apiService.likeComment(commentId);
    if (res && res.success) {
      this.likedReviewsSet.add(commentId);
      localStorage.setItem('greensteps_liked_reviews', JSON.stringify(Array.from(this.likedReviewsSet)));
      
      const updateCount = (list: any[]) => {
        for (let item of list) {
          if (item.id === commentId) {
            item.likesCount = res.likes;
            return true;
          }
          if (item.replies && item.replies.length > 0) {
            if (updateCount(item.replies)) return true;
          }
        }
        return false;
      };
      updateCount(this.reviewsList);
      this.applyFilterAndSort();
      this.cdr.detectChanges();
    }
  }

  public toggleReplyBox(commentId: string) {
    this.activeReplyTarget[commentId] = !this.activeReplyTarget[commentId];
    if (this.activeReplyTarget[commentId]) {
      this.replyInputs[commentId] = '';
    }
  }

  public async submitReply(parentCommentId: string) {
    const text = this.replyInputs[parentCommentId];
    if (!text || !text.trim()) return;

    if (!this.currentUser) {
      this.toastService.warning('Vui lòng đăng nhập để gửi phản hồi!');
      return;
    }

    const userId = this.currentUser.id || this.currentUser._id;
    const tourId = this.activeTour?.id || '';

    let res;
    try {
      if (this.activeTour?.isService) {
        res = await this.apiService.postServiceReview({ serviceId: tourId, text, parentCommentId });
      } else {
        res = await this.apiService.postTourReview({ tourId, text, parentCommentId });
      }
    } catch (error: any) {
      this.toastService.error(error?.error?.message || 'Gửi phản hồi thất bại!');
      return;
    }

    if (res && res.success) {
      this.replyInputs[parentCommentId] = '';
      this.activeReplyTarget[parentCommentId] = false;
      this.toastService.success('Đã gửi phản hồi thành công!');
      if (this.activeTour) {
        await this.loadReviews(this.activeTour.id);
      }
    } else {
      this.toastService.error('Gửi phản hồi thất bại!');
    }
  }

  public async submitRootReview() {
    if (this.isSubmittingReview || !this.newReviewText || !this.newReviewText.trim()) return;

    if (!this.currentUser) {
      this.toastService.warning('Vui lòng đăng nhập để gửi đánh giá!');
      return;
    }

    const tourId = this.activeTour?.id || '';

    const ratingToSend = !this.hasUserRated && this.newReviewRating > 0 ? this.newReviewRating : null;
    this.isSubmittingReview = true;
    let res;
    try {
      if (this.activeTour?.isService) {
        res = await this.apiService.postServiceReview({
          bookingId: this.selectedReviewBookingId || undefined,
          serviceId: tourId,
          rating: ratingToSend,
          text: this.newReviewText
        });
      } else {
        res = await this.apiService.postTourReview({
          bookingId: this.selectedReviewBookingId || undefined,
          tourId,
          rating: ratingToSend,
          text: this.newReviewText
        });
      }
    } catch (error: any) {
      this.toastService.error(error?.error?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
      this.isSubmittingReview = false;
      return;
    }
    this.isSubmittingReview = false;

    if (res && res.success) {
      this.newReviewText = '';
      this.newReviewRating = 5;
      this.toastService.success('Đã gửi đánh giá thành công!');
      if (this.activeTour) {
        await this.loadReviews(this.activeTour.id);
        await this.loadReviewEligibility();
        if (res.rating !== undefined && res.rating !== null) this.activeTour.rating = res.rating;
        const reviewCount = res.votes_count ?? res.reviews_count;
        if (reviewCount !== undefined) {
          this.activeTour.votes_count = reviewCount;
          this.activeTour.votes = reviewCount;
        }
      }
    } else {
      this.toastService.error('Gửi đánh giá thất bại!');
    }
  }

  public isAvatarUrl(avatar?: string): boolean {
    if (!avatar || typeof avatar !== 'string') return false;
    const clean = avatar.trim();
    return clean.startsWith('http://') ||
           clean.startsWith('https://') ||
           clean.startsWith('data:image/') ||
           clean.startsWith('image/') ||
           clean.startsWith('/image/') ||
           clean.startsWith('/uploads/') ||
           clean.startsWith('assets/') ||
           clean.startsWith('/');
  }

  public getFirstLetter(name?: string): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
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
}

export { TourDetailComponent as TourDetail };
