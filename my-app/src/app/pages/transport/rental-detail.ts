import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { VehicleGalleryComponent } from './vehicle-gallery';
import { TransportService } from '../../services/transport.service';

export interface RentalSelection { rental_start:string; rental_end:string; accepted_terms:boolean; }

@Component({selector:'app-rental-detail',standalone:true,imports:[CommonModule,FormsModule,VehicleGalleryComponent],templateUrl:'./rental-detail.html',styleUrls:['./bus-trip-detail.css','./rental-detail.css']})
export class RentalDetailComponent implements OnDestroy {
 @Input() detail:any;
 @Input() submitting=false;
 @Input() pickupDate=''; @Input() pickupTime='08:00';
 @Input() returnDate=''; @Input() returnTime='18:00';
 @Output() continueBooking=new EventEmitter<RentalSelection>();
 @ViewChild('terms') terms?:NgModel;
 agreed=false; quoting=false; comparing=false; error=''; comparisonError='';
 distanceKm:number|null=null; comparison:any=null;
 private quoteVersion=0; private compareVersion=0;
 constructor(private api:TransportService,private cdr:ChangeDetectorRef){}
 get today(){return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});}
 get dates(){return {pickupDate:this.pickupDate?`${this.pickupDate}T${this.pickupTime}:00+07:00`:'',returnDate:this.returnDate?`${this.returnDate}T${this.returnTime}:00+07:00`:''};}
 get validDates(){const {pickupDate,returnDate}=this.dates;const start=Date.parse(pickupDate),end=Date.parse(returnDate);return start>Date.now()&&end>start&&end-start<=90*86400000;}
 get currentQuote(){const q=this.detail?.quote;return this.validDates&&q&&Date.parse(q.rental_start)===Date.parse(this.dates.pickupDate)&&Date.parse(q.rental_end)===Date.parse(this.dates.returnDate)?q:null;}
 get canContinue(){return !!this.currentQuote&&this.detail.available&&this.agreed&&!this.quoting&&!this.submitting;}
 get hours(){return this.validDates?Math.ceil((Date.parse(this.dates.returnDate)-Date.parse(this.dates.pickupDate))/3600000):0;}
 get fuelLabel(){return ({petrol:'Xăng',diesel:'Dầu diesel',electric:'Điện',human:'Sức người'} as Record<string,string>)[this.detail.vehicle.fuel_type]||'';}
 resetAgreement(){this.agreed=false;this.terms?.reset(false);}
 dateChanged(){this.quoteVersion++;this.quoting=false;this.detail={...this.detail,quote:null};this.resetAgreement();this.error='';}
 async quote(){
  if(!this.validDates||this.quoting)return;
  const version=++this.quoteVersion;this.quoting=true;this.resetAgreement();this.error='';this.detail={...this.detail,quote:null};
  try{const r=await this.api.request('GET',`/rentals/${this.detail._id}`,undefined,this.dates);if(version!==this.quoteVersion)return;this.detail=r.data;}
  catch(e){if(version===this.quoteVersion)this.error=this.api.message(e);}
  finally{if(version===this.quoteVersion){this.quoting=false;this.cdr.markForCheck();}}
 }
 distanceChanged(){this.compareVersion++;this.comparing=false;this.comparison=null;this.comparisonError='';}
 async compare(){
  if(this.distanceKm===null||!Number.isFinite(this.distanceKm)||this.distanceKm<0||this.distanceKm>5000||this.comparing)return;
  const version=++this.compareVersion;this.comparing=true;this.comparisonError='';
  try{const r=await this.api.request('GET','/emissions/compare',undefined,{rentalId:this.detail._id,distanceKm:this.distanceKm});if(version===this.compareVersion)this.comparison=r.data;}
  catch(e){if(version===this.compareVersion)this.comparisonError=this.api.message(e);}
  finally{if(version===this.compareVersion){this.comparing=false;this.cdr.markForCheck();}}
 }
 submit(){if(this.canContinue)this.continueBooking.emit({rental_start:this.dates.pickupDate,rental_end:this.dates.returnDate,accepted_terms:this.agreed});}
 ngOnDestroy(){this.quoteVersion++;this.compareVersion++;}
}
