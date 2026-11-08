import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { Tour } from '../../models/models';

declare const L: any;

type DestinationPosition = 'left' | 'center' | 'right';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private revealObserver?: IntersectionObserver;
  private parallaxFrame = 0;
  private storyProgrammaticTimer?: ReturnType<typeof setTimeout>;
  private previewImageTimer?: ReturnType<typeof setTimeout>;
  private storyScrollFrame = 0;
  private storyWheelGestureActive = false;
  private storyWheelAnimationLocked = false;
  private storyWheelLastAt = 0;
  private storyWheelQuietMs = 140;
  private storyWheelMonitorFrame = 0;
  private programmaticStoryTarget: number | null = null;
  private previewImageRequest = 0;
  private readonly countFrames = new Set<number>();
  private readonly onStoryWheel = (event: WheelEvent) => {
    if (window.innerWidth <= 1100 || event.deltaY === 0) return;

    const story = this.elementRef.nativeElement.querySelector<HTMLElement>('.gs-itinerary');
    if (!story) return;

    const rect = story.getBoundingClientRect();
    const navbarHeight = this.getStoryNavbarHeight();
    const stickyHeight = Math.max(1, window.innerHeight - navbarHeight);
    const start = rect.top + window.scrollY - navbarHeight;
    const scrollRange = Math.max(1, story.offsetHeight - stickyHeight);
    const end = start + scrollRange;
    const steps: Array<'eco' | 'guides' | 'dates' | 'ai'> = ['eco', 'guides', 'dates', 'ai'];
    const direction = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1);
    const projectedScroll = window.scrollY + direction;
    const enteringFromAbove = window.scrollY < start && projectedScroll >= start;
    const enteringFromBelow = window.scrollY > end && projectedScroll <= end;
    const isInsideStory = window.scrollY >= start && window.scrollY <= end;
    if (!isInsideStory && !enteringFromAbove && !enteringFromBelow) return;

    if (this.storyWheelGestureActive || this.storyWheelAnimationLocked) {
      event.preventDefault();
      this.recordStoryWheelEvent(event);
      return;
    }

    if (enteringFromAbove) {
      event.preventDefault();
      this.beginStoryWheelGesture(event);
      this.moveStoryToStep(0);
      return;
    }

    if (enteringFromBelow) {
      event.preventDefault();
      this.beginStoryWheelGesture(event);
      this.moveStoryToStep(3);
      return;
    }

    const progress = Math.max(0, Math.min(.999, (window.scrollY - start) / scrollRange));
    const currentStep = Math.floor(progress * steps.length);
    const nextStep = currentStep + (direction > 0 ? 1 : -1);
    if (nextStep < 0 || nextStep >= steps.length) return;

    event.preventDefault();
    this.beginStoryWheelGesture(event);
    this.moveStoryToStep(nextStep);
  };
  private readonly onScrollForParallax = () => {
    if (this.parallaxFrame) return;
    this.parallaxFrame = window.requestAnimationFrame(() => {
      this.parallaxFrame = 0;
      const root = this.elementRef.nativeElement as HTMLElement;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(image => {
          const rect = image.getBoundingClientRect();
          const offset = Math.max(-18, Math.min(18, (rect.top + rect.height / 2 - window.innerHeight / 2) * -0.025));
          image.style.setProperty('--gs-parallax-y', `${offset.toFixed(1)}px`);
        });
      }
      if (root.classList.contains('gs-motion-ready')) {
        const revealLine = window.innerHeight * 0.92;
        root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)').forEach(target => {
          if (target.getBoundingClientRect().top <= revealLine) this.revealTarget(target);
        });
      }
    this.updateStoryFromScroll(root);
    });
  };

  private readonly realPreviewImages = {
    daNang: 'image/greensteps/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg',
    baNa: 'image/greensteps/da-nang-hoi-an/da-nang-cau-vang-binh-minh-01.jpg',
    hoiAn: 'image/greensteps/da-nang-hoi-an/hoi-an-song-hoai-hoa-dang-01.jpg',
    ecoStay: 'image/services/stay_hoi_an_eco.png',
    flexibleDaLat: 'image/greensteps/da-lat/da-lat-thac-nuoc-01.jpg',
    nguHanhSon: 'image/greensteps/da-nang-hoi-an/da-nang-son-tra-rung-xanh-01.jpg',
    phuYen: 'image/greensteps/phu-yen/phu-yen-canh-quan-xanh-01.jpg',
    ganhDaDia: 'image/greensteps/phu-yen/phu-yen-bai-da-ven-bien-01.jpg',
    damOLoan: 'image/greensteps/phu-yen/phu-yen-bien-dao-minh-hoa-01.jpg',
    muiDien: 'image/greensteps/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
    baiXep: 'image/greensteps/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
    honYen: 'image/greensteps/phu-yen/phu-yen-bien-trong-01.jpg',
    nhatTuSon: 'image/greensteps/phu-yen/phu-yen-bai-bien-dua-01.jpg',
    daLat: 'image/greensteps/da-lat/da-lat-rung-thong-san-may-01.jpg',
    langbiang: 'image/greensteps/da-lat/da-lat-rung-thong-01.jpg',
    tuyenLam: 'image/greensteps/da-lat/da-lat-ho-tuyen-lam-01.jpg'
  };

  public searchDest: string = 'Đà Lạt';
  public isDestinationSuggestionsOpen = false;
  public realTours: Tour[] = [];
  public aiPlannerDest: string = 'Đà Nẵng';
  public aiSuggestedDays: any[] = [];
  public aiSuggestedTitle: string = 'Lịch trình gợi ý';
  public isAiLoading: boolean = false;
  public aiAssistantMessage: string = 'Xin chào! Tôi là GreenSteps AI. Hãy chia sẻ sở thích du lịch để tôi thiết kế hành trình phù hợp dành riêng cho bạn.';
  public aiPlannerDuration = 3;
  public aiPlannerTravelers = 2;
  public aiPlannerActiveDay = 0;
  public activeAiActivityIndex = 0;
  public aiSuggestedActivities: any[] = [{
    index: 0,
    stopNumber: 1,
    dayIndex: 0,
    time: '09:00',
    title: 'Cầu Vàng trong mây',
    desc: 'Bắt đầu ngày mới giữa núi rừng và tầng mây.',
    img: this.realPreviewImages.baNa,
    lat: null,
    lng: null
  }];
  public aiPlannerMapDestination = 'Đà Nẵng · Miền Trung';
  public aiPlannerMapTilesReady = false;
  private aiPlannerMap: any = null;
  private aiPlannerMarkers: Array<{ index: number; marker: any }> = [];
  public readonly minimumDate = this.formatDateOffset(0);
  public startDate: string = this.formatDateOffset(14);
  public endDate: string = this.formatDateOffset(18);
  public guests: string = '2';
  public budget: string = '2M-5M';
  public activeDestinationIndex = 1;
  public activeReviewIndex = 0;
  public readonly reviewMemories = [
    {
      rating: '4.9', initial: 'S', name: 'Sarah Johnson', location: 'Hoa Kỳ · Đà Nẵng', destination: 'Đà Nẵng',
      quote: '“Trải nghiệm tại Đà Nẵng thật tuyệt vời. Mọi thứ được tổ chức chu đáo và lịch trình rất hợp lý.”',
      image: 'image/greensteps/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg',
      imageAlt: 'Cầu Vàng giữa núi rừng Bà Nà, Đà Nẵng.'
    },
    {
      rating: '4.9', initial: 'M', name: 'Michael Chen', location: 'Singapore · Hội An', destination: 'Hội An',
      quote: '“GreenSteps đã giúp chuyến đi Việt Nam của chúng tôi trở nên khó quên. Trợ lý AI thực sự hữu ích.”',
      image: 'image/greensteps/da-nang-hoi-an/hoi-an-song-hoai-hoa-dang-01.jpg',
      imageAlt: 'Phố cổ Hội An và thuyền hoa đăng trên sông Hoài.'
    },
    {
      rating: '4.9', initial: 'E', name: 'Emma Williams', location: 'Úc · Đà Lạt', destination: 'Đà Lạt',
      quote: '“Từ chuyến đi đến nơi lưu trú, mọi thứ đều liền mạch. Tôi rất khuyến nghị GreenSteps.”',
      image: 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg',
      imageAlt: 'Hồ Xuân Hương và hàng thông trong ánh đèn Đà Lạt.'
    }
  ];
  public isDestinationTransitioning = false;
  public destinationDirection: 'prev' | 'next' = 'next';
  public wrappingDestinationIndex: number | null = null;
  private destinationTransitionTimer?: ReturnType<typeof setTimeout>;
  private destinationDrag: { pointerId: number; startX: number; startY: number; dragging: boolean } | null = null;
  private destinationClickSuppressed = false;
  private destinationClickSuppressionTimer?: ReturnType<typeof setTimeout>;
  public destinationCards: any[] = [
    {
      dest: 'Đà Lạt',
      label: 'Đà Lạt',
      title: 'Đà Lạt',
      subtitle: 'Thành phố ngàn hoa',
      image: this.realPreviewImages.daLat
    },
    {
      dest: 'Đà Nẵng - Hội An',
      label: 'Đà Nẵng - Hội An',
      title: 'Đà Nẵng - Hội An',
      subtitle: 'Di sản, biển xanh và văn hóa sống động',
      image: this.realPreviewImages.daNang
    },
    {
      dest: 'Phú Yên',
      label: 'Phú Yên',
      title: 'Phú Yên',
      subtitle: 'Bờ biển hoang sơ, kỳ nghỉ bình yên',
      image: this.realPreviewImages.phuYen
    }
  ];

  public activeHighlight: 'eco' | 'guides' | 'dates' | 'ai' = 'eco';
  public isStoryTransitioning = false;
  public storyPreviewImage = this.realPreviewImages.ecoStay;
  public previousStoryPreviewImage: string | null = null;
  public isStoryPreviewImageVisible = true;
  
  public highlightPreviews: { [key: string]: { title: string; subtitle: string; days: { label: string; title: string; desc: string; img: string }[] } } = {
    eco: {
      title: "Chuyến đi 5 ngày Miền Trung Xanh",
      subtitle: "Trải nghiệm lưu trú sinh thái & phục hồi tự nhiên",
      days: [
        { label: "Ngày 1", title: "Đến Đà Nẵng", desc: "Khu nghỉ dưỡng sinh thái tre, bãi biển Mỹ Khê", img: this.realPreviewImages.ecoStay },
        { label: "Ngày 2", title: "Nhà nghỉ sinh thái Hội An", desc: "Chèo thuyền thúng rừng dừa, nông nghiệp hữu cơ", img: this.realPreviewImages.hoiAn },
        { label: "Ngày 3", title: "Danh thắng Ngũ Hành Sơn", desc: "Đi bộ hành hương, thưởng trà thảo mộc", img: this.realPreviewImages.nguHanhSon },
        { label: "Ngày 4", title: "Công viên sinh thái Bà Nà", desc: "Cáp treo thủy điện, vườn hoa bảo tồn", img: this.realPreviewImages.baNa },
        { label: "Ngày 5", title: "Khởi hành về", desc: "Gieo mầm cây lưu niệm, chia tay miền Trung", img: this.realPreviewImages.hoiAn }
      ]
    },
    guides: {
      title: "Hành trình Văn hóa Bản địa 5 ngày",
      subtitle: "Tìm hiểu di sản cùng người kể chuyện bản xứ",
      days: [
        { label: "Ngày 1", title: "Di sản Đà Nẵng", desc: "Đón khách, tour đi bộ phố cổ và bảo tàng Chăm", img: this.realPreviewImages.hoiAn },
        { label: "Ngày 2", title: "Nghề làm lồng đèn Hội An", desc: "Làm lồng đèn cùng nghệ nhân phố cổ", img: this.realPreviewImages.hoiAn },
        { label: "Ngày 3", title: "Làng rau Trà Quế", desc: "Học làm nông dân trồng rau sạch cùng người bản địa", img: this.realPreviewImages.hoiAn },
        { label: "Ngày 4", title: "Thánh địa Mỹ Sơn", desc: "Khám phá thánh địa Mỹ Sơn cổ kính với hướng dẫn viên", img: this.realPreviewImages.nguHanhSon },
        { label: "Ngày 5", title: "Khởi hành về", desc: "Lớp học nấu ăn đặc sản miền Trung, kết thúc tour", img: this.realPreviewImages.hoiAn }
      ]
    },
    dates: {
      title: "Lộ trình Linh hoạt Đà Lạt 3 ngày",
      subtitle: "Tự chủ thời gian và điểm đến mong muốn",
      days: [
        { label: "Ngày 1", title: "Đến nơi & nhận phòng linh hoạt", desc: "Đón sân bay linh hoạt theo giờ bay riêng của khách", img: this.realPreviewImages.flexibleDaLat },
        { label: "Ngày 2", title: "Chinh phục LangBiang tự chọn", desc: "Tự chọn cung đường đi bộ ngắn/dài tùy thuộc sức khỏe", img: this.realPreviewImages.langbiang },
        { label: "Ngày 3", title: "Khởi hành & trả phòng linh hoạt", desc: "Tự do mua sắm, trả phòng muộn không phụ thu", img: this.realPreviewImages.daLat }
      ]
    },
    ai: {
      title: "Lịch trình AI Gemini Tự động Lập",
      subtitle: "Tối ưu hóa phát thải CO2 bằng thuật toán AI",
      days: [
        { label: "Ngày 1", title: "Lộ trình tối ưu phát thải AI", desc: "Đặt xe điện đưa đón và chọn homestay tiết kiệm năng lượng", img: this.realPreviewImages.baNa },
        { label: "Ngày 2", title: "Ẩm thực sinh thái cùng Gemini", desc: "Gợi ý các quán ăn chay thực dưỡng và đi bộ ngắm phố", img: this.realPreviewImages.hoiAn },
        { label: "Ngày 3", title: "Cắm trại không rác thải", desc: "Trải nghiệm cắm trại không rác thải nhựa đồi thông", img: this.realPreviewImages.daLat },
        { label: "Ngày 4", title: "Tham quan xanh bằng xe điện", desc: "Thuê xe máy điện dạo quanh thành phố, giảm thiểu ô nhiễm", img: this.realPreviewImages.baNa },
        { label: "Ngày 5", title: "Bù đắp lượng phát thải", desc: "Tính tổng phát thải và quy đổi thành cây xanh quyên góp", img: this.realPreviewImages.tuyenLam }
      ]
    }
  };

  public get currentPreview() {
    return this.highlightPreviews[this.activeHighlight] || this.highlightPreviews['eco'];
  }

  public get walletFullName(): string {
    return this.authService.getCurrentUser()?.fullname?.trim() || 'Khách GreenSteps';
  }

  public get walletGreetingName(): string {
    return this.walletFullName.split(/\s+/)[0] || 'Khách';
  }

  public get walletInitials(): string {
    const parts = this.walletFullName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'GS';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  public selectHighlight(section: 'eco' | 'guides' | 'dates' | 'ai') {
    this.clearStoryWheelGesture();
    this.setStoryHighlight(section);
    if (window.innerWidth > 1100) this.moveStoryToStep((['eco', 'guides', 'dates', 'ai'] as const).indexOf(section));
    this.scrollPreviewIntoViewOnMobile();
  }

  private updateStoryFromScroll(root: HTMLElement): void {
    if (window.innerWidth <= 1100) return;
    if (this.programmaticStoryTarget === null) return;
    const section = root.querySelector<HTMLElement>('.gs-itinerary');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const navbarHeight = this.getStoryNavbarHeight();
    const stickyHeight = Math.max(1, window.innerHeight - navbarHeight);
    const start = rect.top + window.scrollY - navbarHeight;
    const scrollRange = Math.max(1, section.offsetHeight - stickyHeight);
    const end = start + scrollRange;
    if (window.scrollY < start || window.scrollY > end) return;
    const progress = Math.max(0, Math.min(.999, (window.scrollY - start) / scrollRange));
    const stepIndex = Math.floor(progress * 4);
    if (stepIndex === this.programmaticStoryTarget) this.clearProgrammaticStoryTarget();
  }

  private setStoryHighlight(section: 'eco' | 'guides' | 'dates' | 'ai'): void {
    if (this.activeHighlight !== section) {
      this.activeHighlight = section;
      this.crossfadeStoryPreviewImage(this.highlightPreviews[section]?.days[0]?.img);
      this.isStoryTransitioning = true;
      this.storyWheelAnimationLocked = true;
      this.changeDetectorRef.detectChanges();
    }
    const step = (['eco', 'guides', 'dates', 'ai'] as const).indexOf(section);
    this.setStoryIndicator(section);
  }

  public onStoryCardAnimationEnd(event: AnimationEvent): void {
    // Angular scopes keyframe names in component CSS, so the browser reports a
    // prefixed name such as `_ngcontent-..._gs-story-card-switch`.
    if (event.target !== event.currentTarget || !event.animationName.endsWith('gs-story-card-switch')) return;
    this.isStoryTransitioning = false;
    this.storyWheelAnimationLocked = false;
    this.changeDetectorRef.detectChanges();
  }

  private getStoryNavbarHeight(): number {
    const header = document.querySelector<HTMLElement>('#app-header .editor-header');
    return header?.getBoundingClientRect().height || 70;
  }

  private moveStoryToStep(index: number): void {
    const story = this.elementRef.nativeElement.querySelector<HTMLElement>('.gs-itinerary');
    if (!story || window.innerWidth <= 1100) return;

    const steps: Array<'eco' | 'guides' | 'dates' | 'ai'> = ['eco', 'guides', 'dates', 'ai'];
    const targetStep = Math.max(0, Math.min(steps.length - 1, index));
    const navbarHeight = this.getStoryNavbarHeight();
    const stickyHeight = Math.max(1, window.innerHeight - navbarHeight);
    const storyTop = story.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, story.offsetHeight - stickyHeight);
    const fraction = targetStep === 0 ? .08 : (targetStep + .5) / steps.length;

    this.programmaticStoryTarget = targetStep;
    if (this.storyProgrammaticTimer) clearTimeout(this.storyProgrammaticTimer);
    this.storyProgrammaticTimer = setTimeout(() => this.clearProgrammaticStoryTarget(), 1200);
    this.setStoryHighlight(steps[targetStep]);
    const targetY = storyTop - navbarHeight + scrollRange * fraction;
    if (this.storyScrollFrame) window.cancelAnimationFrame(this.storyScrollFrame);
    this.storyScrollFrame = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo({ top: targetY, behavior: 'auto' });
      return;
    }

    const startY = window.scrollY;
    const distance = targetY - startY;
    const startedAt = performance.now();
    const duration = 360;
    const animateScroll = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) this.storyScrollFrame = window.requestAnimationFrame(animateScroll);
      else this.storyScrollFrame = 0;
    };
    this.storyScrollFrame = window.requestAnimationFrame(animateScroll);
  }

  private clearProgrammaticStoryTarget(): void {
    this.programmaticStoryTarget = null;
    if (this.storyProgrammaticTimer) clearTimeout(this.storyProgrammaticTimer);
    this.storyProgrammaticTimer = undefined;
  }

  private beginStoryWheelGesture(event: WheelEvent): void {
    this.storyWheelGestureActive = true;
    this.recordStoryWheelEvent(event);
  }

  private recordStoryWheelEvent(event: WheelEvent): void {
    const now = performance.now();
    const modeQuiet = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 220 : event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 170 : 130;
    const interval = this.storyWheelLastAt ? now - this.storyWheelLastAt : 0;
    this.storyWheelQuietMs = Math.min(300, Math.max(modeQuiet, interval * 1.8));
    this.storyWheelLastAt = now;
    if (!this.storyWheelMonitorFrame) this.storyWheelMonitorFrame = window.requestAnimationFrame(this.monitorStoryWheelGesture);
  }

  private readonly monitorStoryWheelGesture = (): void => {
    this.storyWheelMonitorFrame = 0;
    if (!this.storyWheelGestureActive) return;
    if (performance.now() - this.storyWheelLastAt >= this.storyWheelQuietMs) {
      this.storyWheelGestureActive = false;
      this.storyWheelLastAt = 0;
      return;
    }
    this.storyWheelMonitorFrame = window.requestAnimationFrame(this.monitorStoryWheelGesture);
  };

  private clearStoryWheelGesture(): void {
    this.storyWheelGestureActive = false;
    this.storyWheelLastAt = 0;
    if (this.storyWheelMonitorFrame) window.cancelAnimationFrame(this.storyWheelMonitorFrame);
    this.storyWheelMonitorFrame = 0;
  }

  private setStoryIndicator(section: 'eco' | 'guides' | 'dates' | 'ai'): void {
    const list = this.elementRef.nativeElement.querySelector<HTMLElement>('.gs-highlight-list');
    const button = list?.querySelector<HTMLElement>(`[data-story-step="${section}"]`);
    if (!list || !button) return;
    // The indicator is positioned relative to the list, so use the button's
    // offset within that list directly. Subtracting list.offsetTop shifted it
    // upward by the list's page offset and detached the bar from the tabs.
    list.style.setProperty('--story-indicator-y', `${button.offsetTop}px`);
    list.style.setProperty('--story-indicator-height', `${button.offsetHeight}px`);
  }

  private crossfadeStoryPreviewImage(source?: string): void {
    if (!source || source === this.storyPreviewImage) return;

    const request = ++this.previewImageRequest;
    const image = new Image();
    let committed = false;
    const showImage = () => {
      if (committed || request !== this.previewImageRequest) return;
      committed = true;
      this.ngZone.run(() => {
        if (this.previewImageTimer) clearTimeout(this.previewImageTimer);
        this.previousStoryPreviewImage = this.storyPreviewImage;
        this.storyPreviewImage = source;
        this.isStoryPreviewImageVisible = false;
        this.changeDetectorRef.detectChanges();
        window.requestAnimationFrame(() => this.ngZone.run(() => {
          if (request !== this.previewImageRequest) return;
          this.isStoryPreviewImageVisible = true;
          this.changeDetectorRef.detectChanges();
          this.previewImageTimer = setTimeout(() => this.ngZone.run(() => {
            if (request !== this.previewImageRequest) return;
            this.previousStoryPreviewImage = null;
            this.changeDetectorRef.detectChanges();
          }), 390);
        }));
      });
    };

    image.onload = showImage;
    image.onerror = showImage;
    image.src = source;
    if (image.complete) void image.decode().then(showImage).catch(showImage);
  }

  public selectAiSuggestion(prompt: string): void {
    this.aiPlannerDest = prompt;
    document.getElementById('aiDestination')?.focus();
  }

  public get aiPlannerDayTabs(): number[] {
    const count = Math.max(1, this.aiSuggestedDays.length || this.aiPlannerDuration);
    return Array.from({ length: Math.min(count, 7) }, (_, index) => index);
  }

  public get aiPlannerActivitiesForSelectedDay(): any[] {
    return this.aiSuggestedActivities.filter(activity => activity.dayIndex === this.aiPlannerActiveDay);
  }

  public get hasAiMapStops(): boolean {
    return this.aiPlannerActivitiesForSelectedDay.some(activity => Number.isFinite(activity.lat) && Number.isFinite(activity.lng));
  }

  public selectAiDay(day: number): void {
    if (day < 0 || day >= this.aiPlannerDayTabs.length) return;
    this.aiPlannerActiveDay = day;
    const first = this.aiPlannerActivitiesForSelectedDay[0];
    if (first) this.activeAiActivityIndex = first.index;
    this.updateAiPlannerMap();
  }

  public selectAiActivity(index: number): void {
    const activity = this.aiSuggestedActivities[index];
    if (!activity) return;
    this.activeAiActivityIndex = index;
    if (Number.isFinite(activity.lat) && Number.isFinite(activity.lng) && this.aiPlannerMap) {
      this.aiPlannerMap.flyTo([activity.lat, activity.lng], Math.max(this.aiPlannerMap.getZoom(), 14), { duration: .55 });
    }
  }

  public zoomAiMap(direction: 1 | -1): void {
    if (!this.aiPlannerMap) return;
    direction > 0 ? this.aiPlannerMap.zoomIn() : this.aiPlannerMap.zoomOut();
  }

  private initAiPlannerMap(): void {
    const container = this.elementRef.nativeElement.querySelector<HTMLElement>('#aiPlannerMap');
    if (!container || this.aiPlannerMap || typeof L === 'undefined') return;
    try {
      this.aiPlannerMap = L.map(container, { zoomControl: false, scrollWheelZoom: false }).setView([16.0544, 108.2022], 12);
      const tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });
      tileLayer.on('tileload', () => {
        if (this.aiPlannerMapTilesReady) return;
        this.ngZone.run(() => {
          this.aiPlannerMapTilesReady = true;
          this.changeDetectorRef.detectChanges();
        });
      });
      tileLayer.addTo(this.aiPlannerMap);
      this.updateAiPlannerMap();
      requestAnimationFrame(() => this.aiPlannerMap?.invalidateSize());
    } catch (error) {
      console.warn('AI Planner map could not be initialized:', error);
    }
  }

  private updateAiPlannerMap(): void {
    if (!this.aiPlannerMap) return;
    this.aiPlannerMarkers.forEach(({ marker }) => this.aiPlannerMap.removeLayer(marker));
    this.aiPlannerMarkers = [];
    const stops = this.aiPlannerActivitiesForSelectedDay.filter(activity => Number.isFinite(activity.lat) && Number.isFinite(activity.lng));
    stops.forEach(activity => {
      const icon = L.divIcon({
        className: '',
        html: `<span class="gs-ai-map-marker${activity.index === this.activeAiActivityIndex ? ' is-active' : ''}"><span>${activity.stopNumber}</span></span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 27]
      });
      const marker = L.marker([activity.lat, activity.lng], { icon, title: activity.title, alt: activity.title, keyboard: true }).addTo(this.aiPlannerMap);
      marker.bindPopup(`<strong>${activity.title}</strong><br>${activity.time || ''}`);
      marker.on('click', () => this.ngZone.run(() => {
        this.activeAiActivityIndex = activity.index;
        this.changeDetectorRef.detectChanges();
      }));
      this.aiPlannerMarkers.push({ index: activity.index, marker });
    });
    if (stops.length > 1) {
      this.aiPlannerMap.fitBounds(L.latLngBounds(stops.map(activity => [activity.lat, activity.lng])), { padding: [34, 34], maxZoom: 14 });
    } else if (stops.length === 1) {
      this.aiPlannerMap.setView([stops[0].lat, stops[0].lng], 14);
    } else {
      const destination = this.aiPlannerMapDestination.toLowerCase();
      const center = destination.includes('đà lạt') ? [11.9404, 108.4373]
        : destination.includes('phú yên') ? [13.0882, 109.3025]
        : [16.0544, 108.2022];
      this.aiPlannerMap.setView(center, 12);
    }
  }

  public selectReview(index: number): void {
    const count = this.reviewMemories.length;
    this.activeReviewIndex = (index + count) % count;
  }

  private scrollPreviewIntoViewOnMobile(): void {
    if (typeof window === 'undefined' || window.innerWidth > 767) return;

    window.setTimeout(() => {
      const preview = document.getElementById('itinerary-preview');
      if (!preview) return;

      const headerOffset = 76;
      const top = preview.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 0);
  }

  public updatePreviewFromDatabase() {
    if (!this.realTours || this.realTours.length === 0) return;

    // 1. Find Eco tour (Phú Yên)
    const ecoTour = this.realTours.find(t => t.title.toLowerCase().includes('phú yên') || t.title.toLowerCase().includes('biển') || t.title.toLowerCase().includes('sinh thái')) || this.realTours[0];
    
    // 2. Find Culture/Guides tour (Đà Nẵng - Hội An)
    const guidesTour = this.realTours.find(t => t.title.toLowerCase().includes('đà nẵng') || t.title.toLowerCase().includes('hội an') || t.title.toLowerCase().includes('văn hóa')) || this.realTours[1] || this.realTours[0];

    // 3. Find Dates/Family tour (Đà Lạt Gia Đình)
    const datesTour = this.realTours.find(t => t.title.toLowerCase().includes('gia đình') || t.title.toLowerCase().includes('đà lạt')) || this.realTours[2] || this.realTours[0];

    // 4. Find AI tour (Trekking Rừng Thông Đồi Sương)
    const aiTour = this.realTours.find(t => t.title.toLowerCase().includes('đồi sương') || t.title.toLowerCase().includes('trekking')) || this.realTours[3] || this.realTours[0];

    const tourMapping = {
      eco: ecoTour,
      guides: guidesTour,
      dates: datesTour,
      ai: aiTour
    };

    Object.keys(tourMapping).forEach(key => {
      const t = tourMapping[key as 'eco' | 'guides' | 'dates' | 'ai'];
      if (!t) return;

      const days = (t.data || []).map((dayActs, dIdx) => {
        const mainAct = dayActs[0] || { name: 'Hoạt động tự do', time: '08:00' };
        
        let img = this.realPreviewImages.daNang;
        if (t.image) {
          img = t.image;
        }
        
        const actName = mainAct.name || '';
        const dest = t.destination || '';
        
        const actNameLower = actName.toLowerCase();
        if (actNameLower.includes('hòn yến') || actNameLower.includes('hon yen')) {
          img = this.realPreviewImages.honYen;
        } else if (actNameLower.includes('nhất tự sơn') || actNameLower.includes('nhat tu son')) {
          img = this.realPreviewImages.nhatTuSon;
        } else if (actNameLower.includes('đầm ô loan') || actNameLower.includes('dam o loan') || actNameLower.includes('ô loan')) {
          img = this.realPreviewImages.damOLoan;
        } else if (actNameLower.includes('gành đá đĩa') || actNameLower.includes('ganh da dia')) {
          img = this.realPreviewImages.ganhDaDia;
        } else if (actNameLower.includes('mũi điện') || actNameLower.includes('mui dien') || actNameLower.includes('bãi môn')) {
          img = this.realPreviewImages.muiDien;
        } else if (actNameLower.includes('bãi xép') || actNameLower.includes('bai xep') || actNameLower.includes('ghềnh ông')) {
          img = this.realPreviewImages.baiXep;
        } else if (actNameLower.includes('đà nẵng') || actNameLower.includes('sân bay') || dest.includes('Đà Nẵng')) {
          img = this.realPreviewImages.daNang;
        } else if (actNameLower.includes('hội an') || actNameLower.includes('đèn lồng')) {
          img = this.realPreviewImages.hoiAn;
        } else if (actNameLower.includes('ngũ hành sơn') || actNameLower.includes('chùa')) {
          img = this.realPreviewImages.nguHanhSon;
        } else if (actNameLower.includes('bà nà') || actNameLower.includes('cáp treo')) {
          img = this.realPreviewImages.baNa;
        } else if (dest.includes('Phú Yên')) {
          img = this.realPreviewImages.phuYen;
        } else if (dest.includes('Đà Lạt')) {
          img = this.realPreviewImages.daLat;
        }

        return {
          label: `Ngày ${dIdx + 1}`,
          title: mainAct.name,
          desc: `${mainAct.time} - Khám phá chặng xanh`,
          img: img
        };
      });

      this.highlightPreviews[key] = {
        title: t.title,
        subtitle: t.destination || 'Trải nghiệm du lịch sinh thái cùng GreenSteps',
        days: days.slice(0, 5) // Limit to max 5 days for preview display
      };
    });
    this.crossfadeStoryPreviewImage(this.currentPreview.days[0]?.img);
  }

  // Itinerary Invite properties
  public inviteItineraryId: string | null = null;
  public inviteSenderName: string | null = null;
  public showInviteConfirmPopup: boolean = false;
  public inviteNotificationMessage: string | null = null;
  public showInviteNotification: boolean = false;
  public inviteNotificationType: 'success' | 'error' | 'info' = 'success';

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private loginModalService: LoginModalService,
    private ngZone: NgZone,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      this.elementRef.nativeElement.classList.add('gs-motion-ready');
    }
  }

  ngAfterViewInit() {
    const root = this.elementRef.nativeElement;
    requestAnimationFrame(() => this.initAiPlannerMap());
    const story = root.querySelector<HTMLElement>('.gs-itinerary');
    story?.style.setProperty('--gs-story-navbar', `${this.getStoryNavbarHeight()}px`);
    window.addEventListener('wheel', this.onStoryWheel, { passive: false });
    this.setStoryIndicator(this.activeHighlight);
    window.addEventListener('scroll', this.onScrollForParallax, { passive: true });
    this.onScrollForParallax();
    const revealTargets = root.querySelectorAll<HTMLElement>('[data-reveal]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      revealTargets.forEach(element => element.classList.add('is-visible'));
      return;
    }

    this.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        this.revealTarget(entry.target as HTMLElement);
      });
    }, { threshold: 0.02, rootMargin: '0px' });
    revealTargets.forEach(element => this.revealObserver?.observe(element));

  }

  private revealTarget(target: HTMLElement): void {
    target.classList.add('is-visible');
    const count = target.querySelector<HTMLElement>('[data-count-up]');
    if (count && count.dataset['counted'] !== 'true') {
      count.dataset['counted'] = 'true';
      this.animateCount(count);
    }
    this.revealObserver?.unobserve(target);
  }

  ngOnDestroy() {
    this.revealObserver?.disconnect();
    this.aiPlannerMap?.remove();
    this.aiPlannerMap = null;
    window.removeEventListener('scroll', this.onScrollForParallax);
    window.removeEventListener('wheel', this.onStoryWheel);
    if (this.storyProgrammaticTimer) clearTimeout(this.storyProgrammaticTimer);
    if (this.previewImageTimer) clearTimeout(this.previewImageTimer);
    if (this.storyWheelMonitorFrame) window.cancelAnimationFrame(this.storyWheelMonitorFrame);
    if (this.storyScrollFrame) window.cancelAnimationFrame(this.storyScrollFrame);
    if (this.destinationTransitionTimer) clearTimeout(this.destinationTransitionTimer);
    if (this.destinationClickSuppressionTimer) clearTimeout(this.destinationClickSuppressionTimer);
    if (this.parallaxFrame) window.cancelAnimationFrame(this.parallaxFrame);
    this.countFrames.forEach(frame => window.cancelAnimationFrame(frame));
    this.countFrames.clear();
  }

  @HostListener('window:resize')
  syncStoryNavbarHeight(): void {
    this.elementRef.nativeElement.querySelector<HTMLElement>('.gs-itinerary')?.style.setProperty('--gs-story-navbar', `${this.getStoryNavbarHeight()}px`);
    if (this.aiPlannerMap) requestAnimationFrame(() => this.aiPlannerMap?.invalidateSize());
    this.setStoryIndicator(this.activeHighlight);
  }

  private animateCount(element: HTMLElement) {
    const target = Number(element.dataset['countUp']);
    if (!Number.isFinite(target) || target <= 0) return;
    const compact = element.dataset['countFormat'] === 'compact';
    const startedAt = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      this.countFrames.delete(frameId);
      const progress = Math.min(1, (now - startedAt) / 950);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      element.textContent = compact ? `${Math.round(value / 1000)}K` : value.toLocaleString('vi-VN');
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        this.countFrames.add(frameId);
      }
    };
    frameId = window.requestAnimationFrame(tick);
    this.countFrames.add(frameId);
  }

  public showInviteNotificationBanner(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.inviteNotificationMessage = message;
    this.inviteNotificationType = type;
    this.showInviteNotification = true;
    setTimeout(() => {
      this.showInviteNotification = false;
    }, 6000);
  }

  public async acceptInvite() {
    if (!this.inviteItineraryId) return;
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showInviteNotificationBanner('Vui lòng đăng nhập để chấp nhận lời mời!', 'error');
      this.loginModalService.open();
      return;
    }

    try {
      const res = await this.apiService.joinItinerary(this.inviteItineraryId, user.id || user._id || '');
      if (res && res.success) {
        this.showInviteConfirmPopup = false;
        this.showInviteNotificationBanner('Chấp nhận lời mời tham gia lịch trình thành công! Đang chuyển hướng...', 'success');
        
        this.router.navigate([], {
          queryParams: { inviteItineraryId: null, senderName: null },
          queryParamsHandling: 'merge'
        });

        setTimeout(() => {
          this.router.navigate(['/schedule', this.inviteItineraryId]);
        }, 1500);
      } else {
        this.showInviteNotificationBanner(res.message || 'Chấp nhận lời mời thất bại!', 'error');
      }
    } catch (e) {
      this.showInviteNotificationBanner('Đã xảy ra lỗi khi tham gia lịch trình.', 'error');
    }
  }

  public rejectInvite() {
    this.showInviteConfirmPopup = false;
    this.showInviteNotificationBanner('Bạn đã từ chối lời mời tham gia lịch trình.', 'info');
    
    this.router.navigate([], {
      queryParams: { inviteItineraryId: null, senderName: null },
      queryParamsHandling: 'merge'
    });
  }

  async ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      const inviteId = params['inviteItineraryId'];
      const senderName = params['senderName'];
      if (inviteId) {
        this.inviteItineraryId = inviteId;
        this.inviteSenderName = senderName || 'Một người bạn';

        const user = this.authService.getCurrentUser();
        if (!user) {
          this.showInviteNotificationBanner('Vui lòng đăng nhập hoặc đăng ký tài khoản để xác nhận lời mời đồng hành du lịch.', 'info');
          this.loginModalService.open();
        } else {
          this.showInviteConfirmPopup = true;
        }
      }
    });
    try {
      const dbDests = await this.apiService.getDestinations();
      if (dbDests && dbDests.length > 0) {
        this.destinationCards = dbDests.map(dest => {
          let label = dest;
          let subtitle = 'Điểm đến du lịch xanh thân thiện';
          let image = this.realPreviewImages.daNang;
          if (dest === 'Đà Lạt') {
            label = 'Đà Lạt';
            subtitle = 'Thành phố ngàn hoa';
            image = this.realPreviewImages.daLat;
          } else if (dest === 'Phú Yên') {
            label = 'Phú Yên';
            subtitle = 'Bờ biển hoang sơ, kỳ nghỉ bình yên';
            image = this.realPreviewImages.phuYen;
          } else if (dest === 'Đà Nẵng - Hội An') {
            label = 'Đà Nẵng - Hội An';
            subtitle = 'Di sản, biển xanh và văn hóa sống động';
            image = this.realPreviewImages.daNang;
          }
          return {
            dest: dest,
            label: label,
            title: dest,
            subtitle: subtitle,
            image: image
          };
        });
        if (this.destinationCards.length > 0) {
          this.searchDest = this.destinationCards[0].dest;
          this.activeDestinationIndex = 0;
        }
      }
      
      // Load real tours and build previews
      this.realTours = await this.apiService.getPresetTours() || [];
      this.updatePreviewFromDatabase();
      this.generateAiItinerary();
    } catch (e) {
      console.warn('Failed to load dynamic destinations:', e);
    }
  }

  public setSearchDest(dest: string) {
    this.searchDest = dest;
    this.isDestinationSuggestionsOpen = false;
  }

  public get destinationSuggestions(): string[] {
    const choices = Array.from(new Set([
      'Đà Lạt', 'Đà Nẵng - Hội An', 'Phú Yên', 'Hội An', 'Đà Nẵng',
      ...this.destinationCards.map(card => String(card.label || card.dest || '').trim())
    ].filter(Boolean)));
    const query = this.searchDest.trim().toLocaleLowerCase('vi');
    if (!query || choices.some(choice => choice.toLocaleLowerCase('vi') === query)) return choices.slice(0, 6);
    return choices.filter(choice => choice.toLocaleLowerCase('vi').includes(query)).slice(0, 6);
  }

  public onDestinationFocusOut(event: FocusEvent) {
    const container = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !container.contains(nextTarget)) {
      this.isDestinationSuggestionsOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  public closeDestinationSuggestionsOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.gs-trip-field--destination')) {
      this.isDestinationSuggestionsOpen = false;
    }
  }

  public onStartDateChange() {
    if (this.endDate < this.startDate) this.endDate = this.startDate;
  }

  private formatDateOffset(offsetDays: number): string {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  public async generateAiItinerary(shouldRedirect = false) {
    if (!this.realTours || this.realTours.length === 0) return;
    
    this.isAiLoading = true;
    const searchKey = (this.aiPlannerDest || '').trim();
    
    let destination = 'Đà Nẵng';
    if (searchKey.toLowerCase().includes('đà lạt')) {
      destination = 'Đà Lạt';
    } else if (searchKey.toLowerCase().includes('phú yên')) {
      destination = 'Phú Yên';
    } else if (searchKey.toLowerCase().includes('đà nẵng') || searchKey.toLowerCase().includes('hội an')) {
      destination = 'Đà Nẵng';
    }

    const matchedTour = this.realTours.find(t =>
      t.title.toLowerCase().includes(searchKey.toLowerCase()) ||
      t.destination.toLowerCase().includes(destination.toLowerCase())
    ) || this.realTours[0];
    if (matchedTour) {
      this.aiPlannerMapDestination = matchedTour.destination || destination;
      const destinationKey = this.aiPlannerMapDestination.toLowerCase();
      const fallbackImage = matchedTour.image || (destinationKey.includes('đà lạt')
        ? this.realPreviewImages.daLat
        : destinationKey.includes('phú yên') ? this.realPreviewImages.phuYen : this.realPreviewImages.daNang);
      let stopNumber = 0;
      this.aiSuggestedActivities = (matchedTour.data || []).flatMap((dayActs: any[], dayIndex: number) =>
        (dayActs || []).map((activity: any) => ({
          index: stopNumber++,
          stopNumber,
          dayIndex,
          time: activity.time || '',
          title: activity.name || 'Điểm dừng trong lịch trình',
          desc: activity.description || 'Điểm dừng trong hành trình được tuyển chọn.',
          img: fallbackImage,
          lat: typeof activity.lat === 'number' && Number.isFinite(activity.lat) ? activity.lat : null,
          lng: typeof activity.lng === 'number' && Number.isFinite(activity.lng) ? activity.lng : null
        }))
      );
      this.aiPlannerActiveDay = 0;
      this.activeAiActivityIndex = this.aiSuggestedActivities[0]?.index ?? 0;
      this.updateAiPlannerMap();
    }

    try {
      // 1. Fetch live response from backend Gemini AI model
      const prompt = `${searchKey}; thời lượng ${this.aiPlannerDuration} ngày; ${this.aiPlannerTravelers} người`;
      const res = await this.apiService.sendAiMessage(prompt, destination, []);
      if (res && res.success) {
        this.aiAssistantMessage = res.reply;
      }
    } catch (e) {
      console.warn('Failed to fetch live AI chat response:', e);
      this.aiAssistantMessage = 'AI hiện chưa kết nối được. Bên dưới là gợi ý tham khảo từ tour có sẵn trên GreenSteps.';
    }
    
    // 2. Fetch and map the matching database preset tour
    if (matchedTour) {
      this.aiSuggestedTitle = `Lịch trình gợi ý: ${matchedTour.title}`;
      this.aiSuggestedDays = (matchedTour.data || []).map((dayActs, dIdx) => {
        const mainAct = dayActs[0] || { name: 'Khám phá tự do', time: '08:00', description: 'Trải nghiệm du lịch sinh thái cùng GreenSteps.' };
        
        let img = this.realPreviewImages.daNang;
        const actName = (mainAct.name || '').toLowerCase();
        const destName = (matchedTour.destination || '').toLowerCase();
        
        if (actName.includes('hòn yến')) {
          img = this.realPreviewImages.honYen;
        } else if (actName.includes('nhất tự sơn')) {
          img = this.realPreviewImages.nhatTuSon;
        } else if (actName.includes('đầm ô loan') || actName.includes('ô loan')) {
          img = this.realPreviewImages.damOLoan;
        } else if (actName.includes('gành đá đĩa')) {
          img = this.realPreviewImages.ganhDaDia;
        } else if (actName.includes('mũi điện') || actName.includes('bãi môn')) {
          img = this.realPreviewImages.muiDien;
        } else if (actName.includes('bãi xép') || actName.includes('ghềnh ông')) {
          img = this.realPreviewImages.baiXep;
        } else if (actName.includes('hội an') || actName.includes('đèn lồng')) {
          img = this.realPreviewImages.hoiAn;
        } else if (actName.includes('bà nà') || actName.includes('cáp treo') || actName.includes('cầu vàng')) {
          img = this.realPreviewImages.baNa; // Golden Bridge
        } else if (actName.includes('đà nẵng')) {
          img = this.realPreviewImages.daNang;
        } else if (destName.includes('đà nẵng')) {
          const daNangImages = [
            this.realPreviewImages.daNang,
            this.realPreviewImages.hoiAn,
            this.realPreviewImages.baNa
          ];
          img = daNangImages[dIdx % daNangImages.length];
        } else if (destName.includes('phú yên')) {
          img = this.realPreviewImages.phuYen;
        } else if (destName.includes('đà lạt') || actName.includes('đồi sương') || actName.includes('cắm trại')) {
          img = this.realPreviewImages.daLat;
        } else if (matchedTour.image) {
          img = matchedTour.image;
        }
        
        return {
          day: `Ngày ${dIdx + 1}`,
          title: mainAct.name,
          desc: (mainAct as any).description || 'Khám phá các điểm checkin sinh thái và dịch vụ xanh bảo vệ môi trường.',
          img: img
        };
      });
      this.aiPlannerActiveDay = Math.min(this.aiPlannerActiveDay, this.aiPlannerDayTabs.length - 1);
      this.updateAiPlannerMap();

      // 3. If redirect is requested, create the itinerary and navigate to schedule editor page
      if (shouldRedirect) {
        const userJson = localStorage.getItem('currentUser');
        const user = userJson ? JSON.parse(userJson) : null;
        const userId = user ? (user.id || user._id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d') : '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d';

        // Deep copy activities
        const daysData = JSON.parse(JSON.stringify(matchedTour.data || []));
        let totalCost = 0;
        let totalCarbon = 0;

        daysData.forEach((day: any[]) => {
          day.forEach((act: any) => {
            totalCost += Number(act.cost || 0);
            totalCarbon += Number(act.carbon || 0);
          });
        });

        const newIti = {
          id: 'iti_' + Date.now(),
          name: `Hành trình AI: ${matchedTour.title}`,
          user_id: userId,
          destination: matchedTour.destination,
          days: matchedTour.days || 3,
          totalCost,
          totalCarbon,
          daysData
        };

        try {
          await this.apiService.saveItinerary(newIti);
          this.router.navigate(['/schedule', newIti.id]);
        } catch (e) {
          console.error('Failed to create itinerary from home page:', e);
        }
      }
    }
    
    this.isAiLoading = false;
  }

  public handleSearchSubmit(event: Event) {
    event.preventDefault();
    sessionStorage.setItem('tours_search_dest', this.searchDest);

    let budgetParam = '6';
    if (this.budget === '1M-2M') budgetParam = '3';
    else if (this.budget === '5M+') budgetParam = '12';

    this.router.navigate(['/tours'], {
      queryParams: {
        dest: this.searchDest,
        budget: budgetParam
      }
    });
  }

  public rotateDestinations(direction: 'prev' | 'next') {
    if (this.isDestinationTransitioning) return;

    const total = this.destinationCards.length;
    this.destinationDirection = direction;
    this.wrappingDestinationIndex = direction === 'next'
      ? (this.activeDestinationIndex - 1 + total) % total
      : (this.activeDestinationIndex + 1) % total;

    this.activeDestinationIndex = direction === 'next'
      ? (this.activeDestinationIndex + 1) % total
      : (this.activeDestinationIndex - 1 + total) % total;

    this.lockDestinationTransition();
  }

  public setActiveDestination(index: number) {
    if (this.isDestinationTransitioning || index === this.activeDestinationIndex) return;

    this.destinationDirection = index > this.activeDestinationIndex ? 'next' : 'prev';
    this.wrappingDestinationIndex = null;
    this.activeDestinationIndex = index;
    this.lockDestinationTransition();
  }

  public onDestinationPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest('.gs-carousel-arrow')) return;
    this.destinationDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
  }

  public onDestinationPointerMove(event: PointerEvent): void {
    const drag = this.destinationDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragging && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      drag.dragging = true;
      const stage = event.currentTarget as HTMLElement;
      if (!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
    }
    if (drag.dragging) event.preventDefault();
  }

  public onDestinationPointerUp(event: PointerEvent): void {
    const drag = this.destinationDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.destinationDrag = null;
    if (!drag.dragging) return;

    const deltaX = event.clientX - drag.startX;
    this.destinationClickSuppressed = true;
    if (this.destinationClickSuppressionTimer) clearTimeout(this.destinationClickSuppressionTimer);
    this.destinationClickSuppressionTimer = setTimeout(() => {
      this.destinationClickSuppressed = false;
      this.destinationClickSuppressionTimer = undefined;
    }, 100);
    if (Math.abs(deltaX) > 42) this.rotateDestinations(deltaX < 0 ? 'next' : 'prev');
  }

  public onDestinationPointerCancel(): void {
    this.destinationDrag = null;
  }

  public onDestinationCardClick(destination: string, event: MouseEvent): void {
    if (this.destinationClickSuppressed) {
      event.preventDefault();
      event.stopPropagation();
      this.destinationClickSuppressed = false;
      if (this.destinationClickSuppressionTimer) clearTimeout(this.destinationClickSuppressionTimer);
      this.destinationClickSuppressionTimer = undefined;
      return;
    }
    this.goToDestination(destination);
  }

  public getDestinationPosition(index: number): DestinationPosition {
    const total = this.destinationCards.length;

    if (index === this.activeDestinationIndex) return 'center';
    if (index === (this.activeDestinationIndex - 1 + total) % total) return 'left';

    return 'right';
  }

  public isDestinationWrapping(index: number): boolean {
    return this.wrappingDestinationIndex === index;
  }

  public goToDestination(dest: string) {
    sessionStorage.setItem('tours_search_dest', dest);
    this.router.navigate(['/tours'], { queryParams: { dest } });
  }

  private lockDestinationTransition() {
    this.isDestinationTransitioning = true;

    if (this.destinationTransitionTimer) {
      clearTimeout(this.destinationTransitionTimer);
    }

    const transitionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520;
    this.destinationTransitionTimer = setTimeout(() => {
      this.isDestinationTransitioning = false;
      this.wrappingDestinationIndex = null;
    }, transitionDuration);
  }
}

export { HomeComponent as Home };
