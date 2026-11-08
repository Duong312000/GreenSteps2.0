import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FavoritesService, FavoriteType } from '../../services/favorites.service';

@Component({ selector: 'app-favorite-button', standalone: true, imports: [CommonModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="favorite-toggle" [class.saved]="saved" [disabled]="!targetId || busy || (favorites.loading$ | async)" [attr.aria-pressed]="saved" [attr.aria-label]="saved ? 'Bỏ yêu thích ' + label : 'Yêu thích ' + label" [title]="saved ? 'Bỏ khỏi Địa điểm yêu thích' : 'Lưu vào Địa điểm yêu thích'" (click)="toggle($event)"><i class="bi" [ngClass]="busy ? 'bi-hourglass-split' : saved ? 'bi-heart-fill' : 'bi-heart'" aria-hidden="true"></i><span *ngIf="showLabel">{{saved ? 'Đã yêu thích' : 'Yêu thích'}}</span></button><small class="favorite-error" role="alert" *ngIf="error">{{error}}</small>`,
  styles: [`:host{display:inline-block;vertical-align:middle}.favorite-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:38px;min-height:38px;padding:8px 11px;border:1px solid var(--bg-tertiary,#dce8e1);border-radius:999px;background:var(--bg-secondary,#fff);color:var(--text-secondary,#3d5a46);font:inherit;font-size:13px;cursor:pointer}.favorite-toggle.saved{color:#c72f54;background:#fff3f6;border-color:#f2cbd5}.favorite-toggle:focus-visible{outline:2px solid var(--primary-green,#047857);outline-offset:3px}.favorite-toggle:disabled{opacity:.55;cursor:wait}.favorite-error{display:block;max-width:240px;color:var(--danger,#b42318);font-size:12px;background:var(--bg-secondary,#fff);padding:6px}`] })
export class FavoriteButtonComponent {
  @Input({ required: true }) targetType: FavoriteType = 'service';
  @Input({ required: true }) targetId = '';
  @Input() label = '';
  @Input() showLabel = false;
  @Input() snapshot?: Record<string, any>;
  @Input() beforeSave?: () => Promise<unknown>;
  saved = false; busy = false; error = '';
  constructor(public favorites: FavoritesService, private cdr: ChangeDetectorRef) {
    // Async pipe below handles loading; the shared state subscription updates
    // buttons across list/detail/profile views without separate local storage.
  }
  private subscription?: import('rxjs').Subscription;
  ngOnInit() { this.subscription = this.favorites.items$.subscribe(() => { this.saved = this.favorites.isSaved(this.targetType, this.targetId); this.cdr.markForCheck(); }); }
  ngOnChanges() { this.saved = this.favorites.isSaved(this.targetType, this.targetId); }
  ngOnDestroy() { this.subscription?.unsubscribe(); }
  async toggle(event: Event) {
    event.stopPropagation(); event.preventDefault(); this.error = ''; this.busy = true;
    try {
      if (!this.favorites.signedIn) { this.favorites.openLogin(); return; }
      if (!this.saved && this.beforeSave) await this.beforeSave();
      await this.favorites.toggle({ type:this.targetType, id:this.targetId, snapshot:this.snapshot });
    }
    catch(error) { this.error = this.favorites.message(error); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
}
