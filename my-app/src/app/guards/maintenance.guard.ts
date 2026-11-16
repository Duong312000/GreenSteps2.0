import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { getApiUrl } from '../config/api-config';
import { AuthService } from '../services/auth.service';

interface MaintenanceStatus {
  maintenanceMode: boolean;
}

let cachedMaintenanceStatus: { maintenanceMode: boolean; checkedAt: number } | null = null;
let checkInFlight = false;
const MAINTENANCE_CACHE_TTL_MS = 60_000;

function checkMaintenance(url: string) {
  const cleanUrl = url.split(/[?#]/, 1)[0];
  if (cleanUrl === '/maintenance') return true;
  if (cleanUrl === '/admin' && inject(AuthService).getCurrentUser()?.role === 'admin') return true;

  const router = inject(Router);
  const http = inject(HttpClient);
  const now = Date.now();

  if (cachedMaintenanceStatus && (now - cachedMaintenanceStatus.checkedAt < MAINTENANCE_CACHE_TTL_MS)) {
    return cachedMaintenanceStatus.maintenanceMode ? router.createUrlTree(['/maintenance']) : true;
  }

  if (!checkInFlight) {
    checkInFlight = true;
    firstValueFrom(
      http.get<MaintenanceStatus>(`${getApiUrl()}/maintenance-status`).pipe(
        timeout(1500),
        catchError(() => of({ maintenanceMode: false }))
      )
    ).then(status => {
      cachedMaintenanceStatus = {
        maintenanceMode: Boolean(status?.maintenanceMode),
        checkedAt: Date.now()
      };
      if (cachedMaintenanceStatus.maintenanceMode) {
        router.navigate(['/maintenance']);
      }
    }).catch(() => {}).finally(() => {
      checkInFlight = false;
    });
  }

  return cachedMaintenanceStatus?.maintenanceMode ? router.createUrlTree(['/maintenance']) : true;
}

export const maintenanceGuard: CanActivateFn = (_route, state) => checkMaintenance(state.url);
export const maintenanceChildGuard: CanActivateChildFn = (_route, state) => checkMaintenance(state.url);
