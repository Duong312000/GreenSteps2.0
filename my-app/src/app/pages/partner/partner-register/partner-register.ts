import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User } from '../../../models/models';

@Component({
  selector: 'app-partner-register',
  standalone: false,
  templateUrl: './partner-register.html',
})
export class PartnerRegisterComponent implements OnInit {
  public currentUser: User | null = null;

  // Form parameters
  public companyName: string = '';
  public bizEmail: string = '';
  public bizPhone: string = '';
  public bizLicense: string = '';
  public bizCategory: string = 'stay';
  public bizDesc: string = '';
  public agreeTerms: boolean = false;

  // Terminal Approval Modal State
  public terminalApprovalState: 'pending' | 'success' | 'error' = 'pending';
  public terminalApprovalTitle: string = 'Đang Chờ Phê Duyệt';
  public terminalApprovalMsg: string = '';
  public isTerminalModalOpen: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private loginModalService: LoginModalService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.role === 'provider') {
        this.router.navigate(['/partner-dashboard']);
      }
    });
  }

  public async registerPartner(event: Event) {
    event.preventDefault();
    if (!this.agreeTerms) {
      alert('Bạn phải đồng ý với Điều khoản Hợp tác của GreenSteps!');
      return;
    }

    if (!this.currentUser) {
      alert('Vui lòng đăng nhập trước khi đăng ký làm đối tác!');
      this.loginModalService.open();
      return;
    }

    const userId = this.currentUser.id || this.currentUser._id || '';

    const updateData = {
      role: 'provider',
      company_name: this.companyName,
      companyName: this.companyName,
      email: this.bizEmail || this.currentUser.email,
      phone: this.bizPhone || this.currentUser.phone
    };

    this.terminalApprovalState = 'pending';
    this.terminalApprovalTitle = 'Đang Chờ Phê Duyệt';
    this.terminalApprovalMsg = 'Yêu cầu đăng ký Nhà cung cấp đối tác đang chờ Quản trị viên duyệt trên Terminal máy chủ.';
    this.isTerminalModalOpen = true;

    try {
      const res = await this.authService.updateProfile(userId, updateData);
      if (res.success) {
        if (res.pending) {
          this.terminalApprovalState = 'success';
          this.terminalApprovalTitle = 'Đăng Ký Đang Chờ Duyệt';
          this.terminalApprovalMsg = 'Yêu cầu đăng ký nhà cung cấp của bạn đã được gửi thành công và đang chờ Quản trị viên phê duyệt.';
          setTimeout(() => {
            this.isTerminalModalOpen = false;
            this.router.navigate(['/profile']);
          }, 3000);
        } else {
          this.terminalApprovalState = 'success';
          this.terminalApprovalTitle = 'Đăng Ký Thành Công';
          this.terminalApprovalMsg = 'Chúc mừng! Đăng ký Kênh nhà cung cấp đối tác thành công. Phân hệ Quản lý dịch vụ đã được kích hoạt.';
          setTimeout(() => {
            this.isTerminalModalOpen = false;
            this.router.navigate(['/partner-dashboard']);
          }, 2000);
        }
      } else {
        this.terminalApprovalState = 'error';
        this.terminalApprovalTitle = 'Đăng Ký Thất Bại';
        this.terminalApprovalMsg = res.message || 'Đăng ký đối tác bị từ chối hoặc thất bại.';
      }
    } catch (err) {
      this.terminalApprovalState = 'error';
      this.terminalApprovalTitle = 'Đăng Ký Thất Bại';
      this.terminalApprovalMsg = 'Đăng ký đối tác thất bại hoặc bị từ chối.';
    }
  }
}

export { PartnerRegisterComponent as PartnerRegister };
