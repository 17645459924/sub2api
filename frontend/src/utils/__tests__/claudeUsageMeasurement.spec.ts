import { describe, expect, it } from 'vitest'
import { isClaudeUsageUnknown } from '../claudeUsageMeasurement'
import type { Account, AccountUsageInfo } from '@/types'

const account = (raw?: number) => ({ type: 'setup-token', extra: raw == null ? {} : { session_window_utilization: raw } }) as Account
const usage = (percent: number, resetsAt: string | null, unknown?: boolean) => ({ source: 'passive', five_hour: {
  utilization: percent, resets_at: resetsAt, utilization_unknown: unknown
} }) as AccountUsageInfo

describe('Claude quota measurement provenance', () => {
  it('uses self-contained header observations without relying on account Extra', () => {
    const sample = usage(0, '2099-01-01T00:00:00Z')
    Object.assign(sample.five_hour!, { measurement_source: 'response_headers', sampled_at: Math.floor(Date.now() / 1000) })
    expect(isClaudeUsageUnknown(account(), sample, 'five_hour')).toBe(false)
    sample.five_hour!.sampled_at! -= 301
    expect(isClaudeUsageUnknown(account(), sample, 'five_hour')).toBe(true)
    Object.assign(sample.five_hour!, { sampled_at: Math.floor(Date.now() / 1000), not_applicable: true })
    expect(isClaudeUsageUnknown(account(), sample, 'five_hour')).toBe(true)
  })
  const future = '2099-01-01T00:00:00Z'
  it('hides legacy zero fallbacks and estimates without an upstream sample', () => {
    expect(isClaudeUsageUnknown(account(), usage(0, null), 'five_hour')).toBe(true)
    expect(isClaudeUsageUnknown(account(), usage(80, future), 'five_hour')).toBe(true)
    expect(isClaudeUsageUnknown(account(), usage(100, future), 'five_hour')).toBe(true)
  })
  it('retains a genuine upstream zero and measured nonzero values', () => {
    expect(isClaudeUsageUnknown(account(0), usage(0, future), 'five_hour')).toBe(false)
    expect(isClaudeUsageUnknown(account(0.53), usage(53, future), 'five_hour')).toBe(false)
  })
  it('accepts measured weekly snapshots even when the account DTO omits Extra', () => {
    const saved = { source: 'passive', seven_day: { utilization: 96, resets_at: future } } as AccountUsageInfo
    expect(isClaudeUsageUnknown(account(), saved, 'seven_day')).toBe(false)
    saved.seven_day!.resets_at = '2020-01-01T00:00:00Z'
    expect(isClaudeUsageUnknown(account(), saved, 'seven_day')).toBe(true)
  })
  it('rejects expired, mismatched, and explicitly unknown samples', () => {
    expect(isClaudeUsageUnknown(account(0.53), usage(0, '2020-01-01'), 'five_hour')).toBe(true)
    expect(isClaudeUsageUnknown(account(0.53), usage(0, future), 'five_hour')).toBe(true)
    expect(isClaudeUsageUnknown(account(0.53), usage(53, future, true), 'five_hour')).toBe(true)
  })
})
