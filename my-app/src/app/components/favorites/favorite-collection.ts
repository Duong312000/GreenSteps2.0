import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FavoritesService, FavoriteItem } from '../../services/favorites.service';
import { FavoriteButtonComponent } from './favorite-button';

@Component({ selector:'app-favorite-collection',standalone:true,imports:[CommonModule,FormsModule,RouterModule,FavoriteButtonComponent],changeDetection:ChangeDetectionStrategy.OnPush,templateUrl:'./favorite-collection.html',styleUrl:'./favorite-collection.css' })
export class FavoriteCollectionComponent implements OnInit,OnDestroy {
  query=''; category='all'; page=1; items:FavoriteItem[]=[]; loading=false; error=''; importing=false; importError=''; legacy:any[]=[];
  private subscriptions=new Subscription();
  categories=[{id:'all',label:'Tất cả'},{id:'tour',label:'Tour'},{id:'service',label:'Dịch vụ'},{id:'itinerary',label:'Lịch trình'},{id:'place',label:'Địa điểm'}];
  constructor(public favorites:FavoritesService,private cdr:ChangeDetectorRef){}
  ngOnInit(){
    this.subscriptions.add(this.favorites.items$.subscribe(items=>{this.items=items;this.page=1;this.cdr.markForCheck();}));
    this.subscriptions.add(this.favorites.loading$.subscribe(loading=>{this.loading=loading;this.cdr.markForCheck();}));
    this.subscriptions.add(this.favorites.error$.subscribe(error=>{this.error=error;this.cdr.markForCheck();}));
    this.loadLegacy();
    void this.favorites.refresh();
  }
  ngOnDestroy(){this.subscriptions.unsubscribe();}
  group(item:FavoriteItem){return item.target_type.startsWith('transport_')?'service':item.target_type;}
  label(item:FavoriteItem){return this.categories.find(c=>c.id===this.group(item))?.label||'Địa điểm';}
  get filtered(){const query=this.query.trim().toLocaleLowerCase('vi');return this.items.filter(item=>(this.category==='all'||this.group(item)===this.category)&&(!query||`${item.name} ${item.destination}`.toLocaleLowerCase('vi').includes(query)));}
  get visible(){return this.filtered.slice((this.page-1)*12,this.page*12);}
  get pages(){return Math.max(1,Math.ceil(this.filtered.length/12));}
  count(category:string){return category==='all'?this.items.length:this.items.filter(item=>this.group(item)===category).length;}
  track(_index:number,item:FavoriteItem){return item.id;}
  fallback(event:Event){const img=event.target as HTMLImageElement;if(!img.src.endsWith('/image/service-photo-pending.svg'))img.src='/image/service-photo-pending.svg';}
  private loadLegacy(){
    const unique=new Map<string,any>();
    for(const key of ['greensteps_favorite_places','greensteps_fav_places']){
      try{
        const stored=JSON.parse(localStorage.getItem(key)||'[]');
        if(!Array.isArray(stored))continue;
        for(const item of stored.filter(value=>value&&(value.name||value.title)).slice(0,200)){
          const ref=this.favorites.placeRef(item);
          unique.set(`${ref.type}:${ref.id}`,item);
        }
      }catch{}
    }
    this.legacy=[...unique.values()].slice(0,200);
  }
  async importLegacy(){
    if(!this.favorites.signedIn){this.favorites.openLogin();return;}
    this.importing=true;this.importError='';
    const account=this.favorites.accountKey;
    try{
      for(const place of this.legacy){
        if(account!==this.favorites.accountKey)throw new Error('Account changed');
        const ref=this.favorites.placeRef(place);
        if(!await this.favorites.setSaved(ref.type,ref.id,true,ref.snapshot))throw new Error('Account changed');
      }
      if(account!==this.favorites.accountKey)throw new Error('Account changed');
      localStorage.removeItem('greensteps_favorite_places');localStorage.removeItem('greensteps_fav_places');this.legacy=[];
    }catch(error){this.importError=this.favorites.message(error);}finally{this.importing=false;this.cdr.markForCheck();}
  }
}
