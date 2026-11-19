import { Injectable } from '@angular/core';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private container: HTMLElement | null = null;

  private getContainer(): HTMLElement {
    if (!this.container || !document.body.contains(this.container)) {
      let existing = document.getElementById('gs-global-toast-container');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'gs-global-toast-container';
        existing.setAttribute('aria-live', 'polite');
        existing.setAttribute('role', 'region');
        existing.setAttribute('aria-label', 'Thông báo hệ thống');
        Object.assign(existing.style, {
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: '999999',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          pointerEvents: 'none'
        });
        document.body.appendChild(existing);
      }
      this.container = existing;
    }
    return this.container;
  }

  public show(message: string, type: ToastType = 'info', duration: number = 3200): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const container = this.getContainer();

    const toast = document.createElement('div');
    toast.className = `gs-toast gs-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const iconMap: Record<ToastType, string> = {
      success: '<i class="bi bi-check-circle-fill" style="color: #10B981; font-size: 1.15rem; flex-shrink: 0;"></i>',
      info: '<i class="bi bi-info-circle-fill" style="color: #38BDF8; font-size: 1.15rem; flex-shrink: 0;"></i>',
      warning: '<i class="bi bi-exclamation-triangle-fill" style="color: #F59E0B; font-size: 1.15rem; flex-shrink: 0;"></i>',
      error: '<i class="bi bi-x-circle-fill" style="color: #EF4444; font-size: 1.15rem; flex-shrink: 0;"></i>'
    };

    Object.assign(toast.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 18px',
      background: '#132A20',
      color: '#FFFFFF',
      fontSize: '0.875rem',
      fontWeight: '500',
      lineHeight: '1.45',
      borderRadius: '12px',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      boxShadow: '0 12px 32px rgba(4, 70, 49, 0.22), 0 4px 12px rgba(0, 0, 0, 0.18)',
      opacity: '0',
      transform: 'translateY(-12px) scale(0.96)',
      transition: 'opacity 220ms ease, transform 220ms ease',
      pointerEvents: 'auto',
      fontFamily: 'inherit'
    });

    toast.innerHTML = `
      ${iconMap[type] || iconMap.info}
      <span style="flex: 1; word-break: break-word;">${this.escapeHtml(message)}</span>
      <button type="button" aria-label="Đóng" style="background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; padding: 2px 4px; font-size: 1rem; line-height: 1; transition: color 150ms;">
        &times;
      </button>
    `;

    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
      closeBtn.onclick = () => removeToast();
      closeBtn.onmouseenter = () => closeBtn.style.color = '#FFFFFF';
      closeBtn.onmouseleave = () => closeBtn.style.color = 'rgba(255,255,255,0.6)';
    }

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1)';
    });

    const timer = setTimeout(() => {
      removeToast();
    }, duration);

    function removeToast() {
      clearTimeout(timer);
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.96)';
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 240);
    }
  }

  public success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  public error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  public info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  public warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
