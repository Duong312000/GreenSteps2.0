import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, timeout, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { LoginModalService } from './login-modal.service';
import { getApiUrl } from '../config/api-config';

export type FavoriteType = 'tour' | 'service' | 'itinerary' | 'place' | 'transport_trip' | 'transport_rental';
export interface FavoriteItem {
  id: string; target_type: FavoriteType; target_id: string; name: string; image: string;
  destination: string; price: number | null; price_unit: string; available: boolean;
  url: string | null; map_url?: string; days?: number; lat?: number; lng?: number; place_type?: string;
}
export interface FavoriteRef { type: FavoriteType; id: string; snapshot?: Record<string, any>; }

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly items$ = new BehaviorSubject<FavoriteItem[]>([]);
  readonly loading$ = new BehaviorSubject(false);
  readonly error$ = new BehaviorSubject('');
  private userId = '';
  private epoch = 0;
  private revision = 0;
  private busyKeys = new Set<string>();
  private inFlight: Promise<void> | null = null;
  private channel?: BroadcastChannel;
  private authSubscription: Subscription;
  private readonly onFocus = () => { if (this.userId) void this.refresh(); };
  constructor(private http: HttpClient, private auth: AuthService, private login: LoginModalService) {
    this.authSubscription = this.auth.currentUser$.subscribe(user => {
      const id = user?.id || user?._id || '';
      if (id === this.userId) return;
      this.userId = id; this.epoch++; this.inFlight = null; this.busyKeys.clear();
      this.items$.next([]); this.error$.next(''); this.loading$.next(false);
      if (id) void this.refresh();
    });
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('greensteps-favorites');
      this.channel.onmessage = event => { if (event.data?.userId === this.userId && this.userId) void this.refresh(); };
    }
    if (typeof window !== 'undefined') window.addEventListener('focus', this.onFocus);
  }
  ngOnDestroy() { this.authSubscription.unsubscribe(); this.channel?.close(); if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus); }
  get accountKey() { return this.userId; }
  get signedIn() { return !!this.userId; }
  get items() { return this.items$.value; }
  private key(type: FavoriteType, id: string) { return `${type}:${id}`; }
  isSaved(type: FavoriteType, id: string) { return this.items.some(item => item.target_type === type && item.target_id === id); }
  isBusy(type: FavoriteType, id: string) { return this.busyKeys.has(this.key(type, id)); }
  openLogin() { this.login.open(); }
  private request(method: string, path = '', body?: unknown): Promise<any> {
    return firstValueFrom(this.http.request(method, `${getApiUrl()}/favorites${path}`, { body, withCredentials: true }).pipe(timeout(15000)));
  }
  message(error: any) { return error?.error?.message || (error?.name === 'TimeoutError' ? 'Kết nối quá lâu. Vui lòng thử lại.' : 'Không thể cập nhật yêu thích. Vui lòng thử lại.'); }
  refresh(): Promise<void> {
    if (!this.userId) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const epoch = this.epoch, revision = this.revision;
    this.loading$.next(true); this.error$.next('');
    const task = (async () => {
      try {
        const result: FavoriteItem[] = [];
        for (let page = 1; ; page++) {
          const response = await this.request('GET', `?page=${page}&limit=100`);
          if (epoch !== this.epoch) return;
          result.push(...response.data);
          if (result.length >= response.total || !response.data.length) break;
        }
        if (epoch === this.epoch && revision === this.revision) this.items$.next(result);
      } catch (error) { if (epoch === this.epoch) this.error$.next(this.message(error)); }
      finally { if (epoch === this.epoch) { this.loading$.next(false); this.inFlight = null; } }
    })();
    this.inFlight = task;
    return task;
  }
  async setSaved(type: FavoriteType, id: string, saved: boolean, snapshot?: Record<string, any>): Promise<boolean> {
    if (!this.userId) { this.openLogin(); return false; }
    if (!id || this.isBusy(type, id)) return false;
    const epoch = this.epoch, key = this.key(type, id);
    this.busyKeys.add(key);
    try {
      const response = await this.request(saved ? 'PUT' : 'DELETE', `/${type}/${encodeURIComponent(id)}`, saved ? snapshot || {} : undefined);
      if (epoch !== this.epoch) return false;
      this.revision++;
      const others = this.items.filter(item => this.key(item.target_type, item.target_id) !== key);
      this.items$.next(saved ? [response.data, ...others] : others);
      this.channel?.postMessage({ userId: this.userId });
      return true;
    } finally { if (epoch === this.epoch) this.busyKeys.delete(key); }
  }
  toggle(ref: FavoriteRef) { return this.setSaved(ref.type, ref.id, !this.isSaved(ref.type, ref.id), ref.snapshot); }
  placeRef(place: any): FavoriteRef {
    const serviceId = place.service_id || place.serviceId || (/^srv[_-]/i.test(String(place.id || '')) ? place.id : '');
    if (serviceId) return { type: 'service', id: serviceId };
    const name = String(place.name || place.title || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    const lat = typeof place.lat === 'number' ? place.lat : null, lng = typeof place.lng === 'number' ? place.lng : null;
    const id = place.google_place_id || place.place_id || `place:${name.toLocaleLowerCase('vi').slice(0,150)}:${lat}:${lng}`;
    return { type: 'place', id: String(id).slice(0,240), snapshot: { name, image: place.img || place.image || '', cost: place.cost, type: place.type, destination: place.destination || '', lat, lng } };
  }
}
