import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: false,
  template: `
    <div class="flex items-center justify-center p-4 gap-2 text-emerald-800" [class.py-2]="compact">
      <i class="bi bi-arrow-repeat animate-spin text-xl"></i>
      <span class="text-sm font-medium">{{ label || 'Đang tải dữ liệu...' }}</span>
    </div>
  `
})
export class LoadingIndicatorComponent {
  @Input() compact: boolean = false;
  @Input() label: string = 'Đang tải...';
}
