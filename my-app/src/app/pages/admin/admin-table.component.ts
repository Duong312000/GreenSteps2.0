import { Component } from '@angular/core';

/** Shared visual frame for Admin tables; row data and actions stay in the owning page. */
@Component({
  selector: 'app-admin-table',
  standalone: true,
  template: '<div class="admin-table-frame"><ng-content></ng-content></div>',
  styleUrl: './admin-table.component.css'
})
export class AdminTableComponent {}
