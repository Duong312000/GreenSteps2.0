import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { FavoritesService } from './favorites.service';

describe('Favorites account synchronization',()=>{
  let service:FavoritesService|undefined;
  afterEach(()=>{service?.ngOnDestroy();service=undefined;});
  function create(initial:any={id:'user-a'}){
    const user$=new BehaviorSubject(initial),login={open:vi.fn()};
    const http={request:vi.fn().mockReturnValue(of({data:[],total:0}))};
    service=new FavoritesService(http as any,{currentUser$:user$} as any,login as any);
    return {service,user$,http,login};
  }
  const item={id:'f1',target_type:'service',target_id:'s1',name:'Saved service',image:'',destination:'Da Nang',price:100,price_unit:'',available:true,url:'/services/s1'};
  it('clears data immediately when switching accounts and ignores late responses',async()=>{
    const {service,user$,http}=create();await service.refresh();
    service.items$.next([item as any]);
    const late=new Subject<any>();http.request.mockReturnValueOnce(late).mockReturnValue(of({data:[],total:0}));
    const refresh=service.refresh();user$.next({id:'user-b'});expect(service.items).toEqual([]);
    late.next({data:[item],total:1});late.complete();await refresh;await service.refresh();
    expect(service.items).toEqual([]);
  });
  it('does not let an earlier list refresh overwrite a completed save',async()=>{
    const {service,http}=create();await service.refresh();
    const oldList=new Subject<any>();http.request.mockReturnValueOnce(oldList).mockReturnValueOnce(of({data:item}));
    const refresh=service.refresh();await service.setSaved('service','s1',true);
    oldList.next({data:[],total:0});oldList.complete();await refresh;
    expect(service.isSaved('service','s1')).toBe(true);
  });
  it('guest hearts open sign-in without storing data and failed writes do not change hearts',async()=>{
    const guest=create(null);await guest.service.toggle({type:'tour',id:'t1'});
    expect(guest.login.open).toHaveBeenCalledOnce();expect(guest.http.request).not.toHaveBeenCalled();
    guest.service.ngOnDestroy();const {service,http}=create();await service.refresh();
    http.request.mockReturnValueOnce(throwError(()=>({status:503})));
    await expect(service.setSaved('tour','t1',true)).rejects.toBeDefined();
    expect(service.isSaved('tour','t1')).toBe(false);expect(service.isBusy('tour','t1')).toBe(false);
  });
  it('keeps same-name places separate by coordinates and maps catalog IDs to real services',()=>{
    const {service}=create(null);
    expect(service.placeRef({name:'Cafe',lat:15,lng:108}).id).not.toBe(service.placeRef({name:'Cafe',lat:16,lng:108}).id);
    expect(service.placeRef({name:'Cafe',service_id:'srv_1'})).toEqual({type:'service',id:'srv_1'});
  });
});
