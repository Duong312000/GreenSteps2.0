// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiService } from './api.service';

describe('ApiService admin queues', () => {
  it('shares and briefly caches a compact public services page', async () => {
    const response = new Subject<any>();
    const http = { get: vi.fn(() => response) };
    const api = new ApiService(http as any);

    const first = api.getServices();
    const second = api.getServices();
    expect(http.get).toHaveBeenCalledTimes(1);

    response.next({ success: true, items: [{ id: 'service-1', name_service: 'Eco Stay' }], total: 1 });
    response.complete();
    await Promise.all([first, second]);
    expect((await api.getServices())[0].id).toBe('service-1');

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/services/search?page=1&pageSize=100&sort=bookings_count&order=desc&compact=1', undefined);
    api.clearCache('services_');
    await api.getServices();
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('loads public preset tours through the compact paginated endpoint', async () => {
    const http = { get: vi.fn(() => of({ success: true, items: [{ id: 'tour-1', title: 'Tour xanh', catalog_status: 'bookable' }], total: 1 })) };
    const api = new ApiService(http as any);

    const tours = await api.getPresetTours();

    expect(tours[0].id).toBe('tour-1');
    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/tours/search?page=1&pageSize=100&sort=popular&compact=1', undefined);
  });

  it('keeps public catalog cache entries separate for different filters', async () => {
    const http = { get: vi.fn((_url?: string) => of({ success: true, items: [], total: 0 })) };
    const api = new ApiService(http as any);

    await api.getServicesPage({ type: 'stay', page: 1 });
    await api.getServicesPage({ type: 'food', page: 1 });

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get.mock.calls.map(call => call[0])).toEqual([
      'http://localhost:5055/api/services/search?type=stay&page=1&compact=1',
      'http://localhost:5055/api/services/search?type=food&page=1&compact=1'
    ]);
  });

  it('does not share personalized community requests across concurrent callers', async () => {
    const firstResponse = new Subject<any[]>();
    const secondResponse = new Subject<any[]>();
    const http = { get: vi.fn().mockReturnValueOnce(firstResponse).mockReturnValueOnce(secondResponse) };
    const api = new ApiService(http as any);

    const first = api.getCommunityPosts(0, 10, 'all', '', true);
    const second = api.getCommunityPosts(0, 10, 'all', '', true);
    expect(http.get).toHaveBeenCalledTimes(2);
    firstResponse.next([{ id: 'saved-by-A' }]); firstResponse.complete();
    secondResponse.next([{ id: 'saved-by-B' }]); secondResponse.complete();
    await expect(Promise.all([first, second])).resolves.toEqual([[{ id: 'saved-by-A' }], [{ id: 'saved-by-B' }]]);
  });

  it('releases a timed out catalog request so a later retry can make a new request', async () => {
    const teardown = vi.fn();
    const never = new Observable<any>(() => teardown);
    const http = { get: vi.fn().mockReturnValueOnce(never).mockReturnValueOnce(of({ success: true, items: [] })) };
    const api = new ApiService(http as any) as any;
    api.requestTimeoutMs = 5;

    await api.getServices();
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(await api.getServices()).toEqual([]);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('can propagate real HTTP failures to loading and retry states', async () => {
    const http = { get: vi.fn(() => throwError(() => new Error('offline'))) };
    const api = new ApiService(http as any);

    await expect(api.getCommunityPosts(0, 10, 'all', '', true)).rejects.toThrow('offline');
    await expect(api.getMyServices('provider', true)).rejects.toThrow('offline');
    await expect(api.getBookings('provider', undefined, true)).rejects.toThrow('offline');
  });

  it('resolves uploaded media paths against the backend origin', () => {
    const api = new ApiService({} as any);

    expect(api.resolveCommunityMediaUrl('/uploads/avatars/profile.jpg'))
      .toBe('http://localhost:5055/uploads/avatars/profile.jpg');
    expect(api.resolveCommunityMediaUrl('https://images.example.test/profile.jpg'))
      .toBe('https://images.example.test/profile.jpg');
    expect(api.resolveCommunityMediaUrl('data:image/jpeg;base64,abc'))
      .toBe('data:image/jpeg;base64,abc');
  });
  it('keeps verified local demo photos and their credits while hiding any demo price or carbon claims', () => {
    const api = new ApiService({} as any) as any;
    const photo = {
      path: 'image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg',
      caption: 'Ruộng bậc thang ở Sa Pa.',
      alt: 'Các thửa ruộng bậc thang uốn theo sườn núi Sa Pa',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Rice_terraces_in_Sapa,_Vietnam.jpg',
      author: 'Eerin25', licenseId: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution: 'Eerin25, via Wikimedia Commons, CC0 1.0', subjectLocation: 'Sa Pa',
      verificationStatus: 'verified', modifications: 'Resized proportionally; no crop.',
      width: 1600, height: 1200, responsiveVariants: [
        { path: 'image/greensteps/tours/sa-pa/sa-pa-rice-terraces-480w.jpg', width: 480, height: 360 },
        { path: 'image/greensteps/tours/sa-pa/sa-pa-rice-terraces-960w.jpg', width: 960, height: 720 },
        { path: 'image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg', width: 1600, height: 1200 }
      ]
    };
    const mapped = api.mapTourToFrontend({
      id: 'test-demo-tour', title: 'Sa Pa', destination: 'Sa Pa', days: 3, catalog_status: 'demo',
      image: photo.path, gallery: [photo.path], photoMetadata: [photo], cost: 1500000, carbon: 0,
      responsibleTravel: 'Respect local communities.', practicalNotes: 'Check weather.', max_capacity: 12,
      rating: 4.8, votes_count: 24, old_cost: 2000000,
      editorialItineraryNotice: 'Proposed itinerary.'
    });
    expect(mapped.image).toBe(photo.path);
    expect(mapped.gallery).toEqual([photo.path]);
    expect(mapped.photoMetadata).toEqual([photo]);
    expect(mapped.responsibleTravel).toBe('Respect local communities.');
    expect(mapped.practicalNotes).toBe('Check weather.');
    expect(mapped.editorialItineraryNotice).toBe('Proposed itinerary.');
    expect(mapped.cost).toBeUndefined();
    expect(mapped.oldCost).toBeUndefined();
    expect(mapped.carbon).toBeUndefined();
    expect(mapped.rating).toBeUndefined();
    expect(mapped.votes).toBeUndefined();
    expect(mapped.maxCapacity).toBeUndefined();
    expect(mapped.is_demo).toBe(true);
    expect(mapped.bookingEnabled).toBe(false);
  });


  it('sends the guest capability only in the MoMo payment header and retrieves server status', async () => {
    const http = { post: vi.fn(() => of({ success: true })), get: vi.fn(() => of({ success: true, booking: { payment_status: 'pending' } })) };
    const api = new ApiService(http as any);
    await api.createMomoPayment('booking-1', 'capability-1');
    await api.getMomoPaymentStatus('booking-1', 'capability-1');
    expect(http.post).toHaveBeenCalledWith('http://localhost:5055/api/payments/momo/create', { bookingId: 'booking-1' }, { withCredentials: true, headers: { 'x-booking-payment-capability': 'capability-1' } });
    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/payments/momo/status/booking-1', { withCredentials: true, headers: { 'x-booking-payment-capability': 'capability-1' } });
  });

  it('loads the admin catalog through the authenticated API', async () => {
    const rows = [{ id: 'service-1', status: 'active' }];
    const http = { get: vi.fn(() => of(rows)) };
    const api = new ApiService(http as any);
    expect(await api.getAdminCatalog('services')).toEqual({ data: rows, available: true });
    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/admin/catalog/services', { withCredentials: true });
  });

  it('does not reuse cached shared records after another account changes them', () => {
    const api = new ApiService({} as any) as any;
    for (const key of ['preset_tours_guest', 'preset_tour_1', 'services_all', 'service_detail_tour_1', 'itineraries_1', 'itinerary_1', 'wallet_info_1', 'transactions_1']) {
      api.setCachedData(key, [{ status: 'pending' }]);
      expect(api.getCachedData(key)).toBeNull();
    }
    api.setCachedData('community_posts_1', [{ id: 'post-1' }]);
    expect(api.getCachedData('community_posts_1')).toBeNull();
  });
  beforeEach(() => vi.stubGlobal('window', { location: { hostname: 'localhost', protocol: 'http:' } }));
  afterEach(() => vi.unstubAllGlobals());

  it('calls the admin users API with server-side filters and returns its response', async () => {
    const response = { success: true, data: [{ id: 'u1' }], pagination: { page: 2, limit: 10, total: 1, pages: 1 } };
    const http = { get: vi.fn(() => of(response)) };
    const api = new ApiService(http as any);

    const result = await (api as any).getAdminUsers({ search: 'mai', role: 'traveler', status: 'active', page: 2, limit: 10, sort: 'createdAt', order: 'desc' });

    expect(http.get).toHaveBeenCalledWith(
      'http://localhost:5055/api/admin/users?search=mai&role=traveler&status=active&page=2&limit=10&sort=createdAt&order=desc',
      { withCredentials: true }
    );
    expect(result).toEqual(response);
  });

  it('deduplicates identical admin user queries and caches successful responses', async () => {
    const response = { success: true, data: [{ id: 'u1' }], pagination: { page: 1, limit: 10, total: 1, pages: 1 } };
    const http = { get: vi.fn(() => of(response)) };
    const api = new ApiService(http as any);
    api.setAdminUserCacheScope('admin-1');

    const [first, second] = await Promise.all([
      api.getAdminUsers({ page: 1, limit: 10, sort: 'createdAt', order: 'desc' }),
      api.getAdminUsers({ order: 'desc', sort: 'createdAt', limit: 10, page: 1 })
    ]);
    const cached = await api.getAdminUsers({ page: 1, limit: 10, sort: 'createdAt', order: 'desc' });

    expect(first).toEqual(response);
    expect(second).toEqual(response);
    expect(cached).toEqual(response);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('does not share cached admin user data after switching account scope', async () => {
    const http = { get: vi.fn()
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'admin-1-view' }] }))
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'admin-2-view' }] })) };
    const api = new ApiService(http as any);
    const query = { page: 1, limit: 10, sort: 'createdAt', order: 'desc' };

    api.setAdminUserCacheScope('admin-1');
    const first = await api.getAdminUsers(query);
    api.setAdminUserCacheScope('admin-2');
    const second = await api.getAdminUsers(query);

    expect(first.data[0].id).toBe('admin-1-view');
    expect(second.data[0].id).toBe('admin-2-view');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('lets an explicit refresh bypass cached list and stats data', async () => {
    const http = { get: vi.fn()
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'stale' }] }))
      .mockReturnValueOnce(of({ success: true, stats: { total: 1 } }))
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'fresh' }] }))
      .mockReturnValueOnce(of({ success: true, stats: { total: 2 } })) };
    const api = new ApiService(http as any);
    const query = { page: 1, limit: 10, sort: 'createdAt', order: 'desc' };

    await api.getAdminUsers(query);
    await api.getAdminUserStats();
    api.refreshAdminUserData();
    const [users, stats] = await Promise.all([api.getAdminUsers(query), api.getAdminUserStats()]);

    expect(users.data[0].id).toBe('fresh');
    expect(stats.stats.total).toBe(2);
    expect(http.get).toHaveBeenCalledTimes(4);
  });

  it('caches detail reads in memory and invalidates them after a profile update', async () => {
    const http = {
      get: vi.fn()
        .mockReturnValueOnce(of({ success: true, user: { id: 'u1', fullname: 'Before' } }))
        .mockReturnValueOnce(of({ success: true, user: { id: 'u1', fullname: 'After' } })),
      patch: vi.fn(() => of({ success: true, user: { id: 'u1', fullname: 'After' } }))
    };
    const api = new ApiService(http as any);
    api.setAdminUserCacheScope('admin-1');

    const first = await api.getAdminUser('u1');
    const cached = await api.getAdminUser('u1');
    await api.updateAdminUser('u1', { fullname: 'After', reason: 'Correction' });
    const fresh = await api.getAdminUser('u1');

    expect(first.user.fullname).toBe('Before');
    expect(cached.user.fullname).toBe('Before');
    expect(fresh.user.fullname).toBe('After');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('does not cache an unsuccessful admin user API response', async () => {
    const http = { get: vi.fn()
      .mockReturnValueOnce(of({ success: false }))
      .mockReturnValueOnce(of({ success: true, data: [{ id: 'fresh' }] })) };
    const api = new ApiService(http as any);
    const query = { page: 1, limit: 10, sort: 'createdAt', order: 'desc' };

    await api.getAdminUsers(query);
    const result = await api.getAdminUsers(query);

    expect(result.data[0].id).toBe('fresh');
    expect(http.get).toHaveBeenCalledTimes(2);
  });


  it('unwraps the backend withdrawal envelope and keeps pending rows only', async () => {
    const http = { get: vi.fn(() => of({
      success: true,
      withdrawals: [
        { id: 'WD-1', status: 'pending' },
        { id: 'WD-2', status: 'approved' }
      ]
    })) };
    const api = new ApiService(http as any);

    const result = await (api as any).getAdminPendingWithdrawals();

    expect(http.get).toHaveBeenCalledWith('http://localhost:5055/api/wallet/withdrawals', { withCredentials: true });
    expect(result).toEqual({ data: [{ id: 'WD-1', status: 'pending' }], available: true });
  });

  it('marks an unavailable queue when its API request fails', async () => {
    const http = { get: vi.fn(() => throwError(() => new Error('Unavailable'))) };
    const api = new ApiService(http as any);

    const result = await (api as any).getAdminPendingProviders();

    expect(result).toEqual({ data: [], available: false });
  });
});
