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

  public getStatusClass(status: string): string {
    if (['deposit', 'confirmed', 'accepted', 'completed'].includes(status)) return 'ok';
    if (['rejected', 'cancelled'].includes(status)) return 'bad';
    return 'wait';
  }
}

export { BookingLookupComponent as BookingLookup };
