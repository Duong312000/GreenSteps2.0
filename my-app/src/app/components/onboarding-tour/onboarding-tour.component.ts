import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

export interface TourStep {
  step: string;
  title: string;
  desc: string;
  targetRoute?: string;
}

@Component({
  selector: 'app-onboarding-tour',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './onboarding-tour.component.html',
  styleUrl: './onboarding-tour.component.css'
})
export class OnboardingTourComponent implements OnInit, OnDestroy {
  public isVisible = false;
  public currentStepIndex = 0;
  private sub?: Subscription;

  public steps: TourStep[] = [
    {
      step: '01',
      title: 'Khám phá & Tìm kiếm',
      desc: 'Tìm kiếm tour hoặc dịch vụ sinh thái theo vùng miền và mức giảm phát thải CO2.',
      targetRoute: '/tours'
    },
    {
      step: '02',
      title: 'AI Lập lịch trình',
      desc: 'Nhập số ngày và ngân sách, trợ lý AI tự động sắp xếp hoạt động xanh phù hợp.',
      targetRoute: '/schedule'
    },
    {
      step: '03',
      title: 'Tối ưu & Tinh chỉnh',
      desc: 'Tự do đổi giờ, kéo thả hoạt động và sửa xung đột thời gian bằng 1 click.',
      targetRoute: '/schedule-editor'
    },
    {
      step: '04',
      title: 'Đặt cọc & Nhận vé',
      desc: 'Thanh toán cọc bảo chứng qua VietQR động và tra cứu E-Voucher tức thì.',
      targetRoute: '/booking-lookup'
    }
  ];

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Check if triggered via query param ?tour=1 or custom event
    this.sub = this.route.queryParams.subscribe(params => {
      if (params['tour'] === '1' || params['tour'] === 'true') {
        this.startTour();
      }
    });

    // Listen to custom window event
    window.addEventListener('open-onboarding-tour', this.onOpenTourEvent);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    window.removeEventListener('open-onboarding-tour', this.onOpenTourEvent);
  }

  private onOpenTourEvent = () => {
    this.startTour();
  };

  public startTour(): void {
    this.currentStepIndex = 0;
    this.isVisible = true;
  }

  public nextStep(): void {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
    } else {
      this.finishTour();
    }
  }

  public prevStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    }
  }

  public finishTour(): void {
    this.isVisible = false;
    try {
      localStorage.setItem('greensteps_tour_done', 'true');
    } catch {
      // ignore
    }
  }

  public goToTarget(): void {
    const route = this.steps[this.currentStepIndex].targetRoute;
    if (route) {
      this.finishTour();
      this.router.navigate([route]);
    }
  }
}

