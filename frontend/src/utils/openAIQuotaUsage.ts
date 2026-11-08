import type { AccountUsageInfo, UsageProgress } from '@/types'
import type { OpenAIQuotaUsage } from '@/api/admin/accounts'

/** Match windows by duration: primary is not necessarily the five-hour window. */
export function openAIQuotaToUsage(quota: OpenAIQuotaUsage, previous: AccountUsageInfo | null): AccountUsageInfo | null {
  const fetchedAt = quota.fetched_at > 0 ? quota.fetched_at * 1000 : Date.now()
  let fiveHour: UsageProgress | null = null
  let sevenDay: UsageProgress | null = null
  let thirtyDay: UsageProgress | null = null
  for (const window of [quota.rate_limit?.primary_window, quota.rate_limit?.secondary_window]) {
    if (!window || window.utilization_unknown || !Number.isFinite(window.used_percent)) continue
    const seconds = window.limit_window_seconds
    const monthly = seconds >= 28 * 86400 && seconds <= 31 * 86400
    if (seconds !== 5 * 3600 && seconds !== 7 * 86400 && !monthly) continue
    const resetAt = window.reset_at > 0
      ? window.reset_at * 1000
      : window.reset_after_seconds > 0 ? fetchedAt + window.reset_after_seconds * 1000 : null
    const old = seconds === 5 * 3600 ? previous?.five_hour : monthly ? previous?.thirty_day : previous?.seven_day
    const progress: UsageProgress = {
      utilization: window.used_percent,
      measurement_source: 'quota_api',
      sampled_at: quota.fetched_at,
      resets_at: resetAt == null ? null : new Date(resetAt).toISOString(),
      remaining_seconds: resetAt == null ? 0 : Math.max(0, Math.floor((resetAt - Date.now()) / 1000)),
      // Billing statistics belong to a particular window; discard them after rollover.
      window_stats: old?.resets_at && resetAt != null && new Date(old.resets_at).getTime() === resetAt
        ? old.window_stats : undefined
    }
    if (seconds === 5 * 3600) fiveHour = progress
    else if (monthly) thirtyDay = progress
    else sevenDay = progress
  }
  // A live read only fills windows it actually returns. Missing windows may be
  // supplemented by recent, unexpired observations from this account's traffic.
  for (const sample of quota.observed_windows ?? []) {
    const seconds = sample.limit_window_seconds
    if ((seconds !== 18000 && seconds !== 604800) || sample.utilization_unknown ||
      !Number.isFinite(sample.used_percent) || sample.used_percent < 0 || sample.used_percent > 100 ||
      !Number.isFinite(sample.sampled_at) || sample.sampled_at <= 0 || sample.sampled_at * 1000 > Date.now() + 5000 ||
      Date.now() - sample.sampled_at * 1000 > 300000 || !Number.isFinite(sample.reset_at) || sample.reset_at * 1000 <= Date.now() ||
      !['response_headers', 'websocket'].includes(sample.source)) continue
    const progress: UsageProgress = {
      utilization: sample.used_percent, measurement_source: sample.source, sampled_at: sample.sampled_at,
      resets_at: new Date(sample.reset_at * 1000).toISOString(),
      remaining_seconds: Math.max(0, Math.floor(sample.reset_at - Date.now() / 1000))
    }
    if (seconds === 18000 && !fiveHour) fiveHour = progress
    if (seconds === 604800 && !sevenDay) sevenDay = progress
  }
  if (!fiveHour && !sevenDay && !thirtyDay) return null
  return {
    source: 'active', updated_at: new Date(fetchedAt).toISOString(),
    five_hour: fiveHour, seven_day: sevenDay, thirty_day: thirtyDay, seven_day_sonnet: null
  }
}
