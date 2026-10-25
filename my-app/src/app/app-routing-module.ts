import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { ToursComponent } from './pages/tours/tours';
import { TourDetailComponent } from './pages/tour-detail/tour-detail';
import { ProfileComponent } from './pages/profile/profile';
import { CommunityComponent } from './pages/community/community';
import { ScheduleEditorComponent } from './pages/schedule-editor/schedule-editor';
import { PartnerDashboardComponent } from './pages/partner/partner-dashboard/partner-dashboard';
import { PartnerServicesComponent } from './pages/partner/partner-services/partner-services';
import { PartnerBookingsComponent } from './pages/partner/partner-bookings/partner-bookings';
import { PartnerAdsComponent } from './pages/partner/partner-ads/partner-ads';
import { PartnerPromotionsComponent } from './pages/partner/partner-promotions/partner-promotions';
import { PartnerRegisterComponent } from './pages/partner/partner-register/partner-register';
import { BookingComponent } from './pages/booking/booking';
import { AdminComponent } from './pages/admin/admin';
import { ServicesComponent } from './pages/services/services';
import { roleGuard } from './guards/role.guard';
import { PartnerLayoutComponent } from './components/partner-layout/partner-layout';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'tours', component: ToursComponent },
  { path: 'tours/:id', component: TourDetailComponent },
  { path: 'tour-detail/:id', component: TourDetailComponent },
  { path: 'services/:type/:id', component: TourDetailComponent },
  { path: 'services/:id', component: TourDetailComponent },
  { path: 'service-detail/:id', component: TourDetailComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'community', component: CommunityComponent },
  { path: 'schedule', component: ScheduleEditorComponent },
  { path: 'schedule/:id', component: ScheduleEditorComponent },
  { path: 'booking', component: BookingComponent },
  { path: 'booking/payment', component: BookingComponent },
  { path: 'booking/confirm', component: BookingComponent },
  { path: '', component: PartnerLayoutComponent, children: [
    { path: 'partner-dashboard', component: PartnerDashboardComponent, canActivate: [roleGuard] },
    { path: 'partner-services', component: PartnerServicesComponent, canActivate: [roleGuard] },
    { path: 'partner-bookings', component: PartnerBookingsComponent, canActivate: [roleGuard] },
    { path: 'partner-ads', component: PartnerAdsComponent, canActivate: [roleGuard] },
    { path: 'partner-promotions', component: PartnerPromotionsComponent, canActivate: [roleGuard] }
  ] },
  { path: 'partner-register', component: PartnerRegisterComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: 'home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
