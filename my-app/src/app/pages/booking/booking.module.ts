import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BookingComponent } from './booking';

@NgModule({
  declarations: [BookingComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild([
    { path: '', component: BookingComponent },
    { path: 'payment', component: BookingComponent },
    { path: 'confirm', component: BookingComponent }
  ])]
})
export class BookingModule {}
