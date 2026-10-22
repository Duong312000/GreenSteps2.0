import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { Tour } from '../../models/models';

type DestinationPosition = 'left' | 'center' | 'right';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly realPreviewImages = {
    daNang: 'https://i.pinimg.com/736x/f3/34/b3/f334b3d836d0d5fd68f797f7ad3c7021.jpg',
    baNa: 'https://i.pinimg.com/736x/3d/a1/1f/3da11f5f8766b7c71fdce561420950e1.jpg',
    hoiAn: 'https://i.pinimg.com/736x/a6/f9/2e/a6f92ed32526a0b16c257a645e4034fc.jpg',
    nguHanhSon: 'https://i.pinimg.com/1200x/51/8a/24/518a24abfd5bf366aaea50f79fc67644.jpg',
    phuYen: 'https://i.pinimg.com/736x/60/9c/ef/609cefb4e490debd1ea140b6e21be7bc.jpg',
    ganhDaDia: 'https://i.pinimg.com/736x/60/9c/ef/609cefb4e490debd1ea140b6e21be7bc.jpg',
    damOLoan: 'https://i.pinimg.com/1200x/c9/81/68/c9816838986e252b85aab71a13f07d8d.jpg',
    muiDien: 'https://i.pinimg.com/1200x/a4/54/5a/a4545a58170747ef18d15a28d465bc13.jpg',
    baiXep: 'https://i.pinimg.com/1200x/9b/43/5f/9b435f463cb84aa6065b3c0c44eec4cc.jpg',
    honYen: 'https://i.pinimg.com/736x/3f/87/0e/3f870eb589c0b29dd95402a8acf8cf25.jpg',
    nhatTuSon: 'https://i.pinimg.com/1200x/e6/58/65/e658653f875121e5aadc54c25a1b397b.jpg',
    daLat: 'https://i.pinimg.com/736x/10/f4/97/10f4970291970e2f773327a6ad723bc0.jpg',
    langbiang: 'https://i.pinimg.com/1200x/69/d6/e5/69d6e56299838d8728a7670ed21edd91.jpg',
    tuyenLam: 'https://i.pinimg.com/1200x/b4/cd/b9/b4cdb9c05718a57d34787052447ca7bf.jpg'
  };

  public searchDest: string = 'Đà Lạt';
  public realTours: Tour[] = [];
  public aiPlannerDest: string = 'Đà Nẵng';
  public aiSuggestedDays: any[] = [];
  public aiSuggestedTitle: string = 'Lịch trình gợi ý';
  public isAiLoading: boolean = false;
  public aiAssistantMessage: string = 'Xin chào! Tôi là GreenSteps AI. Hãy chia sẻ sở thích du lịch để tôi thiết kế hành trình phù hợp dành riêng cho bạn.';
  public startDate: string = '2026-06-14';
  public endDate: string = '2026-06-18';
  public guests: string = '2';
  public budget: string = '2M-5M';
  public activeDestinationIndex = 1;
  public activeReviewIndex = 0;
  public isDestinationTransitioning = false;
  public destinationDirection: 'prev' | 'next' = 'next';
  public wrappingDestinationIndex: number | null = null;
  private destinationTransitionTimer?: ReturnType<typeof setTimeout>;
  public destinationCards: any[] = [
    {
      dest: 'Đà Lạt',
      label: 'Đà Lạt',
      title: 'Đà Lạt',
      subtitle: 'Thành phố ngàn hoa',
      image: 'image/1dc8619487310884c9d631d689ece1e7.jpg'
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
      image: 'image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg'
    }
  ];

  public activeHighlight: 'eco' | 'guides' | 'dates' | 'ai' = 'eco';
  
  public highlightPreviews: { [key: string]: { title: string; subtitle: string; days: { label: string; title: string; desc: string; img: string }[] } } = {
    eco: {
      title: "Chuyến đi 5 ngày Miền Trung Xanh",
      subtitle: "Trải nghiệm lưu trú sinh thái & phục hồi tự nhiên",
      days: [
        { label: "Ngày 1", title: "Đến Đà Nẵng", desc: "Khu nghỉ dưỡng sinh thái tre, bãi biển Mỹ Khê", img: this.realPreviewImages.daNang },
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
        { label: "Ngày 1", title: "Di sản Đà Nẵng", desc: "Đón khách, tour đi bộ phố cổ và bảo tàng Chăm", img: this.realPreviewImages.daNang },
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
        { label: "Ngày 1", title: "Đến nơi & nhận phòng linh hoạt", desc: "Đón sân bay linh hoạt theo giờ bay riêng của khách", img: this.realPreviewImages.daLat },
        { label: "Ngày 2", title: "Chinh phục LangBiang tự chọn", desc: "Tự chọn cung đường đi bộ ngắn/dài tùy thuộc sức khỏe", img: this.realPreviewImages.langbiang },
        { label: "Ngày 3", title: "Khởi hành & trả phòng linh hoạt", desc: "Tự do mua sắm, trả phòng muộn không phụ thu", img: this.realPreviewImages.daLat }
      ]
    },
    ai: {
      title: "Lịch trình AI Gemini Tự động Lập",
      subtitle: "Tối ưu hóa phát thải CO2 bằng thuật toán AI",
      days: [
        { label: "Ngày 1", title: "Lộ trình tối ưu phát thải AI", desc: "Đặt xe điện đưa đón và chọn homestay tiết kiệm năng lượng", img: this.realPreviewImages.daNang },
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
    this.activeHighlight = section;
    this.scrollPreviewIntoViewOnMobile();
  }

  public scrollToReview(index: number, track: HTMLElement): void {
    const cards = Array.from(track.querySelectorAll('article'));
    const card = cards[index] as HTMLElement | undefined;
    if (!card) return;

    this.activeReviewIndex = index;
    track.scrollTo({
      left: card.offsetLeft - track.offsetLeft,
      behavior: 'smooth'
    });
  }

  public onReviewsScroll(track: HTMLElement): void {
    if (typeof window === 'undefined' || window.innerWidth > 767) return;

    const cards = Array.from(track.querySelectorAll('article')) as HTMLElement[];
    if (cards.length === 0) return;

    const center = track.scrollLeft + track.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    this.activeReviewIndex = closestIndex;
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
  }

  // Itinerary Invite properties
  public inviteItineraryId: string | null = null;
  public inviteSenderName: string | null = null;
  public showInviteConfirmPopup: boolean = false;
  public inviteNotificationMessage: string | null = null;
  public showInviteNotification: boolean = false;
  public inviteNotificationType: 'success' | 'error' | 'info' = 'success';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private loginModalService: LoginModalService
  ) {}

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
            image = 'image/1dc8619487310884c9d631d689ece1e7.jpg';
          } else if (dest === 'Phú Yên') {
            label = 'Phú Yên';
            subtitle = 'Bờ biển hoang sơ, kỳ nghỉ bình yên';
            image = 'image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg';
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

    try {
      // 1. Fetch live response from backend Gemini AI model
      const res = await this.apiService.sendAiMessage(searchKey, destination, []);
      if (res && res.success) {
        this.aiAssistantMessage = res.reply;
      }
    } catch (e) {
      console.warn('Failed to fetch live AI chat response:', e);
      this.aiAssistantMessage = `Tôi đã phân tích điểm đến "${destination}" và tìm thấy lịch trình xanh tối ưu cho bạn. Hãy tham khảo chi tiết các ngày trong lịch trình gợi ý bên cạnh nhé!`;
    }
    
    // 2. Fetch and map the matching database preset tour
    const matchedTour = this.realTours.find(t => 
      t.title.toLowerCase().includes(searchKey.toLowerCase()) || 
      t.destination.toLowerCase().includes(destination.toLowerCase())
    ) || this.realTours[0]; // fallback
    
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

    this.destinationTransitionTimer = setTimeout(() => {
      this.isDestinationTransitioning = false;
      this.wrappingDestinationIndex = null;
    }, 920);
  }
}

export { HomeComponent as Home };
