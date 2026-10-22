import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const user = authService.getCurrentUser();
  if (user && user.role === 'provider') {
    return true;
  }

  // Redirect to home if unauthorized
  router.navigate(['/home']);
  return false;
};
