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
  @Input() tone: 'pending' | 'active' | 'danger' | 'neutral' | null = null;
  @Input() withDot = false;

  get semanticTone(): 'pending' | 'active' | 'danger' | 'neutral' {
    if (this.tone) return this.tone;
    const value = this.status.trim().toLocaleLowerCase('vi');
    if (value.includes('pending') || value.includes('chờ')) return 'pending';
    if (value.includes('active') || value.includes('hoạt động') || value.includes('đã duyệt')) return 'active';
    if (value.includes('rejected') || value.includes('từ chối') || value.includes('vi phạm') || value.includes('đã ẩn')) return 'danger';
    return 'neutral';
  }

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
