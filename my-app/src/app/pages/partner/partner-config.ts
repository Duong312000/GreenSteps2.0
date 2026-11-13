/**
 * Partner-facing operational values. Keep approved limits and contact details here
 * so the registration FAQ and draft legal pages stay consistent.
 */
export const PARTNER_CONFIG = {
  reviewDays: 2,
  reconciliationDay: 'thứ Hai hàng tuần',
  minimumWithdrawalVnd: 200_000,
  withdrawalProcessingDays: '1–3',
  disputeWindowDays: 7,
  refundProcessingDays: '5–7',
  supportEmail: 'partner@greensteps.vn',
  documentMaxSizeMb: 5,
  /** Leave empty until a real hotline number is approved; templates hide it while empty. */
  supportPhone: '',
  /** Kept out of the UI until supportPhone is provided. */
  supportPhonePlaceholder: '1900 xxxx xx',
} as const;

export function formatPartnerVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}
