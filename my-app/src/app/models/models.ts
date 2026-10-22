export interface User {
  id?: string;
  _id?: string; // MongoDB format
  username: string;
  fullname: string;
  email: string;
  phone?: string | null;
  dob?: string;
  gender?: string;
  address?: string;
  role: 'traveler' | 'provider' | 'admin';
  companyName?: string;
  company_name?: string;
  avatarUrl?: string;
  is_verified?: boolean;
}

export interface Activity {
  id: string;
  time: string;
  name: string;
  cost: number;
  carbon: number;
  icon: string;
  type: 'lodging' | 'dining' | 'transport' | 'attraction';
  lat?: number;
  lng?: number;
}

export interface Tour {
  id: string;
  title: string;
  destination: string;
  days: number;
  type?: string; // Mapped type: Gia đình, Trải nghiệm, Tiết kiệm, Nghỉ dưỡng
  cost: number;
  oldCost?: number;
  old_cost?: number;
  carbon: number;
  image?: string;
  image_url?: string;
  gallery?: string[];
  description?: string;
  rating?: number;
  votes?: number;
  votes_count?: number;
  badges?: string[];
  tags?: string[];
  data: Activity[][];
  isRecommended?: boolean;
  isService?: boolean;
  maxCapacity?: number;
}

export interface Itinerary {
  id: string;
  name: string;
  user_id: string;
  destination: string;
  days: number;
  totalCost: number;
  total_cost?: number;
  totalCarbon: number;
  total_carbon?: number;
  daysData: Activity[][];
  days_data?: Activity[][];
  status?: 'draft' | 'deposited' | 'cancelled';
  deposit_deadline?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  companion_email?: string | null;
  imageUrl?: string | null;
  collaborators?: any[];
}

export interface Service {
  id: string;
  provider_id: string;
  name: string;
  type: string;
  destination: string;
  cost: number;
  carbon: number;
  icon?: string;
  status: string;
  views_count?: number;
  rating?: number;
  bookings_count?: number;
  bookingsCount?: number;
  badges?: string[];
  image_url?: string;
  max_capacity?: number;
  rejection_reason?: string;
  isRecommended?: boolean;
}

export interface Booking {
  id: string;
  customer?: string;
  customer_name?: string;
  customer_id?: string;
  service: string;
  service_name?: string;
  service_id: string;
  date: string;
  booking_date?: string;
  guests: number;
  value: number;
  status: string;
  booking_status?: string;
  payment_status?: string;
  operation_status?: string;
  confirm_deadline?: string;
  payment_deadline?: string;
  special_requests?: string;
  rejection_reason?: string;
}

export interface WalletInfo {
  registered: boolean;
  balance: number;
  green_points?: number;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'payment' | 'refund';
  desc: string;
  date: string;
  amount: number;
  status: 'success' | 'pending' | 'failed';
}

export interface CommunityPost {
  id: string;
  author: string;
  avatar: string;
  time: string;
  rating: number;
  text: string;
  tripName: string;
  dest: string;
  days: number;
  likes: number;
  comments: number;
  image?: string;
  authorId?: string;
  itinerary_id?: string;
  current_data?: any;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'system' | 'community' | 'booking' | 'wallet';
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
