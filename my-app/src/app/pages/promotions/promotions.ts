import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface Offer {
  id: string; offer_id?: string; campaign_id?: string; applies_to_all?: boolean; services?: OfferService[]; name: string; type: string; code?: string; discount_type: string;
  discount_value: number; min_order: number; start_at: string; end_at: string;
  used_count: number; usage_limit: number; bookings?: number; clicks?: number;
  service: OfferService;
  discountPercent: number; salePrice: number; category: string;
}
interface OfferService { id: string; name: string; image?: string; cost: number; destination?: string; type?: string; days?: number }

@Component({ selector: 'app-promotions', standalone: false, templateUrl: './promotions.html', styleUrls: ['./promotions.css'] })
export class PromotionsComponent implements OnInit, OnDestroy {
  offers: Offer[] = []; filtered: Offer[] = [];
  loading = true; loadError = false; activeTab = 'all';
  selectedCategory = 'all'; selectedDestination = 'all'; selectedOfferType = 'all'; mobileFilters = false;
  query = ''; sort = 'popular'; favorites = new Set<string>();
  private refreshTimer?: number;
  private refreshInFlight = false;
  @ViewChild('results') private results?: ElementRef<HTMLElement>;
  private pendingScroll = '';
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void this.loadOffers();
  };
  tabs = [
    { id: 'all', route: 'for-you', label: 'Dành cho bạn', icon: 'bi-gift' },
    { id: 'trip', route: 'trip', label: 'Chuyến đi', icon: 'bi-map' },
    { id: 'stay', route: 'stay', label: 'Lưu trú', icon: 'bi-house-door' },
    { id: 'transport', route: 'transport', label: 'Di chuyển', icon: 'bi-bus-front' },
    { id: 'eco', route: 'eco', label: 'Ưu đãi xanh', icon: 'bi-leaf' }
  ];
  destinations = ['Đà Lạt', 'Phú Yên', 'Hội An', 'Đà Nẵng'];
  offerGroups = [
    { id: 'flash', label: 'Flash Sale', icon: 'bi-lightning-fill' },
    { id: 'coupon', label: 'Mã giảm giá', icon: 'bi-ticket-perforated' },
    { id: 'eco', label: 'Ưu đãi xanh', icon: 'bi-leaf' },
    { id: 'early', label: 'Đặt sớm', icon: 'bi-clock' },
  ];
  get activeTabInfo() { return this.tabs.find((tab) => tab.id === this.activeTab) || this.tabs[0]; }
  constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    let previousTab: string | null = null;
    this.route.paramMap.subscribe((params) => {
      const section = params.get('section') || 'for-you';
      const nextTab = this.tabs.find((tab) => tab.route === section)?.id || 'all';
      if (previousTab !== null && nextTab !== previousTab) {
        this.selectedCategory = this.selectedDestination = 'all'; this.selectedOfferType = 'all';
        this.query = '';
      }
      previousTab = nextTab;
      this.activeTab = nextTab;
      this.selectedCategory = nextTab;
      this.applyFilters();
      if (this.pendingScroll) this.scrollToResults(this.pendingScroll);
    });
    void this.loadOffers(true);
    this.refreshTimer = window.setInterval(() => void this.loadOffers(), 30000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy() {
    if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  async loadOffers(showLoading = false) {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    if (showLoading) this.loading = true;
    try {
      const base = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:5055/api' : 'https://greensteps-6swn.onrender.com/api';
      const result = await firstValueFrom(this.http.get<{items: any[]}>(`${base}/partner/promotions/public`));
      this.offers = this.combineGlobalVouchers((result.items || []).map((row: any) => this.toOffer(row)).filter((o: Offer | null): o is Offer => !!o));
      this.loadError = false;
      this.applyFilters();
    } catch (e) {
      if (!this.offers.length) this.loadError = true;
    } finally {
      this.loading = false;
      this.refreshInFlight = false;
      this.cdr.detectChanges();
      if (this.pendingScroll) this.scrollToResults(this.pendingScroll);
    }
  }

  private toOffer(row: any): Offer | null {
    const service = row.service;
    const cost = Number(service?.cost || 0), value = Number(row.discount_value || 0);
    if (!service || cost <= 0 || value <= 0) return null;
    const salePrice = Math.max(0, row.discount_type === 'fixed' ? cost - value : cost * (1 - value / 100));
    const discountPercent = Math.min(100, Math.round((cost - salePrice) / cost * 100));
    const type = String(service.type || '').toLowerCase();
    const category = /stay|lodg|accommodation/.test(type) ? 'stay' : /transport|vehicle/.test(type) ? 'transport' : 'trip';
    return { ...row, id: String(row.id), service, services: [service], discountPercent, salePrice, category };
  }

  private combineGlobalVouchers(offers: Offer[]): Offer[] {
    const result: Offer[] = [];
    const globalByCampaign = new Map<string, Offer>();
    for (const offer of offers) {
      if (!offer.applies_to_all || offer.type !== 'voucher') { result.push(offer); continue; }
      const key = offer.campaign_id || offer.id;
      const existing = globalByCampaign.get(key);
      if (existing) {
        const services = existing.services || [];
        if (!services.some(service => service.id === offer.service.id)) services.push(offer.service);
        existing.services = services;
      } else {
        offer.services = [offer.service];
        globalByCampaign.set(key, offer);
        result.push(offer);
      }
    }
    return result;
  }

  setCategory(value: string) {
    const tab = this.tabs.find((item) => item.id === value) || this.tabs[0];
    this.selectedCategory = tab.id;
    this.pendingScroll = 'results';
    if (this.activeTab !== tab.id) {
      void this.router.navigate(['/promotions', tab.route]);
    } else {
      this.applyFilters();
      this.scrollToResults();
    }
  }
  setDestination(value: string) { this.selectedDestination = value; this.applyFilters(); this.scrollToResults(); }
  setOfferType(value: string) {
    this.selectedOfferType = value;
    this.scrollToResults(value === 'all' ? 'results' : value);
  }
  private scrollToResults(target = 'results') {
    this.pendingScroll = target;
    this.mobileFilters = false;
    this.cdr.detectChanges();
    if (this.loading || this.loadError || !this.results) return;
    const element = target === 'results' ? this.results.nativeElement
      : this.results.nativeElement.querySelector<HTMLElement>(`[data-offer-group="${target}"]`);
    if (!element) return;
    this.pendingScroll = '';
    element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  resetFilters() { this.selectedCategory=this.selectedDestination='all'; this.selectedOfferType='all'; this.query=''; this.sort='popular'; this.applyFilters(); }
  applyFilters() {
    const q = this.norm(this.query);
    this.filtered = this.offers.filter(o => {
      const relatedServices = o.services?.length ? o.services : [o.service];
      const text = this.norm([o.name, o.code, ...relatedServices.flatMap(s => [s.name, s.destination])].join(' '));
      const categories: string[] = relatedServices.map((service) => this.serviceCategory(service.type));
      const pageMatches = this.activeTab === 'all' ||
        (this.activeTab === 'eco' ? this.isEco(o) : categories.includes(this.activeTab));
      if (!pageMatches || (q && !text.includes(q))) return false;
      if (this.selectedCategory !== 'all' &&
          !(this.selectedCategory === 'eco' ? this.isEco(o) : categories.includes(this.selectedCategory))) return false;
      if (this.selectedDestination !== 'all' && !relatedServices.some((service) => this.norm(service.destination).includes(this.norm(this.selectedDestination)))) return false;
      return true;
    });
    if (this.sort === 'discount') this.filtered.sort((a,b) => b.discountPercent-a.discountPercent);
    else if (this.sort === 'priceAsc') this.filtered.sort((a,b) => a.salePrice-b.salePrice);
    else if (this.sort === 'priceDesc') this.filtered.sort((a,b) => b.salePrice-a.salePrice);
    else if (this.sort === 'expiry') this.filtered.sort((a,b) => +new Date(a.end_at)- +new Date(b.end_at));
    else this.filtered.sort((a,b) => Number(b.bookings||b.clicks||0)-Number(a.bookings||a.clicks||0));
  }
  sectionOffers(groupId: string): Offer[] {
    return this.filtered.filter((offer) => {
      if (groupId === 'flash') return offer.type === 'flash_sale';
      if (groupId === 'coupon') return offer.type === 'voucher';
      if (groupId === 'eco') return this.isEco(offer);
      return this.isEarly(offer);
    });
  }
  get sectionHasOffers(): boolean {
    return this.offerGroups.some((group) => this.sectionOffers(group.id).length > 0);
  }
  offerKey(offer: Offer) { return offer.offer_id || offer.id; }
  isFavorite(offer: Offer) { return this.favorites.has(this.offerKey(offer)); }
  toggleFavorite(offer: Offer, event: Event) { const key = this.offerKey(offer); event.stopPropagation(); this.favorites.has(key) ? this.favorites.delete(key) : this.favorites.add(key); }
  open(offer: Offer) { this.router.navigate(['/services', offer.category === 'stay' ? 'stay' : offer.category === 'transport' ? 'transport' : 'attraction', offer.service.id]); }
  categoryOf(o: Offer) { return o.category; }
  isEco(o: Offer) { return /xanh|eco|green|net.zero/i.test(o.name + ' ' + (o.services || [o.service]).map(s => `${s.name} ${s.type || ''}`).join(' ')); }
  isEarly(o: Offer) { return /early|đặt sớm|dat som|booking sớm|booking som/i.test(o.name); }
  serviceCategory(type: string | undefined) {
    const value = String(type || '').toLowerCase();
    return /stay|lodg|accommodation/.test(value) ? 'stay' : /transport|vehicle/.test(value) ? 'transport' : 'trip';
  }
  discountLabel(o: Offer) { return o.discount_type === 'fixed' ? `Giảm ${this.money(o.discount_value)}` : `Giảm ${o.discount_value}%`; }
  minOrderLabel(o: Offer) { return o.min_order > 0 ? `Đặt từ ${this.money(o.min_order)}` : 'Không yêu cầu giá trị tối thiểu'; }
  scopeLabel(o: Offer) { return o.applies_to_all ? 'Áp dụng cho tất cả dịch vụ' : `Áp dụng: ${o.service.name}`; }
  isEndingSoon(o: Offer) { const remaining = new Date(o.end_at).getTime() - Date.now(); return remaining > 0 && remaining <= 3 * 24 * 60 * 60 * 1000; }
  copiedOfferId = '';
  async copyOfferCode(o: Offer, event: Event) {
    event.stopPropagation();
    if (!o.code) return;
    try { await navigator.clipboard.writeText(o.code); this.copiedOfferId = this.offerKey(o); }
    catch { this.copiedOfferId = ''; }
  }
  money(value: number) { return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + '₫'; }
  private norm(value: any) { return String(value || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'); }
}
