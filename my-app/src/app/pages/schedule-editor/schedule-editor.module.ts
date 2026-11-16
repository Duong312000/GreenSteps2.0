import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FavoriteButtonComponent } from '../../components/favorites/favorite-button';
import { ScheduleEditorComponent } from './schedule-editor';

@NgModule({
  declarations: [ScheduleEditorComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FavoriteButtonComponent, RouterModule.forChild([
    { path: '', component: ScheduleEditorComponent }
  ])]
})
export class ScheduleEditorModule {}
