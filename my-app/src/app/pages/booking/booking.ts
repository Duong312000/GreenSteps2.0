import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { Tour, User } from '../../models/models';

type BookingFor = 'self' | 'other';
type PaymentMethod = 'wallet' | 'card' | 'bank' | 'counter';
type PayTiming = 'now' | 'later';

interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  phone: string;
  receiveEmailConfirm: boolean;
}

interface OtherGuest {
  fullName: string;
  phone: string;
  note: string;
}

interface BookingContext {
  hotelId: string;
  roomId: string;
  tourId?: string;
  serviceId?: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  roomCount: number;
}

@Component({
  selector: 'app-booking',
  standalone: false,
  templateUrl: './booking.html'
})
export class BookingComponent implements OnInit, OnDestroy {
  private routeChangeSubscription?: Subscription;
  public currentUser: User | null = null;
  public activeTour: Tour | null = null;
  public isPaymentStep = false;
  public isCompleteStep = false;
  public submitted = false;
  public paymentSubmitted = false;
  public toastMessage = '';
  public showPaymentSuccessToast = false;
  private paymentSuccessToastTimer: any = null;
  public walletRegistered = false;
  public walletBalance = 0;
  
  public isNewUserCreated = false;
  public newUsername = '';
  public newPassword = '';
  public isEmailAlreadyExists = false;

  public loginWithGmail = false;
  public showCheckoutOtpModal = false;
  public checkoutOtpDigits = ['', '', '', '', '', ''];
  public checkoutOtpErrorMessage = '';
  public checkoutOtpResendSeconds = 0;
  public isCheckoutOtpSubmitting = false;
  public checkoutCountdownInterval: any = null;

  // Custom Alert Modal properties
  public alertVisible = false;
  public alertTitle = '';
  public alertMessage = '';
  public alertType: 'warning' | 'info' | 'error' = 'warning';
  public alertIllustration = '/image/payment/payment-notice.svg';
  public alertActionUrl = '';

  // VietQR & Loading properties
  public isPageLoading = true;
  public isBookingLoading = false;

  public isQrModalOpen = false;
  public isCardModalOpen = false;
  public readonly isLocalPaymentSandbox = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  public qrCodeUrl = '';
  public qrAmount = 0;
  public qrDescription = '';
  public currentBookingId = '';
  public qrExpiresAt = '';
  public qrCountdown = 600;
  public paymentStatus: 'pending' | 'paid' | 'failed' = 'paid';
  private pollingInterval: any = null;
  private countdownInterval: any = null;

  public bookingContext: BookingContext = {
    hotelId: 'hotel_dahlia_dalat',
    roomId: 'premium_double_window',
    tourId: '',
    checkIn: '2026-06-15',
    checkOut: '2026-06-18',
    guestCount: 2,
    roomCount: 1
  };

  public guestInfo: GuestInfo = {
    firstName: '',
    lastName: '',
    email: '',
    country: 'Việt Nam',
    phone: '',
    receiveEmailConfirm: true
  };

  public bookingFor: BookingFor = 'self';
  public otherGuest: OtherGuest = {
    fullName: '',
    phone: '',
    note: ''
  };

  public addOns: string[] = [];
  public specialRequest = '';
  public arrivalTime = '';
  public payTiming: PayTiming = 'now';
  public paymentMethod: PaymentMethod = 'wallet';
  public acceptedTerms = false;
  public cardForm = {
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: ''
  };

  public errors: Record<string, string> = {};
  public paymentErrors: Record<string, string> = {};

  public readonly countries = ['Việt Nam', 'Singapore', 'Thái Lan', 'Hàn Quốc', 'Nhật Bản', 'Khác'];
  public readonly arrivalOptions = ['12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-18:00', '18:00-20:00', 'Sau 20:00'];
  public readonly paymentMethods = [
    { id: 'wallet' as PaymentMethod, label: 'Ví điện tử', desc: 'Thanh toán nhanh qua ví liên kết.', icon: 'bi-wallet2' },
    { id: 'card' as PaymentMethod, label: 'Thẻ tín dụng / ghi nợ', desc: 'Thử luồng thanh toán bằng thẻ mẫu, không thu tiền thật.', icon: 'bi-credit-card' },
    { id: 'bank' as PaymentMethod, label: 'Chuyển khoản qua QR', desc: 'Quét VietQR trong ứng dụng ngân hàng của bạn.', icon: 'bi-bank' },
    { id: 'counter' as PaymentMethod, label: 'Thanh toán tại quầy', desc: 'Giữ chỗ tạm thời và xác nhận tại quầy.', icon: 'bi-shop' }
  ];
  public readonly addOnOptions = [
    { id: 'airport', label: 'Tôi muốn đặt xe đưa đón sân bay', desc: 'Xe tiết kiệm nhiên liệu, tài xế địa phương.', price: 280000, icon: 'bi-car-front' },
    { id: 'electric-bike', label: 'Tôi muốn thuê xe máy/xe điện', desc: 'Phù hợp di chuyển ngắn trong thành phố.', price: 180000, icon: 'bi-bicycle' },
    { id: 'green-plan', label: 'Tôi muốn nhận gợi ý lịch trình xanh', desc: 'GreenSteps gợi ý điểm đến ít phát thải.', price: 0, icon: 'bi-leaf' },
    { id: 'insurance', label: 'Tôi muốn thêm bảo hiểm du lịch', desc: 'Bảo vệ cơ bản cho hành trình tour.', price: 120000, icon: 'bi-shield-check' }
  ];

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private loginModalService: LoginModalService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    this.syncStepFromUrl();
    this.routeChangeSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.syncStepFromUrl();
        this.cdr.detectChanges();
      }
    });
    this.loadContext();

    this.route.queryParamMap.subscribe(params => {
      if (params.get('newUser') === 'true') {
        this.isNewUserCreated = true;
        this.newUsername = params.get('username') || '';
        this.newPassword = params.get('pwd') || '';
      }
      if (params.get('emailAlreadyExists') === 'true') {
        this.isEmailAlreadyExists = true;
      }
    });

    if (this.isPaymentStep || this.isCompleteStep) {
      const draft = localStorage.getItem('greensteps_booking_draft');
      if (draft) this.restoreDraft(JSON.parse(draft));
    }

    this.authService.currentUser$.subscribe(async user => {
      this.currentUser = user;
      this.prefillUserInfo(user);
      if (user) {
        try {
          const wallet = await this.apiService.getWalletInfo(user.id || user._id || '');
          this.walletRegistered = wallet.registered;
          this.walletBalance = wallet.balance;
        } catch (e) {
          this.walletRegistered = false;
          this.walletBalance = 0;
        }
      }
      this.cdr.detectChanges();
    });

    await this.loadActiveTour();
    if (this.isPaymentStep && ['bank', 'card'].includes(this.paymentMethod) && this.currentBookingId) {
      await this.resumePendingPayment();
    }
    if (this.isCompleteStep && this.paymentStatus === 'paid') this.showSuccessToast();
    this.isPageLoading = false;
    this.cdr.detectChanges();
  }

  private async loadActiveTour() {
    const query = this.route.snapshot.queryParamMap;
    const isItinerary = query.get('bookingType') === 'itinerary' || 
                        (this.bookingContext.tourId && this.bookingContext.tourId.startsWith('iti_'));

    if (isItinerary && this.bookingContext.tourId) {
      try {
        const itinerary = await this.apiService.getItinerary(this.bookingContext.tourId);
        if (itinerary) {
          let totalCost = 0;
          const daysData = itinerary.daysData || itinerary.days_data || [];
          daysData.forEach((day: any) => {
            if (day) {
              day.forEach((act: any) => {
                if (act && act.cost) totalCost += act.cost;
              });
            }
          });

          this.activeTour = {
            id: itinerary.id,
            title: itinerary.name || 'Lịch trình tùy chỉnh của bạn',
            destination: itinerary.destination || 'Đà Lạt',
            days: itinerary.days || 1,
            cost: totalCost,
            carbon: itinerary.totalCarbon || itinerary.total_carbon || 0,
            data: daysData
          } as any;
        }
      } catch (err) {
        console.error('Failed to load itinerary for booking:', err);
      }
    } else {
      if (this.bookingContext.serviceId) {
        this.activeTour = await this.apiService.getServiceAsTour(this.bookingContext.serviceId);
      } else if (this.bookingContext.tourId) {
        this.activeTour = await this.apiService.getPresetTour(this.bookingContext.tourId);
      }
    }

    if (!this.activeTour && !this.bookingContext.serviceId) {
      const tours = await this.apiService.getPresetTours();
      this.activeTour = tours[0] || null;
    }
    this.cdr.detectChanges();
  }


  public openAuth() {
    this.loginModalService.open();
  }

  public changeSelection() {
    if (this.activeTour?.id) {
      this.router.navigate(this.activeTour.isService
        ? ['/services', this.getActiveServiceRouteType(), this.activeTour.id]
        : ['/tours', this.activeTour.id]
      );
      return;
    }
    this.router.navigate([this.bookingContext.serviceId ? '/services' : '/tours']);
  }

  private getActiveServiceRouteType(): string {
    const type = (this.activeTour?.type || '').toLowerCase();
    if (type.includes('lưu') || type.includes('luu') || type.includes('trú') || type.includes('tru')) return 'stay';
    if (type.includes('phương') || type.includes('phuong') || type.includes('tiện') || type.includes('tien')) return 'transport';
    if (type.includes('ăn') || type.includes('an') || type.includes('uống') || type.includes('uong')) return 'food';
    return 'attraction';
  }

  public toggleAddOn(id: string, checked: boolean) {
    if (checked && !this.addOns.includes(id)) {
      this.addOns = [...this.addOns, id];
    } else if (!checked) {
      this.addOns = this.addOns.filter(item => item !== id);
    }
  }

  public hasAddOn(id: string) {
    return this.addOns.includes(id);
  }

  public async continueToPayment() {
    this.submitted = true;
    this.errors = this.validateDetails();
    if (Object.keys(this.errors).length > 0) {
      this.toastMessage = 'Vui lòng hoàn tất thông tin bắt buộc.';
      setTimeout(() => this.toastMessage = '', 2600);
      this.scrollToFirstError();
      return;
    }

    if (!this.currentUser && this.loginWithGmail) {
      this.isBookingLoading = true;
      this.checkoutOtpErrorMessage = '';
      try {
        const fullname = `${this.guestInfo.lastName} ${this.guestInfo.firstName}`;
        const res = await this.apiService.requestCheckoutOtp(this.guestInfo.email, fullname);
        this.isBookingLoading = false;
        if (res.success) {
          this.showCheckoutOtpModal = true;
          this.checkoutOtpDigits = ['', '', '', '', '', ''];
          this.startCheckoutOtpCountdown(60);
        } else {
          this.showAlert('Lỗi', res.message || 'Không thể gửi mã xác thực.', 'error');
        }
      } catch (err: any) {
        this.isBookingLoading = false;
        this.showAlert('Lỗi', 'Không thể gửi mã xác thực.', 'error');
      }
    } else {
      this.saveDraft();
      this.router.navigate(['/booking/payment']);
    }
  }

  public startCheckoutOtpCountdown(seconds: number) {
    this.clearCheckoutOtpCountdown();
    this.checkoutOtpResendSeconds = seconds;
    this.checkoutCountdownInterval = setInterval(() => {
      if (this.checkoutOtpResendSeconds > 0) {
        this.checkoutOtpResendSeconds--;
        this.cdr.detectChanges();
      } else {
        this.clearCheckoutOtpCountdown();
      }
    }, 1000);
  }

  public clearCheckoutOtpCountdown() {
    if (this.checkoutCountdownInterval) {
      clearInterval(this.checkoutCountdownInterval);
      this.checkoutCountdownInterval = null;
    }
  }

  public async resendCheckoutOtp() {
    if (this.checkoutOtpResendSeconds > 0) return;
    this.isCheckoutOtpSubmitting = true;
    try {
      const fullname = `${this.guestInfo.lastName} ${this.guestInfo.firstName}`;
      const res = await this.apiService.requestCheckoutOtp(this.guestInfo.email, fullname);
      this.isCheckoutOtpSubmitting = false;
      if (res.success) {
        this.checkoutOtpDigits = ['', '', '', '', '', ''];
        this.checkoutOtpErrorMessage = '';
        this.startCheckoutOtpCountdown(60);
      } else {
        this.checkoutOtpErrorMessage = res.message || 'Gửi lại mã thất bại.';
      }
    } catch (e) {
      this.isCheckoutOtpSubmitting = false;
      this.checkoutOtpErrorMessage = 'Gửi lại mã thất bại.';
    }
  }

  public onCheckoutOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    this.checkoutOtpDigits[index] = value;
    input.value = value;

    if (value && index < 5) {
      setTimeout(() => {
        const allInputs = document.querySelectorAll('.checkout-otp-input');
        const nextInput = allInputs[index + 1] as HTMLInputElement;
        if (nextInput) nextInput.focus();
      }, 0);
      return;
    }

    if (this.checkoutOtpDigits.every(d => d.length === 1)) {
      setTimeout(() => this.submitCheckoutOtpVerify(), 80);
    }
  }

  public onCheckoutOtpKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.checkoutOtpDigits[index] && index > 0) {
      setTimeout(() => {
        const allInputs = document.querySelectorAll('.checkout-otp-input');
        const prevInput = allInputs[index - 1] as HTMLInputElement;
        if (prevInput) prevInput.focus();
      }, 0);
    }
  }

  public onCheckoutOtpPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    if (!text) return;
    event.preventDefault();
    this.checkoutOtpDigits = Array.from({ length: 6 }, (_, index) => text[index] || '');
    setTimeout(() => {
      const activeIdx = Math.min(text.length, 6) - 1;
      const allInputs = document.querySelectorAll('.checkout-otp-input');
      const targetInput = allInputs[activeIdx] as HTMLInputElement;
      if (targetInput) targetInput.focus();
      if (text.length === 6) this.submitCheckoutOtpVerify();
    }, 0);
  }

  public async submitCheckoutOtpVerify() {
    if (this.isCheckoutOtpSubmitting) return;
    const otp = this.checkoutOtpDigits.join('');
    if (otp.length !== 6) {
      this.checkoutOtpErrorMessage = 'Vui lòng nhập đầy đủ 6 chữ số.';
      return;
    }

    this.isCheckoutOtpSubmitting = true;
    this.checkoutOtpErrorMessage = '';
    try {
      const fullname = `${this.guestInfo.lastName} ${this.guestInfo.firstName}`;
      const res = await this.apiService.verifyCheckoutOtp(
        this.guestInfo.email,
        otp,
        fullname,
        this.guestInfo.phone
      );
      this.isCheckoutOtpSubmitting = false;
      if (res.success && res.user && res.token) {
        this.authService.loginWithToken(res.user, res.token);
        this.showCheckoutOtpModal = false;
        this.saveDraft();
        this.router.navigate(['/booking/payment']);
      } else {
        this.checkoutOtpErrorMessage = res.message || 'Mã xác thực không chính xác.';
      }
    } catch (e: any) {
      this.isCheckoutOtpSubmitting = false;
      this.checkoutOtpErrorMessage = e?.error?.message || 'Xác thực OTP thất bại.';
    }
  }

  public isActivatingWallet = false;

  public selectPayTiming(timing: PayTiming) {
    this.payTiming = timing;
    if (timing === 'later') this.paymentMethod = 'counter';
  }

  public getTempBookingDeadline() {
    const now = new Date();
    if (!this.bookingContext.checkIn) {
      return {
        type: 'normal',
        message: 'GreenSteps sẽ tạm giữ chỗ của bạn trong vòng 12 giờ. Vui lòng hoàn tất đặt cọc trước thời hạn này.',
        buttonLabel: 'Gửi yêu cầu giữ chỗ',
        status: 'holding'
      };
    }
    const departureStr = this.bookingContext.checkIn + 'T08:00:00';
    const departure = new Date(departureStr);
    const diffMs = departure.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 12) {
      return {
        type: 'urgent',
        message: 'Tour sắp khởi hành. GreenSteps cần kiểm tra tình trạng chỗ trước khi xác nhận yêu cầu của bạn.',
        buttonLabel: 'Gửi yêu cầu xác nhận chỗ',
        status: 'pending_confirmation'
      };
    } else if (diffHours >= 12 && diffHours <= 48) {
      const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const timeStr = deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = deadline.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return {
        type: 'normal',
        message: `GreenSteps sẽ tạm giữ chỗ của bạn đến ${timeStr} ngày ${dateStr}. Vui lòng hoàn tất đặt cọc trước thời hạn này để tránh mất chỗ.`,
        buttonLabel: 'Gửi yêu cầu giữ chỗ',
        status: 'holding'
      };
    } else {
      const deadline = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const timeStr = deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = deadline.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return {
        type: 'normal',
        message: `GreenSteps sẽ tạm giữ chỗ của bạn đến ${timeStr} ngày ${dateStr}. Vui lòng hoàn tất đặt cọc trước thời hạn này để tránh mất chỗ.`,
        buttonLabel: 'Gửi yêu cầu giữ chỗ',
        status: 'holding'
      };
    }
  }

  public async activateWalletInline() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.showAlert('Chưa đăng nhập', 'Vui lòng đăng nhập để gửi yêu cầu kích hoạt ví!', 'warning');
      return;
    }
    this.isActivatingWallet = true;
    try {
      const res = await this.apiService.activateWallet(user.id || user._id || '');
      this.isActivatingWallet = false;
      if (res.success) {
        this.showAlert(
          'Đã gửi yêu cầu',
          'Yêu cầu kích hoạt ví GreenSteps của bạn đã được gửi thành công! Quà tặng 200.000đ sẽ được cộng khi Admin phê duyệt.',
          'info'
        );
      } else {
        this.showAlert('Thất bại', res.message || 'Gửi yêu cầu kích hoạt ví thất bại.', 'error');
      }
    } catch (e) {
      this.isActivatingWallet = false;
      this.showAlert('Thất bại', 'Có lỗi xảy ra khi gửi yêu cầu kích hoạt ví.', 'error');
    }
  }

  public async completeDeposit() {
    const user = this.authService.getCurrentUser();
    if (this.paymentMethod === 'wallet' && !user) {
      this.showAlert("Yêu cầu đăng nhập", "Vui lòng đăng nhập để thanh toán bằng ví điện tử!", "warning");
      return;
    }

    const userId = user ? (user.id || user._id || '') : null;
    const targetId = this.bookingContext.serviceId || this.bookingContext.tourId || this.activeTour?.id;
    if (!targetId) {
      this.showAlert('Thiếu thông tin đặt chỗ', 'Vui lòng quay lại trang tour hoặc dịch vụ và chọn mục cần đặt trước khi thanh toán.', 'error');
      return;
    }
    const isService = Boolean(this.bookingContext.serviceId)
      || Boolean((this.activeTour as any)?.isService)
      || /^srv[_-]/i.test(targetId);
    const bookingType = isService ? 'service' : this.isItineraryBooking() ? 'itinerary' : 'tour';

    const bookingData: any = {
      user_id: userId,
      kind: bookingType,
      target_id: targetId,
      booking_date: this.bookingContext.checkIn,
      check_out_date: this.bookingContext.checkOut,
      guests: this.bookingContext.guestCount,
      value: this.depositAmount,
      customer: {
        fullname: `${this.guestInfo.lastName} ${this.guestInfo.firstName}`.trim(),
        phone: this.guestInfo.phone,
        email: this.guestInfo.email
      }
    };

    if (this.payTiming === 'later') {
      // Temporary Holding / Later timing flow
      const dlInfo = this.getTempBookingDeadline();
      this.paymentMethod = 'counter';
      bookingData.payment_method = 'counter';
      
      this.isBookingLoading = true;
      try {
        const res = await this.apiService.createBooking(bookingData);
        this.isBookingLoading = false;
        if (res.success) {
          this.currentBookingId = res.bookingId || '';
          this.paymentStatus = 'pending';
          this.saveDraft();
          if (dlInfo.type === 'urgent') {
            this.showAlert(
              "Tiếp nhận yêu cầu",
              "GreenSteps đã tiếp nhận yêu cầu xác nhận chỗ của bạn cho tour sắp khởi hành này. Nhân viên sẽ liên hệ lại trong thời gian sớm nhất!",
              "info",
              "/booking/confirm"
            );
          } else {
            this.showAlert(
              "Yêu cầu giữ chỗ thành công",
              dlInfo.message,
              "info",
              "/booking/confirm"
            );
          }
        } else {
          this.showAlert("Thất bại", res.message || "Không thể gửi yêu cầu giữ chỗ.", "error");
        }
      } catch (e) {
        this.isBookingLoading = false;
        this.showAlert("Thất bại", "Gửi yêu cầu giữ chỗ thất bại.", "error");
      }
      return;
    }

    // Đặt cọc ngay flow
    this.paymentSubmitted = true;
    this.paymentErrors = this.validatePayment();

    if (Object.keys(this.paymentErrors).length > 0) {
      this.toastMessage = 'Vui lòng hoàn tất thông tin thanh toán.';
      setTimeout(() => this.toastMessage = '', 2600);
      this.scrollToFirstPaymentError();
      return;
    }

    bookingData.payment_method = this.paymentMethod === 'bank' ? 'bank_transfer' : this.paymentMethod;

    if (this.paymentMethod === 'wallet') {
      if (!this.walletRegistered) {
        this.showAlert(
          "Ví chưa kích hoạt",
          "Ví du lịch GreenSteps của bạn chưa được kích hoạt! Vui lòng kích hoạt ví để thanh toán.",
          "warning"
        );
        return;
      }
      if (this.walletBalance < this.depositAmount) {
        this.showAlert(
          "Số dư ví không đủ",
          `Số dư khả dụng trong ví của bạn hiện tại là ${this.walletBalance.toLocaleString('vi-VN')}đ, chưa đủ để thanh toán tiền đặt cọc ${this.depositAmount.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào ví để tiếp tục.`,
          "error"
        );
        return;
      }

      this.isBookingLoading = true;
      try {
        const res = await this.apiService.createBooking(bookingData);
        this.isBookingLoading = false;
        if (res.success) {
          if (res.bookingId) this.currentBookingId = res.bookingId;
          this.paymentStatus = res.paymentStatus === 'paid' ? 'paid' : 'pending';
          this.saveDraft();
          let queryParams = {};
          if (res.emailAlreadyExists) {
            queryParams = { emailAlreadyExists: 'true' };
          } else if (res.autoCreatedUser) {
            this.authService.loginWithToken(res.autoCreatedUser.user, res.autoCreatedUser.token);
            queryParams = {
              newUser: 'true',
              username: res.autoCreatedUser.username,
              pwd: res.autoCreatedUser.defaultPassword
            };
          }
          if (this.paymentStatus === 'paid') this.showSuccessToast();
          this.router.navigate(['/booking/confirm'], { queryParams });
        } else {
          this.showAlert("Thanh toán thất bại", res.message || "Giao dịch trừ tiền ví bị từ chối hoặc có lỗi xảy ra.", "error");
        }
      } catch (e) {
        this.isBookingLoading = false;
        this.showAlert("Thanh toán thất bại", "Yêu cầu thanh toán bị từ chối.", "error");
      }
    } else if (this.paymentMethod === 'card') {
      this.isBookingLoading = true;
      try {
        const res = await this.apiService.createBooking(bookingData);
        if (res.success && res.bookingId) {
          this.openPendingPayment(res, 'card');
        } else {
          this.showAlert('Không thể tạo giao dịch thẻ thử nghiệm', res.message || 'Vui lòng thử lại.', 'error');
        }
      } catch (e) {
        this.showAlert('Không thể tạo giao dịch thẻ thử nghiệm', 'Không kết nối được máy chủ thanh toán.', 'error');
      } finally {
        this.isBookingLoading = false;
      }
    } else if (this.paymentMethod === 'counter') {
      // Direct Counter payment / giữ chỗ thanh toán tại quầy
      this.isBookingLoading = true;
      try {
        const res = await this.apiService.createBooking(bookingData);
        this.isBookingLoading = false;
        if (res.success) {
          if (res.bookingId) this.currentBookingId = res.bookingId;
          this.paymentStatus = res.paymentStatus === 'paid' ? 'paid' : 'pending';
          this.saveDraft();
          let queryParams = {};
          if (res.emailAlreadyExists) {
            queryParams = { emailAlreadyExists: 'true' };
          } else if (res.autoCreatedUser) {
            this.authService.loginWithToken(res.autoCreatedUser.user, res.autoCreatedUser.token);
            queryParams = {
              newUser: 'true',
              username: res.autoCreatedUser.username,
              pwd: res.autoCreatedUser.defaultPassword
            };
          }
          if (this.paymentStatus === 'paid') this.showSuccessToast();
          this.router.navigate(['/booking/confirm'], { queryParams });
        } else {
          this.showAlert("Đặt chỗ thất bại", res.message || "Không thể gửi yêu cầu giữ chỗ tại quầy.", "error");
        }
      } catch (e) {
        this.isBookingLoading = false;
        this.showAlert("Đặt chỗ thất bại", "Không thể gửi yêu cầu giữ chỗ tại quầy.", "error");
      }
    } else if (this.paymentMethod === 'bank') {
      // Direct QR Transfer flow with live countdown & polling
      this.qrAmount = this.depositAmount;
      this.isBookingLoading = true;
      try {
        const res = await this.apiService.createBooking(bookingData);
        if (res.success && res.bookingId) {
          this.openPendingPayment(res, 'bank');
        } else {
          this.showAlert("Thanh toán thất bại", res.message || "Giao dịch chuyển khoản bị từ chối.", "error");
        }
      } catch (e) {
        this.showAlert("Thanh toán thất bại", "Giao dịch chuyển khoản bị từ chối.", "error");
      } finally {
        this.isBookingLoading = false;
      }
    }
  }

  private openPendingPayment(res: any, method: 'bank' | 'card') {
    this.currentBookingId = res.bookingId;
    this.paymentStatus = 'pending';
    this.qrAmount = this.depositAmount;
    this.qrDescription = res.payment?.transfer_reference || res.bookingCode || this.currentBookingId;
    this.qrExpiresAt = res.payment?.expires_at || new Date(Date.now() + 600000).toISOString();
    this.qrCountdown = Math.max(0, Math.ceil((new Date(this.qrExpiresAt).getTime() - Date.now()) / 1000));
    this.isQrModalOpen = method === 'bank';
    this.isCardModalOpen = method === 'card';
    this.qrCodeUrl = method === 'bank'
      ? `https://img.vietqr.io/image/OCB-0392851304-compact.png?amount=${this.qrAmount}&addInfo=${encodeURIComponent(this.qrDescription)}&accountName=KIEU%20HOANG%20DUONG`
      : '';
    this.saveDraft();
    this.startQrCountdown();
    this.startBookingStatusPolling(res.bookingId);
  }

  public startBookingStatusPolling(bookingId: string) {
    this.ngZone.runOutsideAngular(() => {
      this.pollingInterval = setInterval(async () => {
        try {
          const res = await this.apiService.getBooking(bookingId);
          const target = res?.booking;
          if (target && (target.payment?.status === 'paid' || target.status === 'deposit' || target.status === 'confirmed' || target.status === 'accepted')) {
            if (this.pollingInterval) {
              clearInterval(this.pollingInterval);
              this.pollingInterval = null;
            }
            this.ngZone.run(() => {
              this.isQrModalOpen = false;
              this.isCardModalOpen = false;
              this.paymentStatus = 'paid';
              this.clearQrCountdown();

              let queryParams = {};
              if (res && res.emailAlreadyExists) {
                queryParams = { emailAlreadyExists: 'true' };
              } else if (res && res.autoCreatedUser) {
                this.authService.loginWithToken(res.autoCreatedUser.user, res.autoCreatedUser.token);
                queryParams = {
                  newUser: 'true',
                  username: res.autoCreatedUser.username,
                  pwd: res.autoCreatedUser.defaultPassword
                };
              }

              this.saveDraft();
              this.showSuccessToast();
              this.router.navigate(['/booking/confirm'], { queryParams });
            });
          } else if (target && (target.status === 'rejected' || target.status === 'cancelled' || target.payment?.status === 'failed')) {
            if (this.pollingInterval) {
              clearInterval(this.pollingInterval);
              this.pollingInterval = null;
            }
            this.ngZone.run(() => {
              this.isQrModalOpen = false;
              this.isCardModalOpen = false;
              this.paymentStatus = 'failed';
              this.saveDraft();
              this.clearQrCountdown();
              this.showAlert('Thanh toán chưa được xác nhận', 'Đơn đặt chỗ đã bị từ chối hoặc hết hạn. Bạn có thể quay lại và thử lại.', 'error');
            });
          }
        } catch (_) {}
      }, 2500);

      setTimeout(() => {
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
      }, Math.max(0, this.qrCountdown * 1000));
    });
  }

  private async resumePendingPayment() {
    const result = await this.apiService.getBooking(this.currentBookingId);
    const booking = result?.booking;
    if (!booking) return;
    if (booking.payment?.status === 'paid') {
      this.paymentStatus = 'paid';
      this.router.navigate(['/booking/confirm']);
      return;
    }
    if (booking.payment?.status !== 'pending') {
      this.paymentStatus = 'pending';
      this.showAlert('Yêu cầu đã kết thúc', 'Đơn chuyển khoản này đã bị hủy, từ chối hoặc hết hạn. Vui lòng tạo yêu cầu mới.', 'warning');
      return;
    }

    this.paymentMethod = booking.payment?.method === 'card' ? 'card' : 'bank';
    this.qrAmount = Number(booking.value || this.depositAmount);
    this.qrDescription = booking.payment.transfer_reference || booking.evoucher_code || booking.booking_code;
    this.qrExpiresAt = booking.payment.expires_at || this.qrExpiresAt;
    this.qrCountdown = Math.max(0, Math.ceil((new Date(this.qrExpiresAt).getTime() - Date.now()) / 1000));
    this.qrCodeUrl = this.paymentMethod === 'bank' ? `https://img.vietqr.io/image/OCB-0392851304-compact.png?amount=${this.qrAmount}&addInfo=${encodeURIComponent(this.qrDescription)}&accountName=KIEU%20HOANG%20DUONG` : '';
    this.paymentStatus = 'pending';
    this.isQrModalOpen = this.paymentMethod === 'bank' && this.qrCountdown > 0;
    this.isCardModalOpen = this.paymentMethod === 'card' && this.qrCountdown > 0;
    if (this.qrCountdown > 0) {
      this.startQrCountdown();
      this.startBookingStatusPolling(this.currentBookingId);
    } else {
      this.handleQrExpired();
    }
  }

  // Custom Alert Helpers
  public showAlert(title: string, message: string, type: 'warning' | 'info' | 'error' = 'warning', actionUrl = '') {
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertType = type;
    this.alertActionUrl = actionUrl;
    
    if (type === 'warning') this.alertIllustration = '/image/payment/payment-notice.svg';
    else if (type === 'info') this.alertIllustration = '/image/payment/payment-pending.svg';
    else this.alertIllustration = '/image/payment/payment-error.svg';

    this.alertVisible = true;
  }

  public closeAlert() {
    this.alertVisible = false;
  }

  public closeQrModal() {
    this.isQrModalOpen = false;
    this.isCardModalOpen = false;
  }

  public reopenQrModal() {
    if (this.currentBookingId && this.qrCountdown > 0) {
      this.isCardModalOpen = this.paymentMethod === 'card';
      this.isQrModalOpen = this.paymentMethod === 'bank';
    }
  }

  public async simulateCurrentPayment() {
    if (!this.isLocalPaymentSandbox || !this.currentBookingId || this.paymentStatus !== 'pending') return;
    this.isBookingLoading = true;
    const result = await this.apiService.simulateBookingPayment(this.currentBookingId);
    this.isBookingLoading = false;
    if (!result.success) {
      this.showAlert('Chưa xác nhận được thanh toán', result.message || 'Vui lòng kiểm tra lại trạng thái đơn.', 'error');
      return;
    }
    this.paymentStatus = 'paid';
    this.cardForm = { cardName: '', cardNumber: '', expiry: '', cvc: '' };
    this.closeQrModal();
    this.stopPaymentPolling();
    this.saveDraft();
    this.showSuccessToast();
    this.router.navigate(['/booking/confirm']);
  }

  private stopPaymentPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = null;
    this.clearQrCountdown();
  }

  private showSuccessToast() {
    this.showPaymentSuccessToast = true;
    if (this.paymentSuccessToastTimer) clearTimeout(this.paymentSuccessToastTimer);
    this.paymentSuccessToastTimer = setTimeout(() => {
      this.showPaymentSuccessToast = false;
      this.paymentSuccessToastTimer = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  public async cancelPendingBooking() {
    if (!this.currentBookingId) {
      this.closeQrModal();
      this.stopPaymentPolling();
      return;
    }
    
    this.isBookingLoading = true;
    try {
      const res = await this.apiService.cancelBooking(this.currentBookingId);
      this.isBookingLoading = false;
      if (res.success) {
        this.closeQrModal();
        this.stopPaymentPolling();
        this.paymentStatus = 'failed';
        this.saveDraft();
        this.showAlert("Đã hủy giao dịch", res.message, "info");
      } else {
        this.showAlert("Không thể hủy", res.message, "error");
      }
    } catch (e) {
      this.isBookingLoading = false;
      this.showAlert("Không thể hủy", "Không kết nối được máy chủ. Vui lòng thử lại.", "error");
    }
  }

  public temporaryExitQr() {
    this.isQrModalOpen = false;
    this.isCardModalOpen = false;
    this.showAlert(
      "Giao dịch đang chờ xác nhận",
      "Yêu cầu thanh toán đặt cọc của bạn đang được hệ thống xử lý. Bạn có thể tiếp tục xem các thông tin khác trong thời gian chờ đợi. Trạng thái sẽ tự động cập nhật khi giao dịch thành công.",
      "info"
    );
  }

  public startQrCountdown() {
    this.clearQrCountdown();
    if (this.qrCountdown <= 0) {
      this.handleQrExpired();
      return;
    }
    this.countdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.qrCountdown > 0) {
          this.qrCountdown--;
          this.cdr.detectChanges();
        } else {
          this.clearQrCountdown();
          this.handleQrExpired();
        }
      });
    }, 1000);
  }

  public clearQrCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  ngOnDestroy() {
    this.routeChangeSubscription?.unsubscribe();
    if (this.paymentSuccessToastTimer) clearTimeout(this.paymentSuccessToastTimer);
    this.clearQrCountdown();
    this.clearCheckoutOtpCountdown();
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  public get qrCountdownFormatted(): string {
    const minutes = Math.floor(this.qrCountdown / 60);
    const seconds = this.qrCountdown % 60;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString();
    const secondsStr = seconds < 10 ? '0' + seconds : seconds.toString();
    return `${minutesStr}:${secondsStr}`;
  }

  public async handleQrExpired() {
    if (this.paymentStatus !== 'pending') return;
    const latest = this.currentBookingId ? await this.apiService.getBooking(this.currentBookingId) : null;
    if (latest?.booking?.payment?.status === 'paid') {
      this.paymentStatus = 'paid';
      this.closeQrModal();
      this.stopPaymentPolling();
      this.saveDraft();
      this.router.navigate(['/booking/confirm']);
      return;
    }
    this.closeQrModal();
    this.stopPaymentPolling();
    this.paymentStatus = 'failed';
    this.saveDraft();
    // Silently trigger booking cancellation on backend
    this.cancelPendingBookingSilently();
    this.showAlert(
      "Giao dịch hết hạn", 
      "Phiên thanh toán đã hết hạn sau 10 phút. Đơn đặt cọc của bạn đã được hủy tự động.",
      "warning"
    );
  }

  private async cancelPendingBookingSilently() {
    if (!this.currentBookingId) return;
    try {
      await this.apiService.cancelBooking(this.currentBookingId);
    } catch (e) {
      console.warn("Failed to cancel expired booking:", e);
    }
  }

  public triggerAlertAction() {
    this.alertVisible = false;
    if (this.alertActionUrl) {
      this.router.navigate([this.alertActionUrl]);
    }
  }

  public get hotelName() {
    return this.activeTour?.title || 'Tour GreenSteps Travel';
  }

  public get hotelAddress() {
    return this.activeTour?.destination ? `Điểm đến: ${this.activeTour.destination}` : 'Hành trình du lịch xanh';
  }

  public get roomName() {
    return 'Gói tour tiêu chuẩn GreenSteps';
  }

  public isItineraryBooking(): boolean {
    return this.activeTour?.id?.startsWith('iti_') || 
           this.bookingContext.tourId?.startsWith('iti_') || 
           this.route.snapshot.queryParamMap.get('bookingType') === 'itinerary';
  }

  public get itineraryPerPersonCost() {
    let total = 0;
    if (this.activeTour?.data) {
      this.activeTour.data.forEach((day: any) => {
        if (day) {
          day.forEach((act: any) => {
            const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
            if (act && act.cost && !isShared) {
              total += act.cost;
            }
          });
        }
      });
    }
    return total;
  }

  public get itineraryFlatCost() {
    let total = 0;
    if (this.activeTour?.data) {
      this.activeTour.data.forEach((day: any) => {
        if (day) {
          day.forEach((act: any) => {
            const isShared = act.is_shared === true || act.isShared === true || act.type === 'lodging';
            if (act && act.cost && isShared) {
              total += act.cost;
            }
          });
        }
      });
    }
    return total;
  }

  public get basePrice() {
    if (this.isItineraryBooking() && this.activeTour?.data) {
      return (this.itineraryPerPersonCost * Math.max(this.bookingContext.guestCount, 1)) + this.itineraryFlatCost;
    }
    return Math.max(this.activeTour?.cost || 1890000, 0) * Math.max(this.bookingContext.guestCount, 1);
  }

  public get discountAmount() {
    if (this.isItineraryBooking()) return 0;
    return Math.round(this.basePrice * 0.08);
  }

  public get serviceFee() {
    if (this.isItineraryBooking()) return 0;
    return 120000;
  }

  public get totalAmount() {
    return this.basePrice - this.discountAmount + this.serviceFee + this.addOnsTotal;
  }

  public get depositAmount() {
    return Math.round(this.totalAmount * 0.3);
  }

  public get remainingAmount() {
    return this.totalAmount - this.depositAmount;
  }

  public get addOnsTotal() {
    return this.addOnOptions
      .filter(option => this.addOns.includes(option.id))
      .reduce((sum, option) => sum + option.price, 0);
  }

  public get selectedAddOnLabels() {
    return this.addOnOptions
      .filter(option => this.addOns.includes(option.id))
      .map(option => option.label);
  }

  public get nights() {
    const checkIn = new Date(this.bookingContext.checkIn);
    const checkOut = new Date(this.bookingContext.checkOut);
    const diff = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    return Math.max(diff || (this.activeTour?.days ? this.activeTour.days - 1 : 1), 1);
  }

  public get cancellationDate() {
    const checkIn = new Date(this.bookingContext.checkIn);
    checkIn.setDate(checkIn.getDate() - 3);
    return checkIn.toLocaleDateString('vi-VN');
  }

  public get selectedPaymentLabel() {
    return this.paymentMethods.find(method => method.id === this.paymentMethod)?.label || 'Ví điện tử';
  }

  public get paymentReady() {
    return Object.keys(this.validatePayment(true)).length === 0;
  }

  public fieldError(name: string) {
    return this.submitted ? this.errors[name] : '';
  }

  public paymentError(name: string) {
    return this.paymentSubmitted ? this.paymentErrors[name] : '';
  }

  private loadContext() {
    const storedContext = localStorage.getItem('greensteps_booking_context');
    if (storedContext) {
      this.bookingContext = { ...this.bookingContext, ...JSON.parse(storedContext) };
    }

    const query = this.route.snapshot.queryParamMap;
    const queryHasTarget = query.has('tourId') || query.has('serviceId');
    const serviceId = query.get('serviceId') || (!queryHasTarget ? this.bookingContext.serviceId : undefined);
    const tourId = query.get('tourId') || (!queryHasTarget ? this.bookingContext.tourId : undefined);
    const isItinerary = query.get('bookingType') === 'itinerary' || (tourId && tourId.startsWith('iti_'));

    this.bookingContext = {
      ...this.bookingContext,
      tourId: serviceId ? undefined : tourId,
      serviceId,
      checkIn: query.get('checkIn') || this.bookingContext.checkIn,
      checkOut: query.get('checkOut') || this.bookingContext.checkOut,
      guestCount: Number(query.get('guestCount') || (isItinerary ? 1 : this.bookingContext.guestCount)),
      roomCount: Number(query.get('roomCount') || this.bookingContext.roomCount)
    };
  }

  private prefillUserInfo(user: User | null) {
    if (!user) return;
    const parts = (user.fullname || '').trim().split(/\s+/);
    const firstName = parts.pop() || '';
    const lastName = parts.join(' ');

    this.guestInfo = {
      ...this.guestInfo,
      firstName: this.guestInfo.firstName || firstName,
      lastName: this.guestInfo.lastName || lastName,
      email: this.guestInfo.email || user.email || '',
      phone: this.guestInfo.phone || user.phone || '',
      country: this.guestInfo.country || 'Việt Nam'
    };
  }

  private validateDetails() {
    const errors: Record<string, string> = {};
    if (!this.guestInfo.lastName.trim()) errors['lastName'] = 'Vui lòng nhập họ.';
    if (!this.guestInfo.firstName.trim()) errors['firstName'] = 'Vui lòng nhập tên.';
    if (!this.isEmail(this.guestInfo.email)) errors['email'] = 'Email không hợp lệ.';
    if (!this.guestInfo.country.trim()) errors['country'] = 'Vui lòng chọn vùng/quốc gia.';
    if (!this.isPhone(this.guestInfo.phone)) errors['phone'] = 'Số điện thoại không hợp lệ.';
    return errors;
  }

  private validatePayment(includeCard = true) {
    const errors: Record<string, string> = {};
    if (!this.paymentMethod) errors['paymentMethod'] = 'Vui lòng chọn phương thức thanh toán.';
    if (this.paymentMethod === 'card' && includeCard) {
      const digits = this.cardForm.cardNumber.replace(/\s/g, '');
      if (!this.cardForm.cardName.trim()) errors['cardName'] = 'Vui lòng nhập tên thử nghiệm.';
      if (digits !== '4242424242424242') errors['cardNumber'] = 'Sandbox chỉ nhận thẻ thử 4242 4242 4242 4242.';
      const match = this.cardForm.expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!match || (match && new Date(2000 + Number(match[2]), Number(match[1]), 0, 23, 59, 59) < new Date())) errors['expiry'] = 'Nhập tháng/năm hết hạn trong tương lai (TT/NN).';
      if (this.cardForm.cvc.trim() !== '123') errors['cvc'] = 'Sandbox sử dụng CVC thử nghiệm 123.';
    }
    if (!this.acceptedTerms) errors['acceptedTerms'] = 'Bạn cần đồng ý với điều kiện thanh toán.';
    return errors;
  }
  private saveDraft() {
    const draft = {
      hotelId: this.bookingContext.hotelId,
      roomId: this.bookingContext.roomId,
      tourId: this.activeTour?.id || this.bookingContext.tourId,
      checkIn: this.bookingContext.checkIn,
      checkOut: this.bookingContext.checkOut,
      guestCount: this.bookingContext.guestCount,
      roomCount: this.bookingContext.roomCount,
      depositAmount: this.depositAmount,
      userInfo: this.guestInfo,
      bookingFor: this.bookingFor,
      otherGuest: this.otherGuest,
      specialRequests: this.specialRequest,
      addOns: this.addOns,
      arrivalTime: this.arrivalTime,
      payTiming: this.payTiming,
      paymentMethod: this.paymentMethod,
      acceptedTerms: this.acceptedTerms,
      bookingId: this.currentBookingId,
      qrExpiresAt: this.qrExpiresAt,
      paymentStatus: this.paymentStatus,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('greensteps_booking_draft', JSON.stringify(draft));
  }

  private restoreDraft(draft: any) {
    const safeDraft = { ...draft };
    delete safeDraft.cardForm;
    if (draft.cardForm) localStorage.setItem('greensteps_booking_draft', JSON.stringify(safeDraft));
    this.guestInfo = { ...this.guestInfo, ...(draft.userInfo || {}) };
    this.bookingFor = draft.bookingFor || 'self';
    this.otherGuest = { ...this.otherGuest, ...(draft.otherGuest || {}) };
    this.specialRequest = draft.specialRequests || '';
    this.addOns = draft.addOns || [];
    this.arrivalTime = draft.arrivalTime || '';
    this.payTiming = draft.payTiming || 'now';
    this.paymentMethod = draft.paymentMethod || 'wallet';
    this.cardForm = { cardName: '', cardNumber: '', expiry: '', cvc: '' };
    this.acceptedTerms = !!draft.acceptedTerms;
    if (draft.bookingId) this.currentBookingId = draft.bookingId;
    this.qrExpiresAt = draft.qrExpiresAt || '';
    this.paymentStatus = draft.paymentStatus || 'paid';
    this.bookingContext = { ...this.bookingContext, ...safeDraft };
  }

  private syncStepFromUrl() {
    this.isPaymentStep = this.router.url.startsWith('/booking/payment');
    this.isCompleteStep = this.router.url.startsWith('/booking/confirm');
  }

  private isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private isPhone(value: string) {
    return /^(\+?[0-9]{8,15}|0[0-9\s.-]{8,13})$/.test(value.trim());
  }

  private scrollToFirstError() {
    setTimeout(() => {
      const firstError = document.querySelector<HTMLElement>('.booking-field.invalid input, .booking-field.invalid select, .booking-field.invalid textarea');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError?.focus?.();
    }, 50);
  }

  private scrollToFirstPaymentError() {
    setTimeout(() => {
      const firstError = document.querySelector<HTMLElement>('.payment-field.invalid input, .payment-method-error, .terms-error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError?.focus?.();
    }, 50);
  }
}

export { BookingComponent as Booking };
