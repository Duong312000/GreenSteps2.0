import { Component } from '@angular/core';
import { SupportChatLauncherService } from '../../services/support-chat-launcher.service';

@Component({
  selector: 'app-help-center-contact',
  templateUrl: './contact.html',
  styleUrl: './contact.css',
  standalone: false
})
export class HelpCenterContactComponent {
  constructor(private readonly chatLauncher: SupportChatLauncherService) {}

  openChat(): void {
    setTimeout(() => this.chatLauncher.requestOpen(), 0);
  }
}
