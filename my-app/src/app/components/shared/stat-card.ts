import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css',
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() note = '';
  @Input() icon = '';
}
