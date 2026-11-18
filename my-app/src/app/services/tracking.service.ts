import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { getApiUrl } from '../config/api-config';

export type TelemetryTargetType = 'tour' | 'service' | 'post' | 'screen';
export type TelemetryActionName =
  | 'book_click'
  | 'gallery_open'
  | 'map_open'
  | 'policy_open'
  | 'date_select'
  | 'room_select'
  | 'share'
  | 'save'
  | 'contact'
  | 'review_open';

interface QueuedTelemetryEvent {
  k: 'view' | 'engage' | 'action' | 'impression' | 'search';
  vid?: string;
  tt?: TelemetryTargetType;
  tid?: string;
  src?: string;
  act?: number;
  scr?: number;
  name?: TelemetryActionName;
  scope?: 'tours' | 'services' | 'community' | 'global';
  q?: string;
  n?: number;
}

const ANON_ID_KEY = 'greensteps_anon_id';
const SESSION_ID_KEY = 'greensteps_session_id';
const SESSION_TS_KEY = 'greensteps_session_ts';
const CONSENT_KEY = 'greensteps_telemetry_consent';
const GA4_ID_KEY = 'greensteps_ga4_id';
const SESSION_TTL_MS = 30 * 60 * 1000;
const IDLE_THRESHOLD_MS = 30 * 1000;
const HEARTBEAT_INTERVAL_SEC = 15;

@Injectable({
  providedIn: 'root'
})
export class TrackingService implements OnDestroy {
  private readonly backendUrl = getApiUrl();
  private aid = '';
  private sid = '';
  private currentVid: string | null = null;
  private currentTarget: { tt: TelemetryTargetType; tid: string } | null = null;
  private activeSeconds = 0;
  private lastFlushedActiveSeconds = 0;
  private maxScrollPct = 0;
  private lastInteractionAt = Date.now();
  private queue: QueuedTelemetryEvent[] = [];
  private seenImpressions = new Set<string>();
  private tickTimer: any = null;
  private flushTimer: any = null;
  private ga4Initialized = false;
  private ga4MeasurementId: string | null = null;
  private listenersBound = false;

  private readonly onUserActivity = () => {
    this.lastInteractionAt = Date.now();
  };

  private readonly onScroll = () => {
    this.lastInteractionAt = Date.now();
    this.updateScrollDepth();
  };

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.queueEngageSnapshot();
      this.flush(true);
    } else {
      this.lastInteractionAt = Date.now();
    }
  };

  private readonly onPageHide = () => {
    this.queueEngageSnapshot();
    this.flush(true);
  };

  constructor(private ngZone: NgZone) {
    if (typeof window !== 'undefined') {
      this.aid = this.ensureAnonId();
      this.sid = this.ensureSessionId();
      this.initGa4IfConfigured();
      this.bindBrowserListeners();
    }
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (typeof window !== 'undefined' && this.listenersBound) {
      window.removeEventListener('mousemove', this.onUserActivity);
      window.removeEventListener('keydown', this.onUserActivity);
      window.removeEventListener('touchstart', this.onUserActivity);
      window.removeEventListener('click', this.onUserActivity);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('pagehide', this.onPageHide);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  public getVisitorId(): string {
    if (!this.aid && typeof window !== 'undefined') {
      this.aid = this.ensureAnonId();
    }
    return this.aid;
  }

  public isTrackingAllowed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) return true;
      const parsed = JSON.parse(stored);
      return parsed.analytics !== false;
    } catch {
      return true;
    }
  }

  public setConsent(options: { analytics: boolean; personalization: boolean }): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        analytics: options.analytics,
        personalization: options.personalization,
        updatedAt: new Date().toISOString()
      }));
      const payload = JSON.stringify({
        aid: this.getVisitorId(),
        analytics: options.analytics,
        personalization: options.personalization,
        version: '1'
      });
      this.sendPayload(`${this.backendUrl}/events/consent`, payload, false);
    } catch {}
  }

  /**
   * Starts tracking dwell time & scroll depth for a top-level route screen.
   */
  public trackScreenView(routeUrl: string): void {
    if (typeof window === 'undefined' || !this.isTrackingAllowed()) return;
    const cleanPath = routeUrl.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '') || 'home';
    // Detail routes are tracked with their specific tour/service IDs instead of generic screen IDs
    if (/^(tours|tour-detail|services|service-detail)\/[^/]+/.test(cleanPath)) {
      this.dispatchGa4('page_view', { page_path: routeUrl });
      return;
    }
    const screenId = cleanPath.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 48) || 'home';
    this.beginView('screen', screenId, this.detectSource());
    this.dispatchGa4('page_view', { page_path: routeUrl });
  }

  /**
   * Starts tracking dwell time & scroll depth for a specific Tour, Service, or Community Post.
   */
  public trackTargetView(targetType: 'tour' | 'service' | 'post', targetId: string, source?: string): void {
    if (typeof window === 'undefined' || !targetId || !this.isTrackingAllowed()) return;
    const cleanId = String(targetId).trim().slice(0, 120);
    if (!cleanId) return;
    this.beginView(targetType, cleanId, source || this.detectSource());
    this.dispatchGa4('view_item', {
      item_category: targetType,
      item_id: cleanId
    });
  }

  /**
   * Records a user interaction on the currently viewed item (e.g. clicking 'book_click').
   */
  public trackAction(name: TelemetryActionName): void {
    if (typeof window === 'undefined' || !this.currentVid || !this.isTrackingAllowed()) return;
    this.lastInteractionAt = Date.now();
    this.queue.push({ k: 'action', vid: this.currentVid, name });
    if (name === 'book_click' && this.currentTarget) {
      this.dispatchGa4('begin_checkout', {
        item_category: this.currentTarget.tt,
        item_id: this.currentTarget.tid
      });
      this.queueEngageSnapshot();
      this.flush(false);
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Records a card impression (deduplicated per session).
   */
  public trackImpression(targetType: 'tour' | 'service' | 'post', targetId: string): void {
    if (typeof window === 'undefined' || !targetId || !this.isTrackingAllowed()) return;
    const cleanId = String(targetId).trim().slice(0, 120);
    const key = `${targetType}:${cleanId}`;
    if (!cleanId || this.seenImpressions.has(key)) return;
    this.seenImpressions.add(key);
    this.queue.push({ k: 'impression', tt: targetType, tid: cleanId });
    this.scheduleFlush();
  }

  /**
   * Records a search query and result count (for zero-result demand analysis).
   */
  public trackSearch(scope: 'tours' | 'services' | 'community' | 'global', query: string, resultCount: number): void {
    if (typeof window === 'undefined' || !this.isTrackingAllowed()) return;
    const clean = String(query || '').trim();
    if (clean.length < 2) return;
    this.queue.push({ k: 'search', scope, q: clean.slice(0, 80), n: Math.max(0, Number(resultCount) || 0) });
    this.dispatchGa4('search', { search_term: clean, search_scope: scope, results_count: resultCount });
    this.scheduleFlush();
  }

  private beginView(tt: TelemetryTargetType, tid: string, src: string): void {
    if (this.currentTarget && this.currentTarget.tt === tt && this.currentTarget.tid === tid && this.currentVid) {
      return;
    }
    // Flush previous view's dwell time before switching
    this.queueEngageSnapshot();

    this.sid = this.ensureSessionId();
    this.currentVid = this.generateShortId('v');
    this.currentTarget = { tt, tid };
    this.activeSeconds = 0;
    this.lastFlushedActiveSeconds = 0;
    this.maxScrollPct = 0;
    this.lastInteractionAt = Date.now();
    this.updateScrollDepth();

    this.queue.push({
      k: 'view',
      vid: this.currentVid,
      tt,
      tid,
      src
    });
    this.scheduleFlush(1200);
  }

  private queueEngageSnapshot(): void {
    if (!this.currentVid) return;
    if (this.activeSeconds <= 0 && this.maxScrollPct <= 0) return;
    if (this.activeSeconds === this.lastFlushedActiveSeconds && this.activeSeconds < 2) return;
    this.lastFlushedActiveSeconds = this.activeSeconds;
    this.queue.push({
      k: 'engage',
      vid: this.currentVid,
      act: this.activeSeconds,
      scr: this.maxScrollPct
    });
  }

  private bindBrowserListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onUserActivity, { passive: true });
      window.addEventListener('keydown', this.onUserActivity, { passive: true });
      window.addEventListener('touchstart', this.onUserActivity, { passive: true });
      window.addEventListener('click', this.onUserActivity, { passive: true });
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('pagehide', this.onPageHide);
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      this.tickTimer = setInterval(() => {
        if (!this.currentVid) return;
        const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
        const isRecentlyActive = Date.now() - this.lastInteractionAt <= IDLE_THRESHOLD_MS;
        if (isVisible && isRecentlyActive && this.activeSeconds < 1800) {
          this.activeSeconds += 1;
          if (this.activeSeconds % HEARTBEAT_INTERVAL_SEC === 0) {
            this.queueEngageSnapshot();
            this.flush(false);
          }
        }
      }, 1000);
    });
  }

  private updateScrollDepth(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const docEl = document.documentElement;
    const scrollHeight = Math.max(docEl.scrollHeight, docEl.clientHeight, 1);
    const viewed = window.scrollY + window.innerHeight;
    const pct = Math.min(100, Math.max(0, Math.round((viewed / scrollHeight) * 100)));
    if (pct > this.maxScrollPct) {
      this.maxScrollPct = pct;
    }
  }

  private scheduleFlush(delayMs = 3500): void {
    if (this.queue.length >= 12) {
      this.flush(false);
      return;
    }
    if (this.flushTimer) return;
    this.ngZone.runOutsideAngular(() => {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush(false);
      }, delayMs);
    });
  }

  public flush(useBeacon = false): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.queue.length || typeof window === 'undefined') return;

    const batch = this.queue.splice(0, 50);
    const payload = JSON.stringify({
      aid: this.getVisitorId(),
      sid: this.ensureSessionId(),
      dev: this.detectDevice(),
      events: batch
    });

    this.sendPayload(`${this.backendUrl}/events/batch`, payload, useBeacon);
  }

  private sendPayload(url: string, body: string, useBeacon: boolean): void {
    try {
      const token = localStorage.getItem('greensteps_token');
      // Use sendBeacon on tab close when no custom Authorization header is needed
      if (useBeacon && !token && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(url, blob)) return;
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      void fetch(url, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
        keepalive: true
      }).catch(() => {});
    } catch {}
  }

  private ensureAnonId(): string {
    try {
      const existing = localStorage.getItem(ANON_ID_KEY);
      if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
      const created = this.generateShortId('gs');
      localStorage.setItem(ANON_ID_KEY, created);
      return created;
    } catch {
      return this.generateShortId('gs');
    }
  }

  private ensureSessionId(): string {
    try {
      const now = Date.now();
      const existing = sessionStorage.getItem(SESSION_ID_KEY);
      const lastTs = Number(sessionStorage.getItem(SESSION_TS_KEY) || 0);
      if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing) && now - lastTs < SESSION_TTL_MS) {
        sessionStorage.setItem(SESSION_TS_KEY, String(now));
        return existing;
      }
      const created = this.generateShortId('s');
      sessionStorage.setItem(SESSION_ID_KEY, created);
      sessionStorage.setItem(SESSION_TS_KEY, String(now));
      return created;
    } catch {
      return this.generateShortId('s');
    }
  }

  private generateShortId(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 10);
    const ts = Date.now().toString(36);
    return `${prefix}_${ts}_${rand}`;
  }

  private detectDevice(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth || 1280;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  private detectSource(): string {
    if (typeof document === 'undefined') return 'direct';
    const ref = document.referrer || '';
    if (!ref) return 'direct';
    try {
      const refUrl = new URL(ref);
      if (refUrl.hostname === window.location.hostname) {
        if (refUrl.pathname.includes('/community')) return 'community';
        if (refUrl.pathname.includes('/home') || refUrl.pathname === '/') return 'home';
        return 'internal';
      }
      if (/google\.|bing\.|coccoc\.|yahoo\./i.test(refUrl.hostname)) return 'search_engine';
      if (/facebook\.|instagram\.|tiktok\.|zalo\./i.test(refUrl.hostname)) return 'social';
      return 'external';
    } catch {
      return 'direct';
    }
  }

  public configureGa4(measurementId: string): void {
    if (typeof window === 'undefined') return;
    const clean = String(measurementId || '').trim();
    if (!/^G-[A-Z0-9]{4,16}$/i.test(clean)) return;
    try {
      localStorage.setItem(GA4_ID_KEY, clean);
    } catch {}
    this.initGa4IfConfigured();
  }

  private initGa4IfConfigured(): void {
    if (this.ga4Initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
    let id: string | null = null;
    try {
      id = (window as any).__GREENSTEPS_GA4_ID__ || localStorage.getItem(GA4_ID_KEY) || null;
    } catch {}
    if (!id || !/^G-[A-Z0-9]{4,16}$/i.test(id)) return;

    this.ga4MeasurementId = id;
    this.ga4Initialized = true;
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', id, { send_page_view: false, anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  private dispatchGa4(eventName: string, params: Record<string, any>): void {
    if (typeof window === 'undefined') return;
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      try {
        gtag('event', eventName, params);
      } catch {}
    }
  }
}
