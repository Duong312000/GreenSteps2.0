import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { LoginModalService } from '../../services/login-modal.service';
import { User, WalletTransaction } from '../../models/models';

type ProfileSection = 'overview' | 'personal' | 'security' | 'notifications' | 'wallet' | 'tickets' | 'favorites' | 'promotions' | 'settings' | 'map';

type ProfileSidebarItem = {
  icon: string;
  label: string;
  section?: ProfileSection;
  route?: string;
  action?: 'planner' | 'logout' | 'upcomingTrip';
  badge?: string;
};

type ProfileSidebarGroup = {
  heading: string;
  items: ProfileSidebarItem[];
};

type TravelPreference = {
  label: string;
  icon: string;
  selected?: boolean;
};

type SmartCostSuggestion = {
  label: string;
  saving: string;
};

type TripReminder = {
  icon: string;
  label: string;
};

type PreferenceQuestionType = 'single' | 'multi' | 'text';

type TravelPreferenceQuestion = {
  key: string;
  icon: string;
  title: string;
  hint: string;
  type: PreferenceQuestionType;
  options?: string[];
  placeholder?: string;
};

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.html',
  styleUrls: ['./profile-dashboard.css'],
})
export class ProfileComponent implements OnInit {
  public activeSection: ProfileSection = 'overview';
  public selectedSubSection: string = '';
  public currentUser: User | null = null;
  public profileUser: User = {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d',
    username: 'kienldvk24411',
    fullname: 'kienldvk24411',
    email: 'kienldvk24411@st.uel.edu.vn',
    phone: '',
    dob: '',
    gender: 'Nữ',
    address: '',
    role: 'traveler'
  };

  public walletRegistered = false;
  public walletBalance = 0;
  public depositAmount: number | null = null;
  public transactions: WalletTransaction[] = [];
  public savedItinerariesCount = 0;
  public bookedToursCount = 0;
  public userGreenPoints = 0;
  public userTickets: any[] = [];
  public upcomingTrip: {
    id: string;
    title: string;
    destination: string;
    dates: string;
    guests: number;
    cost: number;
    daysLeftText: string;
    statusText: string;
    image: string;
    type: 'booking' | 'itinerary';
    link: string;
  } | null = null;

  public isQrModalOpen = false;
  public isDepositModalOpen = false;
  public qrCodeUrl = '';
  public qrAmount = 0;
  public qrDescription = '';

  public terminalApprovalState: 'pending' | 'success' | 'error' = 'pending';
  public terminalApprovalTitle = 'Đang Chờ Phê Duyệt';
  public terminalApprovalMsg = '';
  public isTerminalModalOpen = false;

  public isEditing = false;
  public detFullname = '';
  public detPhone = '';
  public detEmail = '';
  public detDob = '';
  public detGender = 'Nữ';
  public detAddress = '';
  public detBio = 'Yêu thích du lịch xanh, trekking, khám phá thiên nhiên và trải nghiệm văn hóa địa phương.';
  public detCompanyName = '';
  public detJobType = 'Doanh nghiệp';
  public travelPreferenceNote = '';
  public currentPreferenceStepIndex = 0;
  public travelPreferenceAnswers: Record<string, string | string[]> = {
    travelStyle: ['Trekking', 'Du lịch thiên nhiên'],
    budget: '3 - 5 triệu',
    companion: 'Đi cùng bạn bè',
    accommodation: ['Homestay', 'Campsite'],
    pace: 'Vừa phải',
    mustHave: ''
  };

  public readonly travelPreferenceQuestions: TravelPreferenceQuestion[] = [
    {
      key: 'travelStyle',
      icon: 'bi-compass',
      title: 'Bạn thích kiểu trải nghiệm nào?',
      hint: 'Chọn một hoặc nhiều phong cách để GreenSteps hiểu gu du lịch của bạn.',
      type: 'multi',
      options: ['Trekking', 'Camping', 'Du lịch thiên nhiên', 'Food tour', 'Nghỉ dưỡng', 'Khám phá văn hóa']
    },
    {
      key: 'budget',
      icon: 'bi-cash-coin',
      title: 'Ngân sách thường dùng cho một chuyến đi?',
      hint: 'Thông tin này giúp gợi ý tour, nơi ở và lịch trình vừa túi tiền hơn.',
      type: 'single',
      options: ['Dưới 3 triệu', '3 - 5 triệu', '5 - 10 triệu', 'Trên 10 triệu']
    },
    {
      key: 'companion',
      icon: 'bi-people',
      title: 'Bạn thường đi cùng ai?',
      hint: 'Mỗi nhóm đi lại cần nhịp độ, phòng ở và hoạt động khác nhau.',
      type: 'single',
      options: ['Đi một mình', 'Đi cùng bạn bè', 'Đi cùng gia đình', 'Đi cùng người yêu', 'Đi theo nhóm công ty']
    },
    {
      key: 'accommodation',
      icon: 'bi-house-heart',
      title: 'Bạn ưu tiên nơi lưu trú nào?',
      hint: 'Có thể chọn nhiều lựa chọn nếu bạn linh hoạt về nơi ở.',
      type: 'multi',
      options: ['Homestay', 'Campsite', 'Resort xanh', 'Khách sạn trung tâm', 'Pet-friendly', 'Gần tuyến trekking']
    },
    {
      key: 'pace',
      icon: 'bi-speedometer2',
      title: 'Nhịp độ chuyến đi bạn muốn?',
      hint: 'GreenSteps sẽ cân bằng giữa nghỉ ngơi, di chuyển và hoạt động.',
      type: 'single',
      options: ['Chậm rãi', 'Vừa phải', 'Nhiều hoạt động', 'Linh hoạt theo thời tiết']
    },
    {
      key: 'mustHave',
      icon: 'bi-pencil-square',
      title: 'Có điều gì bắt buộc phải có?',
      hint: 'Nhập yêu cầu riêng như ăn chay, tránh say xe, cần phòng riêng, thích quán cà phê đẹp...',
      type: 'text',
      placeholder: 'Ví dụ: ưu tiên homestay yên tĩnh, có xe đưa đón, không lịch trình quá dày...'
    }
  ];

  public readonly sidebarGroups: ProfileSidebarGroup[] = [
    {
      heading: 'TỔNG QUAN',
      items: [{ icon: 'bi-house-door', label: 'Tổng quan', section: 'overview' }]
    },
    {
      heading: 'CHUYẾN ĐI CỦA TÔI',
      items: [
        { icon: 'bi-calendar2-week', label: 'Lịch trình của tôi', route: '/schedule' },
        { icon: 'bi-ticket-perforated', label: 'Tour đã đặt', action: 'upcomingTrip' },
        { icon: 'bi-credit-card', label: 'Vé & thanh toán', section: 'tickets' },
        { icon: 'bi-heart', label: 'Địa điểm yêu thích', section: 'favorites' }
      ]
    },
    {
      heading: 'CÔNG CỤ HỮU ÍCH',
      items: [
        { icon: 'bi-stars', label: 'Thiết kế lịch trình AI', action: 'planner' },
        { icon: 'bi-geo-alt', label: 'Bản đồ tương tác', section: 'map' },
        { icon: 'bi-chat-dots', label: 'Chatbot hỗ trợ', badge: 'AI' }
      ]
    },
    {
      heading: 'TÀI KHOẢN',
      items: [
        { icon: 'bi-person', label: 'Thông tin cá nhân', section: 'personal' },
        { icon: 'bi-shield-lock', label: 'Bảo mật tài khoản', section: 'security' },
        { icon: 'bi-bell', label: 'Thông báo', section: 'notifications', badge: '3' },
        { icon: 'bi-wallet2', label: 'Ví GreenSteps', section: 'wallet' },
        { icon: 'bi-gift', label: 'Chương trình ưu đãi', section: 'promotions' },
        { icon: 'bi-gear', label: 'Cài đặt', section: 'settings' },
        { icon: 'bi-box-arrow-right', label: 'Đăng xuất', action: 'logout' }
      ]
    }
  ];

  public readonly dashboardStats = [
    { icon: 'bi-luggage', value: '3', label: 'Lịch trình đã lưu', link: 'Xem tất cả' },
    { icon: 'bi-ticket-perforated', value: '0', label: 'Tour đã đặt', link: 'Xem tất cả' },
    { icon: 'bi-leaf', value: '120', label: 'Điểm xanh', link: 'Chi tiết' },
    { icon: 'bi-cloud', value: '8.5 kg', label: 'CO₂ đã tiết kiệm', link: 'Chi tiết' }
  ];

  public readonly checklistItems = [
    { label: 'Đặt vé & xác nhận lịch trình', done: true },
    { label: 'Chuẩn bị giấy tờ tùy thân', done: true },
    { label: 'Đặt chỗ ở', done: true },
    { label: 'Kiểm tra thời tiết', done: false },
    { label: 'Chuẩn bị hành lý', done: false },
    { label: 'Mua bảo hiểm du lịch', done: false },
    { label: 'Đổi tiền mặt', done: false }
  ];

  public readonly carbonBreakdown = [
    { icon: 'bi-bus-front', label: 'Phương tiện', value: '5.2 kg' },
    { icon: 'bi-house-heart', label: 'Lưu trú', value: '2.1 kg' },
    { icon: 'bi-bicycle', label: 'Hoạt động', value: '1.2 kg' }
  ];

  public readonly greenTravelLevel = {
    title: 'Cấp độ du lịch xanh',
    level: 'Nature Explorer',
    current: 120,
    target: 200,
    nextLevel: 'Eco Adventurer'
  };

  public readonly travelTasteProfile = {
    persona: 'Nature Explorer',
    description: 'Ưa trải nghiệm xanh, trekking và khám phá văn hóa địa phương.',
    match: 72
  };

  public readonly travelPreferences: TravelPreference[] = [
    { icon: 'bi-signpost-split', label: 'Trekking', selected: true },
    { icon: 'bi-tree', label: 'Camping', selected: true },
    { icon: 'bi-leaf', label: 'Ecotourism', selected: true },
    { icon: 'bi-house-heart', label: 'Homestay', selected: true },
    { icon: 'bi-cup-hot', label: 'Food tour' }
  ];

  public readonly carbonTrend = [
    { month: 'Jan', value: 12 },
    { month: 'Feb', value: 10 },
    { month: 'Mar', value: 9.5 },
    { month: 'Apr', value: 11 },
    { month: 'May', value: 8.5 },
    { month: 'Jun', value: 8.5 }
  ];

  public readonly weatherAlert = {
    destination: 'Sapa',
    range: '18-22°C',
    description: 'Có thể có mưa nhẹ vào buổi chiều. Nên mang áo khoác mỏng và giày chống trượt.'
  };

  public readonly smartCostSuggestions: SmartCostSuggestion[] = [
    { label: 'Đổi sang homestay đối tác', saving: '-450.000đ' },
    { label: 'Đi shuttle bus thay vì xe riêng', saving: '-270.000đ' },
    { label: 'Ghép nhóm trekking 4 người', saving: '-100.000đ' }
  ];

  public readonly tripReminders: TripReminder[] = [
    { icon: 'bi-person-vcard', label: 'Chuẩn bị giấy tờ tùy thân' },
    { icon: 'bi-cloud-drizzle', label: 'Kiểm tra thời tiết trước 24h' },
    { icon: 'bi-chat-left-text', label: 'Xác nhận lịch trình với nhóm' }
  ];

  public readonly coverImage = 'image/2eee566424c1f35fbeacf85496b4b6e7.jpg';
  public readonly tripImage = 'image/4302842f8d693c25238f2141964a64b2.jpg';
  public readonly offerImage = 'image/1dc8619487310884c9d631d689ece1e7.jpg';

  public isAvatarModalOpen: boolean = false;
  public selectedAvatarPath: string = '';
  public presetAvatars: string[] = [
    'image/khach-hang/avatar-linh-ngo.jpg',
    'image/khach-hang/avatar-pham-hoang-minh.jpg',
    'image/khach-hang/avatar-vu-an-nhien.jpg'
  ];
  public avatarZoom: number = 1.0;
  public avatarPosX: number = 50;
  public avatarPosY: number = 50;
  public isNotificationModalOpen: boolean = false;
  public notificationModalTitle: string = '';
  public notificationModalMessage: string = '';
  public notificationModalType: 'success' | 'error' | 'info' = 'info';

  public showNotification(title: string, message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.notificationModalTitle = title;
    this.notificationModalMessage = message;
    this.notificationModalType = type;
    this.isNotificationModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeNotificationModal() {
    this.isNotificationModalOpen = false;
    this.cdr.detectChanges();
  }

  public notificationsList: any[] = [];
  public notifFilter: 'all' | 'unread' = 'all';
  public selectedCategory: string = 'all';

  public get filteredNotifications(): any[] {
    let list = this.notificationsList;
    if (this.notifFilter === 'unread') {
      list = list.filter(n => !n.read);
    }
    if (this.selectedCategory !== 'all') {
      list = list.filter(n => {
        if (this.selectedCategory === 'offer') return n.type === 'system' && n.title.toLowerCase().includes('ưu đãi');
        if (this.selectedCategory === 'trip') return n.type === 'system' && !n.title.toLowerCase().includes('ưu đãi');
        if (this.selectedCategory === 'system') return n.type === 'system';
        if (this.selectedCategory === 'community') return n.type === 'community';
        if (this.selectedCategory === 'payment') return n.type === 'wallet' || n.type === 'booking';
        return true;
      });
    }
    return list;
  }

  public get totalNotifCount(): number { return this.notificationsList.length; }
  public get unreadNotifCount(): number { return this.notificationsList.filter(n => !n.read).length; }
  public get readNotifCount(): number { return this.notificationsList.filter(n => n.read).length; }

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private loginModalService: LoginModalService
  ) {}

  ngOnInit() {
    const existingUser = this.authService.getCurrentUser();
    if (existingUser) {
      this.applyProfileUser(existingUser);
      this.loadProfileNotifications();
      this.loadWalletAndTransactions();
      this.authService.refreshProfile().catch(() => {});
    }

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.applyProfileUser(user);
        this.loadWalletAndTransactions();
        this.loadProfileNotifications();
      }
      this.cdr.detectChanges();
    });

    this.route.queryParams.subscribe(params => {
      if (params['section']) {
        const sec = params['section'] as ProfileSection;
        if (['overview', 'personal', 'security', 'notifications', 'wallet', 'tickets', 'favorites', 'promotions', 'settings', 'map'].includes(sec)) {
          this.activeSection = sec;
        }
      }
      if (params['sub'] === 'upcomingTrip') {
        this.scrollToUpcomingTrip();
      }
    });
  }

  public async loadProfileNotifications() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    try {
      const res = await this.apiService.getNotifications(userId);
      this.notificationsList = res;
      this.cdr.detectChanges();
    } catch (e) {
      console.warn('Failed to load profile notifications:', e);
    }
  }

  public async markProfileNotifRead(notif: any) {
    if (notif.read) return;
    const ok = await this.apiService.markNotificationRead(notif.id);
    if (ok) {
      notif.read = true;
      this.cdr.detectChanges();
    }
  }

  public async clearAllProfileNotifications() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    const ok = await this.apiService.clearNotifications(userId);
    if (ok) {
      this.notificationsList = [];
      this.cdr.detectChanges();
    }
  }

  public async markAllProfileNotifRead() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    const ok = await this.apiService.markAllNotificationsRead(userId);
    if (ok) {
      this.notificationsList.forEach(n => n.read = true);
      this.cdr.detectChanges();
    }
  }

  private applyProfileUser(user: User) {
    this.currentUser = user;
    this.profileUser = {
      ...this.profileUser,
      ...user,
      fullname: user.fullname || user.username || this.profileUser.fullname,
      email: user.email || this.profileUser.email,
      role: user.role || this.profileUser.role
    };
    this.detFullname = this.profileUser.fullname;
    this.detPhone = this.profileUser.phone || '';
    this.detEmail = this.profileUser.email;
    this.detDob = this.profileUser.dob || '';
    this.detGender = this.profileUser.gender || 'Nữ';
    this.detAddress = this.profileUser.address || '';
    this.detCompanyName = this.profileUser.company_name || this.profileUser.companyName || '';
    this.detJobType = (this.profileUser as any).job || 'Doanh nghiệp';
    if (this.profileUser.role === 'provider' && (this.profileUser as any).job) {
      this.detBio = (this.profileUser as any).bio || this.detBio;
    }
  }

  private async loadWalletAndTransactions() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    try {
      const wallet = await this.apiService.getWalletInfo(userId);
      this.walletRegistered = wallet.registered;
      this.walletBalance = wallet.balance;
      this.userGreenPoints = wallet.green_points || 0;
    } catch (e) {
      this.walletBalance = 0;
      this.userGreenPoints = 0;
    }

    try {
      this.transactions = await this.apiService.getTransactions(userId);
    } catch (e) {
      this.transactions = [];
    }

    await this.loadUpcomingTripData(userId);
    this.cdr.detectChanges();
  }

  private async loadUpcomingTripData(userId: string) {
    let userBookings: any[] = [];
    let userItineraries: any[] = [];

    try {
      userBookings = await this.apiService.getBookings(undefined, userId);
      const activeBookings = (userBookings || []).filter(b => b.status !== 'rejected' && b.status !== 'cancelled');
      this.bookedToursCount = activeBookings.length;
    } catch (e) {
      this.bookedToursCount = 0;
    }

    try {
      userItineraries = await this.apiService.getItineraries(userId);
      this.savedItinerariesCount = (userItineraries || []).length;
    } catch (e) {
      this.savedItinerariesCount = 0;
    }

    // Filter active bookings
    const validBookings = (userBookings || []).filter(b => b.status !== 'cancelled' && b.status !== 'rejected');
    
    // Map userTickets for Tickets section
    this.userTickets = validBookings.map(b => {
      const bDate = b.booking_date || b.date || '';
      const tourTitle = b.tour_name || b.service || b.title || (b.type === 'tour' ? 'Tour Du Lịch Xanh' : 'Dịch Vụ Sinh Thái');
      let statusText = 'Đang chuẩn bị';
      if (b.status === 'confirmed') statusText = 'Sắp khởi hành';
      else if (b.status === 'deposit') statusText = 'Đã đặt cọc';
      else if (b.status === 'completed') statusText = 'Đã hoàn thành';
      else if (b.status === 'pending') statusText = 'Đang chuẩn bị';

      let tripImg = b.image || b.image_url || this.tripImage;
      if (tripImg && tripImg.startsWith('/images/')) {
        tripImg = 'http://localhost:5055' + tripImg;
      } else if (!tripImg || tripImg === this.tripImage) {
        const dest = (tourTitle + ' ' + (b.destination || '')).toLowerCase();
        if (dest.includes('hội an')) tripImg = 'http://localhost:5055/images/tours/hoian1.jpg';
        else if (dest.includes('phú yên')) tripImg = 'http://localhost:5055/images/tours/phuyen1.jpg';
        else tripImg = 'http://localhost:5055/images/tours/dalat1.jpg';
      }

      return {
        id: b.id || b._id,
        title: tourTitle,
        destination: b.destination || (tourTitle.includes('Đà Lạt') || tourTitle.includes('Tuyền Lâm') ? 'Đà Lạt' : (tourTitle.includes('Hội An') ? 'Hội An' : 'Việt Nam')),
        dates: bDate ? `Khởi hành: ${this.formatDisplayDate(bDate)}` : 'Lịch trình sắp xếp',
        guests: b.guests || 2,
        cost: b.value || 0,
        status: b.status,
        statusText,
        image: tripImg,
        evoucher: b.evoucher || b.evoucher_code || ('GS-' + (b.id || '24411').replace(/\D/g, '').slice(-8))
      };
    });

    if (validBookings.length > 0) {
      // 1. Most recent booking
      const b = validBookings[0];
      const bookingDate = b.booking_date || b.date || '';
      const checkOutDate = b.check_out_date || '';

      let dateDisplay = bookingDate;
      if (bookingDate && checkOutDate) {
        dateDisplay = `${this.formatDisplayDate(bookingDate)} - ${this.formatDisplayDate(checkOutDate)}`;
      } else if (bookingDate) {
        dateDisplay = `Khởi hành: ${this.formatDisplayDate(bookingDate)}`;
      }

      let daysLeftText = 'Sắp khởi hành';
      if (bookingDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const bDate = new Date(bookingDate);
        bDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((bDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          daysLeftText = `Còn ${diffDays} ngày nữa`;
        } else if (diffDays === 0) {
          daysLeftText = 'Khởi hành hôm nay';
        } else {
          daysLeftText = 'Đang diễn ra';
        }
      }

      let statusText = 'Sắp khởi hành';
      if (b.status === 'confirmed') statusText = 'Sắp khởi hành';
      else if (b.status === 'deposit') statusText = 'Đã đặt cọc';
      else if (b.status === 'completed') statusText = 'Đã hoàn thành';
      else statusText = 'Đang chuẩn bị';

      const tourTitle = b.tour_name || b.service || b.title || (b.type === 'tour' ? 'Tour Du Lịch Xanh' : 'Dịch Vụ Sinh Thái');
      const tourDest = b.destination || (tourTitle.includes('Đà Lạt') || tourTitle.includes('Tuyền Lâm') ? 'Đà Lạt' : (tourTitle.includes('Hội An') ? 'Hội An' : 'Việt Nam'));

      let tripImg = b.image || b.image_url || this.tripImage;
      if (tripImg && tripImg.startsWith('/images/')) {
        tripImg = 'http://localhost:5055' + tripImg;
      } else if (!tripImg || tripImg === this.tripImage) {
        const dest = (tourTitle + ' ' + tourDest).toLowerCase();
        if (dest.includes('hội an')) tripImg = 'http://localhost:5055/images/tours/hoian1.jpg';
        else if (dest.includes('phú yên')) tripImg = 'http://localhost:5055/images/tours/phuyen1.jpg';
        else tripImg = 'http://localhost:5055/images/tours/dalat1.jpg';
      }

      this.upcomingTrip = {
        id: b.id || b._id,
        title: tourTitle,
        destination: tourDest,
        dates: dateDisplay || 'Lịch trình sắp xếp',
        guests: b.guests || 2,
        cost: b.value || 0,
        daysLeftText,
        statusText,
        image: tripImg,
        type: 'booking',
        link: '/profile'
      };
    } else if (userItineraries.length > 0) {
      // 2. Custom itinerary
      const iti = userItineraries[0];
      let dateDisplay = iti.start_date
        ? `${this.formatDisplayDate(iti.start_date)} - ${this.formatDisplayDate(iti.end_date)}`
        : `${iti.days || 1} ngày trải nghiệm`;

      let tripImg = iti.imageUrl;
      if (!tripImg) {
        const dest = (iti.destination || '').toLowerCase();
        if (dest.includes('hội an') || dest.includes('hoi an')) tripImg = 'http://localhost:5055/images/tours/hoian1.jpg';
        else if (dest.includes('phú yên') || dest.includes('phu yen')) tripImg = 'http://localhost:5055/images/tours/phuyen1.jpg';
        else tripImg = 'http://localhost:5055/images/tours/dalat1.jpg';
      }

      this.upcomingTrip = {
        id: iti.id || iti._id,
        title: iti.name || `Lịch trình sinh thái ${iti.destination}`,
        destination: iti.destination || 'Việt Nam',
        dates: dateDisplay,
        guests: 2,
        cost: iti.totalCost || 0,
        daysLeftText: 'Lịch trình đã lưu',
        statusText: 'Đang lên kế hoạch',
        image: tripImg,
        type: 'itinerary',
        link: `/schedule?id=${iti.id || iti._id}`
      };
    } else {
      this.upcomingTrip = null;
    }
  }

  public openTripDetails(trip: any) {
    if (!trip) return;
    if (trip.type === 'booking') {
      this.activeSection = 'tickets';
      this.cdr.detectChanges();
    } else if (trip.link) {
      this.router.navigateByUrl(trip.link);
    }
  }

  private formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const daysOfWeek = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const dayName = daysOfWeek[d.getDay()];
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${dayName}, ${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  }

  public onTripImageError(event: any) {
    if (event && event.target) {
      event.target.src = this.tripImage;
    }
  }

  public handleSidebarItem(item: ProfileSidebarItem) {
    if (item.action === 'upcomingTrip') {
      this.scrollToUpcomingTrip();
      return;
    }
    this.selectedSubSection = '';
    if (item.section) {
      this.activeSection = item.section;
      return;
    }
    if (item.route) {
      this.router.navigate([item.route]);
      return;
    }
    if (item.action === 'planner') this.router.navigate(['/schedule']);
    if (item.action === 'logout') this.handleLogout();
  }

  public isSidebarItemActive(item: ProfileSidebarItem): boolean {
    if (item.action === 'upcomingTrip') {
      return this.activeSection === 'overview' && this.selectedSubSection === 'upcomingTrip';
    }
    if (item.section === 'overview') {
      return this.activeSection === 'overview' && this.selectedSubSection !== 'upcomingTrip';
    }
    return item.section === this.activeSection;
  }

  public scrollToUpcomingTrip(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.activeSection = 'overview';
    this.selectedSubSection = 'upcomingTrip';
    setTimeout(() => {
      const el = document.getElementById('upcoming-trip-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-upcoming-trip');
        setTimeout(() => el.classList.remove('highlight-upcoming-trip'), 2500);
      }
    }, 100);
  }

  public showPersonalInfo() {
    this.activeSection = 'personal';
  }

  public showSecurityInfo() {
    this.activeSection = 'security';
  }

  public get currentTravelPreferenceStep(): TravelPreferenceQuestion {
    return this.travelPreferenceQuestions[this.currentPreferenceStepIndex];
  }

  public get currentTravelPreferenceOptions(): string[] {
    return this.currentTravelPreferenceStep.options || [];
  }

  public get preferenceStepCount(): number {
    return this.travelPreferenceQuestions.length;
  }

  public get preferenceProgress(): number {
    return Math.round(((this.currentPreferenceStepIndex + 1) / this.preferenceStepCount) * 100);
  }

  public isTravelPreferenceSelected(key: string, option: string): boolean {
    const answer = this.travelPreferenceAnswers[key];
    return Array.isArray(answer) ? answer.includes(option) : answer === option;
  }

  public selectTravelPreference(key: string, option: string, type: PreferenceQuestionType) {
    if (type === 'multi') {
      const current = this.travelPreferenceAnswers[key];
      const values = Array.isArray(current) ? [...current] : [];
      this.travelPreferenceAnswers[key] = values.includes(option)
        ? values.filter(value => value !== option)
        : [...values, option];
      return;
    }

    this.travelPreferenceAnswers[key] = option;
  }

  public goToPreferenceStep(index: number) {
    if (index < 0 || index >= this.preferenceStepCount) return;
    this.currentPreferenceStepIndex = index;
  }

  public previousPreferenceStep() {
    this.goToPreferenceStep(this.currentPreferenceStepIndex - 1);
  }

  public nextPreferenceStep() {
    this.goToPreferenceStep(this.currentPreferenceStepIndex + 1);
  }

  public getPreferenceSummary(key: string): string {
    const answer = this.travelPreferenceAnswers[key];
    if (Array.isArray(answer)) return answer.length ? answer.join(', ') : 'Chưa chọn';
    return answer || 'Chưa nhập';
  }

  public navigateToProviderRegistration() {
    this.router.navigate(['/partner-register']);
  }

  public async saveDetails(event: Event) {
    event.preventDefault();
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    const res = await this.authService.updateProfile(userId, {
      fullname: this.detFullname,
      phone: this.detPhone,
      email: this.detEmail,
      dob: this.detDob,
      gender: this.detGender,
      address: this.detAddress,
      company_name: this.detCompanyName,
      job: this.detJobType,
      bio: this.detBio
    });
    if (res.success) {
      this.showNotification('Thành công', 'Lưu thông tin thành công!', 'success');
      // Update local profileUser info
      if (res.user) {
        this.applyProfileUser(res.user);
      }
    } else {
      this.showNotification('Thất bại', res.message || 'Cập nhật thất bại!', 'error');
    }
    this.cdr.detectChanges();
  }

  public async handleWalletActivation() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';

    this.terminalApprovalState = 'pending';
    this.terminalApprovalTitle = 'Đang Chờ Phê Duyệt';
    this.terminalApprovalMsg = 'Yêu cầu kích hoạt Ví du lịch đang chờ Quản trị viên duyệt trên Terminal máy chủ.';
    this.isTerminalModalOpen = true;
    this.cdr.detectChanges();

    try {
      const res = await this.apiService.activateWallet(userId);
      if (res.success) {
        this.terminalApprovalState = 'success';
        this.terminalApprovalTitle = 'Kích Hoạt Thành Công';
        this.terminalApprovalMsg = 'Ví du lịch của bạn đã được kích hoạt thành công!';
        this.loadWalletAndTransactions();
      } else {
        this.terminalApprovalState = 'error';
        this.terminalApprovalTitle = 'Kích Hoạt Thất Bại';
        this.terminalApprovalMsg = res.message || 'Yêu cầu kích hoạt ví bị từ chối hoặc thất bại.';
      }
    } catch (err) {
      this.terminalApprovalState = 'error';
      this.terminalApprovalTitle = 'Kích Hoạt Thất Bại';
      this.terminalApprovalMsg = 'Yêu cầu bị từ chối hoặc có lỗi xảy ra.';
    }
    this.cdr.detectChanges();
  }

  public async handleDeposit() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';

    if (!this.depositAmount || this.depositAmount < 20000) {
      alert('Vui lòng nhập số tiền nạp tối thiểu là 20.000đ!');
      return;
    }

    const res = await this.apiService.depositMoney(userId, this.depositAmount);
    if (res.success) {
      const txIdMatch = res.message ? res.message.match(/#GD-\d+/) : null;
      const txId = txIdMatch ? txIdMatch[0].replace('#', '') : 'GD-' + Date.now().toString().slice(-10);

      this.qrAmount = this.depositAmount;
      this.qrDescription = `GS DEP ${txId}`;
      this.qrCodeUrl = `https://img.vietqr.io/image/OCB-0392851304-compact.png?amount=${this.qrAmount}&addInfo=${encodeURIComponent(this.qrDescription)}&accountName=KIEU%20HOANG%20DUONG`;
      this.isQrModalOpen = true;
      this.isDepositModalOpen = false;

      this.depositAmount = null;
      this.loadWalletAndTransactions();
    } else {
      alert(res.message || 'Nạp tiền thất bại. Vui lòng thử lại!');
    }
  }

  public closeQrModal() {
    this.isQrModalOpen = false;
    this.loadWalletAndTransactions();
  }

  public closeDepositModal() {
    this.isDepositModalOpen = false;
    this.depositAmount = null;
  }

  public selectDepositPreset(amount: number) {
    this.depositAmount = amount;
  }

  public async handleRoleToggle() {
    if (!this.currentUser) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    const newRole = await this.authService.toggleRole(userId);
    alert(`Đã chuyển đổi vai trò thành công! Vai trò hiện tại: ${newRole === 'provider' ? 'Nhà cung cấp' : 'Khách du lịch'}`);
    this.router.navigate([newRole === 'provider' ? '/partner-dashboard' : '/']);
  }

  public handleLogout() {
    this.authService.logout();
    alert('Đã đăng xuất tài khoản!');
    this.router.navigate(['/']);
  }

  public formatNotifTime(dateStr?: string): string {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Vừa xong';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;
      
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return 'Vừa xong';
    }
  }

  public getFirstLetter(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  // AVATAR EDITING IMPLEMENTATION
  public openAvatarModal() {
    this.selectedAvatarPath = this.profileUser?.avatarUrl || '';
    this.avatarZoom = 1.0;
    this.avatarPosX = 50;
    this.avatarPosY = 50;
    this.isAvatarModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeAvatarModal() {
    this.isAvatarModalOpen = false;
    this.cdr.detectChanges();
  }

  public selectPresetAvatar(path: string) {
    this.selectedAvatarPath = path;
    this.avatarZoom = 1.0;
    this.avatarPosX = 50;
    this.avatarPosY = 50;
    this.cdr.detectChanges();
  }

  public async onAvatarFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      this.selectedAvatarPath = reader.result as string;
      this.avatarZoom = 1.0;
      this.avatarPosX = 50;
      this.avatarPosY = 50;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  private cropAndUploadAvatar(base64Data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Data;
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 250;
          canvas.height = 250;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Data);
            return;
          }

          ctx.clearRect(0, 0, 250, 250);

          const iw = img.width;
          const ih = img.height;
          const aspect = iw / ih;

          let sWidth, sHeight;
          if (aspect > 1) {
            sHeight = ih;
            sWidth = ih;
          } else {
            sWidth = iw;
            sHeight = iw;
          }

          sWidth = sWidth / this.avatarZoom;
          sHeight = sHeight / this.avatarZoom;

          const sx = (iw - sWidth) * (this.avatarPosX / 100);
          const sy = (ih - sHeight) * (this.avatarPosY / 100);

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, 250, 250);

          const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
          
          const uploadRes = await this.apiService.uploadImageBase64(croppedBase64, 'avatar');
          if (uploadRes && uploadRes.success) {
            resolve(uploadRes.url);
          } else {
            reject(new Error('Tải ảnh đại diện lên server thất bại!'));
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => {
        reject(err);
      };
    });
  }

  public async saveAvatar() {
    if (!this.profileUser) return;
    const userId = this.profileUser.id || this.profileUser._id || '';
    
    try {
      let finalAvatarPath = this.selectedAvatarPath;
      if (finalAvatarPath.startsWith('data:image/')) {
        finalAvatarPath = await this.cropAndUploadAvatar(finalAvatarPath);
      }

      const res = await this.authService.updateProfile(userId, {
        avatarUrl: finalAvatarPath
      });

      if (res && res.success && res.user) {
        this.profileUser = res.user;
        this.isAvatarModalOpen = false;
        this.cdr.detectChanges();
        this.showNotification('Thành công', 'Cập nhật ảnh đại diện thành công!', 'success');
      } else {
        this.showNotification('Thất bại', 'Không thể lưu ảnh đại diện: ' + (res?.message || 'Lỗi kết nối'), 'error');
      }
    } catch (err: any) {
      console.error('Save avatar failed:', err);
      this.showNotification('Thất bại', 'Không thể lưu ảnh đại diện: ' + (err.message || 'Lỗi kết nối'), 'error');
    }
  }

  // Drag to Crop Avatar Implementation
  public avatarAspect = 1.0;
  public isDragging = false;
  private startDragX = 0;
  private startDragY = 0;
  private startPosX = 50;
  private startPosY = 50;

  public onImageLoaded(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalWidth) {
      this.avatarAspect = img.naturalWidth / img.naturalHeight;
      this.cdr.detectChanges();
    }
  }

  public onDragStart(event: MouseEvent | TouchEvent) {
    if (!this.selectedAvatarPath) return;
    this.isDragging = true;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    this.startDragX = clientX;
    this.startDragY = clientY;
    this.startPosX = this.avatarPosX;
    this.startPosY = this.avatarPosY;

    // Prevent default selection text behavior
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  @HostListener('window:touchmove', ['$event'])
  public onDragMove(event: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const deltaX = clientX - this.startDragX;
    const deltaY = clientY - this.startDragY;

    // Dimensions of drag container (200px)
    const containerSize = 200;
    
    let baseWidth = containerSize;
    let baseHeight = containerSize;
    if (this.avatarAspect > 1) {
      baseWidth = containerSize * this.avatarAspect;
    } else {
      baseHeight = containerSize / this.avatarAspect;
    }

    const layoutWidth = baseWidth * this.avatarZoom;
    const layoutHeight = baseHeight * this.avatarZoom;

    const overflowX = layoutWidth - containerSize;
    const overflowY = layoutHeight - containerSize;

    if (overflowX > 0) {
      const percentChangeX = (deltaX / overflowX) * 100;
      this.avatarPosX = Math.max(0, Math.min(100, Math.round(this.startPosX - percentChangeX)));
    }

    if (overflowY > 0) {
      const percentChangeY = (deltaY / overflowY) * 100;
      this.avatarPosY = Math.max(0, Math.min(100, Math.round(this.startPosY - percentChangeY)));
    }

    this.cdr.detectChanges();
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  public onDragEnd() {
    this.isDragging = false;
  }

  public openLoginModal() {
    this.loginModalService.open();
  }
}

export { ProfileComponent as Profile };
