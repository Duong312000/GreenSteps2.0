import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { VehicleGalleryComponent } from './vehicle-gallery';

export interface TripStop {
 id: string; order: number; name: string; address?: string;
 estimated_time: string; allow_pickup: boolean; allow_dropoff: boolean;
}
export interface BusSelection { pickup_stop_id: string; dropoff_stop_id: string; passenger_count: number; accepted_terms: boolean; }

@Component({ selector: 'app-bus-trip-detail', standalone: true, imports: [CommonModule, FormsModule, VehicleGalleryComponent], templateUrl: './bus-trip-detail.html', styleUrl: './bus-trip-detail.css' })
export class BusTripDetailComponent {
 @Input() submitting = false;
 @Input() initialPassengers = 1;
 @Output() continueBooking = new EventEmitter<BusSelection>();
 @ViewChild('terms') terms?:NgModel;
 detail: any;
 stops: TripStop[] = [];
 pickupId = ''; dropoffId = ''; seats = 1; agreed = false;
 @Input() set trip(value: any) {
  this.detail = value;
  this.stops = value.stops?.length ? [...value.stops].sort((a, b) => a.order - b.order) : [
   { id: `${value._id}-start`, order: 0, name: value.pickup_point || value.route.origin, estimated_time: value.departure_time, allow_pickup: true, allow_dropoff: false },
   { id: `${value._id}-end`, order: 1, name: value.dropoff_point || value.route.destination, estimated_time: value.arrival_time, allow_pickup: false, allow_dropoff: true }
  ];
  this.pickupId = this.pickups[0]?.id || '';
  this.dropoffId = this.dropoffs.at(-1)?.id || '';
  this.seats = Math.max(1, Math.min(this.initialPassengers, value.available_seats || 1));
  this.agreed = false;
 }
 get images(): string[] { return (this.detail?.vehicle.images || []).filter((s: string) => !!s).slice(0, 6); }
 get pickups() { return this.stops.filter(s => s.allow_pickup && this.stops.some(d => d.order > s.order && d.allow_dropoff)); }
 get pickup() { return this.stops.find(s => s.id === this.pickupId); }
 get dropoff() { return this.stops.find(s => s.id === this.dropoffId); }
 get dropoffs() { return this.stops.filter(s => s.allow_dropoff && this.pickup && s.order > this.pickup.order); }
 get validPair() { return !!this.pickup?.allow_pickup && !!this.dropoff?.allow_dropoff && this.dropoff.order > this.pickup.order; }
 get minutes() { return this.validPair ? Math.round((+new Date(this.dropoff!.estimated_time) - +new Date(this.pickup!.estimated_time)) / 60000) : 0; }
 get validSeats() { return Number.isInteger(this.seats) && this.seats >= 1 && this.seats <= this.detail.available_seats; }
 get canContinue() { return this.validPair && this.validSeats && this.agreed && this.detail.available && !this.submitting; }
 get fuelLabel() { return ({ electric: 'điện', diesel: 'diesel', petrol: 'xăng' } as Record<string,string>)[this.detail.vehicle.fuel_type] || ''; }
 get serviceLabel() { return this.detail.transport_type === 'bus' ? 'Xe khách' : 'Xe ghép'; }
 pickupChanged() {
  if (!this.dropoffs.some(s => s.id === this.dropoffId)) this.dropoffId = '';
  this.resetAgreement();
 }
 resetAgreement(){this.agreed=false;this.terms?.reset(false);}
 inSegment(s: TripStop) { return this.validPair && s.order >= this.pickup!.order && s.order <= this.dropoff!.order; }
 segmentSelected(index: number) { return this.validPair && this.stops[index].order >= this.pickup!.order && this.stops[index+1].order <= this.dropoff!.order; }
 pointX(index: number) { return 42 + index / Math.max(1, this.stops.length - 1) * 136; }
 pointY(index: number) { return 36 + index * 68; }
 chooseOnRoute(stop: TripStop) {
  if (stop.allow_dropoff && this.pickup && stop.order > this.pickup.order && stop.id !== this.dropoffId) { this.dropoffId = stop.id; this.resetAgreement(); }
  else if (this.pickups.some(s => s.id === stop.id)) { this.pickupId = stop.id; this.pickupChanged(); }
 }
 stepSeats(delta: number) { this.seats = Math.min(this.detail.available_seats, Math.max(1, (Number(this.seats) || 1) + delta)); this.resetAgreement(); }
 submit() { if (this.canContinue) this.continueBooking.emit({ pickup_stop_id: this.pickupId, dropoff_stop_id: this.dropoffId, passenger_count: this.seats, accepted_terms: this.agreed }); }
}
