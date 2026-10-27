import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { ChatActivity, ChatItineraryDraft } from './greensteps-chat.types';

@Component({
  selector: 'gs-itinerary-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article *ngIf="itinerary as plan" class="gs-plan-card" aria-label="Phương án lịch trình AI">
      <section class="gs-plan-card__hero" aria-label="Thông tin chuyến đi">
        <div class="gs-plan-card__cover" aria-label="Ảnh điểm đến">
          <img *ngIf="coverImage(plan) && !imageFailed" [src]="coverImage(plan)" [alt]="plan.destination" loading="lazy" (error)="onCoverImageError()">
          <div *ngIf="!coverImage(plan) || imageFailed" class="gs-plan-card__placeholder" aria-hidden="true">
            <svg viewBox="0 0 120 80" focusable="false"><path d="M8 64 38 30l18 20 17-26 39 40H8Z"/><path d="M8 66h104M27 67l14-13 10 9 13-7 15 11"/></svg>
            <span>Khám phá theo cách xanh</span>
          </div>
        </div>

        <div class="gs-plan-card__intro">
          <span class="gs-plan-card__eyebrow"><span aria-hidden="true">✦</span> Lịch trình gợi ý</span>
          <h3>{{ plan.name }}</h3>
          <div class="gs-plan-card__meta">
            <span><span aria-hidden="true">▦</span> {{ durationLabel(plan) }}</span>
            <span><span aria-hidden="true">⌖</span> {{ plan.destination }}</span>
          </div>
          <div class="gs-plan-card__labels">
            <span *ngIf="targetBudget !== null" class="gs-plan-card__label gs-plan-card__label--budget">
              Ngân sách {{ targetBudget | number:'1.0-0':'vi-VN' }} ₫/người
            </span>
            <span *ngIf="verifiedActivityCount(plan) > 0" class="gs-plan-card__label">
              {{ verifiedActivityCount(plan) }} dịch vụ có dữ liệu xác thực
            </span>
          </div>
        </div>
      </section>

      <section class="gs-plan-card__days-section" aria-label="Tóm tắt lịch trình từng ngày">
        <h4><span aria-hidden="true">☷</span> Tóm tắt lịch trình</h4>
        <div class="gs-plan-card__days">
          <article *ngFor="let day of plan.days.slice(0, 3); let index = index" class="gs-plan-day">
            <span class="gs-plan-day__number">Ngày {{ index + 1 }}</span>
            <div class="gs-plan-day__copy">
              <h5>{{ dayTitle(day) }}</h5>
              <p>{{ activitySummary(day) }}</p>
            </div>
          </article>
        </div>
        <details *ngIf="plan.days.length > 3" class="gs-plan-card__more">
          <summary>Xem {{ plan.days.length - 3 }} ngày còn lại</summary>
          <div class="gs-plan-card__days gs-plan-card__days--extra">
            <article *ngFor="let day of plan.days.slice(3); let index = index" class="gs-plan-day">
              <span class="gs-plan-day__number">Ngày {{ index + 4 }}</span>
              <div class="gs-plan-day__copy">
                <h5>{{ dayTitle(day) }}</h5>
                <p>{{ activitySummary(day) }}</p>
              </div>
            </article>
          </div>
        </details>
      </section>

      <section class="gs-plan-card__costs" aria-label="Thông tin chi phí">
        <div *ngIf="targetBudget !== null" class="gs-plan-card__cost gs-plan-card__budget">
          <span class="gs-plan-card__cost-icon" aria-hidden="true">₫</span>
          <div>
            <strong>Ngân sách mục tiêu</strong>
            <p>{{ targetBudget | number:'1.0-0':'vi-VN' }} ₫/người</p>
          </div>
        </div>
        <div class="gs-plan-card__cost">
          <span class="gs-plan-card__cost-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Chi phí dịch vụ xác thực</strong>
            <p *ngIf="plan.estimatedCost > 0; else noVerifiedCost">{{ plan.estimatedCost | number:'1.0-0':'vi-VN' }} ₫</p>
            <ng-template #noVerifiedCost><p class="gs-plan-card__cost-unverified">Chưa có dữ liệu giá dịch vụ xác thực</p></ng-template>
          </div>
        </div>
      </section>

      <p class="gs-plan-card__note">Ngân sách là mức mục tiêu bạn cung cấp, không phải báo giá. Chỉ chi phí dịch vụ được xác thực mới được tính vào phần chi phí.</p>
      <p *ngIf="plan.assumptions.length" class="gs-plan-card__assumption">{{ plan.assumptions[0] }}</p>
    </article>
  `,
  styles: [`
    :host { display: block; min-width: 0; container-type: inline-size; }
    .gs-plan-card { display: grid; min-width: 0; gap: 12px; padding: 12px; border: 1px solid var(--gs-chat-border, #DCE2DA); border-radius: 17px; background: var(--gs-chat-card, #FFFFFF); color: var(--gs-natural-forest, #123D32); box-shadow: none; }
    .gs-plan-card__hero { display: grid; min-width: 0; grid-template-columns: minmax(128px, 31%) minmax(0, 1fr); align-items: center; gap: 13px; }
    .gs-plan-card__cover { display: grid; width: 100%; height: 132px; min-width: 0; overflow: hidden; place-items: center; border-radius: 13px; background: var(--gs-natural-sage, #E9EEE7); }
    .gs-plan-card__cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .gs-plan-card__placeholder { display: grid; width: 100%; height: 100%; align-content: center; justify-items: center; gap: 4px; color: var(--gs-natural-forest, #123D32); }
    .gs-plan-card__placeholder svg { width: 65px; height: 48px; fill: #CDD8CD; stroke: var(--gs-natural-forest, #123D32); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .gs-plan-card__placeholder span { font-size: 9px; font-weight: 700; }
    .gs-plan-card__intro { display: grid; min-width: 0; align-content: center; gap: 7px; }
    .gs-plan-card__eyebrow { display: inline-flex; width: fit-content; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 999px; background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); font-size: 10px; font-weight: 750; }
    .gs-plan-card__eyebrow span { font-size: 13px; }
    .gs-plan-card h3 { margin: 0; color: var(--gs-natural-forest, #123D32); font-size: 16px; line-height: 1.3; overflow-wrap: anywhere; }
    .gs-plan-card__meta { display: flex; min-width: 0; flex-wrap: wrap; gap: 5px 12px; color: var(--gs-chat-secondary, #526159); font-size: 11px; }
    .gs-plan-card__meta span { display: inline-flex; min-width: 0; align-items: center; gap: 5px; }
    .gs-plan-card__meta span span { color: var(--gs-natural-forest, #123D32); font-size: 15px; }
    .gs-plan-card__labels { display: flex; min-width: 0; flex-wrap: wrap; gap: 5px; }
    .gs-plan-card__label { max-width: 100%; padding: 4px 8px; border-radius: 999px; background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); font-size: 9px; font-weight: 700; overflow-wrap: anywhere; }
    .gs-plan-card__label--budget { background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); }
    .gs-plan-card__days-section { display: grid; min-width: 0; gap: 7px; }
    .gs-plan-card__days-section h4 { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--gs-natural-forest, #123D32); font-size: 12px; }
    .gs-plan-card__days-section h4 span { color: var(--gs-natural-forest, #123D32); font-size: 16px; }
    .gs-plan-card__days { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr); gap: 6px; }
    .gs-plan-day { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; padding: 8px 9px; border: 1px solid var(--gs-chat-border, #DCE2DA); border-radius: 12px; background: var(--gs-chat-card, #FFFFFF); }
    .gs-plan-day__number { width: fit-content; padding: 4px 7px; border-radius: 999px; background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); font-size: 9px; font-weight: 750; white-space: nowrap; }
    .gs-plan-day__copy { min-width: 0; }
    .gs-plan-day h5 { display: -webkit-box; margin: 0; overflow: hidden; color: var(--gs-natural-forest, #123D32); font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .gs-plan-day p { margin: 3px 0 0; color: var(--gs-chat-secondary, #526159); font-size: 10px; line-height: 1.4; overflow-wrap: anywhere; }
    .gs-plan-card__more { min-width: 0; }
    .gs-plan-card__more summary { width: fit-content; padding: 3px 0; color: var(--gs-natural-forest, #123D32); font-size: 10px; font-weight: 750; cursor: pointer; }
    .gs-plan-card__more summary:focus-visible { outline: 2px solid var(--gs-natural-forest, #123D32); outline-offset: 2px; }
    .gs-plan-card__days--extra { margin-top: 6px; }
    .gs-plan-card__costs { display: grid; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .gs-plan-card__cost { display: flex; min-width: 0; align-items: flex-start; gap: 8px; padding: 9px; border-radius: 12px; background: var(--gs-chat-ivory, #F7F6F2); }
    .gs-plan-card__cost-icon { display: grid; width: 26px; height: 26px; flex: 0 0 26px; place-items: center; border-radius: 9px; background: var(--gs-chat-success-bg, #E8F1E9); color: var(--gs-chat-success, #286447); font-size: 14px; font-weight: 800; }
    .gs-plan-card__cost > div { min-width: 0; }
    .gs-plan-card__cost strong { display: block; color: var(--gs-natural-forest, #123D32); font-size: 9px; line-height: 1.35; }
    .gs-plan-card__cost p { margin: 3px 0 0; color: var(--gs-chat-secondary, #526159); font-size: 10px; line-height: 1.35; overflow-wrap: anywhere; }
    .gs-plan-card__cost p:not(.gs-plan-card__cost-unverified) { color: var(--gs-natural-forest, #123D32); font-size: 12px; font-weight: 800; }
    .gs-plan-card__cost .gs-plan-card__cost-unverified { color: var(--gs-chat-secondary, #526159); font-size: 9px; }
    .gs-plan-card__note, .gs-plan-card__assumption { margin: 0; color: var(--gs-chat-secondary, #526159); font-size: 9px; line-height: 1.4; overflow-wrap: anywhere; }
    .gs-plan-card__assumption { padding-top: 7px; border-top: 1px solid var(--gs-chat-border, #DCE2DA); }
    @container (max-width: 520px) {
      .gs-plan-card { gap: 10px; padding: 10px; }
      .gs-plan-card__hero { grid-template-columns: minmax(0, 1fr); gap: 9px; }
      .gs-plan-card__cover { height: 128px; }
      .gs-plan-card__intro { gap: 6px; }
    }
    @container (max-width: 360px) {
      .gs-plan-card__costs { grid-template-columns: minmax(0, 1fr); }
      .gs-plan-day { grid-template-columns: minmax(0, 1fr); gap: 5px; }
    }
  `]
})
export class ItineraryTimelineComponent {
  @Input({ required: true }) itinerary!: ChatItineraryDraft;
  @Input() targetBudget: number | null = null;

  imageFailed = false;

  coverImage(plan: ChatItineraryDraft): string | null {
    const destination = plan.destination.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    if (destination.includes('da lat')) return '/image/cb4fbf769d60d911e13c255f7fb39dcc.jpg';
    if (destination.includes('phu yen')) return '/image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg';
    if (destination.includes('da nang') || destination.includes('hoi an')) return '/image/52627caa0015b2f833fbdc632d37dc82.jpg';
    return null;
  }

  onCoverImageError(): void {
    this.imageFailed = true;
  }

  durationLabel(plan: ChatItineraryDraft): string {
    const days = plan.days.length;
    const nights = Math.max(0, days - 1);
    return nights ? `${days} ngày ${nights} đêm` : `${days} ngày`;
  }

  dayTitle(day: ChatActivity[]): string {
    return day[0]?.name?.trim() || 'Thời gian tự do';
  }

  activitySummary(day: ChatActivity[]): string {
    const activities = day.slice(0, 3).map(activity => activity.name.trim()).filter(Boolean);
    if (activities.length === 1) return day[0].time ? `Bắt đầu ${day[0].time}` : 'Hoạt động trong ngày';
    const remaining = Math.max(0, day.length - activities.length);
    return `${activities.slice(1).join(' · ')}${remaining ? `${activities.length > 1 ? ' · ' : ''}+${remaining} hoạt động` : ''}` || activities[0] || 'Chưa có hoạt động được cung cấp';
  }

  verifiedActivityCount(plan: ChatItineraryDraft): number {
    return plan.days.flat().filter(activity => activity.verified).length;
  }
}
