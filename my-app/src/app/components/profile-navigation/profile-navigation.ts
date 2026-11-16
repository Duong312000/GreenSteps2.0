import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type ProfileSection =
  | 'overview'
  | 'tickets'
  | 'favorites'
  | 'map'
  | 'chatbot'
  | 'personal'
  | 'security'
  | 'settings';

type ProfileNavigationItem = {
  icon: string;
  label: string;
  section?: ProfileSection;
  route?: string;
  badge?: string;
  action?: 'logout';
};

@Component({
  selector: 'app-profile-navigation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-navigation.html',
  styleUrls: ['./profile-navigation.css']
})
export class ProfileNavigationComponent {
  public isMobileNavOpen = false;

  public readonly groups: ProfileNavigationItem[][] = [
    [{ icon: 'bi-house-door', label: 'Tổng quan', section: 'overview' }],
    [
      { icon: 'bi-calendar2-week', label: 'Lịch trình của tôi', route: '/schedule' },
      { icon: 'bi-credit-card', label: 'Vé & thanh toán', section: 'tickets' },
      { icon: 'bi-heart', label: 'Địa điểm yêu thích', section: 'favorites' }
    ],
    [
      { icon: 'bi-stars', label: 'Thiết kế lịch trình AI', route: '/ai-planner' },
      { icon: 'bi-geo-alt', label: 'Bản đồ tương tác', section: 'map' },
      { icon: 'bi-chat-dots', label: 'Chatbot hỗ trợ', section: 'chatbot', badge: 'AI' }
    ],
    [
      { icon: 'bi-person', label: 'Thông tin cá nhân', section: 'personal' },
      { icon: 'bi-shield-lock', label: 'Bảo mật tài khoản', section: 'security' },
      { icon: 'bi-globe2', label: 'Về GreenSteps', route: '/about' },
      { icon: 'bi-gear', label: 'Cài đặt', section: 'settings' },
      { icon: 'bi-box-arrow-right', label: 'Đăng xuất', action: 'logout' }
    ]
  ];

  constructor(private router: Router, private authService: AuthService) {}

  public isActive(item: ProfileNavigationItem): boolean {
    const url = this.router.url;
    const path = url.split(/[?#]/)[0];

    if (item.section) {
      if (path !== '/profile') return false;
      const activeSection = this.router.parseUrl(url).queryParams['section'] || 'overview';
      return activeSection === item.section;
    }

    return !!item.route && (path === item.route || path.startsWith(`${item.route}/`));
  }

  public navigate(item: ProfileNavigationItem): void {
    if (item.action === 'logout') {
      this.authService.logout();
      alert('Đã đăng xuất tài khoản!');
      void this.router.navigate(['/']);
      return;
    }

    if (item.section) {
      void this.router.navigate(['/profile'], {
        queryParams: item.section === 'overview' ? {} : { section: item.section }
      });
      return;
    }

    if (item.route) void this.router.navigateByUrl(item.route);
  }
}
