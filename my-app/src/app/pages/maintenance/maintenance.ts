import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { getApiUrl } from '../../config/api-config';

interface MaintenanceStatus {
  maintenanceMode: boolean;
  startsAt: string | null;
  expectedEndAt: string | null;
  retryAfterSeconds: number;
}

@Component({
  selector: 'app-maintenance',
  standalone: false,
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.css',
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  public status?: MaintenanceStatus;
  public isChecking = false;
  public checkMessage = '';
  public countdownText = '';
  public showCountdown = false;

  private hasSeenMaintenance = false;
  private request?: Subscription;
  private pollTimer?: number;
  private clockTimer?: number;

  constructor(private http: HttpClient, private router: Router) {}

  public ngOnInit(): void {
    this.checkStatus();
    this.pollTimer = window.setInterval(() => this.checkStatus(), 45_000);
    this.clockTimer = window.setInterval(() => this.updateCountdown(), 1_000);
  }

  public ngOnDestroy(): void {
    this.request?.unsubscribe();
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    if (this.clockTimer) window.clearInterval(this.clockTimer);
  }

  public checkStatus(): void {
    if (this.isChecking) return;
    this.isChecking = true;
    this.checkMessage = '';
    this.request = this.http.get<MaintenanceStatus>(`${getApiUrl()}/maintenance-status`).subscribe({
      next: status => {
        this.status = status;
        this.isChecking = false;
        if (status.maintenanceMode) {
          this.hasSeenMaintenance = true;
          this.checkMessage = 'Website vẫn đang được bảo trì.';
        } else if (this.hasSeenMaintenance) {
          this.checkMessage = 'Website đã hoạt động trở lại. Đang chuyển về trang chủ…';
          window.setTimeout(() => this.router.navigateByUrl('/home'), 700);
        } else {
          this.checkMessage = 'Đây là trang xem trước; chế độ bảo trì hiện đang tắt.';
        }
        this.updateCountdown();
      },
      error: () => {
        this.isChecking = false;
        this.checkMessage = 'Chưa kiểm tra được trạng thái. Vui lòng thử lại sau.';
      },
    });
  }

  private updateCountdown(): void {
    const end = this.status?.expectedEndAt ? new Date(this.status.expectedEndAt).getTime() : NaN;
    if (!Number.isFinite(end)) {
      this.showCountdown = false;
      this.countdownText = '';
      return;
    }
    this.showCountdown = true;
    const seconds = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    const remainder = seconds % 60;
    this.countdownText = `${days ? `${days} ngày ` : ''}${hours} giờ ${minutes} phút ${remainder} giây`;
  }
}
