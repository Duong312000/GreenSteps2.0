const { FieldTypes, Op } = require('../db/mongo-store');
const { store } = require('../config/db.config');

// 1. User Model (DATEONLY dob, Enum gender, last_interest)
const User = store.define('User', {
  facebook_id: { type: FieldTypes.STRING, unique: true, allowNull: true },
  id: { type: FieldTypes.STRING, primaryKey: true },
  role: { type: FieldTypes.ENUM('traveler', 'provider', 'admin'), defaultValue: 'traveler', allowNull: false },
  username: { type: FieldTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: FieldTypes.STRING, allowNull: false },
  auth_methods: { type: FieldTypes.JSONB, defaultValue: [] },
  password_policy_checked_at: { type: FieldTypes.DATE },
  password_changed_at: { type: FieldTypes.DATE },
  totp_enabled_at: { type: FieldTypes.DATE },
  totp_secret_encrypted: { type: FieldTypes.TEXT },
  totp_last_verified_step: { type: FieldTypes.INTEGER },
  recovery_code_hashes: { type: FieldTypes.JSONB, defaultValue: [] },
  security_email_notifications: { type: FieldTypes.BOOLEAN },
  recovery_phone_verified_at: { type: FieldTypes.DATE },
  fullname: { type: FieldTypes.STRING, allowNull: true },
  email: { type: FieldTypes.STRING, unique: true, allowNull: false },
  phone: { type: FieldTypes.STRING },
  is_verified: { type: FieldTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Existing MongoDB accounts predate this field; tolerate missing/null values as active.
  account_status: { type: FieldTypes.ENUM('active', 'suspended', 'deactivated'), defaultValue: 'active', allowNull: true },
  account_status_reason: { type: FieldTypes.TEXT },
  account_status_changed_by: { type: FieldTypes.STRING },
  account_status_changed_at: { type: FieldTypes.DATE },
  last_login_at: { type: FieldTypes.DATE },
  dob: { type: FieldTypes.DATEONLY }, // DATEONLY
  gender: { type: FieldTypes.ENUM('Nam', 'Nữ', 'Khác'), defaultValue: 'Khác' }, // ENUM
  address: { type: FieldTypes.STRING },
  job: { type: FieldTypes.STRING },
  last_interest: { type: FieldTypes.STRING }, // user's last interested destination slug
  company_name: { type: FieldTypes.STRING },
  avatarUrl: { type: FieldTypes.TEXT }

}, { timestamps: true, indexes: [
  { key: { createdAt: 1 }, options: { name: 'createdAt_1' } },
  { key: { last_login_at: 1 }, options: { name: 'last_login_at_1' } }
] });

const AdminAuditLog = store.define('AdminAuditLog', {
  id: { type: FieldTypes.UUID, defaultValue: FieldTypes.UUIDV4, primaryKey: true },
  actor_id: { type: FieldTypes.STRING, allowNull: false },
  target_user_id: { type: FieldTypes.STRING, allowNull: false },
  action: { type: FieldTypes.STRING, allowNull: false },
  reason: { type: FieldTypes.TEXT, allowNull: false },
  previous_state: { type: FieldTypes.JSONB },
  new_state: { type: FieldTypes.JSONB },
  result: { type: FieldTypes.ENUM('success', 'failure'), defaultValue: 'success', allowNull: false }
}, { tableName: 'admin_audit_logs', timestamps: true });

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

const AuthSession = store.define('AuthSession', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  expires_at: { type: FieldTypes.DATE, allowNull: false },
  last_active_at: { type: FieldTypes.DATE, allowNull: false },
  revoked_at: { type: FieldTypes.DATE },
  user_agent: { type: FieldTypes.TEXT },
  browser: { type: FieldTypes.STRING },
  platform: { type: FieldTypes.STRING },
  ip_address: { type: FieldTypes.STRING },
  revoke_reason: { type: FieldTypes.STRING }
}, { tableName: 'auth_sessions', underscored: true, indexes: [
  { key: { user_id: 1, revoked_at: 1, created_at: -1 }, options: { name: 'auth_sessions_user_active_created' } },
  { key: { expires_at: 1 }, options: { name: 'auth_sessions_expires', expireAfterSeconds: 0 } }
] });

const SecurityAuditEvent = store.define('SecurityAuditEvent', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  session_id: { type: FieldTypes.STRING },
  event_type: { type: FieldTypes.STRING, allowNull: false },
  result: { type: FieldTypes.ENUM('success', 'failure', 'denied'), allowNull: false },
  ip_address: { type: FieldTypes.STRING },
  user_agent: { type: FieldTypes.TEXT },
  metadata: { type: FieldTypes.JSONB }
}, { tableName: 'security_audit_events', underscored: true, indexes: [
  { key: { user_id: 1, created_at: -1 }, options: { name: 'security_audit_user_created' } }
] });

const AuthMfaChallenge = store.define('AuthMfaChallenge', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  auth_method: { type: FieldTypes.STRING, allowNull: false },
  expires_at: { type: FieldTypes.DATE, allowNull: false },
  attempt_count: { type: FieldTypes.INTEGER, defaultValue: 0, allowNull: false },
  consumed_at: { type: FieldTypes.DATE }
}, { tableName: 'auth_mfa_challenges', underscored: true, timestamps: true, indexes: [
  { key: { user_id: 1, expires_at: 1 }, options: { name: 'auth_mfa_challenges_user_expiry' } },
  { key: { expires_at: 1 }, options: { name: 'auth_mfa_challenges_expiry', expireAfterSeconds: 0 } }
] });

const AuthPasskey = store.define('AuthPasskey', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  credential_id: { type: FieldTypes.TEXT, allowNull: false },
  public_key: { type: FieldTypes.TEXT, allowNull: false },
  counter: { type: FieldTypes.INTEGER, defaultValue: 0, allowNull: false },
  transports: { type: FieldTypes.JSONB, defaultValue: [] },
  name: { type: FieldTypes.STRING, allowNull: false },
  last_used_at: { type: FieldTypes.DATE }
}, { tableName: 'auth_passkeys', underscored: true, timestamps: true, indexes: [
  { key: { credential_id: 1 }, options: { name: 'auth_passkeys_credential_id', unique: true } },
  { key: { user_id: 1, created_at: -1 }, options: { name: 'auth_passkeys_user_created' } }
] });

const EmailChangeVerification = store.define('EmailChangeVerification', {
  id: { type: FieldTypes.UUID, defaultValue: FieldTypes.UUIDV4, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  pending_email: { type: FieldTypes.STRING, allowNull: false },
  code_hash: { type: FieldTypes.STRING, allowNull: false },
  expires_at: { type: FieldTypes.DATE, allowNull: false },
  consumed_at: { type: FieldTypes.DATE },
  attempt_count: { type: FieldTypes.INTEGER, defaultValue: 0, allowNull: false },
  resend_available_at: { type: FieldTypes.DATE, allowNull: false }
}, { tableName: 'email_change_verifications', underscored: true, timestamps: true, indexes: [
  { key: { user_id: 1, created_at: -1 }, options: { name: 'email_change_user_created' } },
  { key: { expires_at: 1 }, options: { name: 'email_change_expiry', expireAfterSeconds: 0 } }
] });

const AuthWebAuthnChallenge = store.define('AuthWebAuthnChallenge', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING },
  purpose: { type: FieldTypes.ENUM('registration', 'authentication'), allowNull: false },
  challenge: { type: FieldTypes.STRING, allowNull: false },
  expires_at: { type: FieldTypes.DATE, allowNull: false },
  consumed_at: { type: FieldTypes.DATE }
}, { tableName: 'auth_webauthn_challenges', underscored: true, timestamps: true, indexes: [
  { key: { expires_at: 1 }, options: { name: 'auth_webauthn_challenges_expiry', expireAfterSeconds: 0 } }
] });

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
  reserved_balance: { type: FieldTypes.DOUBLE, defaultValue: 0, validate: { min: 0 } },
  // Absent on ordinary/production wallets; initialized only by an authorized demo posting.
  demo_balance: { type: FieldTypes.INTEGER, validate: { min: 0 } },
  demo_held: { type: FieldTypes.INTEGER, validate: { min: 0 } },
  registered: { type: FieldTypes.BOOLEAN, defaultValue: false },
  green_points: { type: FieldTypes.INTEGER, defaultValue: 0, validate: { min: 0 } },
  tier_points: { type: FieldTypes.INTEGER, defaultValue: 0, validate: { min: 0 } },
  tier_history_synced: { type: FieldTypes.BOOLEAN, defaultValue: false },
  payment_methods: { type: FieldTypes.JSONB, defaultValue: [] }
}, { timestamps: true });

// 5. WalletTransaction Model
const WalletTransaction = store.define('WalletTransaction', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // GDXXXXXXXX
  type: {
    type: FieldTypes.ENUM('deposit', 'payment', 'refund', 'withdrawal', 'escrow_hold', 'escrow_release', 'points_earned', 'points_redeemed', 'points_sent', 'points_received', 'points_tier_adjustment', 'transfer_out', 'transfer_in'),
    allowNull: false
  },
  description: { type: FieldTypes.STRING, allowNull: false },
  // Existing itinerary/withdrawal flows store debits as negative amounts.
  amount: { type: FieldTypes.DOUBLE, allowNull: false, validate: { minMagnitude: 0.01 } },
  status: { type: FieldTypes.ENUM('success', 'pending', 'failed', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'), defaultValue: 'success' },
  mode: { type: FieldTypes.STRING },
  operation_hash: { type: FieldTypes.STRING },
  sender_id: { type: FieldTypes.STRING },
  recipient_id: { type: FieldTypes.STRING },
  recipient_name: { type: FieldTypes.STRING },
  sender_name: { type: FieldTypes.STRING },
  demo_method: { type: FieldTypes.STRING },
  bank_account_id: { type: FieldTypes.STRING },
  bank_label: { type: FieldTypes.STRING },
  note: { type: FieldTypes.STRING },
  completed_at: { type: FieldTypes.DATE },
  reference_id: { type: FieldTypes.STRING },
  verification_reference: { type: FieldTypes.STRING, unique: true, allowNull: true },
  verified_by: { type: FieldTypes.STRING },
  reserved_amount: { type: FieldTypes.DOUBLE, defaultValue: 0, validate: { min: 0 } }
}, { timestamps: true });

const WalletLedger = store.define('WalletLedger', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  wallet_id: { type: FieldTypes.STRING, allowNull: false },
  transaction_id: { type: FieldTypes.STRING, allowNull: false },
  mode: { type: FieldTypes.ENUM('demo'), allowNull: false },
  phase: { type: FieldTypes.STRING, allowNull: false },
  delta_balance: { type: FieldTypes.INTEGER, allowNull: false },
  delta_held: { type: FieldTypes.INTEGER, allowNull: false },
  balance_after: { type: FieldTypes.INTEGER, allowNull: false },
  held_after: { type: FieldTypes.INTEGER, allowNull: false }
}, { tableName: 'wallet_ledger', timestamps: true });

const BankAccount = store.define('BankAccount', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  label: { type: FieldTypes.STRING, allowNull: false },
  demo_reference: { type: FieldTypes.STRING, allowNull: false },
  is_demo: { type: FieldTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'bank_accounts', timestamps: true });

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
  user_id: { type: FieldTypes.STRING, allowNull: true, unique: true },
  name_provider: { type: FieldTypes.STRING, allowNull: false },
  field: { type: FieldTypes.STRING },
  destination: { type: FieldTypes.STRING, allowNull: false },
  image_url: { type: FieldTypes.STRING },
  provider_status: { type: FieldTypes.ENUM('pending', 'active', 'rejected'), defaultValue: 'pending', allowNull: false }
}, { timestamps: true });

// National catalog collections are additive. Existing Schedule.destination strings and
// booking references are intentionally left untouched while IDs are introduced.
const AdminArea = store.define('AdminArea', {
  id: { type: FieldTypes.STRING, primaryKey: true }, code: { type: FieldTypes.STRING, allowNull: false, unique: true },
  name: { type: FieldTypes.STRING, allowNull: false }, type: { type: FieldTypes.ENUM('province', 'city'), allowNull: false },
  aliases: { type: FieldTypes.JSONB, defaultValue: [] }, status: { type: FieldTypes.ENUM('draft', 'published', 'archived'), defaultValue: 'draft' },
  source: { type: FieldTypes.JSONB, allowNull: false }, version: { type: FieldTypes.STRING, allowNull: false },
  effectiveFrom: { type: FieldTypes.DATEONLY, allowNull: false }, effectiveTo: { type: FieldTypes.DATEONLY }
}, { tableName: 'admin_areas', timestamps: true, indexes: [{ key: { name: 1 } }] });

const Region = store.define('Region', {
  id: { type: FieldTypes.STRING, primaryKey: true }, slug: { type: FieldTypes.STRING, allowNull: false, unique: true },
  name: { type: FieldTypes.STRING, allowNull: false }, description: { type: FieldTypes.TEXT },
  adminAreaIds: { type: FieldTypes.JSONB, defaultValue: [] }, status: { type: FieldTypes.ENUM('draft', 'published', 'archived'), defaultValue: 'draft' },
  source: { type: FieldTypes.JSONB }, version: { type: FieldTypes.STRING, allowNull: false }
}, { tableName: 'regions', timestamps: true, indexes: [{ key: { name: 1 } }] });

const Destination = store.define('Destination', {
  id: { type: FieldTypes.STRING, primaryKey: true }, slug: { type: FieldTypes.STRING, allowNull: false, unique: true },
  name: { type: FieldTypes.STRING, allowNull: false }, aliases: { type: FieldTypes.JSONB, defaultValue: [] },
  adminAreaIds: { type: FieldTypes.JSONB, defaultValue: [] }, regionId: { type: FieldTypes.STRING, allowNull: false },
  coordinates: { type: FieldTypes.JSONB }, coordinateVerification: { type: FieldTypes.STRING, defaultValue: 'pending' },
  description: { type: FieldTypes.TEXT }, image_url: { type: FieldTypes.STRING }, coverMediaAssetId: { type: FieldTypes.STRING }, coverMediaVariants: { type: FieldTypes.JSONB, defaultValue: [] },
  coverMediaVerified: { type: FieldTypes.BOOLEAN, defaultValue: false }, mediaAssetIds: { type: FieldTypes.JSONB, defaultValue: [] },
  gallery: { type: FieldTypes.JSONB, defaultValue: [] },
  status: { type: FieldTypes.ENUM('draft', 'editorial', 'published', 'archived'), defaultValue: 'draft' },
  source: { type: FieldTypes.JSONB }, version: { type: FieldTypes.STRING, allowNull: false }
}, { tableName: 'destinations', timestamps: true, indexes: [{ key: { name: 1 } }, { key: { regionId: 1, status: 1 } }] });

const MediaAsset = store.define('MediaAsset', {
  id: { type: FieldTypes.STRING, primaryKey: true }, storageProvider: { type: FieldTypes.STRING, allowNull: false },
  storageKey: { type: FieldTypes.STRING, allowNull: false }, publicUrl: { type: FieldTypes.STRING },
  mimeType: { type: FieldTypes.STRING, allowNull: false }, byteSize: { type: FieldTypes.INTEGER, allowNull: false },
  width: { type: FieldTypes.INTEGER }, height: { type: FieldTypes.INTEGER }, checksum: { type: FieldTypes.STRING },
  variants: { type: FieldTypes.JSONB, defaultValue: [] }, sourceType: { type: FieldTypes.STRING, allowNull: false },
  sourceUrl: { type: FieldTypes.STRING }, photographer: { type: FieldTypes.STRING }, licenseId: { type: FieldTypes.STRING },
  attributionText: { type: FieldTypes.STRING }, rightsEvidence: { type: FieldTypes.STRING },
  verificationStatus: { type: FieldTypes.ENUM('pending_review', 'verified', 'rejected'), defaultValue: 'pending_review' },
  entityRefs: { type: FieldTypes.JSONB, defaultValue: [] }, ownerId: { type: FieldTypes.STRING }, deletedAt: { type: FieldTypes.DATE }
}, { tableName: 'media_assets', timestamps: true, indexes: [{ key: { checksum: 1 } }, { key: { verificationStatus: 1 } }] });

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
  destination_ids: { type: FieldTypes.JSONB, defaultValue: [] },
    coverMediaAssetId: { type: FieldTypes.STRING }, coverMediaVerified: { type: FieldTypes.BOOLEAN, defaultValue: false },
    coverMediaVariants: { type: FieldTypes.JSONB, defaultValue: [] },
    mediaAssetIds: { type: FieldTypes.JSONB, defaultValue: [] },
  votes_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  gallery: { type: FieldTypes.JSONB },
  photo_metadata: { type: FieldTypes.JSONB, defaultValue: [] },
  responsible_travel: { type: FieldTypes.TEXT },
  practical_notes: { type: FieldTypes.TEXT },
  editorial_itinerary_notice: { type: FieldTypes.TEXT },
  highlights: { type: FieldTypes.JSONB },
  included: { type: FieldTypes.JSONB },
  excluded: { type: FieldTypes.JSONB },
  policy: { type: FieldTypes.JSONB },
  guarantees: { type: FieldTypes.JSONB },
  style: { type: FieldTypes.STRING },
  style_explanation: { type: FieldTypes.TEXT },
  group_size: { type: FieldTypes.STRING },
  fitness_level: { type: FieldTypes.STRING },
  fitness_is_estimate: { type: FieldTypes.BOOLEAN },
  fitness_explanation: { type: FieldTypes.TEXT },
  max_capacity: { type: FieldTypes.INTEGER },
  catalog_status: { type: FieldTypes.ENUM('draft', 'editorial', 'demo', 'verified', 'bookable', 'paused', 'personal'), defaultValue: 'editorial', allowNull: true },
  catalog_source: { type: FieldTypes.JSONB }
}, { timestamps: true, indexes: [
  { key: { catalog_status: 1, tour_name: 1, id: 1 } },
  { key: { destination_ids: 1, catalog_status: 1 } }
] });

// 12. BadgeSchedule Junction
const BadgeSchedule = store.define('BadgeSchedule', {}, { timestamps: true });

// 13. ScheduleSample Model
const ScheduleSample = store.define('ScheduleSample', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // ref: Schedule.id
  cost: { type: FieldTypes.DOUBLE, allowNull: false },
  old_cost: { type: FieldTypes.DOUBLE },
  rating: { type: FieldTypes.DOUBLE, allowNull: true, defaultValue: null },
  votes_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
}, { timestamps: true, indexes: [
  { key: { cost: 1, id: 1 } }, { key: { rating: -1, id: 1 } }
] });

// 14. ScheduleCustom Model
const ScheduleCustom = store.define('ScheduleCustom', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // ref: Schedule.id
  total_cost: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  status: { type: FieldTypes.ENUM('draft', 'pending_payment', 'deposited', 'cancelled'), defaultValue: 'draft', allowNull: false },
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
  cost: { type: FieldTypes.DOUBLE, allowNull: true, defaultValue: null },
  priceStatus: { type: FieldTypes.STRING, defaultValue: 'verified' },
  destination: { type: FieldTypes.STRING, allowNull: false },
  carbon: { type: FieldTypes.DOUBLE, defaultValue: 0.0 },
  image_url: { type: FieldTypes.STRING },
  rating: { type: FieldTypes.DOUBLE, allowNull: true, defaultValue: null },
  bookings_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  reviews_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  current_data: { type: FieldTypes.JSONB },
  category_id: { type: FieldTypes.STRING },
  max_capacity: { type: FieldTypes.INTEGER, defaultValue: 10 },
  status: { type: FieldTypes.STRING, defaultValue: 'active', allowNull: false },
  views_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  rejection_reason: { type: FieldTypes.TEXT },
  is_partner: { type: FieldTypes.BOOLEAN, defaultValue: true },
  source: { type: FieldTypes.STRING, defaultValue: 'partner' },
  google_place_id: { type: FieldTypes.STRING, allowNull: true },
  destination_ids: { type: FieldTypes.JSONB, defaultValue: [] },
  catalog_status: { type: FieldTypes.STRING, defaultValue: 'verified' },
  coverMediaAssetId: { type: FieldTypes.STRING }, coverMediaVerified: { type: FieldTypes.BOOLEAN, defaultValue: false }
}, { timestamps: true, indexes: [
  { key: { type: 1, status: 1, destination_ids: 1 } }, { key: { cost: 1, status: 1 } }
] });

// 17. BadgeService Junction
const BadgeService = store.define('BadgeService', {}, { timestamps: true });

// 18. ServiceBooking Model (DATEONLY dates, evoucher_code, escrow_status)
const ServiceBooking = store.define('ServiceBooking', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // BKS-XXXXXXXXXX
  fullname: { type: FieldTypes.STRING, allowNull: false },
  name_service: { type: FieldTypes.STRING, allowNull: false },
  booking_date: { type: FieldTypes.DATEONLY, allowNull: false }, // DATEONLY
  guests: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  value: { type: FieldTypes.INTEGER, allowNull: false },
  // Keep legacy momo rows readable and editable; new bookings reject momo in booking.controller.
  payment_method: { type: FieldTypes.ENUM('wallet', 'bank_transfer', 'card', 'counter', 'momo', 'sepay') },
  status: { type: FieldTypes.ENUM('pending', 'deposit', 'completed', 'rejected', 'refunded'), defaultValue: 'pending', allowNull: false },
  votes_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  voucher_code: { type: FieldTypes.STRING },
  evoucher_code: { type: FieldTypes.STRING, allowNull: false },
  escrow_status: { type: FieldTypes.ENUM('none', 'holding', 'released', 'refunded'), defaultValue: 'none', allowNull: false },
  booking_status: { type: FieldTypes.STRING, defaultValue: 'new', allowNull: false },
  payment_status: { type: FieldTypes.STRING, defaultValue: 'pending', allowNull: false },
  payment_amount: { type: FieldTypes.INTEGER },
  paid_at: { type: FieldTypes.DATE },
  idempotency_key: { type: FieldTypes.STRING, unique: true, allowNull: true },
  idempotency_hash: { type: FieldTypes.STRING },
  pricing_snapshot: { type: FieldTypes.JSONB },
  order_details_snapshot: { type: FieldTypes.JSONB },
  check_out_date: { type: FieldTypes.DATEONLY },
  room_id: { type: FieldTypes.STRING },
  room_count: { type: FieldTypes.INTEGER },
  operation_status: { type: FieldTypes.STRING, defaultValue: 'preparing', allowNull: false },
  confirm_deadline: { type: FieldTypes.DATE },
  payment_deadline: { type: FieldTypes.DATE },
  special_requests: { type: FieldTypes.TEXT },
  rejection_reason: { type: FieldTypes.TEXT },
  customer_phone: { type: FieldTypes.STRING(20) },
  customer_email: { type: FieldTypes.STRING(100) },
  sepay_capability_hash: { type: FieldTypes.STRING }
}, { timestamps: true });

// 19. TourBooking Model (NEW - for preset & custom tours checkouts)
const TourBooking = store.define('TourBooking', {
  id: { type: FieldTypes.STRING, primaryKey: true }, // BKT-XXXXXXXXXX
  fullname: { type: FieldTypes.STRING, allowNull: false },
  tour_name: { type: FieldTypes.STRING, allowNull: false },
  booking_date: { type: FieldTypes.DATEONLY, allowNull: false }, // DATEONLY
  guests: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  value: { type: FieldTypes.INTEGER, allowNull: false },
  // Retain the legacy value for historical records; new bookings reject it in booking.controller.
  payment_method: { type: FieldTypes.ENUM('wallet', 'bank_transfer', 'card', 'counter', 'momo', 'sepay'), allowNull: false },
  voucher_code: { type: FieldTypes.STRING },
  evoucher_code: { type: FieldTypes.STRING, allowNull: false },
  status: { type: FieldTypes.ENUM('pending', 'deposit', 'completed', 'rejected', 'refunded'), defaultValue: 'pending', allowNull: false },
  escrow_status: { type: FieldTypes.ENUM('none', 'holding', 'released', 'refunded'), defaultValue: 'none', allowNull: false },
  booking_status: { type: FieldTypes.STRING, defaultValue: 'new', allowNull: false },
  payment_status: { type: FieldTypes.STRING, defaultValue: 'pending', allowNull: false },
  payment_amount: { type: FieldTypes.INTEGER },
  paid_at: { type: FieldTypes.DATE },
  idempotency_key: { type: FieldTypes.STRING, unique: true, allowNull: true },
  idempotency_hash: { type: FieldTypes.STRING },
  pricing_snapshot: { type: FieldTypes.JSONB },
  order_details_snapshot: { type: FieldTypes.JSONB },
  check_out_date: { type: FieldTypes.DATEONLY },
  operation_status: { type: FieldTypes.STRING, defaultValue: 'preparing', allowNull: false },
  confirm_deadline: { type: FieldTypes.DATE },
  payment_deadline: { type: FieldTypes.DATE },
  special_requests: { type: FieldTypes.TEXT },
  rejection_reason: { type: FieldTypes.TEXT },
  customer_phone: { type: FieldTypes.STRING(20) },
  customer_email: { type: FieldTypes.STRING(100) },
  sepay_capability_hash: { type: FieldTypes.STRING }
}, { timestamps: true });

const BookingAddon = store.define('BookingAddon', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  name: { type: FieldTypes.STRING, allowNull: false },
  unit_price: { type: FieldTypes.INTEGER, allowNull: false, validate: { min: 0 } },
  active: { type: FieldTypes.BOOLEAN, defaultValue: true, allowNull: false }
}, { timestamps: true });

const SepayPaymentAttempt = store.define('SepayPaymentAttempt', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  booking_id: { type: FieldTypes.STRING, allowNull: false },
  order_invoice_number: { type: FieldTypes.STRING, unique: true, allowNull: false },
  amount: { type: FieldTypes.INTEGER, allowNull: false },
  status: { type: FieldTypes.ENUM('pending', 'failed', 'succeeded', 'void', 'reconciliation_required'), defaultValue: 'pending', allowNull: false },
  checkout_fields: { type: FieldTypes.JSONB, allowNull: false },
  transaction_id: { type: FieldTypes.STRING },
  notification_type: { type: FieldTypes.STRING },
  reconciliation_required: { type: FieldTypes.BOOLEAN, defaultValue: false, allowNull: false }
}, { timestamps: true, indexes: [
  { key: { booking_id: 1, createdAt: -1 }, options: { name: 'sepay_booking_createdAt' } },
  { key: { booking_id: 1 }, options: { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_sepay_attempt_per_booking' } },
  { key: { transaction_id: 1 }, options: { unique: true, partialFilterExpression: { transaction_id: { $type: 'string' } }, name: 'unique_sepay_transaction' } }
] });

const ServiceCategory = store.define('ServiceCategory', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  name: { type: FieldTypes.STRING, allowNull: false },
  active: { type: FieldTypes.BOOLEAN, defaultValue: true, allowNull: false },
  sort_order: { type: FieldTypes.INTEGER, defaultValue: 0, allowNull: false },
  icon: { type: FieldTypes.STRING }
}, { timestamps: true, indexes: [
  { key: { active: 1, sort_order: 1 }, options: { name: 'active_sort_order' } }
] });

const BookingSetting = store.define('BookingSetting', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  discount_percent: { type: FieldTypes.DOUBLE, defaultValue: 0, allowNull: false },
  service_fee_vnd: { type: FieldTypes.INTEGER, defaultValue: 0, allowNull: false },
  service_fee_per_guest: { type: FieldTypes.BOOLEAN, defaultValue: false, allowNull: false },
  deposit_percent: { type: FieldTypes.DOUBLE, defaultValue: 0, allowNull: false },
  collect_deposit_for: { type: FieldTypes.JSONB, defaultValue: [], allowNull: false },
  version: { type: FieldTypes.INTEGER, defaultValue: 1, allowNull: false },
  updated_at: { type: FieldTypes.DATE },
  updated_by: { type: FieldTypes.STRING }
}, { timestamps: true });

const AdminConfigAuditLog = store.define('AdminConfigAuditLog', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  actor_id: { type: FieldTypes.STRING, allowNull: false },
  action: { type: FieldTypes.STRING, allowNull: false },
  target_type: { type: FieldTypes.STRING, allowNull: false },
  target_id: { type: FieldTypes.STRING, allowNull: false },
  reason: { type: FieldTypes.TEXT, allowNull: false },
  previous_state: { type: FieldTypes.JSONB },
  new_state: { type: FieldTypes.JSONB },
  config_version: { type: FieldTypes.INTEGER }
}, { timestamps: true, indexes: [
  { key: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
  { key: { target_type: 1, target_id: 1, createdAt: -1 }, options: { name: 'target_createdAt' } }
] });

const SystemEventLog = store.define('SystemEventLog', {
  id: { type: FieldTypes.UUID, defaultValue: FieldTypes.UUIDV4, primaryKey: true },
  kind: { type: FieldTypes.ENUM('security', 'error'), allowNull: false },
  action: { type: FieldTypes.STRING, allowNull: false },
  actor_id: { type: FieldTypes.STRING },
  target_type: { type: FieldTypes.STRING },
  target_id: { type: FieldTypes.STRING },
  request_id: { type: FieldTypes.STRING },
  endpoint: { type: FieldTypes.STRING },
  method: { type: FieldTypes.STRING },
  status: { type: FieldTypes.INTEGER },
  error_type: { type: FieldTypes.STRING },
  message: { type: FieldTypes.STRING },
  result: { type: FieldTypes.ENUM('success', 'failure') },
  metadata: { type: FieldTypes.JSONB, defaultValue: {} },
  expires_at: { type: FieldTypes.DATE, allowNull: false }
}, { timestamps: true, indexes: [
  { key: { kind: 1, createdAt: -1 }, options: { name: 'kind_createdAt_desc' } },
  { key: { expires_at: 1 }, options: { name: 'expires_at_ttl', expireAfterSeconds: 0 } }
] });

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
  editorial_note: { type: FieldTypes.TEXT },
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

// Partner-owned promotions. Vender is the existing provider identity used by GreenService.
const PartnerCampaign = store.define('PartnerCampaign', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  vender_id: { type: FieldTypes.STRING },
  service_id: { type: FieldTypes.STRING },
  name: { type: FieldTypes.STRING, allowNull: false },
  type: { type: FieldTypes.ENUM('promotion', 'flash_sale', 'voucher'), allowNull: false },
  status: { type: FieldTypes.ENUM('active', 'paused', 'cancelled'), defaultValue: 'active', allowNull: false },
  start_at: { type: FieldTypes.DATE, allowNull: false },
  end_at: { type: FieldTypes.DATE, allowNull: false },
  package: { type: FieldTypes.STRING },
  budget: { type: FieldTypes.DOUBLE, defaultValue: 0 },
  code: { type: FieldTypes.STRING },
  discount_type: { type: FieldTypes.ENUM('percent', 'fixed'), defaultValue: 'percent' },
  discount_value: { type: FieldTypes.DOUBLE, defaultValue: 0 },
  min_order: { type: FieldTypes.DOUBLE, defaultValue: 0 },
  usage_limit: { type: FieldTypes.INTEGER, defaultValue: 1 },
  claimed_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  used_count: { type: FieldTypes.INTEGER, defaultValue: 0 },
  views: { type: FieldTypes.INTEGER, defaultValue: 0 },
  clicks: { type: FieldTypes.INTEGER, defaultValue: 0 },
  bookings: { type: FieldTypes.INTEGER, defaultValue: 0 },
  revenue: { type: FieldTypes.DOUBLE, defaultValue: 0 },
  spent: { type: FieldTypes.DOUBLE, defaultValue: 0 },
  archived_at: { type: FieldTypes.DATE },
}, { timestamps: true });

// 23. CommunityPost Model
const CommunityPost = store.define('CommunityPost', {
  moderation_status: { type: FieldTypes.STRING, defaultValue: 'visible' },
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
  moderation_status: { type: FieldTypes.STRING, defaultValue: 'visible' },
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
  booking_id: { type: FieldTypes.STRING, allowNull: true, unique: true },
  is_reported: { type: FieldTypes.BOOLEAN, defaultValue: false, allowNull: false },
  report_reason: { type: FieldTypes.TEXT },
  internal_notes: { type: FieldTypes.TEXT }
}, { timestamps: true });

const CommunityReport = store.define('CommunityReport', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  target_type: { type: FieldTypes.ENUM('post', 'comment'), allowNull: false },
  target_id: { type: FieldTypes.STRING, allowNull: false },
  reporter_id: { type: FieldTypes.STRING, allowNull: false },
  reason: { type: FieldTypes.STRING, allowNull: false },
  details: { type: FieldTypes.TEXT },
  snapshot: { type: FieldTypes.TEXT },
  status: { type: FieldTypes.ENUM('pending', 'hidden', 'dismissed', 'restored'), defaultValue: 'pending' },
  reviewed_by: { type: FieldTypes.STRING },
  reviewed_at: { type: FieldTypes.DATE },
  review_note: { type: FieldTypes.TEXT },
  history: { type: FieldTypes.JSONB, defaultValue: [] }
}, { tableName: 'community_reports', timestamps: true });

const Favorite = store.define('Favorite', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  target_type: { type: FieldTypes.ENUM('tour', 'service', 'itinerary', 'place', 'transport_trip', 'transport_rental'), allowNull: false },
  target_id: { type: FieldTypes.STRING, allowNull: false },
  snapshot: { type: FieldTypes.JSONB, allowNull: false }
}, { tableName: 'favorites', timestamps: true, indexes: [
  { key: { user_id: 1, target_type: 1, target_id: 1 }, options: { unique: true } },
  { key: { user_id: 1, createdAt: -1 }, options: {} }
] });

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

const SavedPromotion = store.define('SavedPromotion', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  user_id: { type: FieldTypes.STRING, allowNull: false },
  campaign_id: { type: FieldTypes.STRING, allowNull: false },
  status: { type: FieldTypes.ENUM('active', 'used'), defaultValue: 'active' },
  snapshot: { type: FieldTypes.JSONB },
  used_at: { type: FieldTypes.DATE },
}, { timestamps: true });

// 27. Voucher Model
const Voucher = store.define('Voucher', {
  id: { type: FieldTypes.STRING, primaryKey: true },
  code: { type: FieldTypes.STRING, unique: true, allowNull: false },
  discount_amount: { type: FieldTypes.INTEGER, defaultValue: 0 },
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
  link: { type: FieldTypes.STRING, allowNull: true },
  reference_id: { type: FieldTypes.STRING, allowNull: true },
  type: {
    type: FieldTypes.ENUM('system', 'community', 'booking', 'wallet', 'itinerary', 'tour', 'service'),
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
User.hasOne(Provider, { foreignKey: 'user_id', onDelete: 'SET NULL' });
Provider.belongsTo(User, { foreignKey: 'user_id' });

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
PartnerCampaign.belongsTo(User, { foreignKey: 'user_id' });
PartnerCampaign.belongsTo(Vender, { foreignKey: 'vender_id' });
PartnerCampaign.belongsTo(GreenService, { foreignKey: 'service_id' });
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

    const votesCount = parseInt(stats[0]?.dataValues?.votesCount || 0);
    const avgRating = votesCount
      ? parseFloat(parseFloat(stats[0].dataValues.avgRating).toFixed(1))
      : null;

    if (type === 'tour') {
      await storeInstance.models.ScheduleSample.update(
        { rating: avgRating, votes_count: votesCount },
        { where: { id: targetId }, transaction: options?.transaction }
      );
    } else if (type === 'service') {
      await storeInstance.models.GreenService.update(
        {
          rating: avgRating,
          reviews_count: votesCount,
          bookings_count: await storeInstance.models.ServiceBooking.count({
            where: { service_id: targetId },
            transaction: options?.transaction
          })
        },
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

const NewsletterSubscription = store.define('NewsletterSubscription', {
  id: { type: FieldTypes.UUID, defaultValue: FieldTypes.UUIDV4, primaryKey: true },
  email: { type: FieldTypes.STRING, allowNull: false, unique: true },
  consented_at: { type: FieldTypes.DATE, allowNull: false, defaultValue: FieldTypes.NOW },
  welcome_email_status: { type: FieldTypes.ENUM('pending', 'sent', 'failed'), allowNull: false, defaultValue: 'pending' },
  welcome_email_sent_at: { type: FieldTypes.DATE, allowNull: true },
  status: { type: FieldTypes.ENUM('subscribed', 'unsubscribed'), allowNull: false, defaultValue: 'subscribed' }
}, { tableName: 'newsletter_subscriptions', underscored: true, timestamps: true });

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
  include: [{ model: GreenService, required: false, attributes: ['id', 'type', 'cost', 'name_service'] }]
}, { override: true });

module.exports = {
  store,
  User,
  AdminAuditLog,
  AuthOtp,
  PendingRegistration,
  AuthSession,
  SecurityAuditEvent,
  AuthMfaChallenge,
  AuthPasskey,
  EmailChangeVerification,
  AuthWebAuthnChallenge,
  Badge,
  BadgeUser,
  Wallet,
  WalletTransaction,
  WalletLedger,
  BankAccount,
  Vender,
  VenderContract,
  Revenue,
  Contract,
  Provider,
  AdminArea,
  Region,
  Destination,
  MediaAsset,
  Schedule,
  BadgeSchedule,
  ScheduleSample,
  ScheduleCustom,
  UserSchedule,
  GreenService,
  BadgeService,
  ServiceBooking,
  TourBooking,
  BookingAddon,
  SepayPaymentAttempt,
  ServiceCategory,
  BookingSetting,
  AdminConfigAuditLog,
  SystemEventLog,
  WithdrawalRequest,
  ScheduleActivity,
  AdCampaign,
  PartnerCampaign,
  CommunityPost,
  CommunityReport,
  CommentPost,
  SavedCommunityItem,
  Favorite,
  CommunityChallenge,
  CommunityChallengeEntry,
  CPSS,
  CPGS,
  Voucher,
  SavedPromotion,
  FAQ,
  NewsletterSubscription,
  Notification,
  ChangeRequest,
  OperationsAssignment
};
