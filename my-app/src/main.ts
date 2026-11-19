import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

// Intercept any stray native browser alerts and route them silently or via modern notification
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    try {
      const container = document.getElementById('gs-global-toast-container');
      const text = String(message ?? '');
      if (container) {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 12px 18px; background: #132A20; color: #FFF; font-size: 14px; border-radius: 12px; border: 1px solid rgba(16,185,129,0.35); box-shadow: 0 10px 25px rgba(0,0,0,0.2); transition: opacity 200ms;';
        item.textContent = text;
        container.appendChild(item);
        setTimeout(() => { item.style.opacity = '0'; setTimeout(() => item.remove(), 200); }, 3000);
      } else {
        console.info('[Application Notice]', text);
      }
    } catch {}
  };
}

registerLocaleData(localeVi, 'vi-VN');

platformBrowser().bootstrapModule(AppModule, {
  
})
  .catch(err => console.error(err));
