import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

registerLocaleData(localeVi, 'vi-VN');

platformBrowser().bootstrapModule(AppModule, {
  
})
  .catch(err => console.error(err));
