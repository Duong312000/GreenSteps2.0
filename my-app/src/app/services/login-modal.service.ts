import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginModalService {
  private openSubject = new Subject<void>();
  public open$ = this.openSubject.asObservable();

  public open() {
    this.openSubject.next();
  }
}
