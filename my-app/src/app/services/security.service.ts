import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../config/api-config';
import { startRegistration } from '@simplewebauthn/browser';

export interface SecuritySession {
  id: string;
  isCurrent: boolean;
  browser: string;
  platform: string;
  createdAt: string | null;
  lastActiveAt: string | null;
  expiresAt: string;
  ipAddress?: string | null;
}

export interface SecurityMeasure {
  enabled: boolean;
  applicable?: boolean;
  status?: string;
}

export interface SecurityMeasures {
  primaryAuthentication: SecurityMeasure & { provider: string };
  emailVerified: SecurityMeasure;
  localPassword: SecurityMeasure & { configured: boolean; strength: string; lastChangedAt: string | null };
  passkeys: SecurityMeasure & { count: number };
  recoveryEmail: SecurityMeasure & { verified: boolean; address: string | null };
  recoveryPhone: SecurityMeasure & { verified: boolean };
  securityEmailNotifications: { enabled: boolean };
}

export interface SecurityOverview {
  score: number;
  scoreLabel: string;
  measures: SecurityMeasures;
  recommendations: Array<{ id: string; title: string; action: string }>;
  sessions: SecuritySession[];
  passkeys: Array<{ id: string; name: string; createdAt: string | null; lastUsedAt: string | null }>;
  recentLoginAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly baseUrl = `${getApiUrl()}/account/security`;

  constructor(private readonly http: HttpClient) {}

  async getOverview(): Promise<SecurityOverview> {
    const response = await firstValueFrom(this.http.get<{ success: boolean; overview: SecurityOverview }>(`${this.baseUrl}/overview`, { withCredentials: true }));
    return response.overview;
  }

  async getSessions(): Promise<SecuritySession[]> {
    const response = await firstValueFrom(this.http.get<{ success: boolean; sessions: SecuritySession[] }>(`${this.baseUrl}/sessions`, { withCredentials: true }));
    return response.sessions || [];
  }

  async revokeSession(sessionId: string): Promise<{ currentSessionRevoked: boolean }> {
    return firstValueFrom(this.http.delete<{ success: boolean; currentSessionRevoked: boolean }>(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}`, { withCredentials: true }));
  }

  async revokeOtherSessions(): Promise<number> {
    const response = await firstValueFrom(this.http.post<{ success: boolean; revokedCount: number }>(`${this.baseUrl}/sessions/revoke-others`, {}, { withCredentials: true }));
    return response.revokedCount;
  }

  async revokeAllSessions(): Promise<number> {
    const response = await firstValueFrom(this.http.post<{ success: boolean; revokedCount: number }>(`${this.baseUrl}/sessions/revoke-all`, {}, { withCredentials: true }));
    return response.revokedCount;
  }

  async getActivity(page = 1, pageSize = 20): Promise<{ items: any[]; page: number; pageSize: number; total: number; totalPages?: number }> {
    return firstValueFrom(this.http.get<{ items: any[]; page: number; pageSize: number; total: number; totalPages?: number }>(`${this.baseUrl}/activity`, { params: { page, pageSize }, withCredentials: true }));
  }

  async updateSecurityEmailNotifications(enabled: boolean): Promise<boolean> {
    const response = await firstValueFrom(this.http.put<{ securityEmailNotifications: boolean }>(`${this.baseUrl}/preferences`, { securityEmailNotifications: enabled }, { withCredentials: true }));
    return response.securityEmailNotifications;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.put(`${getApiUrl()}/auth/change-password`, { oldPassword, newPassword }, { withCredentials: true }));
  }

  async setPassword(password: string, confirmPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.baseUrl}/password/setup`, { password, confirmPassword }, { withCredentials: true }));
  }

  async requestEmailChange(email: string, currentPassword?: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.baseUrl}/email-change/request`, { email, currentPassword }, { withCredentials: true }));
  }

  async confirmEmailChange(code: string): Promise<string> {
    const response = await firstValueFrom(this.http.post<{ success: boolean; email: string }>(`${this.baseUrl}/email-change/confirm`, { code }, { withCredentials: true }));
    return response.email;
  }

  async registerPasskey(name: string, proof: { currentPassword?: string; code?: string } = {}): Promise<void> {
    const started = await firstValueFrom(this.http.post<any>(`${this.baseUrl}/passkeys/register/options`, proof, { withCredentials: true }));
    const response = await startRegistration({ optionsJSON: started.options });
    await firstValueFrom(this.http.post(`${this.baseUrl}/passkeys/register/verify`, { challengeId: started.challengeId, response, name }, { withCredentials: true }));
  }

  async renamePasskey(id: string, name: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.baseUrl}/passkeys/${encodeURIComponent(id)}`, { name }, { withCredentials: true }));
  }

  async deletePasskey(id: string, proof: { currentPassword?: string; code?: string } = {}): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/passkeys/${encodeURIComponent(id)}`, { body: proof, withCredentials: true }));
  }
}
