import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `<main class="reset-password-page"><form (ngSubmit)="submit()"><a routerLink="/home" class="brand">GreenSteps Travel</a><h1>Đặt lại mật khẩu</h1><p *ngIf="!token" role="alert">Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.</p><ng-container *ngIf="token && !done"><label>Mật khẩu mới<input type="password" name="password" [(ngModel)]="password" minlength="8" maxlength="72" autocomplete="new-password" required></label><label>Xác nhận mật khẩu<input type="password" name="confirm" [(ngModel)]="confirmPassword" minlength="8" maxlength="72" autocomplete="new-password" required></label><p class="error" *ngIf="error">{{ error }}</p><button type="submit" [disabled]="busy">{{ busy ? 'Đang lưu...' : 'Cập nhật mật khẩu' }}</button></ng-container><section *ngIf="done"><p>{{ message }}</p><a routerLink="/home">Quay lại đăng nhập</a></section></form></main>`,
  styles: [`.reset-password-page{min-height:70vh;display:grid;place-items:center;padding:32px;background:#f3f8ef}.reset-password-page form{width:min(100%,460px);display:grid;gap:16px;background:white;padding:32px;border:1px solid #dce9df;border-radius:20px;box-shadow:0 12px 40px #12372d12}.brand{color:#087a55;font-weight:700}.reset-password-page h1{margin:0;color:#12372d}.reset-password-page label{display:grid;gap:8px;color:#34594c}.reset-password-page input{padding:13px;border:1px solid #cbd8d2;border-radius:10px}.reset-password-page button{padding:13px;background:#087a55;color:white;border:0;border-radius:10px;font-weight:700}.error{color:#b42318}`]
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  busy = false;
  done = false;
  error = '';
  message = '';

  constructor(private readonly route: ActivatedRoute, private readonly auth: AuthService, private readonly router: Router) {}
  ngOnInit(): void { this.token = this.route.snapshot.queryParamMap.get('token') || ''; }
  async submit(): Promise<void> {
    this.error = '';
    if (!this.token) { this.error = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'; return; }
    if (this.password !== this.confirmPassword) { this.error = 'Mật khẩu xác nhận không khớp.'; return; }
    this.busy = true;
    try {
      const result = await this.auth.resetForgotPassword(this.token, this.password);
      if (!result.success) { this.error = result.message || 'Không thể đặt lại mật khẩu.'; return; }
      this.message = result.message || 'Mật khẩu đã được cập nhật. Hãy đăng nhập lại.';
      this.done = true;
    } catch { this.error = 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.'; }
    finally { this.busy = false; }
  }
}
