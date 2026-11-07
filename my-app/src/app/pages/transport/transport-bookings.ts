import { Component, inject, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { TransportService } from '../../services/transport.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
@Component({ selector:'app-transport-bookings',standalone:true,imports:[CommonModule,RouterModule],template:`
<section class="transport-bookings"><h2>Đặt dịch vụ di chuyển</h2><p *ngIf="!auth.getCurrentUser()">Đăng nhập để xem đặt chỗ của bạn. <button (click)="login.open()">Đăng nhập</button></p><p *ngIf="loading" role="status">Đang tải đặt chỗ…</p><p *ngIf="error" role="alert">{{error}} <button (click)="load()">Thử lại</button></p><p *ngIf="!loading&&!error&&auth.getCurrentUser()&&!data.length">Bạn chưa có đặt chỗ di chuyển. <a routerLink="/transport">Tìm chuyến xe</a></p>
<article *ngFor="let b of data"><div><span>{{b.booking_type==='rental'?'Thuê xe':b.booking_type==='bus'?'Xe khách':'Xe ghép'}}</span><h3>{{b.partner?.name}}</h3><strong>{{b.booking_code}}</strong><p>{{b.vehicle?.name}}</p><p>{{b.service_start|date:'HH:mm dd/MM/yyyy':'+0700'}}<span *ngIf="b.rental_end"> → {{b.rental_end|date:'HH:mm dd/MM/yyyy':'+0700'}}</span></p><p *ngIf="b.pickup_stop">Đón: {{b.pickup_stop.estimated_time|date:'HH:mm dd/MM/yyyy':'+0700'}} · {{b.pickup_stop.name}}<small>{{b.pickup_stop.address}}</small></p><p *ngIf="b.dropoff_stop">Trả: {{b.dropoff_stop.estimated_time|date:'HH:mm dd/MM/yyyy':'+0700'}} · {{b.dropoff_stop.name}}<small>{{b.dropoff_stop.address}}</small></p><p *ngIf="b.passenger_count">{{b.passenger_count}} khách</p><p>{{b.total_price|number}} ₫ · {{statusLabel(b)}}</p><small>{{b.notice}}</small></div><div class="actions"><a *ngIf="b.can_pay" routerLink="/booking/payment" [queryParams]="{transportBookingId:b._id}">Tiếp tục thanh toán</a><a *ngIf="b.payment_status === 'SIMULATED_PAID'" routerLink="/booking/confirm" [queryParams]="{transportBookingId:b._id}">Xem thanh toán</a><a [routerLink]="['/transport-bookings',b._id]" *ngIf="!detailId">Xem chi tiết</a><a [routerLink]="['/transport',b.trip_id?'trips':'rentals',b.trip_id||b.rental_id]" [queryParams]="{type:b.booking_type}">Xem dịch vụ</a><button (click)="cancelId=b._id" *ngIf="b.can_cancel&&cancelId!==b._id">Hủy đặt chỗ</button><div *ngIf="cancelId===b._id"><p>Bạn muốn hủy yêu cầu {{b.booking_code}}?</p><button (click)="cancel(b)" [disabled]="busy">Xác nhận hủy</button><button (click)="cancelId=''" [disabled]="busy">Giữ đặt chỗ</button></div></div></article>
<nav *ngIf="!detailId&&total>10"><button [disabled]="page===1||loading" (click)="page=page-1;load()">Trang trước</button><span>{{page}}</span><button [disabled]="page*10>=total||loading" (click)="page=page+1;load()">Trang sau</button></nav><a routerLink="/profile" [queryParams]="{section:'tickets'}" *ngIf="detailId">Lịch trình của tôi</a></section>`,styles:[`:host{display:block}.transport-bookings{padding:24px;background:var(--bg-secondary);border-radius:16px;color:var(--text-primary)}h2{margin:0 0 20px}article{display:flex;justify-content:space-between;gap:24px;border-top:1px solid var(--bg-tertiary);padding:20px 0}h3{margin:7px 0}p{margin:8px 0}small{display:block;max-width:650px;color:var(--text-secondary);line-height:1.6}a{color:var(--primary-green)}button{padding:9px 12px;border:1px solid var(--bg-tertiary);background:var(--bg-primary);color:var(--primary-green);border-radius:9px;cursor:pointer}.actions{display:flex;flex-direction:column;align-items:start;gap:12px;min-width:130px}nav{display:flex;gap:15px;align-items:center}@media(max-width:600px){article{flex-direction:column}}:host-context(app-transport-booking-page) .transport-bookings{max-width:1050px;margin:auto}`] })
export class TransportBookingsComponent implements OnInit,OnDestroy {
 api=inject(TransportService);auth=inject(AuthService);login=inject(LoginModalService);route=inject(ActivatedRoute);cdr=inject(ChangeDetectorRef);
 data:any[]=[];total=0;page=1;loading=false;busy=false;error='';cancelId='';detailId='';version=0;
 statuses:Record<string,string>={PENDING:'Chờ thanh toán',CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy',COMPLETED:'Đã hoàn tất',FAILED:'Không thể thực hiện'};
 subscriptions=new Subscription();
 statusLabel(b:any){
  if(b.booking_status==='CANCELLED')return b.payment_status==='SIMULATED_REFUNDED'?'Đã hủy · Đã hoàn tác thanh toán':'Đã hủy';
  if(b.payment_status==='SIMULATED_PAID')return 'Đã hoàn tất thanh toán nội bộ';
  if(b.can_pay)return 'Chờ thanh toán';
  return this.statuses[b.booking_status]||b.booking_status;
 }
 ngOnInit(){this.subscriptions.add(combineLatest([this.route.paramMap,this.auth.currentUser$]).subscribe(([p])=>{this.detailId=p.get('id')||'';if(!this.auth.getCurrentUser())this.data=[];this.load();}));}
 ngOnDestroy(){this.subscriptions.unsubscribe();this.version++;}
 async load(){if(!this.auth.getCurrentUser())return;const v=++this.version;this.loading=true;this.error='';try{const r=await this.api.request('GET',this.detailId?`/bookings/${this.detailId}`:'/bookings/me',undefined,{page:this.page,limit:10});if(v===this.version){this.data=this.detailId?[r.data]:r.data;this.total=r.total||0;}}catch(e){this.error=this.api.message(e);}finally{this.loading=false;this.cdr.markForCheck();}}
 async cancel(b:any){this.busy=true;this.error='';try{await this.api.request('POST',`/bookings/${b._id}/cancel`,{});this.cancelId='';await this.load();}catch(e){this.error=this.api.message(e);}finally{this.busy=false;this.cdr.markForCheck();}}
}
@Component({selector:'app-transport-booking-page',standalone:true,imports:[TransportBookingsComponent],template:'<div style="padding:120px 24px 40px;min-height:100vh;background:var(--bg-primary)"><app-transport-bookings /></div>'})
export class TransportBookingPageComponent {}


