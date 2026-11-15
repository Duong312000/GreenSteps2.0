import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
export const foodAdminGuard: CanActivateFn = () =>
  inject(AuthService).getCurrentUser()?.role === 'admin' || inject(Router).createUrlTree(['/home']);
