import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User } from '../../../models/models';
import { PARTNER_CONFIG, formatPartnerVnd } from '../partner-config';

type PartnerFaqGroup = 'registration' | 'operations';
interface PartnerFaqItem {
  id: string;
  q: string;
  group: PartnerFaqGroup;
  paragraphs: string[];
  paragraphsAfterList?: string[];
  bullets?: string[];
  links?: { label: string; route: string }[];
}

@Component({
  selector: 'app-partner-register',
  standalone: false,
  templateUrl: './partner-register.html',
  styleUrl: './partner-register.css',
})
export class PartnerRegisterComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('partnerPage') private pageRoot?: ElementRef<HTMLElement>;
  @ViewChild('applicationSection') private applicationSection?: ElementRef<HTMLElement>;
  private applicationObserver?: IntersectionObserver;
  private visualObservers: IntersectionObserver[] = [];
  private scrollFrame = 0;
  private readonly visualScrollHandler = (): void => {
    if (this.scrollFrame) return;
    this.scrollFrame = window.requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.updateScrollVisuals();
    });
  };
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
  public readonly partnerConfig = PARTNER_CONFIG;
  public readonly faqItems: PartnerFaqItem[] = [
    {
      id: 'faq-registration-fee', group: 'registration', q: 'Đăng ký đối tác có mất phí không?',
      paragraphs: [
        'Đăng ký hồ sơ ban đầu hoàn toàn miễn phí. Bạn chỉ cần điền thông tin cơ bản và gửi hồ sơ để GreenSteps xem xét.',
        'Khi hợp tác chính thức, mức hoa hồng hoặc phí dịch vụ (nếu có) được nêu rõ trong hợp đồng đối tác và Điều khoản dành cho nhà cung cấp. Bạn sẽ biết đầy đủ các khoản này trước khi xác nhận hợp tác, không có khoản thu nào phát sinh mà chưa được thông báo.',
      ],
      links: [{ label: 'Điều khoản dành cho nhà cung cấp', route: '/provider-terms' }],
    },
    {
      id: 'faq-documents', group: 'registration', q: 'Tôi cần chuẩn bị những giấy tờ nào?',
      paragraphs: ['Giấy tờ phụ thuộc vào loại hình hoạt động của bạn:'],
      bullets: [
        'Doanh nghiệp / hộ kinh doanh: giấy phép kinh doanh hoặc mã số thuế.',
        'Cá nhân: giấy tờ tùy thân hợp lệ.',
        'Thông tin người đại diện và kênh liên hệ đang hoạt động (email, số điện thoại).',
        'Tài khoản ngân hàng nhận thanh toán, đứng tên đúng chủ thể đăng ký.',
        'Giấy phép chuyên ngành nếu có (ví dụ lưu trú, lữ hành, an toàn thực phẩm).',
      ],
      paragraphsAfterList: ['Bạn chưa cần tải đủ giấy tờ ở bước đăng ký, có thể bổ sung sau khi gửi hồ sơ.'],
    },
    {
      id: 'faq-review-time', group: 'registration', q: 'Hồ sơ được duyệt trong bao lâu?',
      paragraphs: [
        `GreenSteps xem xét hồ sơ trong tối đa ${PARTNER_CONFIG.reviewDays} ngày làm việc kể từ khi nhận đủ thông tin. Nếu cần bổ sung, đội ngũ sẽ liên hệ qua email hoặc số điện thoại bạn đã đăng ký, và thời gian xét duyệt được tính tiếp từ lúc bạn gửi đủ.`,
        'Bạn có thể theo dõi tiến trình qua trạng thái hồ sơ: Chờ duyệt, Cần bổ sung, Đã duyệt hoặc Từ chối.',
      ],
    },
    {
      id: 'faq-rejected', group: 'registration', q: 'Hồ sơ bị từ chối hoặc cần bổ sung thì sao?',
      paragraphs: [
        `Nếu hồ sơ chưa đạt, bạn sẽ nhận được thông báo kèm lý do cụ thể và hướng dẫn chỉnh sửa. Bạn có thể bổ sung thông tin và gửi lại bất cứ lúc nào, không bị giới hạn số lần và không mất phí.`,
        `Trường hợp cần làm rõ thêm, bạn liên hệ ${PARTNER_CONFIG.supportEmail} để được hỗ trợ trực tiếp.`,
      ],
    },
    {
      id: 'faq-multiple-types', group: 'registration', q: 'Tôi có thể đăng ký nhiều loại hình cùng lúc không?',
      paragraphs: [
        'Có. Một nhà cung cấp có thể hoạt động ở nhiều loại hình như Dịch vụ, Tour, Khuyến mãi & thương hiệu trên cùng một tài khoản. Mỗi loại hình có thể yêu cầu giấy tờ riêng, ví dụ giấy phép lữ hành cho tour hoặc giấy phép lưu trú cho dịch vụ lưu trú. Bạn chọn loại hình chính khi đăng ký và bổ sung các loại hình khác trong trang quản lý sau khi được duyệt.',
      ],
    },
    {
      id: 'faq-document-security', group: 'registration', q: 'Giấy tờ tải lên có bắt buộc không, và có được bảo mật không?',
      paragraphs: [
        'Ở bước đăng ký, việc tải giấy tờ là tùy chọn (định dạng PDF, JPG hoặc PNG, tối đa 5 MB mỗi tệp). Tuy nhiên bạn cần hoàn tất giấy tờ để hồ sơ được duyệt đầy đủ và để nhận thanh toán.',
        'Giấy tờ chỉ dùng để xác minh nhà cung cấp, được lưu trữ an toàn và chỉ những người có thẩm quyền trong quy trình xét duyệt mới được truy cập.',
      ],
    },
    {
      id: 'faq-payout', group: 'operations', q: 'Khi nào và bằng cách nào tôi nhận được thanh toán?',
      paragraphs: [
        `Doanh thu từ các booking hoàn tất được đối soát ${PARTNER_CONFIG.reconciliationDay} (chốt cho các giao dịch của tuần trước). Số tiền thực nhận hiển thị trong Ví nhà cung cấp, bao gồm mã giao dịch, hoa hồng và khoản thực nhận cho từng booking.`,
        `Bạn gửi yêu cầu rút tiền từ Ví về tài khoản ngân hàng đã xác minh. Hạn mức tối thiểu mỗi lần rút là ${formatPartnerVnd(PARTNER_CONFIG.minimumWithdrawalVnd)} và thời gian xử lý từ ${PARTNER_CONFIG.withdrawalProcessingDays} ngày làm việc.`,
      ],
      links: [{ label: 'Chính sách thanh toán', route: '/payment-policy' }],
    },
    {
      id: 'faq-cancellation', group: 'operations', q: 'Nếu khách hủy hoặc có khiếu nại về giao dịch thì xử lý thế nào?',
      paragraphs: [
        'Việc hủy và hoàn tiền tuân theo chính sách hủy mà bạn thiết lập cho từng dịch vụ, trong khuôn khổ Điều khoản dành cho nhà cung cấp. Khi có khiếu nại, bạn nhận thông báo và cung cấp thông tin trong thời hạn quy định, GreenSteps đối chiếu hai phía và phản hồi kết quả.',
        `Khiếu nại về giao dịch được tiếp nhận trong vòng ${PARTNER_CONFIG.disputeWindowDays} ngày kể từ ngày phát sinh, hoàn tiền (nếu có) được xử lý trong ${PARTNER_CONFIG.refundProcessingDays} ngày làm việc.`,
      ],
      links: [{ label: 'Chính sách thanh toán – Hoàn tiền và hủy giao dịch', route: '/payment-policy#hoan-tien' }],
    },
    {
      id: 'faq-support', group: 'operations', q: 'Tôi liên hệ ai khi cần hỗ trợ trong quá trình vận hành?',
      paragraphs: [
        `Bạn có thể gửi yêu cầu đến ${PARTNER_CONFIG.supportEmail} kèm mã hồ sơ (dạng VC-xxxxxx) hoặc mã giao dịch để được xử lý nhanh hơn. Đội ngũ đối tác phản hồi trong giờ làm việc. Với sự cố khẩn cấp ảnh hưởng đến khách đang sử dụng dịch vụ, vui lòng nêu rõ “Khẩn” ở tiêu đề email.`,
      ],
    },
  ];
  public readonly faqGroups = [
    { id: 'registration', label: 'Đăng ký & hồ sơ' },
    { id: 'operations', label: 'Vận hành & thanh toán' },
  ] as const;
  public readonly openFaqIds = new Set<string>(['faq-registration-fee']);
  private faqSchemaScript?: HTMLScriptElement;
  private readonly partnerSubmissionStorageKey = 'greensteps.partnerApplicationSubmittedUserId';

  constructor(
    private authService: AuthService,
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
      if (typeof window !== 'undefined') {
        const userId = user?.id || user?._id || '';
        try {
          if (user?.role === 'provider') {
            sessionStorage.removeItem(this.partnerSubmissionStorageKey);
            this.submitSuccess = false;
          } else {
            this.submitSuccess = !!userId && sessionStorage.getItem(this.partnerSubmissionStorageKey) === userId;
          }
        } catch { /* Storage can be unavailable; the live submission state still works. */ }
      }
      // Keep approved providers here so the final step can show its dashboard action.
    });
    this.route.fragment.subscribe(fragment => {
      if (fragment) setTimeout(() => document.getElementById(fragment)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      }));
    });
  }

  ngAfterViewInit(): void {
    this.setupVisualEnhancements();
    this.installFaqStructuredData();
    if (typeof IntersectionObserver !== 'undefined' && this.applicationSection) {
      this.applicationObserver = new IntersectionObserver(([entry]) => {
        this.isApplicationVisible = entry.isIntersecting;
      }, { threshold: 0.12 });
      this.applicationObserver.observe(this.applicationSection.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.applicationObserver?.disconnect();
    this.visualObservers.forEach(observer => observer.disconnect());
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.visualScrollHandler);
      if (this.scrollFrame) window.cancelAnimationFrame(this.scrollFrame);
    }
    this.faqSchemaScript?.remove();
  }

  public faqItemsFor(group: PartnerFaqGroup): PartnerFaqItem[] {
    return this.faqItems.filter(item => item.group === group);
  }

  public isFaqOpen(id: string): boolean {
    return this.openFaqIds.has(id);
  }

  public toggleFaq(id: string): void {
    if (this.openFaqIds.has(id)) this.openFaqIds.delete(id);
    else this.openFaqIds.add(id);
  }

  private installFaqStructuredData(): void {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('partner-faq-jsonld');
    existing?.remove();
    const script = document.createElement('script');
    script.id = 'partner-faq-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqItems.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: [...item.paragraphs, ...(item.bullets || []), ...(item.paragraphsAfterList || []), ...(item.links || []).map(link => link.label)].join(' '),
        },
      })),
    });
    document.head.appendChild(script);
    this.faqSchemaScript = script;
  }

  get formCompletionPercent(): number {
    const requiredFields = [
      !!this.companyName.trim(), !!this.contactName.trim(), this.emailIsValid,
      this.phoneIsValid, !!this.bizCategory, !!this.province.trim(),
      this.agreeTerms, this.agreePaymentPolicy,
    ];
    return Math.round(requiredFields.filter(Boolean).length / requiredFields.length * 100);
  }

  private setupVisualEnhancements(): void {
    const root = this.pageRoot?.nativeElement;
    if (!root || typeof window === 'undefined') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealTargets = root.querySelectorAll<HTMLElement>(
      '.partner-hero, .partner-stats, .content-section, .application-section, .final-cta',
    );
    revealTargets.forEach(target => target.classList.add('reveal-on-scroll'));
    root.querySelectorAll<HTMLElement>('.stat-card, .benefit-card, .type-card, .steps li, .checklist li')
      .forEach((item, index) => {
        item.classList.add('reveal-item');
        item.style.setProperty('--reveal-order', String(index % 6));
      });

    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll('.reveal-on-scroll, .reveal-item').forEach(node => node.classList.add('is-visible'));
      this.updateScrollVisuals();
      return;
    }

    root.classList.add('partner-visual-ready');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    [...root.querySelectorAll<HTMLElement>('.reveal-on-scroll, .reveal-item')].forEach(target => revealObserver.observe(target));
    this.visualObservers.push(revealObserver);

    const countObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        this.animateMetric(element);
        countObserver.unobserve(element);
      });
    }, { threshold: 0.55 });
    root.querySelectorAll<HTMLElement>('[data-count]').forEach(element => countObserver.observe(element));
    this.visualObservers.push(countObserver);

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      root.querySelectorAll<HTMLElement>('.benefit-card, .type-card').forEach(card => {
        card.addEventListener('pointermove', event => {
          const bounds = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
          card.style.setProperty('--my', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
        }, { passive: true });
      });
    }

    window.addEventListener('scroll', this.visualScrollHandler, { passive: true });
    this.updateScrollVisuals();
  }

  private animateMetric(element: HTMLElement): void {
    const target = Number(element.dataset['count']);
    if (!Number.isFinite(target)) return;
    const suffix = element.dataset['countSuffix'] || '';
    const format = (value: number): string => {
      const rounded = element.dataset['countFormat'] === 'decimal'
        ? value.toFixed(1).replace('.', ',')
        : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(value));
      return `${rounded}${suffix}`;
    };
    const startedAt = performance.now();
    const duration = 900;
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = format(target * eased);
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  private updateScrollVisuals(): void {
    const root = this.pageRoot?.nativeElement;
    if (!root) return;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty('--partner-scroll-progress', `${Math.min(100, Math.max(0, window.scrollY / maxScroll * 100))}%`);

    const hero = root.querySelector<HTMLElement>('.partner-hero__art');
    if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const travelled = Math.max(0, -hero.getBoundingClientRect().top);
      hero.style.setProperty('--hero-parallax', `${Math.min(24, travelled * 0.055)}px`);
    }

    const process = root.querySelector<HTMLElement>('.process-section');
    if (process) {
      process.style.setProperty('--process-progress', this.partnerProcessProgress);
    }
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

  get partnerProcessStep(): number {
    if (this.currentUser?.role === 'provider') return 4;
    if (this.submitSuccess) return 3;
    if (this.isSubmitting) return 2;
    return 1;
  }

  get partnerProcessProgress(): string {
    return String((this.partnerProcessStep - 1) / 3);
  }

  public onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.submitError = '';
    if (!file) { this.selectedDocument = null; return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type) || file.size > PARTNER_CONFIG.documentMaxSizeMb * 1024 * 1024) {
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
      try { sessionStorage.setItem(this.partnerSubmissionStorageKey, userId); } catch { /* Keep the status for this page session when storage is available. */ }
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
