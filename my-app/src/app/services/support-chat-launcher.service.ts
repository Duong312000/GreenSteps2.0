import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SupportChatLauncherService {
  readonly plannerOpen = signal(false);
  private readonly openRequests = new Subject<'support' | 'planner'>();
  readonly openRequested$ = this.openRequests.asObservable();

  requestOpen(mode: 'support' | 'planner' = 'support'): void {
    this.openRequests.next(mode);
  }
}
