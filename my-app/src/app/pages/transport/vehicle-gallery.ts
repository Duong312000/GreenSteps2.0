import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({ selector:'app-vehicle-gallery', standalone:true, imports:[CommonModule], templateUrl:'./vehicle-gallery.html', styleUrl:'./vehicle-gallery.css' })
export class VehicleGalleryComponent {
 @Input() vehicle:any;
 @ViewChild('galleryDialog') galleryDialog?:ElementRef<HTMLDialogElement>;
 activeImage=0;
 get images():string[]{ return (this.vehicle?.images || []).filter((s:string)=>!!s).slice(0,6); }
 openImage(index:number){this.activeImage=index;this.galleryDialog?.nativeElement.showModal();}
 nextImage(delta:number){this.activeImage=(this.activeImage+delta+this.images.length)%this.images.length;}
}
