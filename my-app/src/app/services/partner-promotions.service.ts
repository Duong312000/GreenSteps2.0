import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

export interface PromotionServiceOption {
  id: string;
  name: string;
  cost: number;
  image?: string;
}
export interface PartnerCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  effective_status: string;
  version: number;
  service_id: string | null;
  service: PromotionServiceOption | null;
  start_at: string;
  end_at: string;
  package: string | null;
  budget: number;
  code?: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  usage_limit: number;
  used_count: number;
  views: number;
  clicks: number;
  bookings: number;
  revenue: number;
  spent: number;
}
@Injectable({ providedIn: 'root' })
export class PartnerPromotionsService {
  private readonly base =
    (['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:5055/api'
      : 'https://greensteps-backend.vercel.app/api') + '/partner/promotions';
  constructor(private http: HttpClient) {}
  private get options() {
    const token = localStorage.getItem('greensteps_token');
    return {
      withCredentials: true,
      headers: token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders(),
    };
  }
  list(filters: Record<string, string | number>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== '') params = params.set(key, value);
    return firstValueFrom(
      this.http.get<{ items: PartnerCampaign[]; total: number }>(this.base, {
        ...this.options,
        params,
      }).pipe(timeout({ first: 10000 })),
    );
  }
  optionsList() {
    return firstValueFrom(
      this.http.get<{ services: PromotionServiceOption[]; packages: Record<string, number> }>(
        `${this.base}/options`,
        this.options,
      ).pipe(timeout({ first: 10000 })),
    );
  }
  detail(id: string) {
    return firstValueFrom(
      this.http.get<{ item: PartnerCampaign }>(
        `${this.base}/${encodeURIComponent(id)}`,
        this.options,
      ).pipe(timeout({ first: 10000 })),
    );
  }
  save(body: unknown, id?: string) {
    return firstValueFrom(
      id
        ? this.http.put(`${this.base}/${encodeURIComponent(id)}`, body, this.options).pipe(timeout({ first: 10000 }))
        : this.http.post(this.base, body, this.options).pipe(timeout({ first: 10000 })),
    );
  }
  status(row: PartnerCampaign, status: string) {
    return firstValueFrom(
      this.http.patch(
        `${this.base}/${row.id}/status`,
        { status, version: row.version },
        this.options,
      ).pipe(timeout({ first: 10000 })),
    );
  }
  remove(row: PartnerCampaign) {
    return firstValueFrom(
      this.http.delete(`${this.base}/${row.id}`, {
        ...this.options,
        body: { version: row.version },
      }).pipe(timeout({ first: 10000 })),
    );
  }
  report(id: string) {
    return firstValueFrom(
      this.http.get<{ report: Record<string, any> }>(`${this.base}/${id}/report`, this.options).pipe(timeout({ first: 10000 })),
    );
  }
}
