import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.html',
})
export class AdminComponent implements OnInit {
  public activeTab: 'providers' | 'deposits' | 'withdrawals' | 'wallets' | 'bookings' = 'providers';
  public pendingProviders: any[] = [];
  public pendingDeposits: any[] = [];
  public pendingWithdrawals: any[] = [];
  public pendingWallets: any[] = [];
  public pendingBookings: any[] = [];

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  // Custom Dialog Modal
  public customDialog: { 
    message: string; 
    type: 'success' | 'error' | 'info' | 'confirm'; 
    onConfirm?: () => void; 
    onCancel?: () => void;
  } | null = null;

  public showAlert(message: string, type: 'success' | 'error' | 'info' = 'success', callback?: () => void) {
    this.customDialog = {
      message,
      type,
      onConfirm: () => {
        this.closeCustomDialog();
        if (callback) callback();
      }
    };
    this.cdr.detectChanges();
  }

  public showConfirm(message: string, onConfirm: () => void, onCancel?: () => void) {
    this.customDialog = {
      message,
      type: 'confirm',
      onConfirm: () => {
        this.closeCustomDialog();
        onConfirm();
      },
      onCancel: () => {
        this.closeCustomDialog();
        if (onCancel) onCancel();
      }
    };
    this.cdr.detectChanges();
  }

  public closeCustomDialog() {
    this.customDialog = null;
    this.cdr.detectChanges();
  }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      this.showAlert('Bạn không có quyền truy cập trang này!', 'error', () => {
        this.router.navigate(['/home']);
      });
      return;
    }

    await this.loadAllData();
  }

  public setActiveTab(tab: 'providers' | 'deposits' | 'withdrawals' | 'wallets' | 'bookings') {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  private async loadAllData() {
    await Promise.all([
      this.loadProviders(),
      this.loadDeposits(),
      this.loadWithdrawals(),
      this.loadWallets(),
      this.loadBookings()
    ]);
  }

  public async loadProviders() {
    this.pendingProviders = await this.apiService.getPendingProviders();
    this.cdr.detectChanges();
  }

  public async loadDeposits() {
    this.pendingDeposits = await this.apiService.getPendingDeposits();
    this.cdr.detectChanges();
  }

  public async loadWithdrawals() {
    this.pendingWithdrawals = await this.apiService.getPendingWithdrawals();
    this.cdr.detectChanges();
  }

  public async loadWallets() {
    this.pendingWallets = await this.apiService.getPendingWallets();
    this.cdr.detectChanges();
  }

  public async loadBookings() {
    this.pendingBookings = await this.apiService.getPendingBookings();
    this.cdr.detectChanges();
  }

  // Approvals & Rejections
  public async approveProvider(targetUserId: string) {
    if (!targetUserId) return;
    this.showConfirm('Bạn có chắc chắn muốn phê duyệt đối tác này và kích hoạt các quyền B2B của họ?', async () => {
      const success = await this.apiService.approveProvider(targetUserId);
      if (success) {
        this.showAlert('Phê duyệt đối tác thành công!', 'success');
        await this.loadProviders();
      } else {
        this.showAlert('Phê duyệt thất bại. Vui lòng thử lại!', 'error');
      }
    });
  }

  public async approveDeposit(txId: string) {
    this.showConfirm('Xác nhận số tiền nạp đã vào tài khoản ngân hàng và duyệt giao dịch này?', async () => {
      const success = await this.apiService.approveDeposit(txId);
      if (success) {
        this.showAlert('Đã duyệt nạp tiền ví thành công!', 'success');
        await this.loadDeposits();
      } else {
        this.showAlert('Phê duyệt thất bại!', 'error');
      }
    });
  }

  public async rejectDeposit(txId: string) {
    this.showConfirm('Từ chối giao dịch nạp tiền này?', async () => {
      const success = await this.apiService.rejectDeposit(txId);
      if (success) {
        this.showAlert('Đã từ chối giao dịch nạp tiền ví!', 'success');
        await this.loadDeposits();
      } else {
        this.showAlert('Thao tác thất bại!', 'error');
      }
    });
  }

  public async approveWithdrawal(wdId: string) {
    this.showConfirm('Xác nhận đối soát rút tiền ví và chuyển tiền về tài khoản ngân hàng đối tác?', async () => {
      const success = await this.apiService.approveWithdrawal(wdId);
      if (success) {
        this.showAlert('Phê duyệt rút tiền thành công!', 'success');
        await this.loadWithdrawals();
      } else {
        this.showAlert('Phê duyệt thất bại!', 'error');
      }
    });
  }

  public async rejectWithdrawal(wdId: string) {
    this.showConfirm('Từ chối giao dịch rút tiền này?', async () => {
      const success = await this.apiService.rejectWithdrawal(wdId);
      if (success) {
        this.showAlert('Đã từ chối giao dịch rút tiền ví!', 'success');
        await this.loadWithdrawals();
      } else {
        this.showAlert('Thao tác thất bại!', 'error');
      }
    });
  }

  public async approveWallet(txId: string) {
    this.showConfirm('Phê duyệt kích hoạt ví GreenSteps cho khách hàng này và tặng 200k?', async () => {
      const success = await this.apiService.approveWallet(txId);
      if (success) {
        this.showAlert('Kích hoạt ví và cộng quà thưởng thành công!', 'success');
        await this.loadWallets();
      } else {
        this.showAlert('Duyệt ví thất bại!', 'error');
      }
    });
  }

  public async rejectWallet(txId: string) {
    this.showConfirm('Từ chối yêu cầu kích hoạt ví này?', async () => {
      const success = await this.apiService.rejectWallet(txId);
      if (success) {
        this.showAlert('Đã từ chối yêu cầu kích hoạt ví!', 'success');
        await this.loadWallets();
      } else {
        this.showAlert('Thao tác thất bại!', 'error');
      }
    });
  }

  public async approveBooking(bookingId: string) {
    this.showConfirm('Phê duyệt và xác nhận thanh toán/giữ chỗ cho đơn hàng này?', async () => {
      const success = await this.apiService.approveBooking(bookingId);
      if (success) {
        this.showAlert('Phê duyệt đơn hàng thành công!', 'success');
        await this.loadBookings();
      } else {
        this.showAlert('Phê duyệt thất bại!', 'error');
      }
    });
  }

  public async rejectBooking(bookingId: string) {
    this.showConfirm('Từ chối đơn hàng này?', async () => {
      const success = await this.apiService.rejectBooking(bookingId);
      if (success) {
        this.showAlert('Đã từ chối đơn đặt chỗ!', 'success');
        await this.loadBookings();
      } else {
        this.showAlert('Thao tác thất bại!', 'error');
      }
    });
  }

  public async approveAllBookings() {
    if (this.pendingBookings.length === 0) return;
    this.showConfirm(`Phê duyệt tất cả ${this.pendingBookings.length} đơn hàng đang chờ duyệt?`, async () => {
      let successCount = 0;
      let failCount = 0;
      for (const item of this.pendingBookings) {
        const ok = await this.apiService.approveBooking(item.id);
        if (ok) successCount++; else failCount++;
      }
      await this.loadBookings();
      this.showAlert(
        `Hoàn thành: ${successCount} thành công${failCount > 0 ? ', ' + failCount + ' thất bại' : ''}.`,
        failCount > 0 ? 'error' : 'success'
      );
    });
  }

  public async rejectAllBookings() {
    if (this.pendingBookings.length === 0) return;
    this.showConfirm(`Từ chối tất cả ${this.pendingBookings.length} đơn hàng đang chờ duyệt? Hành động này không thể hoàn tác!`, async () => {
      let successCount = 0;
      let failCount = 0;
      for (const item of this.pendingBookings) {
        const ok = await this.apiService.rejectBooking(item.id);
        if (ok) successCount++; else failCount++;
      }
      await this.loadBookings();
      this.showAlert(
        `Đã từ chối: ${successCount} đơn${failCount > 0 ? ', ' + failCount + ' thất bại' : ''}.`,
        failCount > 0 ? 'error' : 'success'
      );
    });
  }
}

export { AdminComponent as Admin };
