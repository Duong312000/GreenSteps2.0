import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-copyable-id',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="copyable-id" [class.subtle]="appearance === 'subtle'" [title]="value"><code>{{ shortenedValue }}</code><button type="button" class="copy-id-button" (click)="$event.stopPropagation(); copy()" [attr.aria-label]="copied ? 'Đã sao chép' : 'Sao chép mã'"><i class="bi" [ngClass]="copied ? 'bi-check2' : 'bi-copy'"></i></button><span class="copy-id-feedback" *ngIf="copied" role="status">Đã sao chép</span></span>`,
  styleUrl: './copyable-id.component.css'
})
export class CopyableIdComponent implements OnDestroy {
  @Input() value = '';
  @Input() appearance: 'default' | 'subtle' = 'default';
  public copied = false;
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  get shortenedValue(): string {
    const value = String(this.value || '');
    const isLongHexHash = /^[a-f\d]{20,}$/i.test(value);
    const isUuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
    return isLongHexHash || isUuid ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value);
      this.copied = true;
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
      this.feedbackTimer = setTimeout(() => this.copied = false, 1600);
    } catch {
      this.copied = false;
    }
  }

  ngOnDestroy(): void {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
  }
}
