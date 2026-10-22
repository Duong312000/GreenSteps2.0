import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { User } from '../models/models';
import { ApiService } from './api.service';

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
  code?: string;
  email?: string;
  requiresVerification?: boolean;
  retryAfterSeconds?: number;
  resetToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private BACKEND_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5055/api/auth'
    : 'https://greensteps-6swn.onrender.com/api/auth';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private apiService: ApiService) {
    this.loadSession();
    const user = this.getCurrentUser();
    if (user) {
      this.apiService.preloadAppData(user.id);
    } else {
      this.apiService.preloadAppData();
    }
  }

  private loadSession() {
    const userStr = localStorage.getItem('greensteps_user');
    if (!userStr) return;
    try {
      this.currentUserSubject.next(JSON.parse(userStr));
    } catch {
      localStorage.removeItem('greensteps_user');
    }
  }

  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  public setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem('greensteps_user', JSON.stringify(user));
      document.cookie = `isLoggedIn=true; path=/; max-age=86400`;
      document.cookie = `role=${user.role}; path=/; max-age=86400`;
      document.cookie = `userId=${user.id || user._id}; path=/; max-age=86400`;
      document.cookie = `fullname=${encodeURIComponent(user.fullname || user.username)}; path=/; max-age=86400`;
      this.apiService.preloadAppData(user.id || user._id);
    } else {
      localStorage.removeItem('greensteps_user');
      document.cookie = `isLoggedIn=; path=/; max-age=0`;
      document.cookie = `role=; path=/; max-age=0`;
      document.cookie = `userId=; path=/; max-age=0`;
      document.cookie = `fullname=; path=/; max-age=0`;
    }
    this.currentUserSubject.next(user);
  }

  private mapUser(raw: any): User {
    return {
      id: raw.id || raw._id,
      username: raw.username,
      fullname: raw.fullname || raw.username,
      email: raw.email,
      phone: raw.phone ?? null,
      dob: raw.dob,
      gender: raw.gender,
      address: raw.address,
      role: raw.role || 'traveler',
      companyName: raw.companyName || raw.company_name,
      avatarUrl: raw.avatarUrl || raw.avatar_url,
      is_verified: raw.is_verified
    };
  }

  public async login(identifier: string, password: string): Promise<AuthResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/login`, { identifier, password }, { withCredentials: true })
      );
      if (res?.success && res.user) {
        if (res.token) localStorage.setItem('greensteps_token', res.token);
        const user = this.mapUser(res.user);
        this.setCurrentUser(user);
        // Refresh profile in background to get latest data (avatarUrl, etc.)
        this.refreshProfile().catch(() => {});
        return { success: true, user, token: res.token, message: res.message };
      }
      return { success: false, message: res?.message || 'Đăng nhập thất bại.' };
    } catch (err: any) {
      return {
        success: false,
        message: err?.error?.message || 'Email/tên đăng nhập hoặc mật khẩu không chính xác!',
        code: err?.error?.code,
        email: err?.error?.email
      };
    }
  }

  public async googleLogin(email: string, fullname: string): Promise<AuthResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/google-login`, { email, fullname }, { withCredentials: true })
      );
      if (res?.success && res.user) {
        if (res.token) localStorage.setItem('greensteps_token', res.token);
        const user = this.mapUser(res.user);
        this.setCurrentUser(user);
        return { success: true, user, token: res.token, message: res.message };
      }
      return { success: false, message: res?.message || 'Đăng nhập Google thất bại.' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Đăng nhập Google thất bại.' };
    }
  }

  public loginWithToken(rawUser: any, token: string) {
    if (token) localStorage.setItem('greensteps_token', token);
    const user = this.mapUser(rawUser);
    this.setCurrentUser(user);
  }

  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      // atob is supported in modern browsers
      const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  public loginWithOnlyToken(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return false;
    
    const rawUser = {
      id: payload.id,
      username: payload.username,
      fullname: payload.fullname || payload.username,
      role: payload.role || 'traveler'
    };
    
    this.loginWithToken(rawUser, token);
    return true;
  }

  public async register(payload: { username: string; email: string; password: string }): Promise<AuthResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/register`, payload, { withCredentials: true })
      );
      return {
        success: !!res?.success,
        message: res?.message,
        requiresVerification: res?.requiresVerification,
        user: res?.user ? this.mapUser(res.user) : undefined
      };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Đăng ký thất bại.' };
    }
  }

  public async verifyRegisterOtp(email: string, otp: string): Promise<AuthResult> {
    return this.postAuth('/register/verify-otp', { email, otp }, 'Xác thực OTP thất bại.', true);
  }

  public async resendRegisterOtp(email: string): Promise<AuthResult> {
    return this.postAuth('/register/resend-otp', { email }, 'Gửi lại mã thất bại.');
  }

  public async requestForgotPasswordOtp(email: string): Promise<AuthResult> {
    return this.postAuth('/forgot-password/request-otp', { email }, 'Không thể gửi mã xác thực.');
  }

  public async verifyForgotPasswordOtp(email: string, otp: string): Promise<AuthResult> {
    return this.postAuth('/forgot-password/verify-otp', { email, otp }, 'Xác thực OTP thất bại.');
  }

  public async resetForgotPassword(resetToken: string, newPassword: string): Promise<AuthResult> {
    return this.postAuth('/forgot-password/reset', { resetToken, newPassword }, 'Đặt lại mật khẩu thất bại.');
  }

  private async postAuth(path: string, body: any, fallbackMessage: string, persistSession = false): Promise<AuthResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}${path}`, body, { withCredentials: true })
      );
      const user = res?.user ? this.mapUser(res.user) : undefined;
      if (persistSession && res?.success && user) {
        if (res.token) localStorage.setItem('greensteps_token', res.token);
        this.setCurrentUser(user);
      }
      return {
        success: !!res?.success,
        message: res?.message,
        user,
        token: res?.token,
        retryAfterSeconds: res?.retryAfterSeconds,
        resetToken: res?.resetToken
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.error?.message || fallbackMessage,
        retryAfterSeconds: err?.error?.retryAfterSeconds,
        code: err?.error?.code
      };
    }
  }

  public async updateProfile(userId: string, profileData: any): Promise<{ success: boolean; pending?: boolean; message?: string; user?: User }> {
    try {
      const res = await firstValueFrom(
        this.http.put<any>(`${this.BACKEND_URL}/profile/${userId}`, profileData, { withCredentials: true })
      );
      if (res?.success && res.user) {
        const user = this.mapUser(res.user);
        this.setCurrentUser(user);
        this.apiService.clearCache('community_posts_');
        this.apiService.clearCache('tour_reviews_');
        this.apiService.clearCache('service_reviews_');
        this.apiService.clearCache('preset_tour_');
        return { success: true, pending: res.pending, user };
      }
      return { success: false, message: res?.message || 'Cập nhật thất bại!' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Lỗi kết nối server cập nhật!' };
    }
  }

  public async toggleRole(userId: string): Promise<string | null> {
    const user = this.getCurrentUser();
    if (!user) return null;

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; role: 'traveler' | 'provider' }>(`${this.BACKEND_URL}/role/${userId}`, {}, { withCredentials: true })
      );
      if (res?.success) {
        user.role = res.role;
        this.setCurrentUser(user);
        return res.role;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async refreshProfile(): Promise<void> {
    const current = this.getCurrentUser();
    if (!current) return;
    const userId = current.id || current._id || '';
    if (!userId) return;
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.BACKEND_URL}/profile/${userId}`, { withCredentials: true })
      );
      if (res?.success && res.user) {
        const freshUser = this.mapUser(res.user);
        this.setCurrentUser(freshUser);
      }
    } catch {
      // Silently ignore – keep cached user data
    }
  }

  public logout() {
    this.setCurrentUser(null);
    localStorage.removeItem('greensteps_token');
    
    // Send post logout request to clear secure HttpOnly cookies
    this.http.post(`${this.BACKEND_URL}/logout`, {}, { withCredentials: true }).subscribe({
      next: () => {
        window.location.href = '/home';
      },
      error: () => {
        window.location.href = '/home';
      }
    });
  }
}
