import type { Account, AccountUsageInfo, UsageProgress } from '@/types'

/** Older servers return estimated zeroes without an explicit unknown marker. */
export function isClaudeUsageUnknown(account: Account, usage: AccountUsageInfo | null, window: 'five_hour' | 'seven_day' | 'seven_day_sonnet' | 'seven_day_fable'): boolean {
  const progress: UsageProgress | null | undefined = usage?.[window]
  if (!progress || progress.not_applicable || progress.utilization_unknown || !Number.isFinite(progress.utilization)) return true
  if (progress.resets_at && !(new Date(progress.resets_at).getTime() > Date.now())) return true
  if (progress.measurement_source === 'response_headers' || progress.measurement_source === 'quota_api') {
    const expires = claudeUsageExpiry(progress)
    return !expires || Date.now() >= expires * 1000 || (progress.sampled_at ?? 0) * 1000 > Date.now() + 5000
  }
  if (usage?.source === 'active') return false
  if (usage?.source !== 'passive' && account.type !== 'setup-token') return false
  // Weekly passive windows are measured response headers, never status estimates.
  // The account DTO can omit Extra; the usage response is sufficient evidence.
  if (window !== 'five_hour') {
    return !progress.resets_at || !(new Date(progress.resets_at).getTime() > Date.now())
  }
  const key = {
    five_hour: 'session_window_utilization', seven_day: 'passive_usage_7d_utilization',
    seven_day_fable: 'passive_usage_7d_oi_utilization', seven_day_sonnet: ''
  }[window]
  const raw = key ? account.extra?.[key] : null
  if (raw == null || (typeof raw !== 'number' && typeof raw !== 'string') || raw === '') return true
  const sampled = Number(raw)
  if (!Number.isFinite(sampled) || sampled < 0 || Math.abs(sampled * 100 - progress.utilization) > 0.001) return true
  // Once a saved window expires, its old percentage says nothing about the new window.
  return !progress.resets_at || !(new Date(progress.resets_at).getTime() > Date.now())
}

export function claudeUsageExpiry(progress: UsageProgress | null | undefined): number | undefined {
  if (!progress?.sampled_at || !progress.measurement_source) return undefined
  const resetAt = progress.resets_at ? new Date(progress.resets_at).getTime() / 1000 : Infinity
  return Math.min(progress.sampled_at + 300, resetAt)
}

/** A legacy setup-token endpoint returns estimates without declaring their source. */
export function isLegacyClaudeEstimate(account: Account, usage: AccountUsageInfo): boolean {
  return account.platform === 'anthropic' && account.type === 'setup-token' && !usage.source
}
