import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Tour, Itinerary, Service, Booking, WalletInfo, WalletTransaction, CommunityPost, Notification } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private BACKEND_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5055/api' 
    : 'https://greensteps-6swn.onrender.com/api';

  private cache = new Map<string, { data: any; expiry: number }>();

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  private setCachedData(key: string, data: any, ttlMs: number = 300000): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  public clearCache(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  constructor(private http: HttpClient) {}


  private mapTourToFrontend(tour: any): Tour {
    return {
      id: tour.id,
      title: tour.title,
      destination: tour.destination,
      days: tour.days,
      type: tour.badges && tour.badges.includes('Gia đình') ? 'Gia đình' : 
            tour.badges && tour.badges.includes('Trải nghiệm') ? 'Trải nghiệm' :
            tour.badges && tour.badges.includes('Tiết kiệm') ? 'Tiết kiệm' : 'Nghỉ dưỡng',
      cost: Number(tour.cost),
      oldCost: Number(tour.old_cost || tour.oldCost || tour.cost * 1.2),
      image: tour.image_url || tour.image,
      tags: tour.badges || tour.tags || [],
      rating: Number(tour.rating || 5.0),
      votes: Number(tour.votes_count || tour.votes || 0),
      carbon: Number(tour.carbon || 0),
      data: tour.data || []
    };
  }

  // 1. Tours APIs
  public async getPresetTours(userId?: string): Promise<Tour[]> {
    const cacheKey = `preset_tours_${userId || 'guest'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const url = userId ? `${this.BACKEND_URL}/tours?userId=${userId}` : `${this.BACKEND_URL}/tours`;
    const res = await firstValueFrom(this.http.get<any[]>(url));
    const data = (res || []).map(t => this.mapTourToFrontend(t));
    this.setCachedData(cacheKey, data);
    return data;
  }

  public async getPresetTour(id: string): Promise<Tour | null> {
    const cacheKey = `preset_tour_${id}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    if (id && (id.toLowerCase().startsWith('srv_') || id.startsWith('SRV_'))) {
      try {
        const s = await this.getServiceDetails(id);
        if (s) {
          const mappedType = s.type === 'stay' ? 'Lưu trú' :
                             s.type === 'transport' ? 'Phương tiện' :
                             s.type === 'food' ? 'Ăn uống' : 'Giải trí';
          const tour: Tour = {
            id: s.id,
            title: s.name || s.name_service,
            destination: s.destination,
            days: 1,
            cost: Number(s.cost),
            oldCost: Number(s.cost * 1.12),
            image: s.image_url || s.image || 'image/Viet Nam.png',
            tags: [mappedType, ...(s.badges || [])],
            rating: Number(s.rating || 5.0),
            votes: Number(s.bookings_count || s.bookingsCount || 0),
            carbon: Number(s.carbon || 0),
            data: [
              [
                {
                  id: 'act_' + s.id,
                  time: '08:00',
                  name: s.name || s.name_service,
                  cost: s.cost,
                  carbon: s.carbon,
                  icon: s.type === 'stay' ? 'bi-house-door-fill' : 
                        s.type === 'food' ? 'bi-cup-hot-fill' : 
                        s.type === 'transport' ? 'bi-car-front-fill' : 'bi-tree-fill',
                  type: s.type === 'stay' ? 'lodging' : (s.type === 'food' ? 'dining' : (s.type === 'transport' ? 'transport' : 'attraction')),
                  lat: s.current_data?.lat || null,
                  lng: s.current_data?.lng || null
                }
              ]
            ],
            isService: true,
            gallery: s.current_data?.images || s.current_data?.gallery || [],
            maxCapacity: s.max_capacity || s.maxCapacity || 10
          };
          this.setCachedData(cacheKey, tour);
          return tour;
        }
      } catch (e) {
        console.warn('Failed to load service as preset tour:', e);
      }
      return null;
    }

    try {
      const cleanId = String(id).replace('preset_', '');
      const t = await firstValueFrom(this.http.get<any>(`${this.BACKEND_URL}/tours/${cleanId}`));
      if (t) {
        const tour = this.mapTourToFrontend(t);
        this.setCachedData(cacheKey, tour);
        return tour;
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch preset tour details, falling back:', e);
      const cleanId = String(id).replace('preset_', '');
      const tours = await this.getPresetTours();
      const tour = tours.find(t => t.id === id || String(t.id).replace('preset_', '') === cleanId) || null;
      if (tour) {
        this.setCachedData(cacheKey, tour);
      }
      return tour;
    }
  }

  // 2. Itineraries APIs
  public async getItineraries(userId: string): Promise<Itinerary[]> {
    const cacheKey = `itineraries_${userId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const res = await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/itineraries/user/${userId}`));
      const data = res.map(iti => ({
        id: iti.id,
        name: iti.name,
        user_id: iti.user_id || iti.userId || userId,
        destination: iti.destination,
        days: iti.days,
        totalCost: iti.totalCost || iti.total_cost || 0,
        totalCarbon: iti.totalCarbon || iti.total_carbon || 0,
        daysData: iti.daysData || iti.days_data || [],
        status: iti.status || 'draft',
        deposit_deadline: iti.deposit_deadline || null,
        start_date: iti.start_date || null,
        end_date: iti.end_date || null,
        companion_email: iti.companion_email || null
      }));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      console.warn('Failed to load itineraries from server, reading local mockup instead.');
      return [];
    }
  }

  public async getItinerary(id: string, bypassCache = false): Promise<Itinerary | null> {
    const cacheKey = `itinerary_${id}`;
    if (!bypassCache) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      const iti = await firstValueFrom(this.http.get<any>(`${this.BACKEND_URL}/itineraries/${id}`));
      const data = {
        id: iti.id,
        name: iti.name,
        user_id: iti.user_id || iti.userId || '',
        destination: iti.destination,
        days: iti.days,
        totalCost: iti.totalCost || iti.total_cost || 0,
        totalCarbon: iti.totalCarbon || iti.total_carbon || 0,
        daysData: iti.daysData || iti.days_data || [],
        status: iti.status || 'draft',
        deposit_deadline: iti.deposit_deadline || null,
        start_date: iti.start_date || null,
        end_date: iti.end_date || null,
        companion_email: iti.companion_email || null,
        imageUrl: iti.imageUrl || iti.image_url || null,
        collaborators: iti.collaborators || []
      };
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      console.warn('Failed to fetch itinerary from server:', e);
      return null;
    }
  }

  public async saveItinerary(itinerary: Itinerary): Promise<boolean> {
    this.clearCache('itineraries_');
    this.clearCache(`itinerary_${itinerary.id}`);

    try {
      await firstValueFrom(
        this.http.post(`${this.BACKEND_URL}/itineraries`, {
          id: itinerary.id,
          name: itinerary.name,
          user_id: itinerary.user_id,
          destination: itinerary.destination,
          days: itinerary.days,
          totalCost: itinerary.totalCost,
          totalCarbon: itinerary.totalCarbon,
          daysData: itinerary.daysData,
          status: itinerary.status,
          deposit_deadline: itinerary.deposit_deadline,
          start_date: itinerary.start_date,
          end_date: itinerary.end_date,
          companion_email: itinerary.companion_email,
          imageUrl: itinerary.imageUrl
        })
      );
      return true;
    } catch (e) {
      console.error('Error saving itinerary to server:', e);
      return false;
    }
  }

  public async inviteCollaborator(itineraryId: string, emails: string, inviteUrl: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/itineraries/${itineraryId}/invite`, { emails, inviteUrl })
      );
    } catch (e) {
      console.error('Error inviting collaborator:', e);
      throw e;
    }
  }

  public async joinItinerary(itineraryId: string, userId: string): Promise<any> {
    this.clearCache('itineraries_');
    this.clearCache(`itinerary_${itineraryId}`);
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/itineraries/${itineraryId}/join`, { userId })
      );
    } catch (e) {
      console.error('Error joining itinerary:', e);
      throw e;
    }
  }


  // Notifications APIs
  public async getNotifications(userId: string): Promise<Notification[]> {
    try {
      return await firstValueFrom(
        this.http.get<Notification[]>(`${this.BACKEND_URL}/notifications/user/${userId}`)
      );
    } catch (e) {
      console.error('Error fetching notifications:', e);
      return [];
    }
  }

  public async markNotificationRead(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/notifications/${id}/read`, {}));
      return true;
    } catch (e) {
      console.error('Error marking notification read:', e);
      return false;
    }
  }

  public async markAllNotificationsRead(userId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/notifications/user/${userId}/read-all`, {}));
      return true;
    } catch (e) {
      console.error('Error marking all notifications read:', e);
      return false;
    }
  }

  public async clearNotifications(userId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.BACKEND_URL}/notifications/user/${userId}`));
      return true;
    } catch (e) {
      console.error('Error clearing notifications:', e);
      return false;
    }
  }

  public async deleteItinerary(id: string): Promise<boolean> {
    this.clearCache('itineraries_');
    this.clearCache(`itinerary_${id}`);
    try {
      await firstValueFrom(this.http.delete(`${this.BACKEND_URL}/itineraries/${id}`));
      return true;
    } catch (e) {
      console.error('Error deleting itinerary:', e);
      return false;
    }
  }

  // 3. Wallet APIs
  public async getWalletInfo(userId: string): Promise<WalletInfo> {
    const cacheKey = `wallet_info_${userId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const res = await firstValueFrom(this.http.get<{ success: boolean; wallet: WalletInfo }>(`${this.BACKEND_URL}/wallet/${userId}`));
      const data = res.success ? res.wallet : { registered: false, balance: 0 };
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return { registered: false, balance: 0 };
    }
  }

  public async activateWallet(userId: string): Promise<{ success: boolean; balance: number; message?: string }> {
    try {
      this.clearCache(`wallet_info_${userId}`);
      const res = await firstValueFrom(this.http.post<{ success: boolean; balance: number; message?: string }>(`${this.BACKEND_URL}/wallet/activate`, { userId }));
      return res;
    } catch (e) {
      return { success: false, balance: 0 };
    }
  }

  public async depositMoney(userId: string, amount: number): Promise<{ success: boolean; balance: number; message?: string }> {
    try {
      this.clearCache(`wallet_info_${userId}`);
      this.clearCache(`transactions_${userId}`);
      const res = await firstValueFrom(this.http.post<{ success: boolean; balance: number; message?: string }>(`${this.BACKEND_URL}/wallet/deposit`, { userId, amount }));
      return res;
    } catch (e) {
      return { success: false, balance: 0 };
    }
  }

  public async getTransactionStatus(txId: string): Promise<{ success: boolean; status: string; balance: number }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; status: string; balance: number }>(`${this.BACKEND_URL}/wallet/transaction-status/${txId}`)
      );
      return res;
    } catch (e) {
      return { success: false, status: 'error', balance: 0 };
    }
  }

  public async payItinerary(userId: string, itineraryId: string, amount: number): Promise<{ success: boolean; balance: number; message?: string }> {
    try {
      this.clearCache(`wallet_info_${userId}`);
      this.clearCache(`transactions_${userId}`);
      this.clearCache(`itineraries_${userId}`);
      this.clearCache(`itinerary_${itineraryId}`);
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; balance: number; message?: string }>(`${this.BACKEND_URL}/wallet/pay`, { userId, itineraryId, amount })
      );
      return res;
    } catch (e: any) {
      return { success: false, balance: 0, message: e?.error?.message || 'Lỗi thanh toán!' };
    }
  }

  public async payItineraryQr(userId: string, itineraryId: string, amount: number): Promise<{ success: boolean; balance: number; message?: string }> {
    try {
      this.clearCache(`wallet_info_${userId}`);
      this.clearCache(`transactions_${userId}`);
      this.clearCache(`itineraries_${userId}`);
      this.clearCache(`itinerary_${itineraryId}`);
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; balance: number; message?: string }>(`${this.BACKEND_URL}/wallet/pay-qr`, { userId, itineraryId, amount })
      );
      return res;
    } catch (e: any) {
      return { success: false, balance: 0, message: e?.error?.message || 'Lỗi thanh toán!' };
    }
  }

  public async getTransactions(userId: string): Promise<WalletTransaction[]> {
    const cacheKey = `transactions_${userId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<WalletTransaction[]>(`${this.BACKEND_URL}/wallet/transactions/${userId}`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return [];
    }
  }

  // 4. Community APIs
  public async getCommunityPosts(page = 0, limit = 15): Promise<CommunityPost[]> {
    const cacheKey = `community_posts_${page}_${limit}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<CommunityPost[]>(`${this.BACKEND_URL}/community/posts?page=${page}&limit=${limit}`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return [];
    }
  }

  public async addCommunityPost(postData: any): Promise<boolean> {
    try {
      this.clearCache('community_posts_');
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/community/posts`, postData));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async deleteCommunityPost(postId: string): Promise<boolean> {
    try {
      this.clearCache('community_posts_');
      await firstValueFrom(this.http.delete(`${this.BACKEND_URL}/community/posts/${postId}`));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async cloneItinerary(id: string, userId: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/itineraries/${id}/clone`, { userId })
      );
    } catch (e) {
      return { success: false, message: 'Lỗi sao chép lịch trình.' };
    }
  }

  // 5. Services & Bookings APIs
  public async getServices(): Promise<Service[]> {
    const cacheKey = 'services_all';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<Service[]>(`${this.BACKEND_URL}/services`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return [];
    }
  }

  public async getServicesByDestination(destination: string): Promise<any[]> {
    const cacheKey = `services_dest_${destination}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/services?destination=${encodeURIComponent(destination)}`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return [];
    }
  }

  public async getMyServices(providerId: string): Promise<Service[]> {
    try {
      return await firstValueFrom(this.http.get<Service[]>(`${this.BACKEND_URL}/services/provider/${providerId}`, { withCredentials: true }));
    } catch (e) {
      return [];
    }
  }

  public async addMyService(serviceData: any): Promise<boolean> {
    this.clearCache('services_');

    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/services`, serviceData, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async updateMyService(serviceId: string, serviceData: any): Promise<boolean> {
    this.clearCache('services_');

    try {
      await firstValueFrom(this.http.put(`${this.BACKEND_URL}/services/${serviceId}`, serviceData, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }


  public async getBookings(providerId?: string, customerId?: string): Promise<Booking[]> {
    try {
      let query = '';
      if (providerId) query = `providerId=${providerId}`;
      else if (customerId) query = `customerId=${customerId}`;
      return await firstValueFrom(this.http.get<Booking[]>(`${this.BACKEND_URL}/bookings?${query}`));
    } catch (e) {
      return [];
    }
  }

  public async getBooking(id: string): Promise<any> {
    try {
      return await firstValueFrom(this.http.get<any>(`${this.BACKEND_URL}/bookings/${id}`));
    } catch (e) {
      return null;
    }
  }

  public async lookupBookingsByPhone(phone: string, email?: string): Promise<any[]> {
    try {
      let url = `${this.BACKEND_URL}/bookings/lookup/phone?`;
      const params = [];
      if (phone) params.push(`phone=${encodeURIComponent(phone)}`);
      if (email) params.push(`email=${encodeURIComponent(email)}`);
      url += params.join('&');

      const res = await firstValueFrom(this.http.get<any>(url));
      return res.bookings || [];
    } catch (e) {
      return [];
    }
  }

  public async createBooking(bookingData: any): Promise<{ success: boolean; bookingId?: string; message?: string; emailAlreadyExists?: boolean; autoCreatedUser?: any }> {
    try {
      const res = await firstValueFrom(this.http.post<any>(`${this.BACKEND_URL}/bookings`, bookingData));
      return { 
        success: true, 
        bookingId: res.bookingId, 
        message: res.message,
        emailAlreadyExists: res.emailAlreadyExists,
        autoCreatedUser: res.autoCreatedUser
      };
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Có lỗi xảy ra khi tạo đặt chỗ.' };
    }
  }

  public async approveBooking(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/bookings/${id}/approve`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async rejectBooking(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/bookings/${id}/reject`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 5. Reviews & Ratings APIs
  public async getTourReviews(tourId: string): Promise<any[]> {
    const cleanId = String(tourId).replace('preset_', '');
    const cacheKey = `tour_reviews_${cleanId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/reviews/tour/${cleanId}`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      console.error('Failed to load tour reviews:', e);
      return [];
    }
  }

  public async postTourReview(reviewData: { userId: string; tourId: string; rating?: number | null; text: string; parentCommentId?: string | null }): Promise<any> {
    const cleanId = String(reviewData.tourId).replace('preset_', '');
    this.clearCache(`tour_reviews_${cleanId}`);
    this.clearCache(`preset_tour_`);
    this.clearCache(`preset_tours_`);
    const data = { ...reviewData, tourId: cleanId };
    return await firstValueFrom(this.http.post<any>(`${this.BACKEND_URL}/reviews/tour`, data));
  }

  public async likeComment(commentId: string): Promise<any> {
    try {
      this.clearCache(`tour_reviews_`);
      this.clearCache(`service_reviews_`);
      return await firstValueFrom(this.http.post<any>(`${this.BACKEND_URL}/reviews/${commentId}/like`, {}));
    } catch (e) {
      console.error('Failed to like comment:', e);
      return null;
    }
  }

  public async getServiceReviews(serviceId: string): Promise<any[]> {
    const cacheKey = `service_reviews_${serviceId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/reviews/service/${serviceId}`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      console.error('Failed to load service reviews:', e);
      return [];
    }
  }

  public async postServiceReview(reviewData: { userId: string; serviceId: string; rating: number; text: string }): Promise<any> {
    this.clearCache(`service_reviews_${reviewData.serviceId}`);
    return await firstValueFrom(this.http.post<any>(`${this.BACKEND_URL}/reviews/service`, reviewData));
  }

  public async replyToComment(commentId: string, userId: string, text: string): Promise<any> {
    this.clearCache(`tour_reviews_`);
    this.clearCache(`service_reviews_`);
    return await firstValueFrom(this.http.post<any>(`${this.BACKEND_URL}/reviews/${commentId}/reply`, { userId, text }));
  }
  // 6. Recommendation APIs
  public async getDestinations(): Promise<string[]> {
    const cacheKey = 'destinations_list';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<string[]>(`${this.BACKEND_URL}/destinations`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return ['Đà Lạt', 'Phú Yên', 'Đà Nẵng - Hội An']; // fallback
    }
  }

  public async getRecommendedTours(userId: string): Promise<Tour[]> {
    const cacheKey = `recommended_tours_${userId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const res = await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/recommendations/tours/${userId}`));
      const data = (res || []).map(t => this.mapTourToFrontend(t));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return this.getPresetTours(); // fallback
    }
  }

  public async getRecommendedServices(userId: string): Promise<Service[]> {
    const cacheKey = `recommended_services_${userId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const data = await firstValueFrom(this.http.get<Service[]>(`${this.BACKEND_URL}/recommendations/services/${userId}`));
      this.setCachedData(cacheKey, data);
      return data;
    } catch (e) {
      return this.getServices(); // fallback
    }
  }

  public preloadAppData(userId?: string) {
    // Warm up the caches asynchronously to preload data
    this.getPresetTours().catch(() => {});
    this.getServices().catch(() => {});
    this.getCommunityPosts().catch(() => {});
    this.getDestinations().catch(() => {});
    if (userId) {
      this.getItineraries(userId).catch(() => {});
      this.getWalletInfo(userId).catch(() => {});
      this.getTransactions(userId).catch(() => {});
      this.getRecommendedTours(userId).catch(() => {});
      this.getRecommendedServices(userId).catch(() => {});
    }
  }

  public async sendAiMessage(message: string, destination: string, currentActivities: any[]): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/ai/chat`, { message, destination, currentActivities })
      );
    } catch (e) {
      console.error('Failed to send AI message:', e);
      throw e;
    }
  }

  // 7. B2B partner stats & withdrawal API calls
  public async requestWithdrawal(amount: number, bankName: string, bankAccount: string, accountHolder: string): Promise<{ success: boolean; message: string }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/wallet/withdraw`, { amount, bankName, bankAccount, accountHolder })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Lỗi gửi yêu cầu rút tiền!' };
    }
  }

  public async getPartnerStats(): Promise<any> {
    try {
      return await firstValueFrom(this.http.get<any>(`${this.BACKEND_URL}/partner/stats`));
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Lỗi tải báo cáo đối soát!' };
    }
  }

  public async checkInEVoucher(evoucherCode: string): Promise<{ success: boolean; message: string }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/bookings/checkin`, { evoucherCode })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Lỗi xác thực E-Voucher!' };
    }
  }

  public async cancelBooking(bookingId: string): Promise<{ success: boolean; message: string }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/bookings/cancel`, { bookingId })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Lỗi hủy đơn đặt chỗ!' };
    }
  }

  public async registerPartner(nameProvider: string, field: string, destination: string, contractText: string): Promise<{ success: boolean; message: string }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/partner/register`, { nameProvider, field, destination, contractText })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Lỗi đăng ký đối tác!' };
    }
  }

  // 8. Points & Voucher API calls
  public async redeemVoucher(): Promise<{ success: boolean; message: string; voucher?: any; remainingPoints?: number }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/vouchers/redeem`, {})
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Lỗi quy đổi điểm xanh!' };
    }
  }

  public async getMyVouchers(): Promise<any[]> {
    try {
      const res = await firstValueFrom(this.http.get<{ success: boolean; vouchers: any[] }>(`${this.BACKEND_URL}/vouchers/my`));
      return res.success ? res.vouchers : [];
    } catch (e) {
      return [];
    }
  }

  public async validateVoucher(code: string): Promise<{ success: boolean; message: string; discount?: number }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/vouchers/validate`, { code })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Mã Voucher không hợp lệ!' };
    }
  }

  // 9. Community engagement likes & comments
  public async likePost(postId: string): Promise<{ success: boolean; likes: number }> {
    try {
      return await firstValueFrom(this.http.post<{ success: boolean; likes: number }>(`${this.BACKEND_URL}/community/posts/${postId}/like`, {}));
    } catch (e) {
      return { success: false, likes: 0 };
    }
  }

  public async unlikePost(postId: string): Promise<{ success: boolean; likes: number }> {
    try {
      return await firstValueFrom(this.http.post<{ success: boolean; likes: number }>(`${this.BACKEND_URL}/community/posts/${postId}/unlike`, {}));
    } catch (e) {
      return { success: false, likes: 0 };
    }
  }

  public async addPostComment(postId: string, text: string, parentCommentId?: string, userId?: string, fullname?: string, imageUrl?: string): Promise<{ success: boolean; comment: any }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/community/posts/${postId}/comments`, { text, parentCommentId, userId, fullname, imageUrl })
      );
    } catch (e: any) {
      return { success: false, comment: null };
    }
  }

  public async getPostComments(postId: string): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/community/posts/${postId}/comments`));
    } catch (e) {
      return [];
    }
  }

  public async uploadImageBase64(base64Data: string, type?: string): Promise<{ success: boolean; url: string }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/upload-base64`, { base64: base64Data, type })
      );
    } catch (e) {
      return { success: false, url: '' };
    }
  }

  // Admin APIs
  public async getPendingProviders(): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/partner/pending`, { withCredentials: true }));
    } catch (e) {
      return [];
    }
  }

  public async approveProvider(targetUserId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/partner/approve`, { targetUserId }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getPendingDeposits(): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/wallet/deposits/pending`, { withCredentials: true }));
    } catch (e) {
      return [];
    }
  }

  public async approveDeposit(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/wallet/deposits/${id}/approve`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async rejectDeposit(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/wallet/deposits/${id}/reject`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getPendingWithdrawals(): Promise<any[]> {
    try {
      const all = await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/wallet/withdrawals`, { withCredentials: true }));
      return all.filter(w => w.status === 'pending');
    } catch (e) {
      return [];
    }
  }

  public async approveWithdrawal(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/wallet/withdrawals/${id}/approve`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async rejectWithdrawal(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/wallet/withdrawals/${id}/reject`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getPendingWallets(): Promise<any[]> {
    try {
      return await firstValueFrom(
        this.http.get<any[]>(`${this.BACKEND_URL}/wallet/pending-activations`, { withCredentials: true })
      );
    } catch (e) {
      return [];
    }
  }

  public async approveWallet(txId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.BACKEND_URL}/wallet/pending-activations/${txId}/approve`, {}, { withCredentials: true })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async rejectWallet(txId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.BACKEND_URL}/wallet/pending-activations/${txId}/reject`, {}, { withCredentials: true })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getPendingBookings(): Promise<any[]> {
    try {
      return await firstValueFrom(
        this.http.get<any[]>(`${this.BACKEND_URL}/bookings/pending`, { withCredentials: true })
      );
    } catch (e) {
      return [];
    }
  }

  // 15. SerpApi Google Maps Search

  public async searchSerpPlaces(query: string, destination: string): Promise<any[]> {
    try {
      return await firstValueFrom(
        this.http.get<any[]>(`${this.BACKEND_URL}/spots/search-serp?q=${encodeURIComponent(query)}&destination=${encodeURIComponent(destination)}`)
      );
    } catch (e) {
      console.error('Failed to search spots via SerpApi:', e);
      return [];
    }
  }

  public async reverseGeocodeSerp(lat: number, lng: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.get<any>(`${this.BACKEND_URL}/spots/reverse-serp?lat=${lat}&lng=${lng}`)
      );
    } catch (e) {
      console.error('Failed reverse geocoding via SerpApi:', e);
      return null;
    }
  }

  // Cải tiến Quản trị Đối tác (Partner Dashboard Upgrades)
  public async getServiceDetails(id: string): Promise<any> {
    try {
      return await firstValueFrom(this.http.get<any>(`${this.BACKEND_URL}/services/${id}`, { withCredentials: true }));
    } catch (e) {
      return null;
    }
  }

  public async getServiceAsTour(id: string): Promise<Tour | null> {
    const cacheKey = `service_detail_tour_${id}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const s = await this.getServiceDetails(id);
      if (!s) return null;

      const serviceType = s.type || 'attraction';
      const mappedType = serviceType === 'stay' || serviceType === 'lodging' ? 'Lưu trú' :
                         serviceType === 'transport' ? 'Phương tiện' :
                         serviceType === 'food' || serviceType === 'dining' ? 'Ăn uống' : 'Trải nghiệm';
      const title = s.name || s.name_service || 'Dịch vụ GreenSteps';
      const tour: Tour = {
        id: s.id,
        title,
        destination: s.destination,
        days: 1,
        type: mappedType,
        cost: Number(s.cost || 0),
        oldCost: Number((s.cost || 0) * 1.12),
        image: s.image_url || s.image || s.current_data?.img || 'image/Viet Nam.png',
        description: s.current_data?.shortDesc || s.current_data?.description || s.description,
        tags: [mappedType, ...(s.badges || [])],
        badges: s.badges || [],
        rating: Number(s.rating || 5.0),
        votes: Number(s.bookings_count || s.bookingsCount || 0),
        carbon: Number(s.carbon || 0),
        data: [
          [
            {
              id: 'act_' + s.id,
              time: s.current_data?.startTime || '08:00',
              name: title,
              cost: Number(s.cost || 0),
              carbon: Number(s.carbon || 0),
              icon: serviceType === 'stay' || serviceType === 'lodging' ? 'bi-house-door-fill' :
                    serviceType === 'food' || serviceType === 'dining' ? 'bi-cup-hot-fill' :
                    serviceType === 'transport' ? 'bi-car-front-fill' : 'bi-tree-fill',
              type: serviceType === 'stay' || serviceType === 'lodging' ? 'lodging' :
                    serviceType === 'food' || serviceType === 'dining' ? 'dining' :
                    serviceType === 'transport' ? 'transport' : 'attraction',
              lat: s.current_data?.lat || null,
              lng: s.current_data?.lng || null
            }
          ]
        ],
        isService: true,
        gallery: s.current_data?.images || s.current_data?.gallery || [],
        maxCapacity: s.max_capacity || s.maxCapacity || 10
      };

      this.setCachedData(cacheKey, tour);
      return tour;
    } catch (e) {
      console.warn('Failed to load service detail:', e);
      return null;
    }
  }

  public async cloneService(id: string): Promise<boolean> {
    this.clearCache('services_');
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/services/${id}/clone`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async suspendService(id: string): Promise<boolean> {
    this.clearCache('services_');
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/services/${id}/suspend`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async resendServiceApproval(id: string): Promise<boolean> {
    this.clearCache('services_');
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/services/${id}/resend-approval`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getBookingDetails(id: string): Promise<any> {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.BACKEND_URL}/bookings/${id}`, { withCredentials: true }));
      return res?.success ? res.booking : null;
    } catch (e) {
      return null;
    }
  }

  public async completeBooking(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/bookings/${id}/complete`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async updateBookingStatuses(id: string, statuses: any): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/bookings/${id}/status`, statuses, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getChangeRequests(providerId?: string, customerId?: string): Promise<any[]> {
    try {
      let query = '';
      if (providerId) query = `providerId=${providerId}`;
      else if (customerId) query = `customerId=${customerId}`;
      return await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/change-requests?${query}`, { withCredentials: true }));
    } catch (e) {
      return [];
    }
  }

  public async createChangeRequest(data: any): Promise<any> {
    try {
      return await firstValueFrom(this.http.post<any>(`${this.BACKEND_URL}/change-requests`, data, { withCredentials: true }));
    } catch (e) {
      return null;
    }
  }

  public async approveChangeRequest(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/change-requests/${id}/approve`, {}, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async rejectChangeRequest(id: string, reason: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/change-requests/${id}/reject`, { reason }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async proposeAlternativeChangeRequest(id: string, data: any): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/change-requests/${id}/propose`, data, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getOperationsAssignments(providerId: string): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/operations?providerId=${providerId}`, { withCredentials: true }));
    } catch (e) {
      return [];
    }
  }

  public async assignStaffAndVehicle(bookingId: string, data: any): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/operations/${bookingId}/assign`, data, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async updateChecklistItem(bookingId: string, itemLabel: string, done: boolean): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/operations/${bookingId}/checklist`, { itemLabel, done }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async updateAssignmentStatus(bookingId: string, status: string, incidents?: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/operations/${bookingId}/status`, { status, incidents }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getProviderReviews(providerId: string, filters: any): Promise<any[]> {
    try {
      let query = `providerId=${providerId}`;
      if (filters.rating) query += `&rating=${filters.rating}`;
      if (filters.serviceId) query += `&serviceId=${filters.serviceId}`;
      if (filters.answered !== undefined) query += `&answered=${filters.answered}`;
      return await firstValueFrom(this.http.get<any[]>(`${this.BACKEND_URL}/reviews/provider?${query}`, { withCredentials: true }));
    } catch (e) {
      return [];
    }
  }

  public async replyToReview(commentId: string, text: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/reviews/${commentId}/reply`, { text }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async reportReview(commentId: string, reason: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/reviews/${commentId}/report`, { reason }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async updateInternalNotes(commentId: string, notes: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.BACKEND_URL}/reviews/${commentId}/notes`, { notes }, { withCredentials: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public async requestCheckoutOtp(email: string, fullname: string): Promise<{ success: boolean; message: string; exists?: boolean }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/auth/request-checkout-otp`, { email, fullname }, { withCredentials: true })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Không thể gửi mã xác thực.' };
    }
  }

  public async verifyCheckoutOtp(email: string, otp: string, fullname: string, phone: string): Promise<{ success: boolean; message: string; token?: string; user?: any }> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/auth/verify-checkout-otp`, { email, otp, fullname, phone }, { withCredentials: true })
      );
    } catch (e: any) {
      return { success: false, message: e?.error?.message || 'Xác thực mã OTP thất bại.' };
    }
  }
}
