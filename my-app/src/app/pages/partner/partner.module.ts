import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PartnerLayoutComponent } from '../../components/partner-layout/partner-layout';
import { PartnerIconComponent } from '../../components/partner-layout/partner-icon';
import { LegalPageLayoutComponent } from '../../components/legal-page-layout/legal-page-layout';
import { roleGuard } from '../../guards/role.guard';
import { PartnerAdsComponent } from './partner-ads/partner-ads';
import { PartnerBookingsComponent } from './partner-bookings/partner-bookings';
import { PartnerDashboardComponent } from './partner-dashboard/partner-dashboard';
import { PartnerLegalComponent } from './partner-legal/partner-legal';
import { PartnerPromotionsComponent } from './partner-promotions/partner-promotions';
import { PartnerRegisterComponent } from './partner-register/partner-register';
import { PartnerServicesComponent } from './partner-services/partner-services';
import { LoadingIndicator } from '../../components/loading-indicator/loading-indicator';

@NgModule({
  declarations: [PartnerAdsComponent, PartnerBookingsComponent, PartnerDashboardComponent, PartnerLegalComponent,
    PartnerPromotionsComponent, PartnerRegisterComponent, PartnerServicesComponent, LegalPageLayoutComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PartnerIconComponent, PartnerLayoutComponent, LoadingIndicator,
    RouterModule.forChild([
      { path: '', component: PartnerLayoutComponent, children: [
        { path: 'partner-dashboard', component: PartnerDashboardComponent, canActivate: [roleGuard] },
        { path: 'partner-services', component: PartnerServicesComponent, canActivate: [roleGuard] },
        { path: 'partner-bookings', component: PartnerBookingsComponent, canActivate: [roleGuard] },
        { path: 'partner-ads', component: PartnerAdsComponent, canActivate: [roleGuard] },
        { path: 'partner-promotions', component: PartnerPromotionsComponent, canActivate: [roleGuard] }
      ] },
      { path: 'partner-register', component: PartnerRegisterComponent },
      { path: 'become-a-partner', component: PartnerRegisterComponent },
      { path: 'provider-terms', component: PartnerLegalComponent, data: { partnerPolicy: 'terms' } },
      { path: 'payment-policy', component: PartnerLegalComponent, data: { partnerPolicy: 'payment' } }
    ])]
})
export class PartnerModule {}
