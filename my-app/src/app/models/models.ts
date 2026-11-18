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
  avatar?: string;
  is_verified?: boolean;
}

export interface Activity {
  id: string;
  time: string;
  name: string;
  cost: number | null;
  carbon: number | null;
  icon: string;
  type: 'lodging' | 'dining' | 'transport' | 'attraction';
  lat?: number;
  lng?: number;
  description?: string;
}

// Optional lodging details supplied by the service catalog (current_data).
export interface ServiceRoom {
  id: string;
  name: string;
  images?: string[];
  area?: number;
  capacity?: number;
  beds?: string;
  amenities?: string[];
  policies?: string[];
  price_per_night?: number;
  available_rooms?: number;
}

export interface ServiceAmenityGroup {
  name: string;
  items: ServiceAmenity[];
}

export type ServiceAmenity = string | { name: string; fee?: 'free' | 'paid'; available?: boolean; note?: string };
export interface ServicePolicyGroup { title: string; lines: string[]; }
export interface ServiceNearbyPlace { name: string; distance?: string; distanceKm?: number; travelMinutes?: number; travelMode?: 'walking' | 'driving' | 'bicycling'; distanceBasis?: 'source_reported' | 'straight_line' | 'route'; mapQuery?: string; sourceUrl?: string; }
export interface ServiceNearbyGroup { name: string; items: ServiceNearbyPlace[]; }
export interface ServiceGreenFeature { title: string; description?: string; }

export interface TourPhotoVariant {
  path: string;
  width: number;
  height?: number;
}

export interface CatalogMetadata {
  flashSale?: { id: string; name: string; discount_type: 'percent' | 'fixed'; discount_value: number; start_at: string; end_at: string; min_order: number; remaining: number; sale_price: number } | null;
  priceStatus?: 'verified' | 'reference' | 'on_request';
  bookingEnabled?: boolean;
  sourceUrls?: string[];
  sourceCheckedAt?: string;
  carbonKnown?: boolean;
  capacityKnown?: boolean;
  coverMediaVerified?: boolean;
  photoMetadata?: TourPhotoCredit[];
}

export interface TourPhotoCredit {
  path: string;
  width?: number;
  height?: number;
  responsiveVariants?: Array<{ path: string; width: number; height?: number }>;
  caption: string;
  alt: string;
  sourcePage: string;
  author: string;
  licenseId: string;
  licenseUrl: string;
  attribution: string;
  subjectLocation: string;
  verificationStatus: 'verified' | 'unverified';
  relevance?: { type: 'exact_landmark' | 'destination_context' | 'regional_context'; explanation: string };
  verifiedOn?: string;
  modifications: string;
}

export interface Tour extends CatalogMetadata {
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
  coverMediaVerified?: boolean;
  coverMediaVariants?: Array<{ url: string; width?: number; height?: number; format?: string }>;
  gallery?: string[];
  photoMetadata?: TourPhotoCredit[];
  description?: string;
  responsibleTravel?: string;
  practicalNotes?: string;
  editorialItineraryNotice?: string;
  rating?: number | null;
  votes?: number;
  votes_count?: number;
  reviews_count?: number;
  discountPercent?: number;
  ecoFeature?: string;
  badges?: string[];
  tags?: string[];
  styleExplanation?: string;
  fitnessIsEstimate?: boolean;
  fitnessExplanation?: string;
  isDemo?: boolean;
  is_demo?: boolean;
  data: Activity[][];
  isRecommended?: boolean;
  source?: string;
  is_partner?: boolean;
  catalog_status?: string;
  destination_ids?: string[];
  google_place_id?: string;
  isService?: boolean;
  maxCapacity?: number;
  rooms?: ServiceRoom[];
  amenityGroups?: ServiceAmenityGroup[];
  address?: string;
  latitude?: number;
  longitude?: number;
  areaDescription?: string;
  nearby?: string[];
  policies?: string[];
  popularAmenities?: ServiceAmenity[];
  policyGroups?: ServicePolicyGroup[];
  nearbyGroups?: ServiceNearbyGroup[];
  nearbySources?: { name: string; url: string }[];
  nearbyCheckedAt?: string;
  nearbyOrigin?: string;
  greenFeatures?: ServiceGreenFeature[];
  contactPhone?: string;
  highlights?: string[];
  included?: string[];
  excluded?: string[];
  policy?: Array<{ step?: string; title: string; desc: string }>;
  style?: string;
  group_size?: string;
  fitness_level?: string;
  guarantees?: Array<{ icon?: string; title: string; desc: string }>;
  vouchers?: Array<any>;
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

export interface Service extends CatalogMetadata {
  id: string;
  provider_id: string;
  name: string;
  type: string;
  destination: string;
  cost: number | null;
  carbon: number | null;
  icon?: string;
  status: string;
  views_count?: number;
  rating?: number | null;
  oldCost?: number;
  old_cost?: number;
  discountPercent?: number;
  ecoFeature?: string;
  description?: string;
  reviews_count?: number;
  bookings_count?: number;
  bookingsCount?: number;
  badges?: string[];
  image_url?: string;
  coverMediaVerified?: boolean;
  gallery?: string[];
  photoMetadata?: TourPhotoCredit[];
  current_data?: Record<string, any>;
  max_capacity?: number;
  rejection_reason?: string;
  isRecommended?: boolean;
  source?: string;
  is_partner?: boolean;
  google_place_id?: string;
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
  images?: string[];
  videoUrl?: string;
  postType?: 'post' | 'reel' | 'question';
  location?: string;
  hashtags?: string[];
  shares?: number;
  isSaved?: boolean;
  challengeId?: string | null;
  authorId?: string;
  itinerary_id?: string;
  allowClone?: boolean;
  allowCollab?: boolean;
  current_data?: any;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string | null;
  link_url?: string | null;
  bookingId?: string | null;
  booking_id?: string | null;
  reference_id?: string | null;
  postId?: string | null;
  itineraryId?: string | null;
  type: 'system' | 'community' | 'booking' | 'wallet' | 'itinerary' | string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
