import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User } from '../../../models/models';

@Component({
  selector: 'app-partner-promotions',
  standalone: false,
  templateUrl: './partner-promotions.html',
})
export class PartnerPromotionsComponent implements OnInit {
  public currentUser: User | null = null;

  // Mock campaign data (no backend API yet)
  public campaigns = [
    {
      id: 'ADC001',
      name: 'Khám Phá Sương Mù Đà Lạt',
      type: 'Mùa Thu 2024',
      typeClass: 'tag-season',
      views: '1.2k',
      bookings: 45,
      status: 'active',
      statusLabel: 'Đang chạy',
      daysLeft: 12,
    },
    {
      id: 'ADC002',
      name: 'Đêm Hội Trăng Rằm Hội An',
      type: 'Flash Sale',
      typeClass: 'tag-flash',
      views: '3.4k',
      bookings: 120,
      status: 'expired',
      statusLabel: 'Đã kết thúc',
      daysLeft: 0,
    }
  ];

  public vouchers = [
    { code: 'MUAHE24', discount: 200000, discountLabel: '-200K', scope: 'Tất cả dịch vụ', used: 45, max: 100, expires: '30/08/2024', colorClass: 'voucher-yellow' },
    { code: 'HOIANVIP', discount: 0.15, discountLabel: '-15%', scope: 'Phố Cổ Hội An', used: 12, max: null, expires: '31/12/2024', colorClass: 'voucher-green' }
  ];

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private loginModalService: LoginModalService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!user || user.role !== 'provider') {
        this.loginModalService.open();
      }
      this.cdr.detectChanges();
    });
  }

  public registerCampaign(name: string) {
    alert(`Đăng ký thành công chiến dịch: "${name}"!\nĐội ngũ đối tác sẽ liên hệ và thiết lập hiển thị cho bạn.`);
  }
}

export { PartnerPromotionsComponent as PartnerPromotions };
