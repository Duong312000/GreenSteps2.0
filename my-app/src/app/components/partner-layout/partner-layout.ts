import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PartnerIconComponent } from './partner-icon';

@Component({
  selector: 'app-partner-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, PartnerIconComponent],
  templateUrl: './partner-layout.html',
  styleUrl: './partner-layout.css',
})
export class PartnerLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.getCurrentUser() });
  readonly menuOpen = signal(false);
  readonly avatarFailed = signal(false);
  readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');
  readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');
  readonly items = [
    { label: 'Tổng quan & Doanh thu', route: '/partner-dashboard', icon: 'home' },
    { label: 'Quản lý dịch vụ', route: '/partner-services', icon: 'briefcase' },
    { label: 'Quản lý booking', route: '/partner-bookings', icon: 'calendar' },
    { label: 'Tiếp thị & Chăm sóc', route: '/partner-ads', icon: 'megaphone' },
    { label: 'Quảng bá & Khuyến mãi', route: '/partner-promotions', icon: 'tag' },
  ];
  get company(): string {
    return (
      this.user()?.companyName ||
      this.user()?.company_name ||
      this.user()?.fullname ||
      'Tài khoản nhà cung cấp'
    );
  }
  get initials(): string {
    return this.company
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const wasOpen = this.menuOpen();
        this.menuOpen.set(false);
        if (wasOpen)
          requestAnimationFrame(() => {
            const heading =
              this.host.nativeElement.querySelector<HTMLElement>('.partner-content h1');
            if (heading) {
              heading.setAttribute('tabindex', '-1');
              heading.focus({ preventScroll: true });
            }
          });
      });
  }
  openMenu(): void {
    this.menuOpen.set(true);
    requestAnimationFrame(() =>
      this.sidebar()?.nativeElement.querySelector<HTMLElement>('button, a')?.focus(),
    );
  }
  closeMenu(): void {
    this.menuOpen.set(false);
    requestAnimationFrame(() => this.toggle()?.nativeElement.focus());
  }
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.menuOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
    }
    if (event.key === 'Tab') {
      const controls = [
        ...(this.sidebar()?.nativeElement.querySelectorAll<HTMLElement>('button, a') || []),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
}
