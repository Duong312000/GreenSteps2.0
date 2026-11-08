import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyStateComponent {
  @Input() icon = 'bi bi-inbox';
  @Input() title = '';
  @Input() description = '';
  @Input() cta = '';
  @Output() ctaClick = new EventEmitter<void>();
}
