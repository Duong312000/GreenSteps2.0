import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.html',
})
export class FooterComponent {
  public newsletterEmail = '';
  public newsletterMessage = '';
  public newsletterError = false;
  public newsletterSubmitting = false;

  constructor(public authService: AuthService, private apiService: ApiService) {}

  async subscribeNewsletter(event: Event): Promise<void> {
    event.preventDefault();
    if (this.newsletterSubmitting) return;
    const email = this.newsletterEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.newsletterError = true;
      this.newsletterMessage = 'Vui lòng nhập địa chỉ email hợp lệ.';
      return;
    }
    this.newsletterSubmitting = true;
    this.newsletterError = false;
    this.newsletterMessage = '';
    try {
      const result = await this.apiService.subscribeNewsletter(email);
      this.newsletterMessage = result.message || 'Bạn đã đăng ký nhận bản tin GreenSteps.';
      this.newsletterEmail = '';
    } catch (error: any) {
      this.newsletterError = true;
      this.newsletterMessage = error?.error?.message || 'Chưa thể đăng ký lúc này. Vui lòng thử lại sau.';
    } finally {
      this.newsletterSubmitting = false;
    }
  }
}

export { FooterComponent as Footer };
