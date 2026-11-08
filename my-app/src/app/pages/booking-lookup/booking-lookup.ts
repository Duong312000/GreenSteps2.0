import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-booking-lookup',
  standalone: false,
  templateUrl: './booking-lookup.html',
})
export class BookingLookupComponent implements OnInit {
  public bookingCode = '';
  public phone = '';
  public email = '';
  public isLoading = false;
  public resultsList: any[] = [];
  public errorMsg = '';
  public searchPerformed = false;
  public selectedBookingForRefund: any = null;
  public refundReason = 'Thay đổi lịch trình cá nhân';
  public refundBank = '';
  public refundAccount = '';
  public refundHolder = '';
  public refundSubmitting = false;
  public refundMessage = '';
  public refundRatePreview = 0;
  public refundAmountPreview = 0;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef, private route: ActivatedRoute) {}

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      this.bookingCode = code;
      this.lookup();
    }
  }

  public async lookup() {
    const codeInput = this.bookingCode.trim();
    const phoneInput = this.phone.trim();
    const emailInput = this.email.trim();

    if (!codeInput && !phoneInput && !emailInput) {
      this.errorMsg = 'Vui lòng nhập Số điện thoại, Email hoặc Mã đặt chỗ.';
      return;
    }

    this.isLoading = true;
    this.resultsList = [];
    this.errorMsg = '';
    this.searchPerformed = true;

    try {
      if (codeInput) {
        // Query by booking code
        const data = await this.apiService.getBooking(codeInput);
        if (data && data.success && data.booking) {
          const booking = data.booking;
          let matched = true;
          if (phoneInput && booking.customer_phone && booking.customer_phone !== phoneInput) matched = false;
          if (emailInput && booking.customer_email && booking.customer_email.toLowerCase() !== emailInput.toLowerCase()) matched = false;

          if (matched) {
            this.resultsList = [booking];
          } else {
            this.errorMsg = 'Thông tin Số điện thoại hoặc Email không khớp với Mã đặt chỗ.';
          }
        } else {
          this.errorMsg = 'Không tìm thấy đơn đặt chỗ với mã này. Vui lòng kiểm tra lại.';
        }
      } else {
        // Query by phone and/or email
        const list = await this.apiService.lookupBookingsByPhone(phoneInput, emailInput);
        if (list && list.length > 0) {
          this.resultsList = list;
        } else {
          this.errorMsg = 'Không tìm thấy đơn đặt chỗ nào khớp với thông tin cung cấp.';
        }
      }
    } catch {
      this.errorMsg = 'Đã xảy ra lỗi khi tìm kiếm. Vui lòng thử lại sau.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  public getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      deposit: 'Đã đặt cọc',
      confirmed: 'Đã xác nhận',
      accepted: 'Đã chấp nhận',
      rejected: 'Bị từ chối',
      cancelled: 'Đã hủy',
      completed: 'Hoàn thành',
    };
    return map[status] || status;
  }

    public openRefundModal(booking: any) {
    this.selectedBookingForRefund = booking;
    this.refundMessage = '';
    this.refundSubmitting = false;

    const today = new Date();
    const tourDate = new Date(booking.booking_date);
    const diffTime = tourDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 7) {
      this.refundRatePreview = 100;
    } else if (diffDays >= 3) {
      this.refundRatePreview = 50;
    } else {
      this.refundRatePreview = 0;
    }

    const val = Number(booking.value) || 0;
    this.refundAmountPreview = Math.round(val * (this.refundRatePreview / 100));
    this.cdr.detectChanges();
  }

  public closeRefundModal() {
    this.selectedBookingForRefund = null;
    this.refundMessage = '';
    this.cdr.detectChanges();
  }

  public async submitRefund() {
    if (!this.selectedBookingForRefund || this.refundSubmitting) return;

    if (this.refundRatePreview > 0 && (!this.refundBank.trim() || !this.refundAccount.trim() || !this.refundHolder.trim())) {
      this.refundMessage = 'Vui lòng điền đủ thông tin tài khoản để nhận hoàn tiền.';
      return;
    }

    this.refundSubmitting = true;
    this.refundMessage = '';

    try {
      const res = await this.apiService.requestRefund({
        bookingId: this.selectedBookingForRefund.id,
        reason: this.refundReason,
        bankName: this.refundBank,
        accountNumber: this.refundAccount,
        accountHolder: this.refundHolder
      });

      if (res.success) {
        this.selectedBookingForRefund.status = 'rejected';
        this.selectedBookingForRefund.escrow_status = 'refund_pending';
        this.selectedBookingForRefund.rejection_reason = `[Yêu cầu hoàn tiền] ${res.message}`;
        this.refundMessage = res.message;
        setTimeout(() => {
          this.closeRefundModal();
        }, 2200);
      } else {
        this.refundMessage = res.message || 'Lỗi gửi yêu cầu hoàn tiền.';
      }
    } catch {
      this.refundMessage = 'Có lỗi xảy ra khi gửi yêu cầu.';
    } finally {
      this.refundSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  public getStatusClass(status: string): string {
    if (['deposit', 'confirmed', 'accepted', 'completed'].includes(status)) return 'ok';
    if (['rejected', 'cancelled'].includes(status)) return 'bad';
    return 'wait';
  }
}

export { BookingLookupComponent as BookingLookup };
