import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { getApiUrl } from '../config/api-config';
@Injectable({ providedIn:'root' })
export class TransportService {
 private http=inject(HttpClient);
 request(method:string,path:string,body?:unknown,query:Record<string,any>={}) : Promise<any> {
  let params=new HttpParams();
  for(const [k,v] of Object.entries(query)) if(v !== '' && v !== undefined && v !== null) params=params.set(k,String(v));
  return firstValueFrom(this.http.request(method,`${getApiUrl()}/transport${path}`,{ body,params,withCredentials:true }).pipe(timeout(15000)));
 }
 message(e:any) { return e?.error?.message || (e?.name === 'TimeoutError' ? 'Kết nối quá lâu. Vui lòng thử lại.':'Không thể tải dữ liệu. Vui lòng thử lại.'); }
}
