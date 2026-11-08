import { Component } from '@angular/core';
import { GreenStepsChatComponent } from '../../components/greensteps-chat/greensteps-chat.component';

@Component({
  selector: 'app-ai-planner',
  standalone: true,
  imports: [GreenStepsChatComponent],
  template: '<app-greensteps-chat [pageMode]="true" />'
})
export class AiPlannerComponent {}
