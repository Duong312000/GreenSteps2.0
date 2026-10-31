import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User, Booking, Service } from '../../../models/models';

@Component({
  selector: 'app-partner-bookings',
  standalone: false,
  templateUrl: './partner-bookings.html',
})
export class PartnerBookingsComponent implements OnInit {
  public currentUser: User | null = null;
  public bookings: any[] = []; 
  public myServices: Service[] = [];

  // Tab State
  public activeTab: 'bookings' | 'change-requests' | 'schedules' | 'reviews' = 'bookings';

  // Bookings Tab Filters & Modals
  public searchQuery: string = '';
  public bookingStatusFilter: string = 'Tất cả';
  public paymentStatusFilter: string = 'Tất cả';
  public operationStatusFilter: string = 'Tất cả';
  
  public isDetailsOpen: boolean = false;
  public selectedBooking: any = null;
  public showConfirmModal: boolean = false;
  public showRejectModal: boolean = false;
  public rejectReason: string = 'Dịch vụ đã hết chỗ';
  public rejectNotes: string = '';

  // Manual status overrides
  public overrideBookingStatus: string = '';
  public overridePaymentStatus: string = '';
  public overrideOperationStatus: string = '';

  // Change Requests Tab Filters & Modals
  public changeSearchQuery: string = '';
  public changeTypeFilter: string = 'Tất cả';
  public changeStatusFilter: string = 'Tất cả';
  public changeRequests: any[] = [];
  public selectedRequest: any = null;
  public showApproveChangeModal: boolean = false;
  public showRejectChangeModal: boolean = false;
  public showProposeChangeModal: boolean = false;
  
  public proposeNewDate: string = '';
  public proposePriceDiff: number = 0;
  public proposeNotes: string = '';
  public rejectChangeReason: string = '';

  // Schedules (Operations Schedule)
  public operations: any[] = [];
  public selectedOperation: any = null;
  public isAssignModalOpen: boolean = false;
  public assignStaff: string = '';
  public assignVehicle: string = '';
  public assignNotes: string = '';
  public assignChecklist: any[] = [];
  
  public newChecklistItemLabel: string = '';
  public operationViewMode: 'list' | 'calendar' = 'list';
  public currentMonthYear: string = 'Tháng 7, 2026';

  // Reviews Tab Filters & Modals
  public reviews: any[] = [];
  public reviewTargets: any[] = [];
  public reviewTypeFilter = 'all';
  public reviewLoadError = false;
  public reviewRatingFilter: string = 'Tất cả';
  public reviewServiceFilter: string = 'Tất cả';
  public reviewReplyFilter: string = 'Tất cả';
  
  public replyingToReviewId: string | null = null;
  public replyText: string = '';
  
  public reportingReviewId: string | null = null;
  public reportReasonText: string = '';
  
  public editingNotesReviewId: string | null = null;
  public internalNotesText: string = '';

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

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    public cdr: ChangeDetectorRef,
    private loginModalService: LoginModalService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!user || user.role !== 'provider') {
        this.loginModalService.open();
      } else {
        this.loadAllData();
      }
      this.cdr.detectChanges();
    });
  }

  public async loadAllData() {
    if (!this.currentUser) return;
    const providerId = this.currentUser.id || this.currentUser._id || '';
    
    // Load my services for filters
    this.myServices = await this.apiService.getMyServices(providerId);

    await Promise.all([
      this.loadBookings(),
      this.loadChangeRequests(),
      this.loadOperations(),
      this.loadReviews()
    ]);
    this.cdr.detectChanges();
  }

  // 1. Booking handlers
  public async loadBookings() {
    if (!this.currentUser) return;
    const providerId = this.currentUser.id || this.currentUser._id || '';
    const res = await this.apiService.getBookings(providerId);
    this.bookings = res || [];
  }

  public get filteredBookings() {
    return this.bookings.filter(b => {
      const query = this.searchQuery.toLowerCase();
      const matchSearch = b.id.toLowerCase().includes(query) || 
                          b.customer.toLowerCase().includes(query) || 
                          b.service.toLowerCase().includes(query);
      
      const matchBStatus = this.bookingStatusFilter === 'Tất cả' || b.booking_status === this.bookingStatusFilter;
      const matchPStatus = this.paymentStatusFilter === 'Tất cả' || b.payment_status === this.paymentStatusFilter;
      const matchOStatus = this.operationStatusFilter === 'Tất cả' || b.operation_status === this.operationStatusFilter;
      
      return matchSearch && matchBStatus && matchPStatus && matchOStatus;
    });
  }

  public openBookingDetails(booking: any) {
    this.selectedBooking = booking;
    this.overrideBookingStatus = booking.booking_status;
    this.overridePaymentStatus = booking.payment_status;
    this.overrideOperationStatus = booking.operation_status;
    this.isDetailsOpen = true;
    this.cdr.detectChanges();
  }

  public closeBookingDetails() {
    this.isDetailsOpen = false;
    this.selectedBooking = null;
    this.cdr.detectChanges();
  }

  public async updateStatusesIndividually() {
    if (!this.selectedBooking) return;
    const updateData = {
      booking_status: this.overrideBookingStatus,
      payment_status: this.overridePaymentStatus,
      operation_status: this.overrideOperationStatus
    };
    const success = await this.apiService.updateBookingStatuses(this.selectedBooking.id, updateData);
    if (success) {
      this.showAlert('Cập nhật trạng thái thành công!', 'success');
      await this.loadBookings();
      this.closeBookingDetails();
    } else {
      this.showAlert('Lỗi cập nhật trạng thái.', 'error');
    }
  }

  public async confirmBookingDirect(id: string) {
    this.showConfirm('Bạn có chắc chắn muốn phê duyệt cọc đơn này?', async () => {
      const ok = await this.apiService.approveBooking(id);
      if (ok) {
        this.showAlert('Duyệt thành công!', 'success');
        await this.loadBookings();
        this.closeBookingDetails();
      } else {
        this.showAlert('Lỗi phê duyệt.', 'error');
      }
    });
  }

  public triggerRejectModal(booking: any) {
    this.selectedBooking = booking;
    this.showRejectModal = true;
    this.cdr.detectChanges();
  }

  public async submitRejectBooking() {
    if (!this.selectedBooking) return;
    const success = await this.apiService.rejectBooking(this.selectedBooking.id);
    if (success) {
      // Save rejection reason
      await this.apiService.updateBookingStatuses(this.selectedBooking.id, {
        booking_status: 'rejected',
        rejection_reason: this.rejectReason
      });
      this.showAlert('Đã từ chối đơn đặt chỗ thành công.', 'success');
      await this.loadBookings();
      this.showRejectModal = false;
      this.selectedBooking = null;
    } else {
      this.showAlert('Lỗi từ chối đơn đặt.', 'error');
    }
  }

  public async completeBookingDirect(id: string) {
    this.showConfirm('Đơn dịch vụ đã phục vụ xong? Hãy đánh dấu hoàn thành.', async () => {
      const ok = await this.apiService.completeBooking(id);
      if (ok) {
        this.showAlert('Đã cập nhật trạng thái đơn thành HOÀN THÀNH!', 'success');
        await this.loadBookings();
        this.closeBookingDetails();
      } else {
        this.showAlert('Lỗi cập nhật.', 'error');
      }
    });
  }

  // 2. Change Requests handlers
  public async loadChangeRequests() {
    if (!this.currentUser) return;
    const providerId = this.currentUser.id || this.currentUser._id || '';
    this.changeRequests = await this.apiService.getChangeRequests(providerId) || [];
  }

  public get filteredChangeRequests() {
    return this.changeRequests.filter(r => {
      const query = this.changeSearchQuery.toLowerCase();
      const matchSearch = r.id.toLowerCase().includes(query) || 
                          r.booking_id.toLowerCase().includes(query) ||
                          r.booking?.fullname?.toLowerCase().includes(query);
      
      const matchType = this.changeTypeFilter === 'Tất cả' || r.type === this.changeTypeFilter;
      const matchStatus = this.changeStatusFilter === 'Tất cả' || r.status === this.changeStatusFilter;
      
      return matchSearch && matchType && matchStatus;
    });
  }

  public openChangeRequestAction(req: any, action: 'approve' | 'reject' | 'propose') {
    this.selectedRequest = req;
    if (action === 'approve') {
      this.showApproveChangeModal = true;
    } else if (action === 'reject') {
      this.rejectChangeReason = '';
      this.showRejectChangeModal = true;
    } else {
      this.proposeNewDate = req.new_content?.date || '';
      this.proposePriceDiff = req.price_diff || 0;
      this.proposeNotes = '';
      this.showProposeChangeModal = true;
    }
    this.cdr.detectChanges();
  }

  public async submitApproveChange() {
    if (!this.selectedRequest) return;
    const success = await this.apiService.approveChangeRequest(this.selectedRequest.id);
    if (success) {
      this.showAlert('Đã phê duyệt và áp dụng thay đổi thành công!', 'success');
      await this.loadChangeRequests();
      await this.loadBookings();
      this.showApproveChangeModal = false;
      this.selectedRequest = null;
    } else {
      this.showAlert('Lỗi phê duyệt thay đổi.', 'error');
    }
  }

  public async submitRejectChange() {
    if (!this.selectedRequest) return;
    const success = await this.apiService.rejectChangeRequest(this.selectedRequest.id, this.rejectChangeReason);
    if (success) {
      this.showAlert('Từ chối yêu cầu thay đổi thành công.', 'success');
      await this.loadChangeRequests();
      this.showRejectChangeModal = false;
      this.selectedRequest = null;
    } else {
      this.showAlert('Lỗi từ chối.', 'error');
    }
  }

  public async submitProposeChange() {
    if (!this.selectedRequest) return;
    const proposeData = {
      propose_date: this.proposeNewDate,
      propose_notes: this.proposeNotes,
      price_diff: this.proposePriceDiff
    };
    const success = await this.apiService.proposeAlternativeChangeRequest(this.selectedRequest.id, proposeData);
    if (success) {
      this.showAlert('Đã gửi đề xuất lịch và giá mới đến khách hàng!', 'success');
      await this.loadChangeRequests();
      this.showProposeChangeModal = false;
      this.selectedRequest = null;
    } else {
      this.showAlert('Lỗi gửi đề xuất.', 'error');
    }
  }

  // 3. Operations handlers
  public async loadOperations() {
    if (!this.currentUser) return;
    const providerId = this.currentUser.id || this.currentUser._id || '';
    this.operations = await this.apiService.getOperationsAssignments(providerId) || [];
  }

  public openAssignModal(op: any) {
    this.selectedOperation = op;
    this.assignStaff = op.assigned_staff || '';
    this.assignVehicle = op.assigned_vehicle || '';
    this.assignNotes = op.notes || '';
    this.assignChecklist = op.checklist ? [...op.checklist] : [];
    this.isAssignModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeAssignModal() {
    this.isAssignModalOpen = false;
    this.selectedOperation = null;
    this.cdr.detectChanges();
  }

  public addChecklistItem() {
    if (this.newChecklistItemLabel.trim()) {
      this.assignChecklist.push({ label: this.newChecklistItemLabel.trim(), done: false });
      this.newChecklistItemLabel = '';
      this.cdr.detectChanges();
    }
  }

  public removeChecklistItem(idx: number) {
    this.assignChecklist.splice(idx, 1);
    this.cdr.detectChanges();
  }

  public async submitAssign() {
    if (!this.selectedOperation) return;
    const data = {
      assigned_staff: this.assignStaff,
      assigned_vehicle: this.assignVehicle,
      checklist: this.assignChecklist,
      notes: this.assignNotes
    };
    const success = await this.apiService.assignStaffAndVehicle(this.selectedOperation.booking_id, data);
    if (success) {
      this.showAlert('Cập nhật phân công và checklist thành công!', 'success');
      await this.loadOperations();
      this.closeAssignModal();
    } else {
      this.showAlert('Lỗi lưu thông tin phân công.', 'error');
    }
  }

  public async toggleChecklistItemDirect(op: any, item: any, event: any) {
    const isChecked = event.target.checked;
    const success = await this.apiService.updateChecklistItem(op.booking_id, item.label, isChecked);
    if (success) {
      item.done = isChecked;
      this.cdr.detectChanges();
    } else {
      this.showAlert('Lỗi cập nhật checklist.', 'error');
      event.target.checked = !isChecked; // revert
    }
  }

  public async changeOperationStatus(op: any, status: string) {
    let incidents = '';
    if (status === 'incident') {
      incidents = prompt('Mô tả sự cố hoặc nhật ký phát sinh (nếu có):') || '';
      if (!incidents) return;
    }
    const success = await this.apiService.updateAssignmentStatus(op.booking_id, status, incidents);
    if (success) {
      this.showAlert('Cập nhật trạng thái vận hành thành công!', 'success');
      await this.loadOperations();
      await this.loadBookings();
    } else {
      this.showAlert('Lỗi cập nhật trạng thái.', 'error');
    }
  }

  // 4. Reviews handlers
  public async loadReviews() {
    if (!this.currentUser) return;
    const providerId = this.currentUser.id || this.currentUser._id || '';
    this.reviewLoadError = false;
    const filters: any = {};
    if (this.reviewRatingFilter !== 'Tất cả') filters.rating = this.reviewRatingFilter;
    if (this.reviewTypeFilter !== 'all') filters.type = this.reviewTypeFilter;
    if (this.reviewServiceFilter !== 'Tất cả') {
      const target = this.reviewTargets.find(item => item.id === this.reviewServiceFilter);
      if (target?.type === 'tour') filters.tourId = target.id;
      else filters.serviceId = this.reviewServiceFilter;
    }
    if (this.reviewReplyFilter !== 'Tất cả') {
      filters.answered = this.reviewReplyFilter === 'Đã phản hồi' ? 'true' : 'false';
    }

    try {
      this.reviews = await this.apiService.getProviderReviews(providerId, filters);
      if (!this.reviewTargets.length) {
        this.reviewTargets = this.reviews.reduce((targets: any[], review: any) => {
          if (review.target && !targets.some(target => target.id === review.target.id)) targets.push(review.target);
          return targets;
        }, []);
      }
    } catch {
      this.reviews = [];
      this.reviewLoadError = true;
    }
  }

  public initiateReply(reviewId: string) {
    this.replyingToReviewId = reviewId;
    this.replyText = '';
    this.cdr.detectChanges();
  }

  public async submitReply(reviewId: string) {
    if (!this.replyText.trim()) return;
    const success = await this.apiService.replyToReview(reviewId, this.replyText.trim());
    if (success) {
      this.showAlert('Đã phản hồi đánh giá thành công!', 'success');
      await this.loadReviews();
      this.replyingToReviewId = null;
      this.replyText = '';
    } else {
      this.showAlert('Gửi phản hồi thất bại.', 'error');
    }
  }

  public initiateReport(reviewId: string) {
    this.reportingReviewId = reviewId;
    this.reportReasonText = '';
    this.cdr.detectChanges();
  }

  public async submitReport(reviewId: string) {
    if (!this.reportReasonText.trim()) return;
    const success = await this.apiService.reportReview(reviewId, this.reportReasonText.trim());
    if (success) {
      this.showAlert('Đã báo cáo đánh giá vi phạm thành công!', 'success');
      await this.loadReviews();
      this.reportingReviewId = null;
      this.reportReasonText = '';
    } else {
      this.showAlert('Báo cáo vi phạm thất bại.', 'error');
    }
  }

  public initiateNotes(reviewId: string, currentNotes: string) {
    this.editingNotesReviewId = reviewId;
    this.internalNotesText = currentNotes || '';
    this.cdr.detectChanges();
  }

  public async submitNotes(reviewId: string) {
    const success = await this.apiService.updateInternalNotes(reviewId, this.internalNotesText.trim());
    if (success) {
      this.showAlert('Cập nhật ghi chú nội bộ thành công!', 'success');
      await this.loadReviews();
      this.editingNotesReviewId = null;
      this.internalNotesText = '';
    } else {
      this.showAlert('Cập nhật thất bại.', 'error');
    }
  }

  // Tab navigation
  public setActiveTab(tab: 'bookings' | 'change-requests' | 'schedules' | 'reviews') {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  public getBookingStatusClass(status: string): string {
    switch (status) {
      case 'new': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending_confirm': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'accepted': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-600';
    }
  }

  public getBookingStatusLabel(status: string): string {
    switch (status) {
      case 'new': return 'Chờ duyệt cọc';
      case 'pending_confirm': return 'Chờ xác nhận';
      case 'accepted': return 'Đã xác nhận';
      case 'rejected': return 'Bị từ chối';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  }

  public getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-250';
      case 'deposit_paid': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'fully_paid': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'refunded': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-600';
    }
  }

  public getPaymentStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Chưa thanh toán';
      case 'deposit_paid': return 'Đã cọc';
      case 'fully_paid': return 'Đã thanh toán hết';
      case 'refunded': return 'Đã hoàn tiền';
      default: return status;
    }
  }

  public getOperationStatusClass(status: string): string {
    switch (status) {
      case 'preparing': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'ongoing': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'completed': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'incident': return 'bg-red-100 text-red-800 border-red-200 font-bold animate-pulse';
      default: return 'bg-gray-50 text-gray-600';
    }
  }

  public getOperationStatusLabel(status: string): string {
    switch (status) {
      case 'preparing': return 'Đang chuẩn bị';
      case 'ongoing': return 'Đang đi tour';
      case 'completed': return 'Đã hoàn thành';
      case 'incident': return 'Gặp sự cố!';
      default: return status;
    }
  }

  public getRequestTypeLabel(type: string): string {
    switch (type) {
      case 'date_change': return 'Đổi ngày sử dụng';
      case 'time_change': return 'Đổi giờ khởi hành';
      case 'guests_change': return 'Thay đổi số khách';
      case 'info_change': return 'Thay đổi thông tin liên lạc';
      case 'package_change': return 'Thay đổi gói dịch vụ';
      case 'cancel_booking': return 'Yêu cầu hủy đơn';
      case 'refund': return 'Yêu cầu hoàn trả tiền';
      default: return type;
    }
  }

  public getRequestStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ duyệt';
      case 'checking': return 'Đang kiểm tra';
      case 'pending_customer_confirm': return 'Chờ khách xác nhận';
      case 'pending_additional_payment': return 'Chờ thanh toán chênh lệch';
      case 'pending_refund': return 'Chờ hoàn tiền';
      case 'accepted': return 'Đã chấp nhận';
      case 'rejected': return 'Bị từ chối';
      case 'completed': return 'Đã hoàn thành';
      default: return status;
    }
  }
}

export { PartnerBookingsComponent as PartnerBookings };
