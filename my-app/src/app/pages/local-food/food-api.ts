import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiUrl } from '../../config/api-config';
import { registerLocaleData } from '@angular/common';
import vi from '@angular/common/locales/vi';
registerLocaleData(vi);

export interface FoodPlace {
  id: string;
  name: string;
  category: string;
  destination: string;
  address: string;
  description: string;
  image: string;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string;
  rating: number | null;
  reviewCount: number | null;
  features: string[];
  hours: string;
  capacity: number | null;
  menu: { name: string; price: number | null }[];
  status: string;
  version: number;
  isDemo?: boolean;
  mapsUrl?: string;
  website?: string;
  phone?: string;
  menuUrl?: string;
  bookingEnabled?: boolean;
  sourceCheckedAt?: string;
  sources?: { label: string; url: string }[];
  priceNote?: string;
}
export const FOOD_CATEGORIES = [
  'Quán chay',
  'Đặc sản địa phương',
  'Cà phê & trà',
  'Set ăn & buffet',
];
export const FOOD_FEATURES = [
  'Thuần chay',
  'Chay có trứng sữa',
  'Chỗ đỗ xe',
  'Không gian ngoài trời',
  'Nguyên liệu địa phương',
  'Hạn chế nhựa',
];
@Injectable({ providedIn: 'root' })
export class FoodApi {
  private http = inject(HttpClient);
  request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return firstValueFrom(
      this.http.request<T>(method, `${getApiUrl()}/food${path}`, { body, withCredentials: true }),
    );
  }
  list(admin = false) {
    return this.request<FoodPlace[]>('GET', admin ? '/admin/places' : '/places');
  }
}
