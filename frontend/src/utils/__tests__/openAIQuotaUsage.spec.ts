import { describe, expect, it } from 'vitest'
import { openAIQuotaToUsage } from '../openAIQuotaUsage'
import type { OpenAIQuotaUsage, OpenAIRateLimitWindow } from '@/api/admin/accounts'
import type { AccountUsageInfo } from '@/types'

const window = (seconds: number, percent: number): OpenAIRateLimitWindow => ({
  limit_window_seconds: seconds, used_percent: percent, reset_after_seconds: 120, reset_at: 1800000120
})
const quota = (primary: OpenAIRateLimitWindow | null, secondary: OpenAIRateLimitWindow | null): OpenAIQuotaUsage => ({
  fetched_at: 1800000000,
  rate_limit: { allowed: true, limit_reached: false, primary_window: primary, secondary_window: secondary }
})

describe('openAIQuotaToUsage', () => {
  it('maps swapped windows by duration and preserves upstream zero', () => {
    const usage = openAIQuotaToUsage(quota(window(604800, 42), window(18000, 0)), null)!
    expect(usage.five_hour?.utilization).toBe(0)
    expect(usage.seven_day?.utilization).toBe(42)
    expect(usage.five_hour?.resets_at).toBe(new Date(1800000120000).toISOString())
  })

  it('rejects empty or unrelated quota windows instead of reporting a successful refresh', () => {
    expect(openAIQuotaToUsage(quota(null, null), null)).toBeNull()
    expect(openAIQuotaToUsage(quota(window(3600, 10), null), null)).toBeNull()
  })

  it('never treats a missing upstream measurement as zero', () => {
    expect(openAIQuotaToUsage(quota({ ...window(18000, 0), utilization_unknown: true }, null), null)).toBeNull()
    expect(openAIQuotaToUsage(quota({ ...window(18000, 0), used_percent: null as any }, null), null)).toBeNull()
  })

  it.each([28, 29, 30, 31])('recognizes a %i-day monthly window without relabeling it weekly', days => {
    const usage = openAIQuotaToUsage(quota(window(days * 86400, 71), window(18000, 0)), null)!
    expect(usage.thirty_day?.utilization).toBe(71)
    expect(usage.seven_day).toBeNull()
    expect(usage.five_hour?.utilization).toBe(0)
  })

  it('maps the supplied upstream weekly-only response without inventing a 5h measurement', () => {
    const usage = openAIQuotaToUsage(quota({ limit_window_seconds: 604800, used_percent: 29, reset_after_seconds: 471668, reset_at: 1794534706 }, null), null)!
    expect(usage.seven_day?.utilization).toBe(29)
    expect(usage.five_hour).toBeNull()
    expect(usage.seven_day?.resets_at).toBe(new Date(1794534706000).toISOString())
  })

  it('derives reset time from the fetch timestamp when absolute reset time is absent', () => {
    const primary = { ...window(18000, 20), reset_at: 0 }
    expect(openAIQuotaToUsage(quota(primary, null), null)?.five_hour?.resets_at)
      .toBe(new Date(1800000120000).toISOString())
  })

  it('does not carry a stale seven-day value into a partial live response', () => {
    const previous = { seven_day: { utilization: 99 } } as AccountUsageInfo
    expect(openAIQuotaToUsage(quota(window(18000, 20), null), previous)?.seven_day).toBeNull()
  })

  it('supplements a missing 5h window using a recent actual request observation', () => {
    const now = Math.floor(Date.now() / 1000)
    const live = { ...quota(window(604800, 29), null), observed_windows: [{
      ...window(18000, 42), reset_at: now + 1200, sampled_at: now - 30, source: 'websocket' as const
    }] }
    const usage = openAIQuotaToUsage(live, null)!
    expect(usage.five_hour?.utilization).toBe(42)
    expect(usage.five_hour?.measurement_source).toBe('websocket')
    expect(usage.five_hour?.sampled_at).toBe(now - 30)
    expect(usage.seven_day?.utilization).toBe(29)
    expect(usage.seven_day?.measurement_source).toBe('quota_api')
    // A returned live 5h reading takes priority, even when it is zero.
    live.rate_limit!.secondary_window = window(18000, 0)
    expect(openAIQuotaToUsage(live, null)?.five_hour?.utilization).toBe(0)
  })

  it('does not reuse expired, stale, malformed or estimated traffic observations', () => {
    const now = Math.floor(Date.now() / 1000)
    const sample = { ...window(18000, 0), reset_at: now + 1200, sampled_at: now, source: 'response_headers' as const }
    for (const update of [{ sampled_at: now - 301 }, { reset_at: now - 1 }, { sampled_at: now + 60 },
      { used_percent: null }, { used_percent: 101 }, { source: 'estimated' }, { limit_window_seconds: 3600 }]) {
      const usage = openAIQuotaToUsage({ ...quota(window(604800, 29), null), observed_windows: [{ ...sample, ...update } as any] }, null)
      expect(usage?.five_hour).toBeNull()
    }
    expect(openAIQuotaToUsage({ ...quota(null, null), observed_windows: [sample] }, null)?.five_hour?.utilization).toBe(0)
  })

  it('keeps billing statistics only for the same reset window', () => {
    const stats = { requests: 10, tokens: 2000, cost: 1 }
    const previous = { five_hour: { resets_at: new Date(1800000120000).toISOString(), window_stats: stats } } as AccountUsageInfo
    expect(openAIQuotaToUsage(quota(window(18000, 20), null), previous)?.five_hour?.window_stats).toEqual(stats)
    previous.five_hour!.resets_at = new Date(1800000119000).toISOString()
    expect(openAIQuotaToUsage(quota(window(18000, 20), null), previous)?.five_hour?.window_stats).toBeUndefined()
  })
})
