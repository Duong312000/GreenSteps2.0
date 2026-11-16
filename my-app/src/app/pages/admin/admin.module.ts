import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AccountDetailModalComponent } from './account-detail-modal.component';
import { AdminTableComponent } from './admin-table.component';
import { AdminUsersComponent } from './admin-users';
import { CopyableIdComponent } from './copyable-id.component';
import { AdminComponent } from './admin';
import { StatusBadgeComponent } from '../../components/shared/status-badge';

@NgModule({
  declarations: [AdminComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AccountDetailModalComponent, AdminTableComponent,
    AdminUsersComponent, CopyableIdComponent, StatusBadgeComponent,
    RouterModule.forChild([{ path: '', component: AdminComponent }])]
})
export class AdminModule {}
