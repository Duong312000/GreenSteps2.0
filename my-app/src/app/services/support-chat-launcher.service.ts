import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SupportChatLauncherService {
  private readonly openRequests = new Subject<void>();
  readonly openRequested$ = this.openRequests.asObservable();

  requestOpen(): void {
    this.openRequests.next();
  }
}
