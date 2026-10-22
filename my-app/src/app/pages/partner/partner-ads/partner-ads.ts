import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User } from '../../../models/models';

@Component({
  selector: 'app-partner-ads',
  standalone: false,
  templateUrl: './partner-ads.html',
})
export class PartnerAdsComponent implements OnInit {
  public currentUser: User | null = null;
  public reviews: any[] = [];
  public selectedReview: any = null;
  public replyText: string = '';
  public isLoading = false;
  public filterTab: 'all' | 'unread' = 'all';
  public internalNote: string = '';

  get filteredReviews() {
    if (this.filterTab === 'unread') {
      return this.reviews.filter(r => !r.replied);
    }
    return this.reviews;
  }

  get avgRating() {
    if (!this.reviews.length) return '0.0';
    const avg = this.reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / this.reviews.length;
    return avg.toFixed(1);
  }

  get pendingCount() {
    return this.reviews.filter(r => !r.replied).length;
  }

  get complaintCount() {
    return this.reviews.filter(r => r.rating <= 3).length;
  }

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private loginModalService: LoginModalService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(async user => {
      this.currentUser = user;
      if (!user || user.role !== 'provider') {
        this.loginModalService.open();
        return;
      }
      await this.loadReviews(user);
      this.cdr.detectChanges();
    });
  }

  async loadReviews(user: User) {
    this.isLoading = true;
    try {
      const userId = (user as any).id || (user as any)._id;
      const services = await this.apiService.getMyServices(userId);
      const allReviews: any[] = [];

      for (const service of services) {
        const serviceReviews = await this.apiService.getServiceReviews(service.id);
        serviceReviews.forEach((r: any) => {
          allReviews.push({
            ...r,
            serviceName: (service as any).name_service || (service as any).name || 'Dịch vụ',
            replied: false,
            replyDraft: '',
            replyText: ''
          });
        });
      }

      this.reviews = allReviews.sort((a, b) =>
        new Date(b.createdAt || b.created_at || 0).getTime() -
        new Date(a.createdAt || a.created_at || 0).getTime()
      );

      if (this.reviews.length > 0) {
        this.selectReview(this.reviews[0]);
      }
    } catch (e) {
      console.error('Failed to load reviews:', e);
    } finally {
      this.isLoading = false;
    }
  }

  selectReview(review: any) {
    this.selectedReview = review;
    this.replyText = review.replyDraft || '';
    this.internalNote = review.internalNote || '';
  }

  applyTemplate(template: 'thanks' | 'sorry' | 'voucher') {
    const templates: Record<string, string> = {
      thanks: 'Cảm ơn bạn đã chia sẻ! Chúng tôi rất vui khi bạn có trải nghiệm tốt và mong được đón tiếp bạn lần sau.',
      sorry: 'Chúng tôi xin lỗi vì sự bất tiện này. Đây là điều chúng tôi sẽ cải thiện ngay. Cảm ơn bạn đã phản hồi để chúng tôi tốt hơn.',
      voucher: 'Cảm ơn phản hồi của bạn! Chúng tôi gửi tặng bạn mã giảm giá 10% (CARE10) cho lần đặt dịch vụ tiếp theo.'
    };
    this.replyText = templates[template];
  }

  saveDraft() {
    if (this.selectedReview) {
      this.selectedReview.replyDraft = this.replyText;
      this.selectedReview.internalNote = this.internalNote;
      alert('Đã lưu nháp!');
    }
  }

  sendReply() {
    if (!this.replyText.trim() || !this.selectedReview) return;
    this.selectedReview.replied = true;
    this.selectedReview.replyText = this.replyText;
    this.selectedReview.replyDraft = '';
    this.replyText = '';
    alert('Đã gửi phản hồi thành công!');
    this.cdr.detectChanges();
  }

  getTagLabel(review: any): string {
    if (review.rating >= 4) return 'Đánh giá';
    if (review.rating <= 2) return 'Khiếu nại';
    return 'Hỗ trợ';
  }

  getTagClass(review: any): string {
    const tag = this.getTagLabel(review);
    if (tag === 'Đánh giá') return 'bg-blue-100 text-blue-700';
    if (tag === 'Khiếu nại') return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-700';
  }

  getUrgencyLabel(review: any): string {
    return review.rating <= 2 ? 'Ưu tiên cao' : '';
  }

  getTimeAgo(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    return `${diffDays} ngày trước`;
  }

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'K';
  }

  getAvatarColor(name: string): string {
    const colors = [
      'bg-teal-500', 'bg-blue-500', 'bg-violet-500',
      'bg-rose-500', 'bg-amber-500', 'bg-emerald-500'
    ];
    const idx = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[idx];
  }

  getStarArray(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }
}

export { PartnerAdsComponent as PartnerAds };
