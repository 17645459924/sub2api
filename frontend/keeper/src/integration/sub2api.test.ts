// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bounds, event, quotaRows, sub2apiFetch } from './sub2api'
import { fetchUsageOverview, fetchUsageOverviewComparisons, fetchUsageOverviewRealtime, fetchAnalysis, fetchAnalysisLatency, fetchUsageActivity, fetchUsageEvents } from '../lib/api'

let serial = 0
const envelope = (data: unknown) => new Response(JSON.stringify({ code: 0, data }), { headers: { 'Content-Type': 'application/json' } })
const page = (items: unknown[], total = items.length) => ({ items, total, page: 1, page_size: 100 })
const query = (path: string, init?: RequestInit) => sub2apiFetch(`/keeper/api/v1${path}`, init)
beforeEach(() => {
  window.__APP_BASE_PATH__ = '/keeper'
  localStorage.setItem('auth_token', `test-${++serial}`)
  vi.restoreAllMocks()
})
describe('Sub2API compatibility boundary', () => {
  it('loads selector labels from real accounts, including accounts with no usage', async () => {
    const fetch = vi.fn(async () => envelope(page([
      { id: 2, name: 'Claude production' }, { id: 42, name: 'Codex reserve' },
    ])))
    vi.stubGlobal('fetch', fetch)
    const result = await (await query('/usage/api-keys/options')).json()
    expect(result.options).toEqual([
      { id: 'account:2', label: 'Claude production (#2)' },
      { id: 'account:42', label: 'Codex reserve (#42)' },
    ])
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/admin/accounts?')
  })
  it('uses account_id across all charts and request events without confusing a matching API key ID', async () => {
    const timestamp = new Date(Date.now() - 60_000).toISOString()
    const success = [
      { id: 1, account_id: 2, api_key_id: 99, created_at: timestamp, request_id: 'selected', input_tokens: 11, output_tokens: 3, actual_cost: .9, model: 'selected-model' },
      { id: 2, account_id: 42, api_key_id: 2, created_at: timestamp, request_id: 'other', input_tokens: 1000, actual_cost: 50, model: 'other-model' },
    ]
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts')) return envelope(page([{ id: 2, name: 'Claude', platform: 'anthropic', type: 'oauth' }, { id: 42, name: 'Codex', platform: 'openai', type: 'oauth' }]))
      expect(url.searchParams.get('account_id')).toBe('2')
      expect(url.searchParams.has('api_key_id')).toBe(false)
      // Simulate an older backend ignoring filters to verify the adapter's own guard.
      return envelope(page(url.pathname.endsWith('/request-errors') ? [
        { id: 3, account_id: 2, api_key_id: 99, created_at: timestamp, request_id: 'selected-failure' },
        { id: 4, account_id: 42, api_key_id: 2, created_at: timestamp, request_id: 'other-failure' },
      ] : success))
    })
    vi.stubGlobal('fetch', fetch)
    const range = { range: '24h' as const }, account = 'account:2'
    expect((await fetchUsageOverview(range, undefined, account)).usage).toMatchObject({ total_requests: 2, total_tokens: 14, failure_count: 1 })
    const comparisons = await fetchUsageOverviewComparisons(range, { apiKeyId: account })
    expect(comparisons.models.some(m => m.key === 'other-model')).toBe(false)
    expect((await fetchAnalysis(range, undefined, account)).cost_summary.total_cost_usd).toBe(.9)
    await fetchAnalysisLatency(range, undefined, account)
    await fetchUsageOverviewRealtime({ apiKeyId: account })
    expect((await fetchUsageActivity({ request: range, apiKeyId: account })).total_success).toBe(1)
    const events = await fetchUsageEvents(range, undefined, { apiKeyId: account })
    expect(events.events.map(e => e.auth_index)).toEqual(['2', '2'])
    expect((await (await query('/usage/events?range=24h&account_id=2&source=42')).json()).total_count).toBe(0)
  })
  it('keeps actual zero distinct from missing, expired, or passive quota values', () => {
    const info = { source: 'active', five_hour: { utilization: 0 }, seven_day: { utilization: 0, utilization_unknown: true } }
    expect(quotaRows(info).map(r => r.usedPercent)).toEqual([0, undefined])
    expect(quotaRows({ ...info, source: 'passive' })[0]?.usedPercent).toBeUndefined()
    expect(quotaRows({ source: 'active', five_hour: { utilization: 0, resets_at: '2000-01-01T00:00:00Z' } })[0]?.usedPercent).toBeUndefined()
    expect(quotaRows({ source: 'active', five_hour: { utilization: null } })[0]?.usedPercent).toBeUndefined()
  })

  it('omits explicitly absent Claude windows and accepts recent real 5h header samples', () => {
    expect(quotaRows({ source: 'active', five_hour: { not_applicable: true, utilization: 0 }, seven_day: { utilization: 29 } }).map(r => r.key)).toEqual(['seven_day'])
    const sample = { source: 'passive', five_hour: { utilization: 0, measurement_source: 'response_headers', sampled_at: Date.now() / 1000, resets_at: '2099-01-01T00:00:00Z' } }
    expect(quotaRows(sample)[0]?.usedPercent).toBe(0)
    sample.five_hour.sampled_at -= 301
    expect(quotaRows(sample)[0]?.usedPercent).toBeUndefined()
  })

  it('falls back to actual Claude request samples when the official usage endpoint is denied', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts/8')) return envelope({ id: 8, platform: 'anthropic', type: 'setup-token' })
      if (url.searchParams.get('source') === 'active') return new Response(JSON.stringify({ message: 'scope denied' }), { status: 403 })
      expect(url.searchParams.get('source')).toBe('passive')
      return envelope({ source: 'passive', updated_at: new Date().toISOString(), five_hour: {
        utilization: 42, measurement_source: 'response_headers', sampled_at: Math.floor(Date.now() / 1000) - 60, resets_at: '2099-01-01T00:00:00Z'
      } })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['8'] }) })
    await vi.waitFor(async () => {
      const result = await (await query('/quota/refresh/8')).json()
      expect(result.status).toBe('completed')
      expect(result.quota.quota[0].usedPercent).toBe(42)
      expect(result.quota.quota[0].label).toContain('查询失败')
      expect(result.quota.notice).toBeUndefined()
      expect(+new Date(result.expires_at) - Date.now()).toBeLessThanOrEqual(240000)
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('explains a Claude profile-scope denial and keeps a real request sample', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts/8')) return envelope({ id: 8, platform: 'anthropic', type: 'setup-token' })
      if (url.searchParams.get('source') === 'active') {
        return new Response(JSON.stringify({ code: 403, message: 'upstream permission error', reason: 'CLAUDE_USAGE_PROFILE_SCOPE_REQUIRED' }), { status: 403 })
      }
      return envelope({ source: 'passive', updated_at: new Date().toISOString(), five_hour: {
        utilization: 42, measurement_source: 'response_headers', sampled_at: Math.floor(Date.now() / 1000) - 60, resets_at: '2099-01-01T00:00:00Z'
      } })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['8'] }) })
    await vi.waitFor(async () => {
      const result = await (await query('/quota/refresh/8')).json()
      expect(result.status).toBe('completed')
      expect(result.quota.quota[0].usedPercent).toBe(42)
      expect(result.quota.quota[0].label).not.toContain('查询失败')
      expect(result.quota.notice).toContain('user:profile')
    })
  })

  it('explains a Claude profile-scope denial when no request sample exists', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts/9')) return envelope({ id: 9, platform: 'anthropic', type: 'setup-token' })
      return new Response(JSON.stringify({ code: 403, message: 'upstream permission error', reason: 'CLAUDE_USAGE_PROFILE_SCOPE_REQUIRED' }), { status: 403 })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['9'] }) })
    await vi.waitFor(async () => {
      const result = await (await query('/quota/refresh/9')).json()
      expect(result.status).toBe('failed')
      expect(result.error).toContain('user:profile')
      expect(result.error).toContain('重复刷新不会补足权限')
    })
  })
  it('preserves recorded tokens and billed cost without claiming failed request cost', () => {
    const row = { id: 1, input_tokens: 10, output_tokens: 5, cache_read_tokens: 20, cache_creation_tokens: 2, actual_cost: .25 }
    expect(event(row).tokens).toMatchObject({ input_tokens: 32, total_tokens: 37 })
    expect(event(row).cost_usd).toBe(.25)
    expect(event(row, true).cost_available).toBe(false)
    expect(event(row, true).cost_usd).toBeUndefined()
  })
  it('uses exclusive local date/hour boundaries and rolling windows', () => {
    const now = new Date('2026-11-07T12:00:00Z')
    expect(+bounds(new URLSearchParams({ range: '5h' }), now).start).toBe(+now - 5 * 3600_000)
    const b = bounds(new URLSearchParams({ range: 'custom', unit: 'hour', start: '2026-11-06T00:00:00Z', end: '2026-11-06T05:00:00Z' }), now)
    expect(b.end.toISOString()).toBe('2026-11-06T06:00:00.000Z')
  })
  it('verifies the actual server role rather than trusting browser auth_user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope({ role: 'user' })))
    const res = await query('/auth/session')
    expect(res.status).toBe(403)
  })
  it('does not issue quota requests while reading an empty cache', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const res = await query('/quota/cache', { method: 'POST', body: JSON.stringify({ auth_indexes: ['1'] }) })
    expect((await res.json()).items[0]).toMatchObject({ status: 'failed' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('queries the selected OpenAI account and keeps unknown windows separate from real zero', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts/42')) return envelope({ id: 42, platform: 'openai', type: 'oauth' })
      expect(url.pathname).toBe('/api/v1/admin/openai/accounts/42/quota')
      return envelope({ fetched_at: Math.floor(Date.now()/1000), rate_limit: {
        primary_window: { limit_window_seconds: 18000, used_percent: 0, utilization_unknown: true },
        secondary_window: { limit_window_seconds: 604800, used_percent: 0 },
      } })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['42'] }) })
    await vi.waitFor(async () => {
      const task = await (await query('/quota/refresh/42')).json()
      expect(task.status).toBe('completed')
      expect(task.quota.quota.map((row: { usedPercent?: number }) => row.usedPercent)).toEqual([undefined, 0])
      expect(task.quota.notice).toContain('未返回 5h')
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('supplements only missing live windows with fresh observed quota and expires the cache with the sample', async () => {
    const now = Math.floor(Date.now() / 1000)
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts/44')) return envelope({ id: 44, platform: 'openai', type: 'oauth' })
      return envelope({ fetched_at: now, rate_limit: { primary_window: { used_percent: 29, limit_window_seconds: 604800 } }, observed_windows: [
        { used_percent: 42, limit_window_seconds: 18000, sampled_at: now - 30, reset_at: now + 1200, source: 'websocket' },
        { used_percent: 99, limit_window_seconds: 604800, sampled_at: now, reset_at: now + 3000, source: 'response_headers' }
      ] })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['44'] }) })
    await vi.waitFor(async () => {
      const task = await (await query('/quota/refresh/44')).json()
      expect(task.status).toBe('completed')
      expect(task.quota.quota.map((row: { usedPercent?: number }) => row.usedPercent)).toEqual([29, 42])
      expect(task.quota.notice).toBeUndefined()
      expect(new Date(task.expires_at).getTime()).toBe((now + 270) * 1000)
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('falls back to measured weekly snapshots on a legacy setup-token server', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/accounts/43')) return envelope({ id: 43, platform: 'anthropic', type: 'setup-token' })
      expect(url.pathname).toBe('/api/v1/admin/accounts/43/usage')
      if (url.searchParams.get('source') === 'active') return envelope({ five_hour: { utilization: 100 } })
      expect(url.searchParams.get('source')).toBe('passive')
      return envelope({ source: 'passive', updated_at: new Date().toISOString(),
        five_hour: { utilization: 100 }, seven_day: { utilization: 96, resets_at: '2099-01-01T00:00:00Z' } })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['43'] }) })
    await vi.waitFor(async () => {
      const task = await (await query('/quota/refresh/43')).json()
      expect(task.status).toBe('completed')
      expect(task.quota.quota.map((row: { usedPercent?: number }) => row.usedPercent)).toEqual([undefined, 96])
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('forces live Claude refresh, preserves actual zero, and isolates quota cache after a session change', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/usage')) {
        expect(url.searchParams.get('source')).toBe('active')
        expect(url.searchParams.get('force')).toBe('true')
        return envelope({ source: 'active', updated_at: new Date().toISOString(), five_hour: { utilization: 0 } })
      }
      return envelope({ id: 1, platform: 'anthropic' })
    })
    vi.stubGlobal('fetch', fetch)
    await query('/quota/refresh', { method: 'POST', body: JSON.stringify({ auth_indexes: ['1'] }) })
    await vi.waitFor(async () => {
      const task = await (await query('/quota/refresh/1')).json()
      expect(task.status).toBe('completed')
      expect(task.quota.quota[0].usedPercent).toBe(0)
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    localStorage.setItem('auth_token', 'another-admin')
    const res = await query('/quota/cache', { method: 'POST', body: JSON.stringify({ auth_indexes: ['1'] }) })
    expect((await res.json()).items[0].status).toBe('failed')
  })
  it('combines all pages, deduplicates recovered errors, and applies API key filtering to errors', async () => {
    const timestamp = new Date(Date.now() - 3600_000).toISOString()
    const rows = Array.from({ length: 101 }, (_, i) => ({ id: i + 1, created_at: timestamp, request_id: `r${i}`, api_key_id: 7, model: 'm', input_tokens: 1, actual_cost: .01 }))
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, 'https://example.test')
      if (url.pathname.endsWith('/request-errors')) return envelope(page([
        { id: 1, request_id: 'r0', created_at: timestamp, api_key_id: 7 },
        { id: 2, request_id: 'f1', created_at: timestamp, api_key_id: 7 },
        { id: 3, request_id: 'f2', created_at: timestamp, api_key_id: 8 },
      ]))
      return envelope(page(url.searchParams.get('page') === '2' ? rows.slice(100) : rows.slice(0, 100), 101))
    })
    vi.stubGlobal('fetch', fetch)
    const result = await (await query('/usage/events?range=24h&api_key_id=7&page_size=200')).json()
    expect(result.total_count).toBe(102)
    expect(result.events.filter((e: { failed: boolean }) => e.failed)).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('rejects oversized/incomplete data instead of presenting truncated totals', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope(page([], 50001))))
    const res = await query('/usage/overview?range=30d')
    expect(res.status).toBe(413)
    expect((await res.json()).error).toContain('50,000')
  })
  it('puts OAuth credentials in Keeper auth_type 1 and API providers in auth_type 2', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => envelope(input.startsWith('/api/v1/admin/accounts?') ? page([
      { id: 1, name: 'Claude', type: 'setup-token', platform: 'anthropic', status: 'active' },
      { id: 2, name: 'API', type: 'apikey', platform: 'openai', status: 'active' },
    ]) : page([]))))
    const data = await (await query('/usage/identities')).json()
    expect(data.identities.map((i: { auth_type: number; type: string }) => [i.auth_type, i.type])).toEqual([[1, 'claude'], [2, 'codex']])
  })
  it('returns explicit unsupported history rather than an invented empty timeline', async () => {
    expect((await query('/quota/history/1')).status).toBe(501)
  })
})
