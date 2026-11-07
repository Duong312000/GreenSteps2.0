import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { ToursComponent } from './pages/tours/tours';
import { PromotionsComponent } from './pages/promotions/promotions';
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
import { BookingLookupComponent } from './pages/booking-lookup/booking-lookup';
import { AdminComponent } from './pages/admin/admin';
import { ServicesComponent } from './pages/services/services';
import { roleGuard } from './guards/role.guard';
import { PartnerLayoutComponent } from './components/partner-layout/partner-layout';
import { HelpCenterComponent } from './pages/help-center/help-center';
import { HelpCenterContactComponent } from './pages/help-center/contact';
import { HowItWorksComponent } from './pages/how-it-works/how-it-works';
import { CancellationPolicyComponent } from './pages/cancellation-policy/cancellation-policy';
import { NetworkErrorComponent } from './pages/network-error/network-error';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'tours', component: ToursComponent },
  { path: 'promotions', redirectTo: 'promotions/for-you', pathMatch: 'full' },
  { path: 'promotions/:section', component: PromotionsComponent },
  { path: 'tours/:id', component: TourDetailComponent },
  { path: 'tour-detail/:id', component: TourDetailComponent },
  { path: 'services/:type/:id', component: TourDetailComponent },
  { path: 'services/:id', component: TourDetailComponent },
  { path: 'service-detail/:id', component: TourDetailComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'how-it-works', component: HowItWorksComponent },
  { path: 'cancellation-policy', component: CancellationPolicyComponent },
  { path: 'transparency', component: CancellationPolicyComponent },
  { path: 'network-error', component: NetworkErrorComponent },
  { path: 'help-center', component: HelpCenterComponent },
  { path: 'help-center/:slug', component: HelpCenterComponent },
  { path: 'contact', component: HelpCenterContactComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'community', component: CommunityComponent },
  { path: 'schedule', component: ScheduleEditorComponent },
  { path: 'schedule/:id', component: ScheduleEditorComponent },
  { path: 'schedule-editor', component: ScheduleEditorComponent },
  { path: 'schedule-editor/:id', component: ScheduleEditorComponent },
  { path: 'booking', component: BookingComponent },
  { path: 'booking/payment', component: BookingComponent },
  { path: 'booking/confirm', component: BookingComponent },
  { path: 'booking-lookup', component: BookingLookupComponent },
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
