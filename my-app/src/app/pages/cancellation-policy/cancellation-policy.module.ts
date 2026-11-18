import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CancellationPolicyComponent } from './cancellation-policy';

@NgModule({
  declarations: [CancellationPolicyComponent],
  imports: [CommonModule, RouterModule.forChild([{ path: '', component: CancellationPolicyComponent }])]
})
export class CancellationPolicyModule {}
