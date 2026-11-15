function campaignState(row, now = Date.now()) {
  if (row.status === 'cancelled') return 'cancelled';
  if (new Date(row.end_at).getTime() <= now) return 'expired';
  if (row.type !== 'promotion' && Math.max(row.used_count || 0, row.type === 'voucher' ? row.claimed_count || 0 : 0) >= row.usage_limit) return 'exhausted';
  if (row.status === 'paused') return 'paused';
  return new Date(row.start_at).getTime() > now ? 'scheduled' : 'active';
}

module.exports = { campaignState };
