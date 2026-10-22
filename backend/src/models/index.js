const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/db.config');

// 1. User Model (DATEONLY dob, Enum gender, last_interest)
const User = sequelize.define('User', {
  id: { type: DataTypes.STRING, primaryKey: true },
  role: { type: DataTypes.ENUM('traveler', 'provider', 'admin'), defaultValue: 'traveler', allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  fullname: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  phone: { type: DataTypes.STRING },
  is_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  dob: { type: DataTypes.DATEONLY }, // DATEONLY
  gender: { type: DataTypes.ENUM('Nam', 'Nữ', 'Khác'), defaultValue: 'Khác' }, // ENUM
  address: { type: DataTypes.STRING },
  job: { type: DataTypes.STRING },
  last_interest: { type: DataTypes.STRING }, // user's last interested destination slug
  company_name: { type: DataTypes.STRING },
  avatarUrl: { type: DataTypes.TEXT }
}, { timestamps: true });

const AuthOtp = sequelize.define('AuthOtp', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  purpose: { type: DataTypes.ENUM('REGISTER', 'RESET_PASSWORD'), allowNull: false },
  otp_hash: { type: DataTypes.STRING, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  consumed_at: { type: DataTypes.DATE },
  attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resend_available_at: { type: DataTypes.DATE, allowNull: false },
  reset_token_hash: { type: DataTypes.STRING },
  reset_token_expires_at: { type: DataTypes.DATE },
  reset_token_consumed_at: { type: DataTypes.DATE }
}, {
  tableName: 'auth_otps',
  underscored: true,
  timestamps: true
});

const PendingRegistration = sequelize.define('PendingRegistration', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  otp_hash: { type: DataTypes.STRING, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  consumed_at: { type: DataTypes.DATE },
  attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resend_available_at: { type: DataTypes.DATE, allowNull: false }
}, {
  tableName: 'pending_registrations',
  underscored: true,
  timestamps: true
});

// 2. Badge Model
const Badge = sequelize.define('Badge', {
  id: { type: DataTypes.STRING, primaryKey: true }, // badge name
  badges_description: { type: DataTypes.STRING },
  foruserortour: { type: DataTypes.INTEGER, allowNull: false } // 0: user, 1: tour
}, { timestamps: true });

// 3. BadgeUser Junction Model
const BadgeUser = sequelize.define('BadgeUser', {}, { timestamps: true });

// 4. Wallet Model
const Wallet = sequelize.define('Wallet', {
  id: { type: DataTypes.STRING, primaryKey: true }, // EWXXXXXXXX
  balance: { type: DataTypes.DOUBLE, defaultValue: 0.0, validate: { min: 0 } },
  registered: { type: DataTypes.BOOLEAN, defaultValue: false },
  green_points: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 5. WalletTransaction Model
const WalletTransaction = sequelize.define('WalletTransaction', {
  id: { type: DataTypes.STRING, primaryKey: true }, // GDXXXXXXXX
  type: { 
    type: DataTypes.ENUM('deposit', 'payment', 'refund', 'withdrawal', 'escrow_hold', 'escrow_release'), 
    allowNull: false 
  },
  description: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DOUBLE, allowNull: false, validate: { min: 0.01 } },
  status: { type: DataTypes.ENUM('success', 'pending', 'failed'), defaultValue: 'success' },
  reference_id: { type: DataTypes.STRING }
}, { timestamps: true });

// 6. Vender Model
const Vender = sequelize.define('Vender', {
  id: { type: DataTypes.STRING, primaryKey: true },
  role: { type: DataTypes.ENUM('provider'), defaultValue: 'provider', allowNull: false },
  registration_date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW }
}, { tableName: 'Venders', timestamps: true });


// 7. VenderContract Model
const VenderContract = sequelize.define('VenderContract', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name_contract: { type: DataTypes.STRING, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false }
}, { timestamps: true });

// 8. Revenue Model
const Revenue = sequelize.define('Revenue', {
  id: { type: DataTypes.STRING, primaryKey: true },
  monthyear: { type: DataTypes.STRING, allowNull: false }, // MM/YYYY
  total_booking: { type: DataTypes.INTEGER, defaultValue: 0 },
  total_revenue: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  service_fee: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  final_profit: { type: DataTypes.DOUBLE, defaultValue: 0.0 }
}, { timestamps: true });

// 9. Contract Model
const Contract = sequelize.define('Contract', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name_contract: { type: DataTypes.STRING, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  contract_status: { type: DataTypes.STRING, defaultValue: 'active' }
}, { timestamps: true });

// 10. Provider Model
const Provider = sequelize.define('Provider', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name_provider: { type: DataTypes.STRING, allowNull: false },
  field: { type: DataTypes.STRING },
  destination: { type: DataTypes.STRING, allowNull: false },
  image_url: { type: DataTypes.STRING },
  provider_status: { type: DataTypes.ENUM('pending', 'active', 'rejected'), defaultValue: 'pending', allowNull: false }
}, { timestamps: true });

// 11. Schedule Model
const Schedule = sequelize.define('Schedule', {
  id: { type: DataTypes.STRING, primaryKey: true },
  tour_name: { type: DataTypes.STRING, allowNull: false },
  destination: { type: DataTypes.STRING, allowNull: false },
  days: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  discount: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  carbon: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  image_url: { type: DataTypes.STRING },
  tour_description: { type: DataTypes.TEXT },
  votes_count: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 12. BadgeSchedule Junction
const BadgeSchedule = sequelize.define('BadgeSchedule', {}, { timestamps: true });

// 13. ScheduleSample Model
const ScheduleSample = sequelize.define('ScheduleSample', {
  id: { type: DataTypes.STRING, primaryKey: true }, // ref: Schedule.id
  cost: { type: DataTypes.DOUBLE, allowNull: false },
  old_cost: { type: DataTypes.DOUBLE },
  rating: { type: DataTypes.DOUBLE, defaultValue: 5.0 },
  votes_count: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 14. ScheduleCustom Model
const ScheduleCustom = sequelize.define('ScheduleCustom', {
  id: { type: DataTypes.STRING, primaryKey: true }, // ref: Schedule.id
  total_cost: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  status: { type: DataTypes.ENUM('draft', 'deposited', 'cancelled'), defaultValue: 'draft', allowNull: false },
  deposit_deadline: { type: DataTypes.DATEONLY, allowNull: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: true },
  end_date: { type: DataTypes.DATEONLY, allowNull: true },
  companion_email: { type: DataTypes.STRING, allowNull: true }
}, { timestamps: true });

// 15. UserSchedule Junction
const UserSchedule = sequelize.define('UserSchedule', {}, { timestamps: true });

// 16. GreenService Model
const GreenService = sequelize.define('GreenService', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name_service: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('stay', 'food', 'transport', 'attraction', 'tour'), allowNull: false },
  cost: { type: DataTypes.DOUBLE, allowNull: false },
  destination: { type: DataTypes.STRING, allowNull: false },
  carbon: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  image_url: { type: DataTypes.STRING },
  rating: { type: DataTypes.DOUBLE, defaultValue: 5.0 },
  bookings_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  current_data: { type: DataTypes.JSONB },
  max_capacity: { type: DataTypes.INTEGER, defaultValue: 10 },
  status: { type: DataTypes.STRING, defaultValue: 'active', allowNull: false },
  views_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  rejection_reason: { type: DataTypes.TEXT }
}, { timestamps: true });

// 17. BadgeService Junction
const BadgeService = sequelize.define('BadgeService', {}, { timestamps: true });

// 18. ServiceBooking Model (DATEONLY dates, evoucher_code, escrow_status)
const ServiceBooking = sequelize.define('ServiceBooking', {
  id: { type: DataTypes.STRING, primaryKey: true }, // BKS-XXXXXXXXXX
  fullname: { type: DataTypes.STRING, allowNull: false },
  name_service: { type: DataTypes.STRING, allowNull: false },
  booking_date: { type: DataTypes.DATEONLY, allowNull: false }, // DATEONLY
  guests: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  value: { type: DataTypes.DOUBLE, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'deposit', 'completed', 'rejected', 'refunded'), defaultValue: 'pending', allowNull: false },
  votes_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  voucher_code: { type: DataTypes.STRING },
  evoucher_code: { type: DataTypes.STRING, allowNull: false },
  escrow_status: { type: DataTypes.ENUM('none', 'holding', 'released', 'refunded'), defaultValue: 'none', allowNull: false },
  booking_status: { type: DataTypes.STRING, defaultValue: 'new', allowNull: false },
  payment_status: { type: DataTypes.STRING, defaultValue: 'pending', allowNull: false },
  operation_status: { type: DataTypes.STRING, defaultValue: 'preparing', allowNull: false },
  confirm_deadline: { type: DataTypes.DATE },
  payment_deadline: { type: DataTypes.DATE },
  special_requests: { type: DataTypes.TEXT },
  rejection_reason: { type: DataTypes.TEXT },
  customer_phone: { type: DataTypes.STRING(20) },
  customer_email: { type: DataTypes.STRING(100) }
}, { timestamps: true });

// 19. TourBooking Model (NEW - for preset & custom tours checkouts)
const TourBooking = sequelize.define('TourBooking', {
  id: { type: DataTypes.STRING, primaryKey: true }, // BKT-XXXXXXXXXX
  fullname: { type: DataTypes.STRING, allowNull: false },
  tour_name: { type: DataTypes.STRING, allowNull: false },
  booking_date: { type: DataTypes.DATEONLY, allowNull: false }, // DATEONLY
  guests: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  value: { type: DataTypes.DOUBLE, allowNull: false },
  payment_method: { type: DataTypes.ENUM('wallet', 'bank_transfer', 'card'), allowNull: false },
  voucher_code: { type: DataTypes.STRING },
  evoucher_code: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'deposit', 'completed', 'rejected', 'refunded'), defaultValue: 'pending', allowNull: false },
  escrow_status: { type: DataTypes.ENUM('none', 'holding', 'released', 'refunded'), defaultValue: 'none', allowNull: false },
  booking_status: { type: DataTypes.STRING, defaultValue: 'new', allowNull: false },
  payment_status: { type: DataTypes.STRING, defaultValue: 'pending', allowNull: false },
  operation_status: { type: DataTypes.STRING, defaultValue: 'preparing', allowNull: false },
  confirm_deadline: { type: DataTypes.DATE },
  payment_deadline: { type: DataTypes.DATE },
  special_requests: { type: DataTypes.TEXT },
  rejection_reason: { type: DataTypes.TEXT },
  customer_phone: { type: DataTypes.STRING(20) },
  customer_email: { type: DataTypes.STRING(100) }
}, { timestamps: true });

// 20. WithdrawalRequest Model (NEW - B2B withdrawal tracking)
const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
  id: { type: DataTypes.STRING, primaryKey: true }, // WDXXXXXXXX
  amount: { type: DataTypes.DOUBLE, allowNull: false, validate: { min: 50000 } },
  bank_name: { type: DataTypes.STRING, allowNull: false },
  bank_account: { type: DataTypes.STRING, allowNull: false },
  account_holder: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending', allowNull: false }
}, { timestamps: true });

// 21. ScheduleActivity Model
const ScheduleActivity = sequelize.define('ScheduleActivity', {
  id: { type: DataTypes.STRING, primaryKey: true },
  day_number: { type: DataTypes.INTEGER, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: false },
  activity_name: { type: DataTypes.STRING, allowNull: false },
  activity_cost: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  carbon: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  coordinates: { type: DataTypes.STRING }, // "lat, lng"
  cost: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('activity_cost');
    }
  },
  type: {
    type: DataTypes.VIRTUAL,
    get() {
      if (this.GreenService) {
        const sType = this.GreenService.type;
        return sType === 'stay' ? 'lodging' : sType === 'food' ? 'dining' : sType;
      }
      return 'attraction';
    }
  },
  icon: {
    type: DataTypes.VIRTUAL,
    get() {
      if (this.GreenService) {
        const sType = this.GreenService.type;
        return sType === 'stay' || sType === 'lodging' ? 'bi-house-door-fill' : (sType === 'dining' || sType === 'food' ? 'bi-cup-hot-fill' : 'bi-tree-fill');
      }
      return 'bi-tree-fill';
    }
  },
  is_shared: {
    type: DataTypes.VIRTUAL,
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
const AdCampaign = sequelize.define('AdCampaign', {
  id: { type: DataTypes.STRING, primaryKey: true }, // ADCXXXXXXXX
  campaigns_type: { type: DataTypes.STRING, allowNull: false }, // e.g. top_recommend, flash_sale
  campaigns_name: { type: DataTypes.STRING, allowNull: false },
  campaigns_cost: { type: DataTypes.DOUBLE, allowNull: false },
  duration_days: { type: DataTypes.INTEGER, allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false }, // DATEONLY
  end_date: { type: DataTypes.DATEONLY, allowNull: false }, // DATEONLY
  status: { type: DataTypes.ENUM('active', 'expired', 'paused'), defaultValue: 'active', allowNull: false },
  discount_percent: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

// 23. CommunityPost Model
const CommunityPost = sequelize.define('CommunityPost', {
  id: { type: DataTypes.STRING, primaryKey: true }, // CUPtraXXXXXXXX
  rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  text: { type: DataTypes.TEXT, allowNull: false },
  tour_name: { type: DataTypes.STRING },
  destination: { type: DataTypes.STRING },
  image_url: { type: DataTypes.TEXT },
  tour_description: { type: DataTypes.TEXT },
  days: { type: DataTypes.INTEGER },
  likes_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  comments_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  current_data: { type: DataTypes.JSONB },
  itinerary_id: { type: DataTypes.STRING, allowNull: true }
}, { timestamps: true });

// 24. CommentPost Model
const CommentPost = sequelize.define('CommentPost', {
  id: { type: DataTypes.STRING, primaryKey: true }, // CEPtraXXXXXXXX
  rating: { type: DataTypes.INTEGER }, // 1-5, nullable (replies don't have stars)
  text: { type: DataTypes.TEXT, allowNull: false },
  image_url: { type: DataTypes.TEXT },
  tour_id: { type: DataTypes.STRING, allowNull: true },
  service_id: { type: DataTypes.STRING, allowNull: true },
  parent_comment_id: { type: DataTypes.STRING, allowNull: true },
  likes_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  booking_id: { type: DataTypes.STRING, allowNull: true },
  is_reported: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  report_reason: { type: DataTypes.TEXT },
  internal_notes: { type: DataTypes.TEXT }
}, { timestamps: true });

// 25. CPSS Junction
const CPSS = sequelize.define('CPSS', {}, { timestamps: true });

// 26. CPGS Junction
const CPGS = sequelize.define('CPGS', {}, { timestamps: true });

// 27. Voucher Model
const Voucher = sequelize.define('Voucher', {
  id: { type: DataTypes.STRING, primaryKey: true },
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  discount_percent: { type: DataTypes.INTEGER, defaultValue: 10 },
  status: { type: DataTypes.ENUM('active', 'used', 'expired'), defaultValue: 'active', allowNull: false }
}, { timestamps: true });

// 28. FAQ Model
const FAQ = sequelize.define('FAQ', {
  id: { type: DataTypes.STRING, primaryKey: true },
  question: { type: DataTypes.STRING, allowNull: false },
  answer: { type: DataTypes.TEXT, allowNull: false }
}, { timestamps: true });

// 29. ChangeRequest Model
const ChangeRequest = sequelize.define('ChangeRequest', {
  id: { type: DataTypes.STRING, primaryKey: true },
  booking_id: { type: DataTypes.STRING, allowNull: false },
  booking_type: { type: DataTypes.ENUM('service', 'tour'), defaultValue: 'service' },
  type: { 
    type: DataTypes.ENUM('date_change', 'time_change', 'guests_change', 'info_change', 'package_change', 'add_service', 'cancel_booking', 'refund'), 
    allowNull: false 
  },
  old_content: { type: DataTypes.JSONB },
  new_content: { type: DataTypes.JSONB },
  status: { 
    type: DataTypes.ENUM('pending', 'checking', 'pending_customer_confirm', 'pending_additional_payment', 'pending_refund', 'accepted', 'rejected', 'completed'), 
    defaultValue: 'pending' 
  },
  rejection_reason: { type: DataTypes.TEXT },
  price_diff: { type: DataTypes.DOUBLE, defaultValue: 0.0 },
  notes: { type: DataTypes.TEXT }
}, { tableName: 'change_requests', timestamps: true });

// 30. OperationsAssignment Model
const OperationsAssignment = sequelize.define('OperationsAssignment', {
  id: { type: DataTypes.STRING, primaryKey: true },
  booking_id: { type: DataTypes.STRING, allowNull: false },
  booking_type: { type: DataTypes.ENUM('service', 'tour'), defaultValue: 'service' },
  assigned_staff: { type: DataTypes.STRING }, // Tên nhân viên/hướng dẫn viên
  assigned_vehicle: { type: DataTypes.STRING }, // Thông tin xe/phương tiện
  checklist: { type: DataTypes.JSONB }, // Danh sách đầu việc cần chuẩn bị
  status: { type: DataTypes.ENUM('preparing', 'ongoing', 'completed', 'incident'), defaultValue: 'preparing' },
  incidents: { type: DataTypes.TEXT }, // Nhật ký sự cố nếu có
  notes: { type: DataTypes.TEXT }
}, { tableName: 'operations_assignments', timestamps: true });

// 31. Notification Model
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.STRING, primaryKey: true }, // 'notif_' + timestamp + random
  user_id: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { 
    type: DataTypes.ENUM('system', 'community', 'booking', 'wallet'), 
    defaultValue: 'system', 
    allowNull: false 
  },
  read: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false }
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

const updateTargetRating = async (targetId, type, sequelizeInstance) => {
  try {
    const stats = await sequelizeInstance.models.CommentPost.findAll({
      attributes: [
        [sequelizeInstance.fn('AVG', sequelizeInstance.col('rating')), 'avgRating'],
        [sequelizeInstance.fn('COUNT', sequelizeInstance.col('id')), 'votesCount']
      ],
      where: { 
        [type === 'tour' ? 'tour_id' : 'service_id']: targetId,
        rating: { [Op.ne]: null } // only average reviews with ratings (exclude text replies)
      }
    });

    const avgRating = stats[0]?.dataValues?.avgRating 
      ? parseFloat(parseFloat(stats[0].dataValues.avgRating).toFixed(1)) 
      : 5.0;
    const votesCount = parseInt(stats[0]?.dataValues?.votesCount || 0);

    if (type === 'tour') {
      await sequelizeInstance.models.ScheduleSample.update(
        { rating: avgRating, votes_count: votesCount },
        { where: { id: targetId } }
      );
    } else if (type === 'service') {
      await sequelizeInstance.models.GreenService.update(
        { rating: avgRating, bookings_count: votesCount }, // synchronize bookings_count with rating reviews count
        { where: { id: targetId } }
      );
    }
  } catch (err) {
    console.error('Error in updateTargetRating hook:', err);
  }
};

CommentPost.addHook('afterCreate', async (comment, options) => {
  if (comment.tour_id) {
    await updateTargetRating(comment.tour_id, 'tour', comment.sequelize);
  }
  if (comment.service_id) {
    await updateTargetRating(comment.service_id, 'service', comment.sequelize);
  }
});

CommentPost.addHook('afterDestroy', async (comment, options) => {
  if (comment.tour_id) {
    await updateTargetRating(comment.tour_id, 'tour', comment.sequelize);
  }
  if (comment.service_id) {
    await updateTargetRating(comment.service_id, 'service', comment.sequelize);
  }
});

// Default scope to eager load GreenService for dynamic virtual field evaluation
ScheduleActivity.addScope('defaultScope', {
  include: [{ model: GreenService, required: false }]
}, { override: true });

module.exports = {
  sequelize,
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
  CPSS,
  CPGS,
  Voucher,
  FAQ,
  Notification,
  ChangeRequest,
  OperationsAssignment
};
