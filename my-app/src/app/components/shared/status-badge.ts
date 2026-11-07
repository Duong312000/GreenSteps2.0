import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
})
export class StatusBadgeComponent {
  @Input() status = '';

  get label(): string {
    const labels: Record<string, string> = {
      active: 'Hoạt động',
      pending: 'Chờ duyệt',
      draft: 'Bản nháp',
      rejected: 'Bị từ chối',
      deposit: 'Đã xác nhận',
      confirmed: 'Đã xác nhận',
      completed: 'Hoàn thành',
    };
    return labels[this.status.trim().toLowerCase()] || this.status;
  }
}
