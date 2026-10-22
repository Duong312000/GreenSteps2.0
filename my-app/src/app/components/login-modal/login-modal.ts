import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type AuthMode = 'login' | 'register';
type AuthStep = 'login' | 'registerVerify' | 'forgot' | 'forgotVerify' | 'reset' | 'resetDone';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
const PASSWORD_MESSAGE = 'Mật khẩu phải có ít nhất 6 ký tự, bao gồm ít nhất một chữ cái và một chữ số, không chứa khoảng trắng hoặc ký tự đặc biệt.';

@Component({
  selector: 'app-login-modal',
  standalone: false,
  templateUrl: './login-modal.html',
  styleUrls: ['./login-modal.css']
})
export class LoginModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() initialMode: AuthMode = 'login';
  @Output() close = new EventEmitter<void>();
  @ViewChild('loginDialog') loginDialog!: ElementRef<HTMLElement>;
  @ViewChild('firstField') firstField?: ElementRef<HTMLInputElement>;

  public mode: AuthMode = 'login';
  public authStep: AuthStep = 'login';
  public isSubmitting = false;
  public errorMessage = '';
  public successMessage = '';
  
  public showDevMessage = false;

  public loginUsername = '';
  public loginPassword = '';
  public showPassword = false;
  public rememberMe = false;

  public registerUsername = '';
  public registerEmail = '';
  public registerPassword = '';
  public registerConfirmPassword = '';

  public identifier = '';
  public verificationEmail = '';
  public otpDigits = ['', '', '', '', '', ''];
  public resendSeconds = 0;
  public resetToken = '';
  public showResetPassword = false;
  public showResetConfirm = false;
  public resetForm = {
    password: '',
    confirmPassword: ''
  };

  private readonly previousBodyOverflow = document.body.style.overflow;
  private countdownTimer?: number;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.mode = this.initialMode;
  }

  ngAfterViewInit() {
    document.body.style.overflow = 'hidden';
    this.focusFirstField();
  }

  ngOnDestroy() {
    document.body.style.overflow = this.previousBodyOverflow;
    this.clearCountdown();
  }

  @HostListener('document:keydown', ['$event'])
  public onDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') this.requestClose();
    if (event.key === 'Tab') this.trapFocus(event);
  }

  public requestClose() {
    this.close.emit();
  }

  public setMode(mode: AuthMode) {
    this.mode = mode;
    this.setStep('login');
  }

  public setStep(step: AuthStep) {
    this.authStep = step;
    this.errorMessage = '';
    this.successMessage = '';
    if (step !== 'registerVerify' && step !== 'forgotVerify') this.clearCountdown();
    this.focusFirstField();
  }

  public async onLoginSubmit(event: Event) {
    event.preventDefault();
    this.errorMessage = '';

    const identifier = this.loginUsername.trim();
    if (!identifier || !this.loginPassword) {
      this.errorMessage = 'Vui lòng nhập email/tên đăng nhập và mật khẩu.';
      return;
    }

    this.isSubmitting = true;
    const res = await this.authService.login(identifier, this.loginPassword);
    this.isSubmitting = false;

    if (res.success && res.user) {
      this.requestClose();
      if (res.user.role === 'admin') {
        this.router.navigate(['/admin']);
      }
      return;
    }

    if (res.code === 'EMAIL_NOT_VERIFIED' && res.email) {
      this.verificationEmail = res.email;
      this.mode = 'register';
      this.resetOtpInputs();
      this.startCountdown(60);
      this.authStep = 'registerVerify';
      this.errorMessage = res.message || 'Tài khoản chưa được xác thực.';
      return;
    }

    this.errorMessage = res.message || 'Đăng nhập thất bại.';
  }

  public async onRegisterSubmit(event: Event) {
    event.preventDefault();
    this.errorMessage = '';

    const username = this.registerUsername.trim();
    const email = this.registerEmail.trim().toLowerCase();
    const password = this.registerPassword;
    const confirmPassword = this.registerConfirmPassword;

    if (!username) return this.setError('Tên đăng nhập không được để trống.');
    if (username.length < 3) return this.setError('Tên đăng nhập phải có ít nhất 3 ký tự.');
    if (!email) return this.setError('Email không được để trống.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.setError('Email không hợp lệ.');
    if (!password) return this.setError('Mật khẩu không được để trống.');
    if (!PASSWORD_REGEX.test(password)) return this.setError(PASSWORD_MESSAGE);
    if (!confirmPassword) return this.setError('Vui lòng xác nhận mật khẩu.');
    if (password !== confirmPassword) return this.setError('Mật khẩu xác nhận không khớp.');

    this.isSubmitting = true;
    const res = await this.authService.register({ username, email, password });
    this.isSubmitting = false;

    if (res.success && res.requiresVerification) {
      this.verificationEmail = email;
      this.resetOtpInputs();
      this.startCountdown(60);
      this.successMessage = res.message || 'Mã xác thực đã được gửi đến email của bạn.';
      this.authStep = 'registerVerify';
      return;
    }

    this.errorMessage = res.message || 'Đăng ký thất bại.';
  }

  public openRecovery() {
    this.identifier = '';
    this.resetToken = '';
    this.setStep('forgot');
  }

  public async onForgotSubmit(event: Event) {
    event.preventDefault();
    this.errorMessage = '';
    const email = this.identifier.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMessage = 'Vui lòng nhập địa chỉ email hợp lệ.';
      return;
    }

    this.isSubmitting = true;
    const res = await this.authService.requestForgotPasswordOtp(email);
    this.isSubmitting = false;

    if (res.success) {
      this.verificationEmail = email;
      this.resetOtpInputs();
      this.startCountdown(60);
      this.successMessage = res.message || 'Nếu email tồn tại trong hệ thống, mã xác thực đã được gửi.';
      this.authStep = 'forgotVerify';
      return;
    }

    this.errorMessage = res.message || 'Không thể gửi mã xác thực.';
    if (res.retryAfterSeconds) this.startCountdown(res.retryAfterSeconds);
  }

  public async verifyRegisterOtp(event: Event) {
    event.preventDefault();
    await this.submitCurrentOtp();
  }

  public async verifyForgotOtp(event: Event) {
    event.preventDefault();
    await this.submitCurrentOtp();
  }

  private async submitCurrentOtp() {
    if (this.isSubmitting) return;
    if (this.authStep !== 'registerVerify' && this.authStep !== 'forgotVerify') return;
    await this.verifyOtpWithApi(this.authStep);
  }

  private async verifyOtpWithApi(step: 'registerVerify' | 'forgotVerify') {
    this.errorMessage = '';
    const otp = this.otpDigits.join('');
    if (!/^\d{6}$/.test(otp)) {
      this.errorMessage = 'Vui lòng nhập đầy đủ 6 chữ số OTP.';
      return;
    }

    this.isSubmitting = true;
    const res = step === 'registerVerify'
      ? await this.authService.verifyRegisterOtp(this.verificationEmail, otp)
      : await this.authService.verifyForgotPasswordOtp(this.verificationEmail, otp);
    this.isSubmitting = false;

    if (!res.success) {
      this.errorMessage = res.message || 'Xác thực OTP thất bại.';
      return;
    }

    this.clearCountdown();
    if (step === 'registerVerify') {
      this.successMessage = res.message || 'Xác thực tài khoản thành công.';
      this.requestClose();
      if (res.user?.role === 'admin') {
        this.router.navigate(['/admin']);
      }
      return;
    }

    this.resetToken = res.resetToken || '';
    this.successMessage = res.message || 'Xác thực OTP thành công.';
    this.authStep = 'reset';
  }

  public async resendOtp() {
    if (this.resendSeconds > 0 || !this.verificationEmail) return;

    this.isSubmitting = true;
    const res = this.authStep === 'registerVerify'
      ? await this.authService.resendRegisterOtp(this.verificationEmail)
      : await this.authService.requestForgotPasswordOtp(this.verificationEmail);
    this.isSubmitting = false;

    if (res.success) {
      this.errorMessage = '';
      this.resetOtpInputs();
      this.successMessage = res.message || 'Mã xác thực mới đã được gửi.';
      this.startCountdown(60);
      return;
    }

    this.errorMessage = res.message || 'Gửi lại mã thất bại.';
    if (res.retryAfterSeconds) this.startCountdown(res.retryAfterSeconds);
  }

  public async onResetSubmit(event: Event) {
    event.preventDefault();
    this.errorMessage = '';

    if (!PASSWORD_REGEX.test(this.resetForm.password)) {
      this.errorMessage = PASSWORD_MESSAGE;
      return;
    }

    if (this.resetForm.password !== this.resetForm.confirmPassword) {
      this.errorMessage = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    this.isSubmitting = true;
    const res = await this.authService.resetForgotPassword(this.resetToken, this.resetForm.password);
    this.isSubmitting = false;

    if (res.success) {
      this.mode = 'login';
      this.authStep = 'login';
      this.loginUsername = this.verificationEmail;
      this.loginPassword = '';
      this.resetToken = '';
      this.resetForm = { password: '', confirmPassword: '' };
      this.errorMessage = '';
      this.successMessage = res.message || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.';
      this.focusFirstField();
      return;
    }

    this.errorMessage = res.message || 'Đặt lại mật khẩu thất bại.';
  }

  public onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    this.otpDigits[index] = value;
    input.value = value;

    if (value && index < 5) {
      setTimeout(() => {
        const nextInput = this.getOtpInput(index + 1);
        if (nextInput && nextInput.value === value && !this.otpDigits[index + 1]) {
          nextInput.value = '';
        }
        this.focusOtp(index + 1);
      }, 0);
      return;
    }

    if (this.otpDigits.every((digit) => digit.length === 1)) {
      setTimeout(() => this.submitCurrentOtp(), 80);
    }
  }

  public onOtpKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      setTimeout(() => this.focusOtp(index - 1), 0);
    }
  }

  public onOtpPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    if (!text) return;
    event.preventDefault();
    this.otpDigits = Array.from({ length: 6 }, (_, index) => text[index] || '');
    setTimeout(() => {
      this.focusOtp(Math.min(text.length, 6) - 1);
      if (text.length === 6) this.submitCurrentOtp();
    }, 0);
  }

  public alertSocial(provider: string) {
    if (provider === 'Google') {
      const clientId = (window as any).GOOGLE_CLIENT_ID || (window as any).env?.GOOGLE_CLIENT_ID;
      if (clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID') {
        this.openRealGoogleLogin(clientId);
      } else {
        this.showDevMessage = true;
      }
    } else {
      this.showDevMessage = true;
    }
  }

  private openRealGoogleLogin(clientId: string) {
    const google = (window as any).google;
    if (!google) {
      alert('Không thể tải Google Sign-In SDK. Vui lòng kiểm tra lại kết nối mạng.');
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile',
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            this.fetchGoogleProfile(tokenResponse.access_token);
          }
        }
      });
      client.requestAccessToken();
    } catch (e) {
      console.error('Failed to initialize Google token client:', e);
      alert('Cấu hình Google Client ID không hợp lệ hoặc không được hỗ trợ từ nguồn này.');
    }
  }

  private async fetchGoogleProfile(accessToken: string) {
    try {
      this.isSubmitting = true;
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profile = await response.json();
      this.isSubmitting = false;
      if (profile && profile.email) {
        await this.submitGoogleSim(profile.email, profile.name || profile.email.split('@')[0]);
      } else {
        this.errorMessage = 'Không thể lấy thông tin tài khoản Google từ API.';
      }
    } catch (err) {
      this.isSubmitting = false;
      this.errorMessage = 'Lỗi kết nối khi lấy thông tin tài khoản Google.';
      console.error(err);
    }
  }

  public async submitGoogleSim(email: string, fullname: string) {
    this.errorMessage = '';
    this.isSubmitting = true;
    const res = await this.authService.googleLogin(email, fullname);
    this.isSubmitting = false;
    if (res.success && res.user) {
      this.requestClose();
      if (res.user.role === 'admin') {
        this.router.navigate(['/admin']);
      }
    } else {
      this.errorMessage = res.message || 'Đăng nhập Google thất bại.';
    }
  }


  private setError(message: string) {
    this.errorMessage = message;
  }

  private resetOtpInputs() {
    this.otpDigits = ['', '', '', '', '', ''];
    setTimeout(() => this.focusOtp(0), 80);
  }

  private startCountdown(seconds: number) {
    this.clearCountdown();
    this.resendSeconds = Math.max(0, Math.ceil(seconds));
    this.cdr.detectChanges();
    this.countdownTimer = window.setInterval(() => {
      this.resendSeconds = Math.max(0, this.resendSeconds - 1);
      this.cdr.detectChanges();
      if (this.resendSeconds === 0) this.clearCountdown();
    }, 1000);
  }

  private clearCountdown() {
    if (this.countdownTimer) window.clearInterval(this.countdownTimer);
    this.countdownTimer = undefined;
    this.cdr.detectChanges();
  }

  private focusFirstField() {
    setTimeout(() => this.firstField?.nativeElement.focus(), 80);
  }

  private focusOtp(index: number) {
    this.getOtpInput(index)?.focus();
  }

  private getOtpInput(index: number): HTMLInputElement | undefined {
    const dialog = this.loginDialog?.nativeElement;
    return dialog?.querySelectorAll<HTMLInputElement>('.otp-input')[index];
  }

  private trapFocus(event: KeyboardEvent) {
    const dialog = this.loginDialog?.nativeElement;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }
}

export { LoginModalComponent as LoginModal };
