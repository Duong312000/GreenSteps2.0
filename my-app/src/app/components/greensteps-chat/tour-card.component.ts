import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ChatTour } from './greensteps-chat.types';
import { getBackendOrigin } from '../../config/api-config';

@Component({
  selector: 'gs-tour-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="gs-tour-card">
      <a class="gs-tour-card__image" [routerLink]="['/tours', tour.id]" [attr.aria-label]="'Xem chi tiết ' + tour.name">
        <img *ngIf="imageSrc && !imageFailed; else imageFallback" [src]="imageSrc" alt="" loading="lazy" (error)="onImageError($event)">
        <ng-template #imageFallback>
          <div class="gs-tour-card__placeholder" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        </ng-template>
      </a>
      <div class="gs-tour-card__body">
        <div class="gs-tour-card__eyebrow">
          {{ tour.destination }} ·
          <ng-container *ngIf="tour.durationDays !== null && tour.durationNights !== null; else durationMissing">{{ tour.durationDays }} ngày {{ tour.durationNights }} đêm</ng-container>
          <ng-template #durationMissing>Thời lượng đang cập nhật</ng-template>
        </div>
        <h3>{{ tour.name }}</h3>
        <div *ngIf="tour.ecoLabels.length" class="gs-tour-card__labels">
          <span *ngFor="let label of tour.ecoLabels.slice(0, 2)">{{ label }}</span>
        </div>
        <div class="gs-tour-card__footer">
          <div class="gs-tour-card__price">
            <strong *ngIf="tour.price !== null; else missingPrice">{{ tour.price | number:'1.0-0':'vi-VN' }} {{ tour.currency }}</strong>
            <ng-template #missingPrice><span>Giá đang cập nhật</span></ng-template>
            <small *ngIf="tour.rating !== null && tour.rating !== undefined">{{ tour.rating | number:'1.1-1' }} / 5</small>
          </div>
          <div class="gs-tour-card__actions">
            <a class="gs-tour-card__detail" [routerLink]="['/tours', tour.id]" [attr.aria-label]="'Xem chi tiết ' + tour.name">Xem chi tiết</a>
            <a *ngIf="tour.bookingAvailable" class="gs-tour-card__book" [routerLink]="['/booking']" [queryParams]="{ tourId: tour.id, bookingType: 'tour', guestCount: 1 }">Đặt tour</a>
          </div>
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
    .gs-tour-card { display: grid; grid-template-columns: clamp(220px, 34%, 280px) minmax(0, 1fr); align-items: start; width: 100%; height: auto; min-width: 0; box-sizing: border-box; overflow: hidden; border: 1px solid var(--gs-chat-border, #DCE2DA); border-radius: 16px; background: var(--gs-chat-card, #FFFFFF); box-shadow: 0 1px 3px #14231d08; }
    .gs-tour-card__image { display: grid; width: 100%; height: 168px; min-width: 0; min-height: 0; place-items: center; overflow: hidden; background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); }
    .gs-tour-card__image img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; font-size: 0; color: transparent; text-indent: -9999px; }
    .gs-tour-card__placeholder { display: grid; place-items: center; width: 100%; height: 100%; color: var(--gs-natural-forest, #123D32); opacity: 0.5; }
    .gs-tour-card__body { display: grid; align-content: start; gap: 7px; min-width: 0; padding: 12px 14px; }
    .gs-tour-card__eyebrow { color: var(--gs-chat-secondary, #526159); font-size: 11px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
    .gs-tour-card h3 { margin: 0; color: var(--gs-natural-forest, #123D32); font-size: 16px; line-height: 1.35; font-weight: 750; overflow-wrap: anywhere; }
    .gs-tour-card__labels { display: flex; gap: 5px; flex-wrap: wrap; }
    .gs-tour-card__labels span { padding: 4px 8px; border-radius: 999px; background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); font-size: 10px; font-weight: 700; }
    .gs-tour-card__footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; min-width: 0; flex-wrap: wrap; }
    .gs-tour-card__price { display: grid; gap: 2px; min-width: 0; }
    .gs-tour-card__price strong { color: var(--gs-natural-forest, #123D32); font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
    .gs-tour-card__price span, .gs-tour-card__price small { color: var(--gs-chat-secondary, #526159); font-size: 10px; }
    .gs-tour-card__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .gs-tour-card__actions a { display: inline-flex; min-height: 34px; align-items: center; justify-content: center; box-sizing: border-box; padding: 7px 11px; border: 1px solid var(--gs-chat-border, #DCE2DA); border-radius: 999px; background: var(--gs-chat-card, #FFFFFF); color: var(--gs-natural-forest, #123D32); font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .gs-tour-card__actions a:hover { border-color: #AAB8AA; background: var(--gs-chat-ivory, #F7F6F2); }
    .gs-tour-card__actions .gs-tour-card__book { border-color: var(--gs-natural-forest, #123D32); background: var(--gs-natural-forest, #123D32); color: white; }
    .gs-tour-card__actions .gs-tour-card__book:hover { border-color: #0D3028; background: #0D3028; }
    .gs-tour-card a:focus-visible { outline: 2px solid var(--gs-natural-forest, #123D32); outline-offset: 2px; }
    @media (max-width: 700px) {
      .gs-tour-card { border-radius: 14px; }
      .gs-tour-card__body { gap: 6px; padding: 10px; }
      .gs-tour-card h3 { font-size: 14px; }
      .gs-tour-card__price strong { font-size: 12px; }
    }
    @media (max-width: 560px) {
      .gs-tour-card { grid-template-columns: minmax(0, 1fr); }
      .gs-tour-card__image { height: 168px; }
      .gs-tour-card__body { gap: 7px; padding: 11px 12px; }
      .gs-tour-card__footer { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
      .gs-tour-card__actions a { min-height: 36px; padding: 8px 12px; }
    }
  `]
})
export class TourCardComponent {
  @Input({ required: true }) tour!: ChatTour;
  imageFailed = false;

  get imageSrc(): string {
    const source = this.tour?.imageUrl?.trim();
    if (source && /^(?:https?:|data:|blob:)/i.test(source)) return source;
    if (source && (source.startsWith('image/') || source.startsWith('/image/'))) {
      return `/${source.replace(/^\//, '')}`;
    }
    if (source && (source.startsWith('images/') || source.startsWith('/images/'))) {
      return `/image/${source.replace(/^\/?images\//, '')}`;
    }
    if (source && (source.startsWith('tours/') || source.startsWith('/tours/'))) {
      return `/image/${source.replace(/^\//, '')}`;
    }
    if (source && source.startsWith('greensteps/')) {
      return `/image/${source}`;
    }

    // High quality destination photographic fallback from verified local assets
    const dest = (this.tour?.destination || '').toLowerCase();
    const name = (this.tour?.name || '').toLowerCase();
    if (dest.includes('hà nội') || dest.includes('ha noi') || name.includes('hà nội') || name.includes('phố cổ') || name.includes('di sản xanh')) {
      return '/image/greensteps/tours/hanoi/hanoi-pho-co-old-quarter.jpg';
    }
    if (dest.includes('đà lạt') || dest.includes('da lat') || name.includes('đà lạt') || name.includes('rừng thông') || name.includes('hồ xuân hương') || name.includes('cầu đất') || name.includes('linh phước')) {
      return '/image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg';
    }
    if (dest.includes('hội an') || dest.includes('đà nẵng') || dest.includes('da nang') || name.includes('bà nà') || name.includes('sơn trà') || name.includes('cầu rồng') || name.includes('cầu vàng')) {
      return '/image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town.jpg';
    }
    if (dest.includes('phú yên') || dest.includes('phu yen') || name.includes('gành đá đĩa') || name.includes('vũng rô')) {
      return '/image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia.jpg';
    }
    if (dest.includes('sa pa') || dest.includes('sapa') || name.includes('fansipan') || name.includes('cát cát')) {
      return '/image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg';
    }
    if (dest.includes('ninh bình') || dest.includes('ninh binh') || name.includes('tràng an') || name.includes('tam cốc')) {
      return '/image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg';
    }
    if (dest.includes('phú quốc') || dest.includes('phu quoc') || name.includes('bãi sao') || name.includes('bãi kem')) {
      return '/image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg';
    }
    if (dest.includes('hạ long') || dest.includes('ha long') || name.includes('vịnh hạ long') || name.includes('cát bà')) {
      return '/image/greensteps/tours/halong/halong-bay-islands.jpg';
    }
    if (dest.includes('hà giang') || dest.includes('ha giang') || name.includes('mã pí lèng') || name.includes('đồng văn')) {
      return '/image/greensteps/tours/hagiang/hagiang-ma-pi-leng.jpg';
    }
    if (dest.includes('huế') || dest.includes('hue') || name.includes('thiên mụ') || name.includes('khải định') || name.includes('sông hương')) {
      return '/image/greensteps/tours/hue/hue-thien-mu-pagoda.jpg';
    }
    if (dest.includes('cần thơ') || dest.includes('can tho') || name.includes('cái răng') || name.includes('ninh kiều')) {
      return '/image/greensteps/tours/cantho/can-tho-cai-rang-floating-market.jpg';
    }
    if (dest.includes('vũng tàu') || dest.includes('vung tau')) {
      return '/image/greensteps/phu-yen/phu-yen-bai-bien-dua-01.jpg';
    }
    return '/image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img) {
      this.imageFailed = true;
      return;
    }
    const attempt = Number(img.dataset['fallbackAttempt'] || '0');
    if (attempt === 0) {
      img.dataset['fallbackAttempt'] = '1';
      const dest = (this.tour?.destination || '').toLowerCase();
      const name = (this.tour?.name || '').toLowerCase();
      if (dest.includes('hà nội') || dest.includes('ha noi') || name.includes('hà nội') || name.includes('phố cổ') || name.includes('di sản xanh')) {
        img.src = '/image/greensteps/tours/hanoi/hanoi-pho-co-old-quarter.jpg';
      } else if (dest.includes('hội an') || dest.includes('đà nẵng') || dest.includes('da nang')) {
        img.src = '/image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town.jpg';
      } else if (dest.includes('phú yên') || dest.includes('phu yen')) {
        img.src = '/image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia.jpg';
      } else {
        img.src = '/image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg';
      }
      return;
    }
    this.imageFailed = true;
  }
}
