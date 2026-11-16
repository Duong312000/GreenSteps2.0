import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FavoriteCollectionComponent } from '../../components/favorites/favorite-collection';
import { GreenStepsChatComponent } from '../../components/greensteps-chat/greensteps-chat.component';
import { GreenWalletComponent } from './green-wallet';
import { TransportBookingsComponent } from '../transport/transport-bookings';
import { ProfileComponent } from './profile';
import { MyVouchersComponent } from './my-vouchers';

@NgModule({
  declarations: [ProfileComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FavoriteCollectionComponent, GreenWalletComponent,
    TransportBookingsComponent, MyVouchersComponent, GreenStepsChatComponent,
    RouterModule.forChild([{ path: '', component: ProfileComponent }])]
})
export class ProfileModule {}
