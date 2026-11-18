import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator';
import { CommunityComponent } from './community';

@NgModule({
  declarations: [CommunityComponent],
  imports: [CommonModule, FormsModule, LoadingIndicatorComponent, RouterModule.forChild([{ path: '', component: CommunityComponent }])]
})
export class CommunityModule {}
