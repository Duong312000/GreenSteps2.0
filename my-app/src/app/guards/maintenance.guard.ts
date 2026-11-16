import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../config/api-config';
import { AuthService } from '../services/auth.service';

interface MaintenanceStatus {
  maintenanceMode: boolean;
}

async function checkMaintenance(url: string) {
  const cleanUrl = url.split(/[?#]/, 1)[0];
  if (cleanUrl === '/maintenance') return true;
  if (cleanUrl === '/admin' && inject(AuthService).getCurrentUser()?.role === 'admin') return true;

  const router = inject(Router);
  const http = inject(HttpClient);
  try {
    const status = await firstValueFrom(http.get<MaintenanceStatus>(`${getApiUrl()}/maintenance-status`));
    return status.maintenanceMode ? router.createUrlTree(['/maintenance']) : true;
  } catch {
    // A temporary status API failure must not block navigation to the page.
    return true;
  }
}

export const maintenanceGuard: CanActivateFn = (_route, state) => checkMaintenance(state.url);
export const maintenanceChildGuard: CanActivateChildFn = (_route, state) => checkMaintenance(state.url);
