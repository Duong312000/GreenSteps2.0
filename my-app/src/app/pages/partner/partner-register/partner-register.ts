import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User } from '../../../models/models';

@Component({
  selector: 'app-partner-register',
  standalone: false,
  templateUrl: './partner-register.html',
  styleUrl: './partner-register.css',
})
export class PartnerRegisterComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('applicationSection') private applicationSection?: ElementRef<HTMLElement>;
  private applicationObserver?: IntersectionObserver;
  public isApplicationVisible = false;
  public currentUser: User | null = null;
  public companyName = '';
  public contactName = '';
  public bizEmail = '';
  public bizPhone = '';
  public bizLicense = '';
  public bizCategory = '';
  public province = '';
  public bizDesc = '';
  public agreeTerms = false;
  public agreePaymentPolicy = false;
  public selectedDocument: File | null = null;
  public isSubmitting = false;
  public attemptedSubmit = false;
  public submitError = '';
  public submitSuccess = false;
  public isTerminalModalOpen = false;
  public terminalApprovalState: 'pending' | 'success' | 'error' = 'pending';
  public terminalApprovalTitle = '';
  public terminalApprovalMsg = '';
  public readonly faqItems = [
    { q: 'Đăng ký đối tác có mất phí không?', a: 'Tạo hồ sơ trên GreenSteps hiện không mất phí. Các khoản phí áp dụng (nếu có) sẽ được thông báo rõ trong thỏa thuận hợp tác.' },
    { q: 'Tôi cần chuẩn bị những giấy tờ nào?', a: 'Bạn nên chuẩn bị giấy phép kinh doanh hoặc giấy tờ cá nhân phù hợp, thông tin liên hệ và tài khoản nhận thanh toán.' },
    { q: 'Hồ sơ được duyệt trong bao lâu?', a: 'Trong 2 ngày làm việc.' },
    { q: 'Có thể đăng ký nhiều loại hình cùng lúc không?', a: 'Có. Hãy chọn loại hình chính trong biểu mẫu và mô tả thêm các dịch vụ khác trong phần giới thiệu.' },
    { q: 'Tôi có thể cập nhật thông tin sau khi gửi không?', a: 'Bạn có thể liên hệ đội ngũ hỗ trợ để bổ sung hoặc điều chỉnh hồ sơ trong thời gian chờ duyệt.' },
    { q: 'Giấy tờ tải lên có bắt buộc không?', a: 'Không bắt buộc ở bước đăng ký ban đầu. Tệp đính kèm được giữ trong phiên hiện tại; chức năng lưu hồ sơ giấy tờ sẽ được kết nối với API sau.' },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private loginModalService: LoginModalService,
    title: Title,
    meta: Meta,
  ) {
    title.setTitle('Trở thành đối tác | GreenSteps Travel');
    meta.updateTag({ name: 'description', content: 'Đăng ký trở thành đối tác GreenSteps, giới thiệu dịch vụ du lịch xanh và tiếp cận cộng đồng du khách bền vững.' });
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      // Do not leave this page while this form is promoting the applicant to provider;
      // keep the success dialog visible. Existing providers still go to their dashboard.
      if (user?.role === 'provider' && !this.isSubmitting && !this.submitSuccess) this.router.navigate(['/partner-dashboard']);
    });
    this.route.fragment.subscribe(fragment => {
      if (fragment) setTimeout(() => document.getElementById(fragment)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      }));
    });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined' || !this.applicationSection) return;
    this.applicationObserver = new IntersectionObserver(([entry]) => {
      this.isApplicationVisible = entry.isIntersecting;
    }, { threshold: 0.12 });
    this.applicationObserver.observe(this.applicationSection.nativeElement);
  }

  ngOnDestroy(): void {
    this.applicationObserver?.disconnect();
  }

  public scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  get phoneIsValid(): boolean {
    return /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(this.bizPhone.replace(/[ .-]/g, ''));
  }

  get emailIsValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.bizEmail.trim());
  }

  get formIsValid(): boolean {
    return !!this.companyName.trim() && !!this.contactName.trim() &&
      this.emailIsValid && this.phoneIsValid &&
      !!this.bizCategory && !!this.province && this.agreeTerms && this.agreePaymentPolicy;
  }

  public onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.submitError = '';
    if (!file) { this.selectedDocument = null; return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.selectedDocument = null;
      input.value = '';
      this.submitError = 'Vui lòng chọn tệp PDF, JPG hoặc PNG không quá 5 MB.';
      return;
    }
    this.selectedDocument = file;
  }

  public async registerPartner(event: Event): Promise<void> {
    event.preventDefault();
    this.attemptedSubmit = true;
    this.submitError = '';
    if (!this.formIsValid || this.isSubmitting) return;
    if (!this.currentUser) {
      this.loginModalService.open();
      this.submitError = 'Vui lòng đăng nhập để gửi hồ sơ đăng ký đối tác.';
      return;
    }

    this.isSubmitting = true;
    this.terminalApprovalState = 'pending';
    this.terminalApprovalTitle = 'Đang gửi hồ sơ';
    this.terminalApprovalMsg = 'GreenSteps đang tiếp nhận thông tin đăng ký của bạn.';
    this.isTerminalModalOpen = true;
    try {
      const userId = this.currentUser.id || this.currentUser._id || '';
      const result = await this.authService.updateProfile(userId, {
        role: 'provider',
        company_name: this.companyName.trim(),
        companyName: this.companyName.trim(),
        fullname: this.contactName.trim(),
        email: this.bizEmail.trim(),
        phone: this.bizPhone.trim(),
        address: this.province,
      });
      if (!result.success) throw new Error(result.message || 'Không thể gửi hồ sơ lúc này.');

      // TODO: persist business category, license, description and optional document
      // when the partner application API supports these fields and secure file upload.
      this.submitSuccess = true;
      this.terminalApprovalState = 'success';
      this.terminalApprovalTitle = 'Hồ sơ đang chờ duyệt';
      this.terminalApprovalMsg = 'Hồ sơ đăng ký nhà cung cấp đã được gửi. Bạn có thể theo dõi trạng thái trong tài khoản của mình.';
    } catch (error) {
      this.terminalApprovalState = 'error';
      this.terminalApprovalTitle = 'Chưa gửi được hồ sơ';
      this.terminalApprovalMsg = error instanceof Error ? error.message : 'Đã xảy ra lỗi kết nối. Vui lòng thử lại.';
      this.submitError = this.terminalApprovalMsg;
    } finally {
      this.isSubmitting = false;
    }
  }

  public retrySubmit(): void {
    const form = document.querySelector<HTMLFormElement>('#partner-application-form');
    if (form) this.registerPartner(new Event('submit', { cancelable: true }));
  }
}

export { PartnerRegisterComponent as PartnerRegister };
