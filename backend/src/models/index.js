const { FieldTypes, Op } = require('../db/mongo-store');
const { store } = require('../config/db.config');

// 1. User Model (DATEONLY dob, Enum gender, last_interest)
const User = store.define('User', {
  facebook_id: { type: FieldTypes.STRING, unique: true, allowNull: true },
  id: { type: FieldTypes.STRING, primaryKey: true },
  role: { type: FieldTypes.ENUM('traveler', 'provider', 'admin'), defaultValue: 'traveler', allowNull: false },
  username: { type: FieldTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: FieldTypes.STRING, allowNull: false },
  fullname: { type: FieldTypes.STRING, allowNull: true },
  email: { type: FieldTypes.STRING, unique: true, allowNull: false },
  phone: { type: FieldTypes.STRING },
  is_verified: { type: FieldTypes.BOOLEAN, allowNull: false, defaultValue: false },
  dob: { type: FieldTypes.DATEONLY }, // DATEONLY
  gender: { type: FieldTypes.ENUM('Nam', 'Nữ', 'Khác'), defaultValue: 'Khác' }, // ENUM
  address: { type: FieldTypes.STRING },
  job: { type: FieldTypes.STRING },
  last_interest: { type: FieldTypes.STRING }, // user's last interested destination slug
  company_name: { type: FieldTypes.STRING },
  avatarUrl: { type: FieldTypes.TEXT }

}, { timestamps: true });

const AuthOtp = store.define('AuthOtp', {
  id: { type: FieldTypes.UUID, defaultValue: FieldTypes.UUIDV4, primaryKey: true },
  purpose: { type: FieldTypes.ENUM('REGISTER', 'RESET_PASSWORD'), allowNull: false },
  otp_hash: { type: FieldTypes.STRING, allowNull: false },
  expires_at: { type: FieldTypes.DATE, allowNull: false },
  consumed_at: { type: FieldTypes.DATE },
  attempt_count: { type: FieldTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resend_available_at: { type: FieldTypes.DATE, allowNull: false },
  reset_token_hash: { type: FieldTypes.STRING },
  reset_token_expires_at: { type: FieldTypes.DATE },
  reset_token_consumed_at: { type: FieldTypes.DATE }
}, {
  tableName: 'auth_otps',
  underscored: true,
  timestamps: true
});

const PendingRegistration = store.define('PendingRegistration', {
  id: { type: FieldTypes.UUID, defaultValue: FieldTypes.UUIDV4, primaryKey: true },
  username: { type: FieldTypes.STRING, allowNull: false },
  email: { type: FieldTypes.STRING, allowNull: false },
  password_hash: { type: FieldTypes.STRING, allowNull: false },
  otp_hash: { type: FieldTypes.STRING, allowNull: false },
  expires_at: { type: FieldTypes.DATE, allowNull: false },
  consumed_at: { type: FieldTypes.DATE },
  attempt_count: { type: FieldTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resend_available_at: { type: FieldTypes.DATE, allowNull: false }
}, {
  tableName: 'pending_registrations',
  underscored: true,
  timestamps: true
});

// 2. Badge Model
const Badge = store.define('Badge', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // badge name
  badges_description: { type: FieldTypes.STRING },
  foruserortour: { type: FieldTypes.INTEGER, allowNull: false } // 0: user, 1: tour
}, { timestamps: true });

// 3. BadgeUser Junction Model
const BadgeUser = store.define('BadgeUser', {}, { timestamps: true });

// 4. Wallet Model
const Wallet = store.define('Wallet', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // EWXXXXXXXX
  balance: { type: FieldTypes.DOUBLE, defaultValue: 0.0, validate: { min: 0 } },
  registered: { type: FieldTypes.BOOLEAN, defaultValue: false },
  green_points: { type: FieldTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 5. WalletTransaction Model
const WalletTransaction = store.define('WalletTransaction', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // GDXXXXXXXX
  type: {
    type: FieldTypes.ENUM('deposit', 'payment', 'refund', 'withdrawal', 'escrow_hold', 'escrow_release'),
    allowNull: false
  },
  description: { type: FieldTypes.STRING, allowNull: false },
  // Existing itinerary/withdrawal flows store debits as negative amounts.
  amount: { type: FieldTypes.DOUBLE, allowNull: false, validate: { minMagnitude: 0.01 } },
  status: { type: FieldTypes.ENUM('success', 'pending', 'failed'), defaultValue: 'success' },
  reference_id: { type: FieldTypes.STRING }
}, { timestamps: true });

// 6. Vender Model
const Vender = store.define('Vender', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  role: { type: FieldTypes.ENUM('provider'), defaultValue: 'provider', allowNull: false },
  registration_date: { type: FieldTypes.DATEONLY, defaultValue: FieldTypes.NOW }
}, { tableName: 'Venders', timestamps: true });


// 7. VenderContract Model
const VenderContract = store.define('VenderContract', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  name_contract: { type: FieldTypes.STRING, allowNull: false },
  text: { type: FieldTypes.TEXT, allowNull: false }
}, { timestamps: true });

// 8. Revenue Model
const Revenue = store.define('Revenue', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  monthyear: { type: FieldTypes.STRING, allowNull: false }, // MM/YYYY
  total_booking: { type: FieldTypes.INTEGER, defaultValue: 0 },
  total_revenue: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  service_fee: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  final_profit: { type: FieldTypes.DOUBLE, defaultValue: 0.0 }
}, { timestamps: true });

// 9. Contract Model
const Contract = store.define('Contract', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  name_contract: { type: FieldTypes.STRING, allowNull: false },
  text: { type: FieldTypes.TEXT, allowNull: false },
  contract_status: { type: FieldTypes.STRING, defaultValue: 'active' }
}, { timestamps: true });

// 10. Provider Model
const Provider = store.define('Provider', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  name_provider: { type: FieldTypes.STRING, allowNull: false },
  field: { type: FieldTypes.STRING },
  destination: { type: FieldTypes.STRING, allowNull: false },
  image_url: { type: FieldTypes.STRING },
  provider_status: { type: FieldTypes.ENUM('pending', 'active', 'rejected'), defaultValue: 'pending', allowNull: false }
}, { timestamps: true });

// 11. Schedule Model
const Schedule = store.define('Schedule', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  tour_name: { type: FieldTypes.STRING, allowNull: false },
  destination: { type: FieldTypes.STRING, allowNull: false },
  days: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  discount: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  carbon: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  image_url: { type: FieldTypes.STRING },
  tour_description: { type: FieldTypes.TEXT },
  votes_count: { type: FieldTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 12. BadgeSchedule Junction
const BadgeSchedule = store.define('BadgeSchedule', {}, { timestamps: true });

// 13. ScheduleSample Model
const ScheduleSample = store.define('ScheduleSample', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // ref: Schedule.id
  cost: { type: FieldTypes.DOUBLE, allowNull: false },
  old_cost: { type: FieldTypes.DOUBLE },
  rating: { type: FieldTypes.DOUBLE, defaultValue: 5.0 },
  votes_count: { type: FieldTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 14. ScheduleCustom Model
const ScheduleCustom = store.define('ScheduleCustom', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // ref: Schedule.id
  total_cost: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  status: { type: FieldTypes.ENUM('draft', 'deposited', 'cancelled'), defaultValue: 'draft', allowNull: false },
  deposit_deadline: { type: FieldTypes.DATEONLY, allowNull: true },
  start_date: { type: FieldTypes.DATEONLY, allowNull: true },
  end_date: { type: FieldTypes.DATEONLY, allowNull: true },
  companion_email: { type: FieldTypes.STRING, allowNull: true }
}, { timestamps: true });

// 15. UserSchedule Junction
const UserSchedule = store.define('UserSchedule', {}, { timestamps: true });

// 16. GreenService Model
const GreenService = store.define('GreenService', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  name_service: { type: FieldTypes.STRING, allowNull: false },
  type: { type: FieldTypes.ENUM('stay', 'food', 'transport', 'attraction', 'tour'), allowNull: false },
  cost: { type: FieldTypes.DOUBLE, allowNull: false },
  destination: { type: FieldTypes.STRING, allowNull: false },
  carbon: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  image_url: { type: FieldTypes.STRING },
  rating: { type: FieldTypes.DOUBLE, defaultValue: 5.0 },
  bookings_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  current_data: { type: FieldTypes.JSONB },
  max_capacity: { type: FieldTypes.INTEGER, defaultValue: 10 },
  status: { type: FieldTypes.STRING, defaultValue: 'active', allowNull: false },
  views_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  rejection_reason: { type: FieldTypes.TEXT }
}, { timestamps: true });

// 17. BadgeService Junction
const BadgeService = store.define('BadgeService', {}, { timestamps: true });

// 18. ServiceBooking Model (DATEONLY dates, evoucher_code, escrow_status)
const ServiceBooking = store.define('ServiceBooking', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // BKS-XXXXXXXXXX
  fullname: { type: FieldTypes.STRING, allowNull: false },
  name_service: { type: FieldTypes.STRING, allowNull: false },
  booking_date: { type: FieldTypes.DATEONLY, allowNull: false }, // DATEONLY
  guests: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  value: { type: FieldTypes.DOUBLE, allowNull: false },
  payment_method: { type: FieldTypes.ENUM('wallet', 'bank_transfer', 'card', 'counter') },
  status: { type: FieldTypes.ENUM('pending', 'deposit', 'completed', 'rejected', 'refunded'), defaultValue: 'pending', allowNull: false },
  votes_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  voucher_code: { type: FieldTypes.STRING },
  evoucher_code: { type: FieldTypes.STRING, allowNull: false },
  escrow_status: { type: FieldTypes.ENUM('none', 'holding', 'released', 'refunded'), defaultValue: 'none', allowNull: false },
  booking_status: { type: FieldTypes.STRING, defaultValue: 'new', allowNull: false },
  payment_status: { type: FieldTypes.STRING, defaultValue: 'pending', allowNull: false },
  operation_status: { type: FieldTypes.STRING, defaultValue: 'preparing', allowNull: false },
  confirm_deadline: { type: FieldTypes.DATE },
  payment_deadline: { type: FieldTypes.DATE },
  special_requests: { type: FieldTypes.TEXT },
  rejection_reason: { type: FieldTypes.TEXT },
  customer_phone: { type: FieldTypes.STRING(20) },
  customer_email: { type: FieldTypes.STRING(100) }
}, { timestamps: true });

// 19. TourBooking Model (NEW - for preset & custom tours checkouts)
const TourBooking = store.define('TourBooking', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // BKT-XXXXXXXXXX
  fullname: { type: FieldTypes.STRING, allowNull: false },
  tour_name: { type: FieldTypes.STRING, allowNull: false },
  booking_date: { type: FieldTypes.DATEONLY, allowNull: false }, // DATEONLY
  guests: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  value: { type: FieldTypes.DOUBLE, allowNull: false },
  payment_method: { type: FieldTypes.ENUM('wallet', 'bank_transfer', 'card', 'counter'), allowNull: false },
  voucher_code: { type: FieldTypes.STRING },
  evoucher_code: { type: FieldTypes.STRING, allowNull: false },
  status: { type: FieldTypes.ENUM('pending', 'deposit', 'completed', 'rejected', 'refunded'), defaultValue: 'pending', allowNull: false },
  escrow_status: { type: FieldTypes.ENUM('none', 'holding', 'released', 'refunded'), defaultValue: 'none', allowNull: false },
  booking_status: { type: FieldTypes.STRING, defaultValue: 'new', allowNull: false },
  payment_status: { type: FieldTypes.STRING, defaultValue: 'pending', allowNull: false },
  operation_status: { type: FieldTypes.STRING, defaultValue: 'preparing', allowNull: false },
  confirm_deadline: { type: FieldTypes.DATE },
  payment_deadline: { type: FieldTypes.DATE },
  special_requests: { type: FieldTypes.TEXT },
  rejection_reason: { type: FieldTypes.TEXT },
  customer_phone: { type: FieldTypes.STRING(20) },
  customer_email: { type: FieldTypes.STRING(100) }
}, { timestamps: true });

// 20. WithdrawalRequest Model (NEW - B2B withdrawal tracking)
const WithdrawalRequest = store.define('WithdrawalRequest', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // WDXXXXXXXX
  amount: { type: FieldTypes.DOUBLE, allowNull: false, validate: { min: 50000 } },
  bank_name: { type: FieldTypes.STRING, allowNull: false },
  bank_account: { type: FieldTypes.STRING, allowNull: false },
  account_holder: { type: FieldTypes.STRING, allowNull: false },
  status: { type: FieldTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending', allowNull: false }
}, { timestamps: true });

// 21. ScheduleActivity Model
const ScheduleActivity = store.define('ScheduleActivity', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  day_number: { type: FieldTypes.INTEGER, allowNull: false },
  time: { type: FieldTypes.STRING, allowNull: false },
  activity_name: { type: FieldTypes.STRING, allowNull: false },
  activity_cost: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  carbon: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  coordinates: { type: FieldTypes.STRING }, // "lat, lng"
  cost: {
    type: FieldTypes.VIRTUAL,
    get() {
      return this.getDataValue('activity_cost');
    }
  },
  type: {
    type: FieldTypes.VIRTUAL,
    get() {
      if (this.GreenService) {
        const sType = this.GreenService.type;
        return sType === 'stay' ? 'lodging' : sType === 'food' ? 'dining' : sType;
      }
      return 'attraction';
    }
  },
  icon: {
    type: FieldTypes.VIRTUAL,
    get() {
      if (this.GreenService) {
        const sType = this.GreenService.type;
        return sType === 'stay' || sType === 'lodging' ? 'bi-house-door-fill' : (sType === 'dining' || sType === 'food' ? 'bi-cup-hot-fill' : 'bi-tree-fill');
      }
      return 'bi-tree-fill';
    }
  },
  is_shared: {
    type: FieldTypes.VIRTUAL,
    get() {
      if (this.GreenService) {
        const sType = this.GreenService.type;
        return (sType === 'stay' || sType === 'lodging' || sType === 'transport');
      }
      return false;
    }
  }
}, { tableName: 'ScheduleActivities', timestamps: true });

// 22. AdCampaign Model (DATE start_date, end_date)
const AdCampaign = store.define('AdCampaign', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // ADCXXXXXXXX
  campaigns_type: { type: FieldTypes.STRING, allowNull: false }, // e.g. top_recommend, flash_sale
  campaigns_name: { type: FieldTypes.STRING, allowNull: false },
  campaigns_cost: { type: FieldTypes.DOUBLE, allowNull: false },
  duration_days: { type: FieldTypes.INTEGER, allowNull: false },
  start_date: { type: FieldTypes.DATEONLY, allowNull: false }, // DATEONLY
  end_date: { type: FieldTypes.DATEONLY, allowNull: false }, // DATEONLY
  status: { type: FieldTypes.ENUM('active', 'expired', 'paused'), defaultValue: 'active', allowNull: false },
  discount_percent: { type: FieldTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 23. CommunityPost Model
const CommunityPost = store.define('CommunityPost', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // CUPtraXXXXXXXX
  rating: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  post_type: { type: FieldTypes.ENUM('post', 'reel', 'question'), defaultValue: 'post', allowNull: false },
  text: { type: FieldTypes.TEXT, allowNull: false },
  tour_name: { type: FieldTypes.STRING },
  destination: { type: FieldTypes.STRING },
  location: { type: FieldTypes.STRING },
  hashtags: { type: FieldTypes.JSONB, defaultValue: [] },
  image_urls: { type: FieldTypes.JSONB, defaultValue: [] },
  image_url: { type: FieldTypes.TEXT },
  video_url: { type: FieldTypes.TEXT },
  tour_description: { type: FieldTypes.TEXT },
  days: { type: FieldTypes.INTEGER },
  likes_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  comments_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  shares_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  saved_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  current_data: { type: FieldTypes.JSONB },
  itinerary_id: { type: FieldTypes.STRING, allowNull: true },
  challenge_id: { type: FieldTypes.STRING, allowNull: true }
}, { timestamps: true });

// 24. CommentPost Model
const CommentPost = store.define('CommentPost', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // CEPtraXXXXXXXX
  rating: { type: FieldTypes.INTEGER }, // 1-5, nullable (replies don't have stars)
  text: { type: FieldTypes.TEXT, allowNull: false },
  image_url: { type: FieldTypes.TEXT },
  tour_id: { type: FieldTypes.STRING, allowNull: true },
  service_id: { type: FieldTypes.STRING, allowNull: true },
  parent_comment_id: { type: FieldTypes.STRING, allowNull: true },
  likes_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  helpful_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  helpful_by: { type: FieldTypes.JSONB, defaultValue: [] },
  is_helpful: { type: FieldTypes.BOOLEAN, defaultValue: false },
  booking_id: { type: FieldTypes.STRING, allowNull: true },
  is_reported: { type: FieldTypes.BOOLEAN, defaultValue: false, allowNull: false },
  report_reason: { type: FieldTypes.TEXT },
  internal_notes: { type: FieldTypes.TEXT }
}, { timestamps: true });

const SavedCommunityItem = store.define('SavedCommunityItem', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  item_type: { type: FieldTypes.ENUM('post', 'itinerary'), allowNull: false },
  item_id: { type: FieldTypes.STRING, allowNull: false },
  source_post_id: { type: FieldTypes.STRING }
}, { tableName: 'saved_community_items', timestamps: true });

const CommunityChallenge = store.define('CommunityChallenge', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  title: { type: FieldTypes.STRING, allowNull: false },
  description: { type: FieldTypes.TEXT, allowNull: false },
  hashtag: { type: FieldTypes.STRING, allowNull: false },
  points: { type: FieldTypes.INTEGER, allowNull: false, defaultValue: 100 },
  badge_name: { type: FieldTypes.STRING, allowNull: false },
  image_url: { type: FieldTypes.TEXT },
  starts_at: { type: FieldTypes.DATE, allowNull: false },
  ends_at: { type: FieldTypes.DATE, allowNull: false }
}, { tableName: 'community_challenges', timestamps: true });

const CommunityChallengeEntry = store.define('CommunityChallengeEntry', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  challenge_id: { type: FieldTypes.STRING, allowNull: false },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  post_id: { type: FieldTypes.STRING, allowNull: false },
  points: { type: FieldTypes.INTEGER, allowNull: false }
}, { tableName: 'community_challenge_entries', timestamps: true });

// 25. CPSS Junction
const CPSS = store.define('CPSS', {}, { timestamps: true });

// 26. CPGS Junction
const CPGS = store.define('CPGS', {}, { tableName: 'CPGs', timestamps: true });

// 27. Voucher Model
const Voucher = store.define('Voucher', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  code: { type: FieldTypes.STRING, unique: true, allowNull: false },
  discount_percent: { type: FieldTypes.INTEGER, defaultValue: 10 },
  status: { type: FieldTypes.ENUM('active', 'used', 'expired'), defaultValue: 'active', allowNull: false }
}, { timestamps: true });

// 28. FAQ Model
const FAQ = store.define('FAQ', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  question: { type: FieldTypes.STRING, allowNull: false },
  answer: { type: FieldTypes.TEXT, allowNull: false }
}, { timestamps: true });

// 29. ChangeRequest Model
const ChangeRequest = store.define('ChangeRequest', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  booking_id: { type: FieldTypes.STRING, allowNull: false },
  booking_type: { type: FieldTypes.ENUM('service', 'tour'), defaultValue: 'service' },
  type: {
    type: FieldTypes.ENUM('date_change', 'time_change', 'guests_change', 'info_change', 'package_change', 'add_service', 'cancel_booking', 'refund'),
    allowNull: false
  },
  old_content: { type: FieldTypes.JSONB },
  new_content: { type: FieldTypes.JSONB },
  status: {
    type: FieldTypes.ENUM('pending', 'checking', 'pending_customer_confirm', 'pending_additional_payment', 'pending_refund', 'accepted', 'rejected', 'completed'),
    defaultValue: 'pending'
  },
  rejection_reason: { type: FieldTypes.TEXT },
  price_diff: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  notes: { type: FieldTypes.TEXT }
}, { tableName: 'change_requests', timestamps: true });

// 30. OperationsAssignment Model
const OperationsAssignment = store.define('OperationsAssignment', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  booking_id: { type: FieldTypes.STRING, allowNull: false },
  booking_type: { type: FieldTypes.ENUM('service', 'tour'), defaultValue: 'service' },
  assigned_staff: { type: FieldTypes.STRING }, // Tên nhân viên/hướng dẫn viên
  assigned_vehicle: { type: FieldTypes.STRING }, // Thông tin xe/phương tiện
  checklist: { type: FieldTypes.JSONB }, // Danh sách đầu việc cần chuẩn bị
  status: { type: FieldTypes.ENUM('preparing', 'ongoing', 'completed', 'incident'), defaultValue: 'preparing' },
  incidents: { type: FieldTypes.TEXT }, // Nhật ký sự cố nếu có
  notes: { type: FieldTypes.TEXT }
}, { tableName: 'operations_assignments', timestamps: true });

// 31. Notification Model
const Notification = store.define('Notification', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // 'notif_' + timestamp + random
  user_id: { type: FieldTypes.STRING, allowNull: false },
  title: { type: FieldTypes.STRING, allowNull: false },
  message: { type: FieldTypes.TEXT, allowNull: false },
  type: {
    type: FieldTypes.ENUM('system', 'community', 'booking', 'wallet'),
    defaultValue: 'system',
    allowNull: false
  },
  read: { type: FieldTypes.BOOLEAN, defaultValue: false, allowNull: false }
}, { timestamps: true });


// ==========================================
// RELATIONSHIPS & ASSOCIATIONS WITH CASCADE
// ==========================================

// User <-> Notification
User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// User <-> Auth OTP
User.hasMany(AuthOtp, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AuthOtp.belongsTo(User, { foreignKey: 'user_id' });

// Badge <-> User
User.belongsToMany(Badge, { through: BadgeUser, foreignKey: 'user_id', otherKey: 'badge_name', onDelete: 'CASCADE' });
Badge.belongsToMany(User, { through: BadgeUser, foreignKey: 'badge_name', otherKey: 'user_id', onDelete: 'CASCADE' });

// Wallet <-> User
User.hasOne(Wallet, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Wallet.belongsTo(User, { foreignKey: 'user_id' });

// WalletTransaction <-> Wallet
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', onDelete: 'CASCADE' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id' });

// Vender <-> User
User.hasOne(Vender, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Vender.belongsTo(User, { foreignKey: 'user_id' });

// VenderContract <-> User
User.hasMany(VenderContract, { foreignKey: 'user_id', onDelete: 'CASCADE' });
VenderContract.belongsTo(User, { foreignKey: 'user_id' });

// Revenue <-> User
User.hasMany(Revenue, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Revenue.belongsTo(User, { foreignKey: 'user_id' });

// Provider <-> Contract
Contract.hasMany(Provider, { foreignKey: 'contract_id', onDelete: 'RESTRICT' });
Provider.belongsTo(Contract, { foreignKey: 'contract_id' });

// Badge <-> Schedule
Schedule.belongsToMany(Badge, { through: BadgeSchedule, foreignKey: 'schedule_id', otherKey: 'badge_name', onDelete: 'CASCADE' });
Badge.belongsToMany(Schedule, { through: BadgeSchedule, foreignKey: 'badge_name', otherKey: 'schedule_id', onDelete: 'CASCADE' });

// ScheduleSample <-> Schedule
Schedule.hasOne(ScheduleSample, { foreignKey: 'id', onDelete: 'CASCADE' });
ScheduleSample.belongsTo(Schedule, { foreignKey: 'id' });

// ScheduleSample <-> Provider
Provider.hasMany(ScheduleSample, { foreignKey: 'provider_id', onDelete: 'RESTRICT' });
ScheduleSample.belongsTo(Provider, { foreignKey: 'provider_id' });

// ScheduleCustom <-> Schedule
Schedule.hasOne(ScheduleCustom, { foreignKey: 'id', onDelete: 'CASCADE' });
ScheduleCustom.belongsTo(Schedule, { foreignKey: 'id' });

// ScheduleCustom <-> User
User.hasMany(ScheduleCustom, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ScheduleCustom.belongsTo(User, { foreignKey: 'user_id' });

// User <-> Schedule (Junction)
User.belongsToMany(Schedule, { through: UserSchedule, foreignKey: 'user_id', otherKey: 'schedule_id', onDelete: 'CASCADE' });
Schedule.belongsToMany(User, { through: UserSchedule, foreignKey: 'schedule_id', otherKey: 'user_id', onDelete: 'CASCADE' });

// GreenService <-> Vender
Vender.hasMany(GreenService, { foreignKey: 'vender_id', onDelete: 'CASCADE' });
GreenService.belongsTo(Vender, { foreignKey: 'vender_id' });

// Badge <-> GreenService
GreenService.belongsToMany(Badge, { through: BadgeService, foreignKey: 'service_id', otherKey: 'badge_name', onDelete: 'CASCADE' });
Badge.belongsToMany(GreenService, { through: BadgeService, foreignKey: 'badge_name', otherKey: 'service_id', onDelete: 'CASCADE' });

// ServiceBooking <-> User
User.hasMany(ServiceBooking, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ServiceBooking.belongsTo(User, { foreignKey: 'user_id' });

// ServiceBooking <-> GreenService
GreenService.hasMany(ServiceBooking, { foreignKey: 'service_id', onDelete: 'RESTRICT' });
ServiceBooking.belongsTo(GreenService, { foreignKey: 'service_id' });

// TourBooking <-> User
User.hasMany(TourBooking, { foreignKey: 'user_id', onDelete: 'CASCADE' });
TourBooking.belongsTo(User, { foreignKey: 'user_id' });

// TourBooking <-> Schedule
Schedule.hasMany(TourBooking, { foreignKey: 'schedule_id', onDelete: 'RESTRICT' });
TourBooking.belongsTo(Schedule, { foreignKey: 'schedule_id' });

// WithdrawalRequest <-> User (Provider)
User.hasMany(WithdrawalRequest, { foreignKey: 'user_id', onDelete: 'CASCADE' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'user_id' });

// ScheduleActivity <-> Schedule
Schedule.hasMany(ScheduleActivity, { foreignKey: 'schedule_id', onDelete: 'CASCADE' });
ScheduleActivity.belongsTo(Schedule, { foreignKey: 'schedule_id' });

// ScheduleActivity <-> GreenService
GreenService.hasMany(ScheduleActivity, { foreignKey: 'service_id', onDelete: 'SET NULL' });
ScheduleActivity.belongsTo(GreenService, { foreignKey: 'service_id' });

// AdCampaign <-> User
User.hasMany(AdCampaign, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AdCampaign.belongsTo(User, { foreignKey: 'user_id' });

// AdCampaign <-> GreenService
GreenService.hasMany(AdCampaign, { foreignKey: 'service_id', onDelete: 'CASCADE' });
AdCampaign.belongsTo(GreenService, { foreignKey: 'service_id' });

// CommunityPost <-> User
User.hasMany(CommunityPost, { foreignKey: 'user_id', onDelete: 'CASCADE' });
CommunityPost.belongsTo(User, { foreignKey: 'user_id' });

// CommentPost <-> User
User.hasMany(CommentPost, { foreignKey: 'user_id', onDelete: 'CASCADE' });
CommentPost.belongsTo(User, { foreignKey: 'user_id' });

// CommentPost <-> CommunityPost
CommunityPost.hasMany(CommentPost, { foreignKey: 'post_id', onDelete: 'CASCADE' });
CommentPost.belongsTo(CommunityPost, { foreignKey: 'post_id' });

// CommentPost <-> CommentPost (Self-referencing parent-child for replies)
CommentPost.hasMany(CommentPost, { as: 'Replies', foreignKey: 'parent_comment_id', onDelete: 'CASCADE' });
CommentPost.belongsTo(CommentPost, { as: 'Parent', foreignKey: 'parent_comment_id' });

// CommentPost <-> ScheduleSample (CPSS Junction)
CommentPost.belongsToMany(ScheduleSample, { through: CPSS, foreignKey: 'comment_id', otherKey: 'schedule_sample_id', onDelete: 'CASCADE' });
ScheduleSample.belongsToMany(CommentPost, { through: CPSS, foreignKey: 'schedule_sample_id', otherKey: 'comment_id', onDelete: 'CASCADE' });

// CommentPost <-> GreenService (CPGS Junction)
CommentPost.belongsToMany(GreenService, { through: CPGS, foreignKey: 'comment_id', otherKey: 'service_id', onDelete: 'CASCADE' });
GreenService.belongsToMany(CommentPost, { through: CPGS, foreignKey: 'service_id', otherKey: 'comment_id', onDelete: 'CASCADE' });

// User <-> Voucher
User.hasMany(Voucher, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Voucher.belongsTo(User, { foreignKey: 'user_id' });


// ==========================================
// DATABASE HOOKS (AUTOMATIC RATINGS SYNC)
// ==========================================

const updateTargetRating = async (targetId, type, storeInstance, options) => {
  try {
    const stats = await storeInstance.models.CommentPost.ratingStats({
      [type === 'tour' ? 'tour_id' : 'service_id']: targetId,
      rating: { [Op.ne]: null }
    }, options);

    const avgRating = stats[0]?.dataValues?.avgRating
      ? parseFloat(parseFloat(stats[0].dataValues.avgRating).toFixed(1))
      : 5.0;
    const votesCount = parseInt(stats[0]?.dataValues?.votesCount || 0);

    if (type === 'tour') {
      await storeInstance.models.ScheduleSample.update(
        { rating: avgRating, votes_count: votesCount },
        { where: { id: targetId }, transaction: options?.transaction }
      );
    } else if (type === 'service') {
      await storeInstance.models.GreenService.update(
        { rating: avgRating, bookings_count: votesCount }, // synchronize bookings_count with rating reviews count
        { where: { id: targetId }, transaction: options?.transaction }
      );
    }
  } catch (err) {
    console.error('Error in updateTargetRating hook:', err);
    throw err;
  }
};

CommentPost.addHook('afterCreate', async (comment, options) => {
  if (comment.tour_id) {
    await updateTargetRating(comment.tour_id, 'tour', comment.store, options);
  }
  if (comment.service_id) {
    await updateTargetRating(comment.service_id, 'service', comment.store, options);
  }
});

CommentPost.addHook('afterDestroy', async (comment, options) => {
  if (comment.tour_id) {
    await updateTargetRating(comment.tour_id, 'tour', comment.store, options);
  }
  if (comment.service_id) {
    await updateTargetRating(comment.service_id, 'service', comment.store, options);
  }
});

// Default scope to eager load GreenService for dynamic virtual field evaluation
ScheduleActivity.addScope('defaultScope', {
  include: [{ model: GreenService, required: false }]
}, { override: true });

module.exports = {
  store,
  User,
  AuthOtp,
  PendingRegistration,
  Badge,
  BadgeUser,
  Wallet,
  WalletTransaction,
  Vender,
  VenderContract,
  Revenue,
  Contract,
  Provider,
  Schedule,
  BadgeSchedule,
  ScheduleSample,
  ScheduleCustom,
  UserSchedule,
  GreenService,
  BadgeService,
  ServiceBooking,
  TourBooking,
  WithdrawalRequest,
  ScheduleActivity,
  AdCampaign,
  CommunityPost,
  CommentPost,
  SavedCommunityItem,
  CommunityChallenge,
  CommunityChallengeEntry,
  CPSS,
  CPGS,
  Voucher,
  FAQ,
  Notification,
  ChangeRequest,
  OperationsAssignment
};
