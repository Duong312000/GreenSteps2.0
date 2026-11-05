import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Tour, Itinerary } from '../../models/models';
import { bookingDate } from '../../utils/booking-date';

@Component({
  selector: 'app-tour-detail',
  standalone: false,
  templateUrl: './tour-detail.html',
  styleUrls: ['./tour-detail.css']
})
export class TourDetailComponent implements OnInit {
  public activeTour: Tour | null = null;
  public slideImages: string[] = [];
  public activeSlideIndex: number = 0;
  public isPageLoading: boolean = true;
  public isPhotoGalleryOpen: boolean = false;

  public reviewsList: any[] = [];
  public filteredReviews: any[] = [];
  public reviewLoadError = false;
  public reviewEligibilityError = false;
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
  public activeInfoTab: 'overview' | 'included' | 'itinerary' | 'policy' | 'reviews' = 'overview';
  public isServiceDetail: boolean = false;

  // Booking details
  public bookingDate: string = bookingDate();
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

  public get totalReviewsCount(): number {
    return Number(this.activeTour?.votes_count ?? this.activeTour?.votes ?? this.reviewsList?.length ?? 0);
  }

  public get averageScore(): number {
    if (!this.activeTour || this.activeTour.rating == null || !Number.isFinite(Number(this.activeTour.rating))) return 0;
    return Number(this.activeTour.rating);
  }

  public get ratingText(): string {
    const score = this.averageScore;
    if (!this.totalReviewsCount) return 'ChÆ°a cÃ³ Ä‘Ã¡nh giÃ¡';
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
    if (this.activeTour?.highlights && Array.isArray(this.activeTour.highlights) && this.activeTour.highlights.length > 0) {
      return this.activeTour.highlights;
    }
    return [
      'Lịch trình thong thả, có nhiều thời gian nghỉ ngơi thoải mái',
      'Ưu tiên trải nghiệm văn hóa và ẩm thực bản địa sạch',
      'Hướng dẫn viên thân thiện, chu đáo và am hiểu sinh thái',
      'Có thể cá nhân hóa lại các hoạt động theo mong muốn của bạn'
    ];
  }

  public get tourIncluded(): string[] {
    if (this.activeTour?.included && Array.isArray(this.activeTour.included) && this.activeTour.included.length > 0) {
      return this.activeTour.included;
    }
    return [
      'Phương tiện di chuyển xanh theo lịch trình đã xác nhận',
      'Vé vào cổng các điểm tham quan chính trong tour',
      'Hướng dẫn viên đồng hành chuyên nghiệp, thân thiện',
      'Bảo hiểm du lịch theo quy định'
    ];
  }

  public get tourExcluded(): string[] {
    if (this.activeTour?.excluded && Array.isArray(this.activeTour.excluded) && this.activeTour.excluded.length > 0) {
      return this.activeTour.excluded;
    }
    return [
      'Chi tiêu cá nhân ngoài chương trình (mua sắm quà lưu niệm...)',
      'Các bữa ăn uống tự do ngoài các bữa chính trong hành trình',
      'Phụ phí phòng đơn nếu có nhu cầu ở riêng'
    ];
  }

  public get tourGuarantees(): Array<{ icon?: string; title: string; desc: string }> {
    return (this.activeTour?.guarantees && Array.isArray(this.activeTour.guarantees) && this.activeTour.guarantees.length > 0)
      ? this.activeTour.guarantees
      : [];
  }

  public get tourVouchers(): any[] {
    return (this.activeTour?.vouchers && Array.isArray(this.activeTour.vouchers) && this.activeTour.vouchers.length > 0)
      ? this.activeTour.vouchers
      : [];
  }

  public activeAssuranceOpen: boolean = false;
  public toggleAssurance() {
    this.activeAssuranceOpen = !this.activeAssuranceOpen;
  }

  public get tourPolicies(): Array<{ step?: string; title: string; desc: string }> {
    if (this.activeTour?.policy && Array.isArray(this.activeTour.policy) && this.activeTour.policy.length > 0) {
      return this.activeTour.policy;
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
        title: 'Chính sách hoàn cọc',
        desc: 'Hoàn 90% nếu thông báo hủy trước 7 ngày. Mọi chi phí được minh bạch tuyệt đối.'
      }
    ];
  }

  public get tourStyle(): string {
    return this.activeTour?.style || (this.activeTour?.isService ? this.detailKindLabel : 'Gia đình / Eco Travel');
  }

  public get tourGroupSize(): string {
    return this.activeTour?.group_size || 'Nhóm nhỏ thân mật';
  }

  public get tourFitnessLevel(): string {
    return this.activeTour?.fitness_level || 'Nhẹ nhàng';
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
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (this.activeTour) void this.loadReviewEligibility();
    });

    const liked = JSON.parse(localStorage.getItem('greensteps_liked_reviews') || '[]');
    this.likedReviewsSet = new Set<string>(liked);

    this.route.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (id) {
        this.isPageLoading = true;
        const isService = this.route.snapshot.routeConfig?.path?.startsWith('services') ||
                          this.route.snapshot.routeConfig?.path?.startsWith('service-detail') ||
                          id.toLowerCase().startsWith('srv_') ||
                          id.toLowerCase().startsWith('srv-');

        if (isService) {
          this.activeTour = await this.apiService.getServiceAsTour(id);
          if (!this.activeTour) {
            this.activeTour = await this.apiService.getPresetTour(id);
          }
        } else {
          this.activeTour = await this.apiService.getPresetTour(id);
          if (!this.activeTour) {
            this.activeTour = await this.apiService.getServiceAsTour(id);
          }
        }

        this.isServiceDetail = !!this.activeTour?.isService || isService;
        if (this.activeTour) {
          this.setupSlides();
          await this.loadReviews(id);
          await this.loadReviewEligibility();
        }
        this.isPageLoading = false;
        this.cdr.detectChanges();
      } else {
        this.isPageLoading = false;
        this.cdr.detectChanges();
      }
    });
  }


  public onThumbError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg';
    }
  }

  private setupSlides() {
    if (!this.activeTour) return;
    const coverImage = (this.activeTour.image || this.activeTour.image_url || 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg').replace(/^\//, '');
    const rawGallery = (this.activeTour.gallery || []).map((img: string) => (img || '').replace(/^\//, '')).filter(Boolean);

    let rawImages: string[] = [];
    if (rawGallery.length > 0) {
      rawImages = Array.from(new Set([coverImage, ...rawGallery]));
    } else {
      const dest = this.activeTour.destination || 'Đà Lạt';
      const destImgs = this.destinationImages[dest] || this.destinationImages['Đà Lạt'] || [];
      rawImages = Array.from(new Set([coverImage, ...destImgs]));
    }

    this.slideImages = rawImages.filter(img => !this.isLowQualityGalleryImage(img)).slice(0, 5);
    if (this.slideImages.length === 0) {
      this.slideImages = [coverImage];
    }
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
    return img.startsWith('http') ||
      img.includes('e8b896896439701c1ff79d65290703b0') ||
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

  public scrollToTab(tab: 'overview' | 'included' | 'itinerary' | 'policy' | 'reviews') {
    this.activeInfoTab = tab;
    setTimeout(() => {
      const el = document.querySelector('.gs-tabs-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  public setInfoTab(tab: 'overview' | 'included' | 'itinerary' | 'policy' | 'reviews') {
    this.activeInfoTab = tab;
  }

  public scrollToReviews() {
    this.activeInfoTab = 'reviews';
    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.getElementById('reviews-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }


  public get totalPrice(): number {
    if (!this.activeTour) return 0;
    return this.activeTour.cost * this.totalGuests;
  }

  public get totalGuests(): number {
    return Number(this.bookingAdults) + Number(this.bookingChildren);
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
    return this.activeTour.oldCost || this.activeTour.old_cost || Math.round(this.activeTour.cost * 1.12);
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
    return this.activeTour?.isService ? 'Đặt Dịch Vụ Ngay' : 'Đặt Cọc Tour Ngay';
  }

  public get detailBookingLabelLower(): string {
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
    if (!this.activeTour) return;
    
    const user = this.authService.getCurrentUser();
    const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';

    const newIti: Itinerary = {
      id: "iti_" + Date.now(),
      name: this.activeTour.title + " (Custom)",
      user_id: userId,
      destination: this.activeTour.destination,
      days: this.activeTour.days,
      totalCost: this.activeTour.cost,
      totalCarbon: this.activeTour.carbon,
      daysData: JSON.parse(JSON.stringify(this.activeTour.data))
    };

    await this.apiService.saveItinerary(newIti);
    this.router.navigate(['/schedule', newIti.id]);
  }

  public async submitBooking(event: Event) {
    event.preventDefault();
    if (!this.activeTour) return;

    this.validateBookingDate();
    const checkIn = this.bookingDate;
    const checkOutDate = new Date(`${checkIn}T12:00:00`);
    checkOutDate.setDate(checkOutDate.getDate() + Math.max(this.activeTour.days - 1, 1));
    const checkOut = bookingDate(0, checkOutDate);

    const bookingContext = {
      hotelId: `hotel_${this.activeTour.destination || 'greensteps'}`.toLowerCase().replace(/\s+/g, '_'),
      roomId: 'premium_double_window',
      tourId: this.activeTour.isService ? undefined : this.activeTour.id,
      serviceId: this.activeTour.isService ? this.activeTour.id : undefined,
      checkIn,
      checkOut,
      guestCount: this.totalGuests,
      roomCount: 1
    };

    localStorage.setItem('greensteps_booking_context', JSON.stringify(bookingContext));
    this.router.navigate(['/booking'], { queryParams: bookingContext });
  }

  // REVIEWS & COMMENTS FEATURE INTEGRATION
  public async loadReviews(tourId: string) {
    this.reviewLoadError = false;
    try {
      if (this.activeTour?.isService || (tourId && (tourId.toLowerCase().startsWith('srv_') || tourId.toLowerCase().startsWith('srv-') || tourId.startsWith('SRV_')))) {
        this.reviewsList = await this.apiService.getServiceReviews(tourId);
      } else {
        this.reviewsList = await this.apiService.getTourReviews(tourId);
      }
    } catch {
      this.reviewsList = [];
      this.reviewLoadError = true;
    }
    this.applyFilterAndSort();
    this.cdr.detectChanges();
  }

  public async loadReviewEligibility() {
    this.reviewEligibilityError = false;
    const userId = this.currentUser?.id || this.currentUser?._id;
    if (!userId || this.currentUser?.role !== 'traveler' || !this.activeTour) {
      this.reviewBookings = [];
      this.selectedReviewBookingId = '';
      return;
    }
    const type = this.activeTour.isService ? 'service' : 'tour';
    let bookings: any[];
    try {
      bookings = await this.apiService.getBookingsForReviewEligibility(userId);
    } catch {
      this.reviewBookings = [];
      this.selectedReviewBookingId = '';
      this.reviewEligibilityError = true;
      return;
    }
    const alreadyReviewed = new Set(this.reviewsList.map(review => review.bookingId).filter(Boolean));
    this.reviewBookings = bookings.filter((booking: any) =>
      booking.status === 'completed' && booking.type === type && booking.targetId === this.activeTour?.id && !alreadyReviewed.has(booking.id)
    );
    this.selectedReviewBookingId = this.reviewBookings[0]?.id || '';
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
      alert('Vui lòng đăng nhập để gửi phản hồi!');
      return;
    }

    const userId = this.currentUser.id || this.currentUser._id;
    const tourId = this.activeTour?.id || '';

    let res;
    if (this.activeTour?.isService) {
      res = await this.apiService.replyToComment(parentCommentId, userId, text);
    } else {
      res = await this.apiService.postTourReview({
        tourId,
        text,
        parentCommentId
      });
    }

    if (res && res.success) {
      this.replyInputs[parentCommentId] = '';
      this.activeReplyTarget[parentCommentId] = false;
      if (this.activeTour) {
        await this.loadReviews(this.activeTour.id);
      }
    } else {
      alert('Gửi phản hồi thất bại!');
    }
  }

  public async submitRootReview() {
    if (this.isSubmittingReview || !this.newReviewText || !this.newReviewText.trim() || !this.selectedReviewBookingId) return;

    if (!this.currentUser) {
      alert('Vui lòng đăng nhập để gửi đánh giá!');
      return;
    }

    const tourId = this.activeTour?.id || '';

    this.isSubmittingReview = true;
    let res;
    try {
      if (this.activeTour?.isService) {
        res = await this.apiService.postServiceReview({
          bookingId: this.selectedReviewBookingId,
          serviceId: tourId,
          rating: this.newReviewRating,
          text: this.newReviewText
        });
      } else {
        res = await this.apiService.postTourReview({
          bookingId: this.selectedReviewBookingId,
          tourId,
          rating: this.newReviewRating,
          text: this.newReviewText
        });
      }
    } catch (error: any) {
      alert(error?.error?.message || 'Could not submit the review. Please try again.');
      this.isSubmittingReview = false;
      return;
    }
    this.isSubmittingReview = false;

    if (res && res.success) {
      this.newReviewText = '';
      this.newReviewRating = 5;
      if (this.activeTour) {
        await this.loadReviews(this.activeTour.id);
        await this.loadReviewEligibility();
        this.activeTour.rating = res.rating;
        const reviewCount = res.votes_count ?? res.reviews_count;
        if (reviewCount !== undefined) {
          this.activeTour.votes_count = reviewCount;
          this.activeTour.votes = reviewCount;
        }
      }
    } else {
      alert('Gửi đánh giá thất bại!');
    }
  }

  public isAvatarUrl(avatar?: string): boolean {
    if (!avatar) return false;
    return avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('image/');
  }

  public getFirstLetter(name?: string): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }
}

export { TourDetailComponent as TourDetail };
