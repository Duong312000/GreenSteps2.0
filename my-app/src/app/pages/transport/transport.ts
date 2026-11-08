import { FavoriteButtonComponent } from '../../components/favorites/favorite-button';
import { Component, inject, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { TransportService } from '../../services/transport.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { BusTripDetailComponent, BusSelection } from './bus-trip-detail';
import { RentalDetailComponent, RentalSelection } from './rental-detail';
@Component({ selector:'app-transport',standalone:true,imports:[FavoriteButtonComponent,CommonModule,FormsModule,RouterModule,BusTripDetailComponent,RentalDetailComponent],templateUrl:'./transport.html',styleUrl:'./transport.css' })
export class TransportComponent implements OnInit,OnDestroy {
 api=inject(TransportService); route=inject(ActivatedRoute); router=inject(Router); auth=inject(AuthService); login=inject(LoginModalService); cdr=inject(ChangeDetectorRef);
 subscriptions=new Subscription(); version=0; loading=false; submitting=false; error=''; success=''; data:any[]=[]; total=0; detail:any=null; comparison:any=null; metadata:any={origins:[],destinations:[],locations:[],vehicleTypes:[],fuelTypes:[]};
 q:Record<string,any>={type:'shared',passengers:1,page:1,sortBy:'departure'};
 labels:Record<string,string>={car:'Ô tô tự lái',electric_car:'Ô tô điện',motorbike:'Xe máy',electric_motorbike:'Xe máy điện',bicycle:'Xe đạp',electric_bicycle:'Xe đạp điện',minibus:'Xe ghép',coach:'Xe khách',petrol:'Xăng',diesel:'Dầu diesel',electric:'Điện',human:'Sức người'};
 tabs=[{id:'shared',label:'Xe ghép / Xe chia sẻ',icon:'bi-car-front'},{id:'bus',label:'Xe khách',icon:'bi-bus-front'},{id:'rental',label:'Thuê xe',icon:'bi-key'}];
 seatCount=1; pickupDate=''; pickupTime='08:00'; returnDate=''; returnTime='18:00'; distanceKm:number|null=null; bookingId=''; confirmed=false;
 get vehicleTypes():string[]{ return this.metadata.vehicleTypes.filter((v:string)=>this.rental ? !['minibus','coach'].includes(v):this.q['type']==='bus'?['coach','minibus'].includes(v):['car','electric_car','minibus'].includes(v)); }
 get rental() { return this.q['type']==='rental'; }
 get isDetail() { return !!this.route.snapshot.paramMap.get('id'); }
 get pages() { return Math.max(1,Math.ceil(this.total/12)); }
 get today() { return new Date().toLocaleDateString('en-CA',{ timeZone:'Asia/Ho_Chi_Minh' }); }
 ngOnInit() {
  this.api.request('GET','/filters').then(r=>{this.metadata=r.data;this.cdr.markForCheck();}).catch(()=>{});
  this.subscriptions.add(combineLatest([this.route.queryParams,this.route.paramMap]).subscribe(([p])=>{
   this.q={type:'shared',passengers:1,page:1,sortBy:'departure',fuelType:'',vehicleType:'',departurePeriod:'',origin:'',destination:'',location:'',lowEmission:'',minSeats:'',minPrice:'',maxPrice:'',date:'',...p};
   if (this.isDetail) this.q['type']=this.route.snapshot.paramMap.get('kind')==='rentals' ? 'rental':(p['type']||'shared');
   this.seatCount=Number(p['passengers']||1);
   this.readDates(); this.load();
  }));
 }
 ngOnDestroy(){ this.subscriptions.unsubscribe();this.version++; }
 readDates(){ if(this.q['pickupDate']) { const s=this.q['pickupDate'].split('T'); this.pickupDate=s[0];this.pickupTime=s[1]?.slice(0,5)||'08:00'; } if(this.q['returnDate']){ const s=this.q['returnDate'].split('T');this.returnDate=s[0];this.returnTime=s[1]?.slice(0,5)||'18:00'; } }
 dates(){ return { pickupDate:this.pickupDate ? `${this.pickupDate}T${this.pickupTime}:00+07:00`:'',returnDate:this.returnDate ? `${this.returnDate}T${this.returnTime}:00+07:00`:'' }; }
 async load(){
  const version=++this.version;this.loading=true;this.error='';this.success='';this.detail=null;
  try {
   const path=this.isDetail ? `/${this.rental?'rentals':'trips'}/${this.route.snapshot.paramMap.get('id')}`:`/${this.rental?'rentals':'trips'}`;
   const r=await this.api.request('GET',path,undefined,this.q);
   if(version!==this.version)return;
   if(this.isDetail){this.detail=r.data;this.comparison=r.data.sustainability;this.q['type']=r.data.transport_type||'rental';} else {this.data=r.data;this.total=r.total;}
  }catch(e){if(version===this.version){this.error=this.api.message(e);this.data=[];this.total=0;}}
  finally{if(version===this.version){this.loading=false;this.cdr.markForCheck();}}
 }
 search(page=1){ const query={...this.q,...(this.rental?this.dates():{}),page};this.router.navigate([], {relativeTo:this.route,queryParams:query}); }
 tab(type:string){ this.pickupDate='';this.returnDate='';this.router.navigate(['/transport'],{queryParams:{type,passengers:1,sortBy:type==='rental'?'price':'departure'}}); }
 reset(){this.tab(this.q['type']);}
 open(item:any){this.router.navigate(['/transport',this.rental?'rentals':'trips',item._id],{queryParams:{...this.q,...(this.rental?this.dates():{})}});}
 async quote(){this.error='';try{ const r=await this.api.request('GET',`/rentals/${this.detail._id}`,undefined,this.dates());this.detail=r.data;this.confirmed=false;}catch(e){this.error=this.api.message(e);}this.cdr.markForCheck();}
 async compare(){this.error='';try{ const r=await this.api.request('GET','/emissions/compare',undefined,{rentalId:this.detail._id,distanceKm:this.distanceKm});this.comparison=r.data;}catch(e){this.error=this.api.message(e);}this.cdr.markForCheck();}
 async book(selection?:BusSelection|RentalSelection){
  if(!this.auth.getCurrentUser()){this.login.open();return;}
  if(!(selection?.accepted_terms || this.confirmed)){this.error='Vui lòng đọc và xác nhận điều kiện đặt dịch vụ.';return;}
  this.submitting=true;this.error='';
  try{
   const dates=this.dates();
   const r=await this.api.request('POST','/bookings',this.rental?{rental_id:this.detail._id,rental_start:dates.pickupDate,rental_end:dates.returnDate,...selection}:{trip_id:this.detail._id,passenger_count:this.seatCount,...selection});
   this.bookingId=r.data._id;
   await this.router.navigate(['/booking/payment'],{queryParams:{transportBookingId:r.data._id}});
  }catch(e){this.error=this.api.message(e);}finally{this.submitting=false;this.cdr.markForCheck();}
 }
}
