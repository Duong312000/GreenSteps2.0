import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptors, HttpInterceptorFn } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { HeaderComponent } from './components/header/header';
import { FooterComponent } from './components/footer/footer';
import { LoginModalComponent } from './components/login-modal/login-modal';
import { HomeComponent } from './pages/home/home';
import { ToursComponent } from './pages/tours/tours';
import { TourDetailComponent } from './pages/tour-detail/tour-detail';
import { BookingComponent } from './pages/booking/booking';
import { BookingLookupComponent } from './pages/booking-lookup/booking-lookup';
import { ServicesComponent } from './pages/services/services';
import { CommunityComponent } from './pages/community/community';
import { ProfileComponent } from './pages/profile/profile';
import { ScheduleEditorComponent } from './pages/schedule-editor/schedule-editor';
import { AdminComponent } from './pages/admin/admin';
import { PartnerDashboardComponent } from './pages/partner/partner-dashboard/partner-dashboard';
import { PartnerServicesComponent } from './pages/partner/partner-services/partner-services';
import { PartnerBookingsComponent } from './pages/partner/partner-bookings/partner-bookings';
import { PartnerAdsComponent } from './pages/partner/partner-ads/partner-ads';
import { PartnerPromotionsComponent } from './pages/partner/partner-promotions/partner-promotions';
import { PartnerRegisterComponent } from './pages/partner/partner-register/partner-register';

const authInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.url, window.location.origin);
  const allowedOrigins = new Set(['http://localhost:5055', 'http://127.0.0.1:5055', 'https://greensteps-6swn.onrender.com', window.location.origin]);
  if (!allowedOrigins.has(url.origin) || !url.pathname.startsWith('/api/')) return next(req);

  const token = localStorage.getItem('greensteps_token');
  const cloneConfig: any = {
    withCredentials: true
  };
  if (token) {
    cloneConfig.setHeaders = {
      Authorization: `Bearer ${token}`
    };
  }
  const cloned = req.clone(cloneConfig);
  return next(cloned);
};

@NgModule({
  declarations: [
    App,
    HeaderComponent,
    FooterComponent,
    LoginModalComponent,
    HomeComponent,
    ToursComponent,
    TourDetailComponent,
    BookingComponent,
    BookingLookupComponent,
    ServicesComponent,
    CommunityComponent,
    ProfileComponent,
    ScheduleEditorComponent,
    AdminComponent,
    PartnerDashboardComponent,
    PartnerServicesComponent,
    PartnerBookingsComponent,
    PartnerAdsComponent,
    PartnerPromotionsComponent,
    PartnerRegisterComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor]))
  ],
  bootstrap: [App],
})
export class AppModule {}
