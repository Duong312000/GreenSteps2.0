import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ToursComponent } from './pages/tours/tours';
import { PromotionsComponent } from './pages/promotions/promotions';
import { ScheduleEditorComponent } from './pages/schedule-editor/schedule-editor';
import { PartnerDashboardComponent } from './pages/partner/partner-dashboard/partner-dashboard';
import { PartnerServicesComponent } from './pages/partner/partner-services/partner-services';
import { PartnerBookingsComponent } from './pages/partner/partner-bookings/partner-bookings';
import { PartnerAdsComponent } from './pages/partner/partner-ads/partner-ads';
import { PartnerPromotionsComponent } from './pages/partner/partner-promotions/partner-promotions';
import { PartnerRegisterComponent } from './pages/partner/partner-register/partner-register';
import { PartnerLegalComponent } from './pages/partner/partner-legal/partner-legal';
import { ServerErrorComponent } from './pages/server-error/server-error';
import { MaintenanceComponent } from './pages/maintenance/maintenance';
import { maintenanceChildGuard, maintenanceGuard } from './guards/maintenance.guard';
import { BookingComponent } from './pages/booking/booking';
import { BookingLookupComponent } from './pages/booking-lookup/booking-lookup';
import { ServicesComponent } from './pages/services/services';
import { roleGuard } from './guards/role.guard';
import { adminGuard } from './guards/admin.guard';
import { HelpCenterComponent } from './pages/help-center/help-center';
import { HelpCenterContactComponent } from './pages/help-center/contact';
import { HowItWorksComponent } from './pages/how-it-works/how-it-works';
import { NetworkErrorComponent } from './pages/network-error/network-error';
import { foodAdminGuard } from './pages/local-food/food-admin.guard';

const routes: Routes = [
  { path: 'about', loadComponent: () => import('./pages/about/about').then(m => m.AboutComponent) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password').then(m => m.ResetPasswordComponent) },
  { path: 'sustainability', loadComponent: () => import('./pages/sustainability/sustainability').then(m => m.SustainabilityComponent) },
  { path: 'local-food', loadComponent: () => import('./pages/local-food/local-food').then(m => m.LocalFoodComponent) },
  { path: 'local-food/:id', loadComponent: () => import('./pages/local-food/food-detail').then(m => m.FoodDetailComponent) },
  { path: 'admin/food', loadComponent: () => import('./pages/local-food/food-admin').then(m => m.FoodAdminComponent), canActivate: [foodAdminGuard] },
  { path: 'ai-planner', loadComponent: () => import('./pages/ai-planner/ai-planner').then(m => m.AiPlannerComponent) },
  { path:'transport', loadComponent:()=>import('./pages/transport/transport').then(m=>m.TransportComponent) },
  { path:'transport/:kind/:id', loadComponent:()=>import('./pages/transport/transport').then(m=>m.TransportComponent) },
  { path:'transport-bookings', loadComponent:()=>import('./pages/transport/transport-bookings').then(m=>m.TransportBookingPageComponent) },
  { path:'transport-bookings/:id', loadComponent:()=>import('./pages/transport/transport-bookings').then(m=>m.TransportBookingPageComponent) },
  { path:'admin/transport', loadComponent:()=>import('./pages/transport/transport-admin').then(m=>m.TransportAdminComponent) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadChildren: () => import('./pages/home/home.module').then(m => m.HomeModule) },
  { path: 'tours', component: ToursComponent },
  { path: 'destinations', redirectTo: 'home', pathMatch: 'full' },
  { path: 'destinations/:slug', redirectTo: 'home', pathMatch: 'full' },
  { path: 'promotions', redirectTo: 'promotions/for-you', pathMatch: 'full' },
  { path: 'promotions/:section', component: PromotionsComponent },
  { path: 'tours/:id', loadChildren: () => import('./pages/tour-detail/tour-detail.module').then(m => m.TourDetailModule) },
  { path: 'tour-detail/:id', loadChildren: () => import('./pages/tour-detail/tour-detail.module').then(m => m.TourDetailModule) },
  { path: 'services/:type/:id', loadChildren: () => import('./pages/tour-detail/tour-detail.module').then(m => m.TourDetailModule) },
  { path: 'services/:id', loadChildren: () => import('./pages/tour-detail/tour-detail.module').then(m => m.TourDetailModule) },
  { path: 'service-detail/:id', loadChildren: () => import('./pages/tour-detail/tour-detail.module').then(m => m.TourDetailModule) },
  { path: 'services', component: ServicesComponent },
  { path: 'how-it-works', component: HowItWorksComponent },
  { path: 'cancellation-policy', loadChildren: () => import('./pages/cancellation-policy/cancellation-policy.module').then(m => m.CancellationPolicyModule) },
  { path: 'transparency', loadChildren: () => import('./pages/cancellation-policy/cancellation-policy.module').then(m => m.CancellationPolicyModule) },
  { path: 'network-error', component: NetworkErrorComponent },
  { path: '500', component: ServerErrorComponent },
  { path: 'maintenance', component: MaintenanceComponent },
  { path: 'help-center', component: HelpCenterComponent },
  { path: 'help-center/:slug', component: HelpCenterComponent },
  { path: 'contact', component: HelpCenterContactComponent },
  { path: 'profile', loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfileModule) },
  { path: 'community', loadChildren: () => import('./pages/community/community.module').then(m => m.CommunityModule) },
  { path: 'ai-planner', redirectTo: 'schedule' },
  { path: 'schedule', loadChildren: () => import('./pages/schedule-editor/schedule-editor.module').then(m => m.ScheduleEditorModule) },
  { path: 'schedule/:id', loadChildren: () => import('./pages/schedule-editor/schedule-editor.module').then(m => m.ScheduleEditorModule) },
  { path: 'schedule-editor', loadChildren: () => import('./pages/schedule-editor/schedule-editor.module').then(m => m.ScheduleEditorModule) },
  { path: 'schedule-editor/:id', loadChildren: () => import('./pages/schedule-editor/schedule-editor.module').then(m => m.ScheduleEditorModule) },
  { path: 'booking', loadChildren: () => import('./pages/booking/booking.module').then(m => m.BookingModule) },
  { path: 'admin/catalog', loadComponent: () => import('./pages/admin/catalog-admin.component').then(m => m.CatalogAdminComponent), canActivate: [adminGuard] },
  { path: 'booking-lookup', component: BookingLookupComponent },
  { path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { path: '', loadChildren: () => import('./pages/partner/partner.module').then(m => m.PartnerModule) },
  { path: '**', redirectTo: 'home' }
];

// Maintenance is checked on public navigation; admin and the maintenance screen remain reachable.
for (const route of routes) {
  if (route.path === 'maintenance' || route.path === 'admin' || route.redirectTo || !route.path && !route.children) continue;
  if (route.children) {
    route.canActivateChild = [...(route.canActivateChild || []), maintenanceChildGuard];
  } else {
    route.canActivate = [...(route.canActivate || []), maintenanceGuard];
  }
}

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
