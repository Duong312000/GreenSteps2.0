import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FavoriteButtonComponent } from '../../components/favorites/favorite-button';
import { TourDetailComponent } from './tour-detail';

@NgModule({
  declarations: [TourDetailComponent],
  imports: [CommonModule, FormsModule, FavoriteButtonComponent, RouterModule.forChild([{ path: '', component: TourDetailComponent }])]
})
export class TourDetailModule {}
