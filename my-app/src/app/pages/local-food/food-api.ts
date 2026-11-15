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
  priceMin: number;
  priceMax: number;
  priceUnit: string;
  rating: number;
  reviewCount: number;
  features: string[];
  hours: string;
  capacity: number;
  menu: { name: string; price: number }[];
  status: string;
  version: number;
  isDemo?: boolean;
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
