import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ChatTour } from './greensteps-chat.types';

@Component({
  selector: 'gs-tour-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="gs-tour-card">
      <a class="gs-tour-card__image" [routerLink]="['/tours', tour.id]" [attr.aria-label]="'Xem chi tiết ' + tour.name">
        <img *ngIf="imageSrc; else imageFallback" [src]="imageSrc" [alt]="tour.name" loading="lazy">
        <ng-template #imageFallback><span aria-hidden="true">🌿</span></ng-template>
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
    .gs-tour-card__image { display: grid; width: 100%; height: 168px; min-width: 0; min-height: 0; place-items: center; overflow: hidden; background: var(--gs-natural-sage, #E9EEE7); color: var(--gs-natural-forest, #123D32); font-size: 30px; }
    .gs-tour-card__image img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
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

  get imageSrc(): string | null {
    const source = this.tour?.imageUrl?.trim();
    if (!source) return null;
    if (/^(?:https?:|data:|blob:)/i.test(source)) return source;
    const origin = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:5055'
      : 'https://greensteps-6swn.onrender.com';
    const path = source.replace(/^\/?image\//i, '/images/');
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
