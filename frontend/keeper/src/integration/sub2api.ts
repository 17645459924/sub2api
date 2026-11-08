/** Compatibility boundary. Keeper components remain upstream; all product data comes from Sub2API. */
import type { UsageEvent, UsageIdentity, UsageQuotaCacheItem, UsageQuotaRow } from '../lib/types'
import { applyPublicBranding } from './branding'

// API wire records vary between deployed Sub2API versions.
type RecordData = Record<string, any>
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
const MAX_ROWS = 50_000
class BridgeError extends Error {
  constructor(message: string, public status = 422, public reason = '') { super(message) }
}
const CLAUDE_SCOPE_REASON = 'CLAUDE_USAGE_PROFILE_SCOPE_REQUIRED'
const CLAUDE_SCOPE_NOTICE = '此 Token 缺少 user:profile 权限，无法实时查询额度。请重新完成 OAuth 授权，或使用真实请求采样；重复刷新不会补足权限。 / This token lacks user:profile permission for live quota queries. Reauthorize with OAuth or use real request samples. Refreshing cannot grant the missing permission.'
const fiveHourUnavailableNotice = (refreshed: string) => {
  const time = new Date(refreshed).toLocaleTimeString()
  return `已读取上游 · ${time}；上游未返回 5h 额度。 / Upstream read at ${time}; no 5h quota was returned.`
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const n = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0
const date = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const idOf = (s: string) => {
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) < 1) throw new BridgeError('Invalid account ID')
  return Number(s)
}
const provider = (p: string) => ({ anthropic: 'claude', openai: 'codex', grok: 'xai' }[p] || p)
const mem = new Map<string, { until: number; value: Promise<any> }>()
let owner = ''
const quotas = new Map<string, UsageQuotaCacheItem>()
const tasks = new Map<string, Promise<UsageQuotaCacheItem>>()

async function request(path: string, params: RecordData = {}, signal?: AbortSignal | null, init?: RequestInit) {
  const token = localStorage.getItem('auth_token') || ''
  if (owner !== token) { mem.clear(); quotas.clear(); tasks.clear(); owner = token }
  if (!token) throw new BridgeError('请先登录后台 / Sign in to the admin console', 401)
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
  const res = await fetch(`/api/v1${path}${query.size ? `?${query}` : ''}`, {
    ...init, signal, headers: { ...init?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await res.json()
  if (!res.ok || body.code !== 0) throw new BridgeError(body.message || `Sub2API HTTP ${res.status}`, res.ok ? 422 : res.status, String(body.reason || ''))
  return body.data
}

// Only completed, successful snapshots are shared. An aborted caller never cancels another caller's request.
async function cached<T>(key: string, fn: () => Promise<T>, signal?: AbortSignal | null): Promise<T> {
  const token = localStorage.getItem('auth_token') || ''
  const cacheKey = `${token}:${key}`
  let entry = mem.get(cacheKey)
  if (!entry || entry.until < Date.now()) {
    const value = fn().catch(e => { mem.delete(cacheKey); throw e })
    entry = { value, until: Date.now() + 10_000 }; mem.set(cacheKey, entry)
    if (mem.size > 40) mem.delete(mem.keys().next().value!)
  }
  const result = await entry.value
  signal?.throwIfAborted()
  return result
}

async function all(path: string, params: RecordData = {}, signal?: AbortSignal | null): Promise<RecordData[]> {
  const rows: RecordData[] = []
  for (let page = 1; ; page++) {
    const data = await request(path, { ...params, page, page_size: 100, exact_total: true }, signal)
    if (!Array.isArray(data.items) || !Number.isFinite(data.total)) throw new BridgeError('接口未返回完整分页数据 / Invalid pagination')
    rows.push(...data.items)
    if (data.total > MAX_ROWS) throw new BridgeError('当前范围超过 50,000 条，请缩小时间范围；未显示截断统计。 / Narrow the range (50,000 record limit).', 413)
    if (rows.length >= data.total) return [...new Map(rows.map(row => [row.id, row])).values()]
    if (!data.items.length || page >= 500) throw new BridgeError('分页数据不完整，无法计算真实统计 / Incomplete pagination')
  }
}

export function bounds(q: URLSearchParams, now = new Date()): { start: Date; end: Date } {
  const end = new Date(now); const start = new Date(now)
  const range = q.get('range') || 'today'
  const window = q.get('window')
  if (range === 'custom') {
    const s = q.get('start') || ''; const e = q.get('end') || ''
    const hour = q.get('unit') === 'hour'
    const a = new Date(hour ? s : `${s}T00:00:00`)
    const b = new Date(hour ? e : `${e}T00:00:00`)
    if (hour) b.setTime(b.getTime() + 3600_000)
    else b.setDate(b.getDate() + 1)
    if (!Number.isFinite(+a) || !Number.isFinite(+b) || +b <= +a) throw new BridgeError('Invalid time range')
    return { start: a, end: b }
  }
  if (window && /^(15|30|60)m$/.test(window)) start.setTime(+end - parseInt(window) * 60_000)
  else if (window && ['day', 'week', 'month', 'year'].includes(window)) start.setDate(start.getDate() - ({ day: 1, week: 7, month: 30, year: 365 }[window]!))
  else if (range === 'yesterday') { end.setHours(0, 0, 0, 0); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 1) }
  else if (/^\d+[hd]$/.test(range)) start.setTime(+end - parseInt(range) * (range.endsWith('h') ? 3600_000 : 86400_000))
  else start.setHours(0, 0, 0, 0)
  return { start, end }
}

export function event(row: RecordData, failed = false): UsageEvent {
  const input = n(row.input_tokens), output = n(row.output_tokens), read = n(row.cache_read_tokens), creation = n(row.cache_creation_tokens)
  return {
    id: `${failed ? 'error' : 'usage'}-${row.id}`, request_id: row.request_id,
    timestamp: row.created_at, api_key: row.api_key_id != null ? String(row.api_key_id) : row.api_key?.name || (row.api_key_id != null ? String(row.api_key_id) : undefined),
    model: row.model || 'unknown', response_model: row.upstream_response_model || undefined,
    reasoning_effort: row.reasoning_effort, service_tier: row.service_tier, endpoint: row.inbound_endpoint,
    source: row.account?.name || row.account_name || (row.account_id != null ? String(row.account_id) : 'unknown'),
    auth_index: row.account_id != null ? String(row.account_id) : undefined,
    failed, status_code: failed ? row.status_code : undefined, stream: row.stream,
    latency_ms: n(row.duration_ms), ttft_ms: row.first_token_ms ?? undefined,
    client_ip: row.ip_address || row.client_ip, user_agent: row.user_agent,
    tokens: { input_tokens: input + read + creation, output_tokens: output, cache_read_tokens: read,
      cache_creation_tokens: creation, reasoning_tokens: 0, total_tokens: input + output + read + creation },
    cost_usd: failed ? undefined : row.actual_cost, cost_available: !failed && typeof row.actual_cost === 'number',
  }
}

async function dataset(q: URLSearchParams, signal?: AbortSignal | null) {
  const { start, end } = bounds(q)
  const accountId = q.get('account_id') || q.get('source') || undefined
  if (accountId) idOf(accountId)
  const params = { start_date: date(start), end_date: date(end), timezone: zone, model: q.get('model') || undefined,
    api_key_id: q.get('api_key_id') || undefined, account_id: accountId, sort_by: 'created_at', sort_order: 'desc' }
  const sourceId = q.get('source')
  const key = JSON.stringify({ params, sourceId, start: Math.floor(+start / 10_000), end: Math.floor(+end / 10_000) })
  // Round only the cache identity, never the requested time boundaries.
  return cached('events:' + key, async () => {
    const [success, errors] = await Promise.all([
      all('/admin/usage', params),
      all('/admin/ops/request-errors', { start_time: start.toISOString(), end_time: end.toISOString(),
        model: params.model, account_id: params.account_id, api_key_id: params.api_key_id, sort_by: 'created_at', sort_order: 'desc' }),
    ])
    const ids = new Set(success.map(r => r.request_id).filter(Boolean))
    const failures = errors.filter(r => {
      if (params.api_key_id && String(r.api_key_id) !== params.api_key_id) return false
      if (params.account_id && String(r.account_id) !== params.account_id) return false
      if (!r.request_id) return true
      if (ids.has(r.request_id)) return false
      ids.add(r.request_id); return true
    })
    const events = [...success.map(r => event(r)), ...failures.map(r => event(r, true))]
      .filter(r => +new Date(r.timestamp) >= +start && +new Date(r.timestamp) < +end)
      .filter(r => (!accountId || r.auth_index === accountId) && (!sourceId || r.auth_index === sourceId) &&
        (!params.api_key_id || r.api_key === params.api_key_id) && (!params.model || r.model === params.model))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    return { start, end, events }
  }, signal)
}

function sum(events: UsageEvent[]) {
  const tokens = { input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, total_tokens: 0 }
  for (const e of events) for (const key of Object.keys(tokens) as (keyof typeof tokens)[]) tokens[key] += e.tokens[key]
  return { ...tokens, requests: events.length, failures: events.filter(e => e.failed).length,
    cost: events.reduce((v, e) => v + (e.cost_usd ?? 0), 0),
    cost_available: events.filter(e => !e.failed).every(e => e.cost_available) }
}
function groups(events: UsageEvent[], field: 'model' | 'api_key' | 'auth_index' | 'source' | ((event: UsageEvent) => string)) {
  const map = new Map<string, UsageEvent[]>()
  for (const e of events) { const k = (typeof field === 'function' ? field(e) : e[field]) || 'unknown'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(e) }
  return [...map].map(([key, rows]) => ({ key, label: field === 'auth_index' ? rows[0]!.source : key, ...sum(rows) }))
    .sort((a, b) => b.total_tokens - a.total_tokens)
}
function buckets(events: UsageEvent[], start: Date, end: Date, seconds: number) {
  const count = Math.max(1, Math.ceil((+end - +start) / (seconds * 1000)))
  const rows: UsageEvent[][] = Array.from({ length: count }, () => [])
  for (const e of events) { const index = Math.floor((+new Date(e.timestamp) - +start) / (seconds * 1000)); rows[index]?.push(e) }
  return rows.map((es, i) => ({ bucket: new Date(+start + i * seconds * 1000).toISOString(), ...sum(es) }))
}
const percentile = (values: number[], p: number) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]! : 0
function latency(events: UsageEvent[]) {
  const points = events.filter(e => !e.failed && e.ttft_ms != null && e.latency_ms > 0)
    .map(e => ({ ttft_ms: e.ttft_ms!, latency_ms: e.latency_ms }))
  return { points, density: [], total_points: points.length, sampled: false,
    p95_ttft_ms: percentile(points.map(e => e.ttft_ms), .95), p95_latency_ms: percentile(points.map(e => e.latency_ms), .95),
    max_ttft_ms: Math.max(0, ...points.map(e => e.ttft_ms)), max_latency_ms: Math.max(0, ...points.map(e => e.latency_ms)) }
}
function speedSample(events: UsageEvent[]) {
  const speeds = events.filter(e => !e.failed && e.ttft_ms != null && e.latency_ms > e.ttft_ms && e.tokens.output_tokens > 0)
    .map(e => e.tokens.output_tokens * 1000 / (e.latency_ms - e.ttft_ms!))
  const sum = speeds.reduce((a, b) => a + b, 0)
  return { speed_tps_sum: sum, speed_sample_count: speeds.length, mean_tps: speeds.length ? sum / speeds.length : null }
}

async function analytics(path: string, q: URLSearchParams, signal?: AbortSignal | null) {
  const { events, start, end } = await dataset(q, signal)
  const accounts = await cached('accounts', () => all('/admin/accounts'), signal)
  const roster = new Map(accounts.map(a => [String(a.id), a]))
  const isProvider = (e: UsageEvent) => ['apikey', 'upstream'].includes(roster.get(e.auth_index!)?.type)
  const credentialEvents = events.filter(e => !isProvider(e)), providerEvents = events.filter(isProvider)
  const total = sum(events), minutes = Math.max(1, (+end - +start) / 60_000)
  const seconds = minutes <= 1440 ? 3600 : 86400
  const series = buckets(events, start, end, seconds)
  const compare = (rows: UsageEvent[], field: 'model' | 'api_key' | 'auth_index') => groups(rows, field).map(g => ({ ...g,
    cost: g.cost_available ? g.cost : null,
    token_series: buckets(rows.filter(e => e[field] === g.key), start, end, seconds).map(b => b.total_tokens) }))
  const comparison = { timezone: zone, buckets: series.map(s => s.bucket), granularity: seconds === 3600 ? 'hourly' : 'daily',
    models: compare(events, 'model'), api_keys: compare(events, 'api_key'), credentials: compare(credentialEvents, 'auth_index'), ai_providers: compare(providerEvents, 'auth_index') }
  if (path.endsWith('/comparisons')) return comparison
  if (path.endsWith('/latency')) return latency(events)
  if (path.endsWith('/realtime')) {
    const step = q.get('window') === '60m' ? 120 : q.get('window') === '30m' ? 60 : 30
    const bs = buckets(events, start, end, step)
    const mid = new Date((+start + +end) / 2)
    const top = (field: 'model' | 'api_key' | 'auth_index') => groups(events, field).map(g => ({ ...g, tokens: g.total_tokens, share: total.total_tokens ? g.total_tokens / total.total_tokens : 0 }))
    return { window: q.get('window') || '15m', timezone: zone, bucket_seconds: step,
      window_start: start.toISOString(), window_end: end.toISOString(),
      token_velocity: bs.map(b => ({ bucket: b.bucket, tokens: b.total_tokens, tokens_per_minute: b.total_tokens * 60 / step, cost: b.cost })),
      latency_scatter: latency(events), current_usage: { models: top('model'), api_keys: top('api_key'),
        credentials: groups(credentialEvents, 'auth_index').map(g => ({ ...g, tokens: g.total_tokens, share: total.total_tokens ? g.total_tokens / total.total_tokens : 0 })),
        ai_providers: groups(providerEvents, 'auth_index').map(g => ({ ...g, tokens: g.total_tokens, share: total.total_tokens ? g.total_tokens / total.total_tokens : 0 })) },
      model_speed: { available: speedSample(events).speed_sample_count > 0, start: start.toISOString(), mid: mid.toISOString(), end: end.toISOString(),
        series: groups(events, 'model').map(g => {
          const es = events.filter(e => e.model === g.key)
          return { model: g.key, total_tokens: g.total_tokens, speed_sample_count: speedSample(es).speed_sample_count,
            first_half: speedSample(es.filter(e => +new Date(e.timestamp) < +mid)), second_half: speedSample(es.filter(e => +new Date(e.timestamp) >= +mid)) }
        }) },
      request_level: bs.map(b => ({ bucket: b.bucket, requests: b.requests, requests_per_minute: b.requests * 60 / step })),
      cache_level: bs.map(b => ({ ...b, cache_read_rate: b.input_tokens ? b.cache_read_tokens / b.input_tokens : null })),
      insights: { summary: { ...total, token_requests: events.filter(e => e.tokens.total_tokens > 0).length, cached_requests: events.filter(e => e.tokens.cache_read_tokens > 0).length }, outcomes: bs },
    }
  }
  if (path.endsWith('/activity')) {
    // The original Keeper grid has exactly seven rows and fifty-two columns.
    const activityStep = Math.max(1, (+end - +start) / 364_000)
    const activitySeries = buckets(events, start, end, activityStep)
    return { window: q.get('window') || 'day', grain: minutes <= 1440 ? 'short' : minutes <= 10080 ? 'medium' : 'daily', timezone: zone,
      ...total, total_success: total.requests - total.failures, total_failure: total.failures,
      success_rate: total.requests ? (total.requests - total.failures) / total.requests * 100 : 0,
      rows: 7, columns: 52, bucket_seconds: activityStep, window_start: start.toISOString(), window_end: end.toISOString(),
      blocks: activitySeries.map(b => ({ ...b, start_time: b.bucket, end_time: new Date(+new Date(b.bucket) + activityStep * 1000).toISOString(),
        success: b.requests - b.failures, failure: b.failures, rate: b.requests ? (b.requests - b.failures) / b.requests : 0 })) }
  }
  if (path.endsWith('/analysis')) {
    const compose = (field: 'model' | 'api_key' | 'auth_index', rows = events) => groups(rows, field).map(g => ({ ...g, percent: total.total_tokens ? g.total_tokens / total.total_tokens * 100 : 0, cost_usd: g.cost }))
    const cells = groups(events, e => JSON.stringify([e.api_key || 'unknown', e.model])).map(g => {
      const [api_key, model] = JSON.parse(g.key)
      return { ...g, api_key, model, cost_usd: g.cost, intensity: total.total_tokens ? g.total_tokens / total.total_tokens : 0 }
    })
    const models = groups(events, 'model')
    return { granularity: comparison.granularity, timezone: zone, range_start: start.toISOString(), range_end: end.toISOString(),
      token_usage: series.map(s => ({ ...s, cost_usd: s.cost })), model_composition: compose('model'), api_key_composition: compose('api_key'),
      credentials_composition: compose('auth_index', credentialEvents), ai_provider_composition: compose('auth_index', providerEvents),
      model_usage: { buckets: series.map(s => s.bucket), series: models.map(m => {
        const bs = buckets(events.filter(e => e.model === m.key), start, end, seconds)
        return { model: m.key, total_tokens: bs.map(b => b.total_tokens), requests: bs.map(b => b.requests) }
      }) },
      model_speed: { range_start: start.toISOString(), range_end: end.toISOString(),
        buckets: series.map(b => ({ start: b.bucket, end: new Date(+new Date(b.bucket) + seconds * 1000).toISOString() })),
        series: models.map(m => {
          const es = events.filter(e => e.model === m.key)
          return { model: m.key, total_tokens: m.total_tokens, speed_sample_count: speedSample(es).speed_sample_count,
            samples: series.map(b => speedSample(es.filter(e => +new Date(e.timestamp) >= +new Date(b.bucket) && +new Date(e.timestamp) < +new Date(b.bucket) + seconds * 1000))) }
        }) },
      heatmap: { api_keys: [...new Set(events.map(e => e.api_key || 'unknown'))], api_key_labels: {}, models: models.map(m => m.key), cells },
      cost_summary: { total_cost_usd: total.cost, cost_available: total.cost_available },
      model_efficiency: groups(events, 'model').map(g => ({ ...g, model: g.key, cost_usd: g.cost,
        cost_per_request_usd: g.requests ? g.cost / g.requests : 0, output_tokens_per_request: g.requests ? g.output_tokens / g.requests : 0,
        cache_read_rate: g.input_tokens ? g.cache_read_tokens / g.input_tokens : 0 })) }
  }
  return { timezone: zone, usage: { total_requests: total.requests, success_count: total.requests - total.failures, failure_count: total.failures, total_tokens: total.total_tokens },
    summary: { ...total, total_cost: total.cost, rpm: total.requests / minutes, tpm: total.total_tokens / minutes,
      daily_average_requests: total.requests / Math.max(1, Math.ceil(minutes / 1440)), daily_average_tokens: total.total_tokens / Math.max(1, Math.ceil(minutes / 1440)),
      daily_average_cost: total.cost / Math.max(1, Math.ceil(minutes / 1440)), daily_average_range_days: Math.max(1, Math.ceil(minutes / 1440)) },
    series: { buckets: series.map(s => s.bucket), requests: series.map(s => s.requests), tokens: series.map(s => s.total_tokens),
      rpm: series.map(s => s.requests * 60 / seconds), tpm: series.map(s => s.total_tokens * 60 / seconds), cost: series.map(s => s.cost),
      cache_read_rate: series.map(s => s.input_tokens ? s.cache_read_tokens / s.input_tokens : null) } }
}

async function identities(signal?: AbortSignal | null): Promise<UsageIdentity[]> {
  return cached('identities', async () => {
    const [accounts, data] = await Promise.all([all('/admin/accounts'), dataset(new URLSearchParams({ range: '30d' }))])
    return accounts.map(a => {
      const es = data.events.filter(e => e.auth_index === String(a.id)), stats = sum(es)
      const auth = a.type === 'apikey' || a.type === 'upstream' ? 2 : 1
      const healthEnd = new Date(), healthStart = new Date(+healthEnd - 18000_000)
      const recent = es.filter(e => +new Date(e.timestamp) >= +healthStart && +new Date(e.timestamp) < +healthEnd), hs = sum(recent)
      const health = { window_seconds: 18000, bucket_seconds: 600, window_start: healthStart.toISOString(), window_end: healthEnd.toISOString(),
        total_success: hs.requests - hs.failures, total_failure: hs.failures, success_rate: hs.requests ? (hs.requests - hs.failures) / hs.requests * 100 : 0,
        input_tokens: hs.input_tokens, cache_read_tokens: hs.cache_read_tokens,
        buckets: buckets(recent, healthStart, healthEnd, 600).map(b => ({ start_time: b.bucket, end_time: new Date(+new Date(b.bucket) + 600_000).toISOString(),
          success: b.requests - b.failures, failure: b.failures, rate: b.requests ? (b.requests - b.failures) / b.requests : 0 })) }
      return { id: String(a.id), identity: String(a.id), name: a.name, displayName: a.name, auth_type: auth, auth_type_name: auth === 1 ? a.type : 'API Key',
        type: provider(a.platform), provider: provider(a.platform), prefix: '', priority: a.priority, disabled: a.status !== 'active' || a.schedulable === false,
        note: a.notes, ...stats, credential_health: health, total_requests: stats.requests, success_count: stats.requests - stats.failures, failure_count: stats.failures,
        last_aggregated_usage_event_id: '', last_used_at: es[0]?.timestamp, is_deleted: false, created_at: a.created_at, updated_at: a.updated_at,
        subscription: a.extra?.subscription_tier ? { provider: provider(a.platform), plan: a.extra.subscription_tier } : undefined } as UsageIdentity
    })
  }, signal)
}

export function quotaRows(info: RecordData): UsageQuotaRow[] {
  const keys = ['five_hour', 'seven_day', 'seven_day_sonnet', 'seven_day_fable', 'thirty_day', 'gemini_shared_daily', 'gemini_pro_daily', 'gemini_flash_daily']
  const labels: Record<string, string> = { five_hour: '5h', seven_day: '7d', seven_day_sonnet: 'Sonnet 7d', thirty_day: '30d' }
  return keys.filter(key => info[key] && !info[key].not_applicable).map(key => {
    const v = info[key]
    const expired = v.resets_at && +new Date(v.resets_at) <= Date.now()
    const sampled = ['quota_api', 'response_headers'].includes(v.measurement_source)
    const fresh = !sampled || (typeof v.sampled_at === 'number' && v.sampled_at > 0 && v.sampled_at * 1000 <= Date.now() + 5000 && Date.now() < v.sampled_at * 1000 + 300000)
    const measuredSource = sampled || info.source === 'active' || (info.source === 'passive' && key !== 'five_hour')
    const known = measuredSource && fresh && !expired && !v.utilization_unknown && typeof v.utilization === 'number' && Number.isFinite(v.utilization)
    const label = labels[key] || key
    const sampleLabel = sampled && (v.measurement_source === 'response_headers' || info.source === 'passive')
      ? `${label} · 采样 / Sample ${new Date(v.sampled_at * 1000).toLocaleString()}` : label
    return { key, label: info.query_failed && !info.scope_denied ? `${sampleLabel} · 查询失败 / Query failed` : sampleLabel, usedPercent: known ? v.utilization : undefined, resetAt: v.resets_at || undefined,
      window: { seconds: key === 'five_hour' ? 18000 : key.startsWith('seven_day') ? 604800 : key === 'thirty_day' ? 2592000 : 86400 },
      window_usage_tokens: known ? v.window_stats?.tokens : undefined, window_usage_cost: known ? v.window_stats?.user_cost : undefined }
  })
}

async function loadQuota(id: string, signal?: AbortSignal | null): Promise<UsageQuotaCacheItem> {
  idOf(id)
  const a = await request(`/admin/accounts/${id}`, {}, signal)
  let quota: UsageQuotaRow[], refreshed: string
  let observationExpires = Infinity
  let confirmedAbsent = false
  let notice: string | undefined
  if (a.platform === 'openai') {
    const info = await request(`/admin/openai/accounts/${id}/quota`, {}, signal)
    refreshed = info.fetched_at ? new Date(info.fetched_at * 1000).toISOString() : new Date().toISOString()
    quota = [info.rate_limit?.primary_window, info.rate_limit?.secondary_window].map((v: RecordData, i: number): UsageQuotaRow | null => v ? ({
      key: `rate_limit.${i ? 'secondary' : 'primary'}_window`, label: 'Window', window: { seconds: v.limit_window_seconds },
      usedPercent: !v.utilization_unknown && typeof v.used_percent === 'number' && Number.isFinite(v.used_percent) && !(v.reset_at > 0 && v.reset_at * 1000 <= Date.now()) ? v.used_percent : undefined,
      resetAt: v.reset_at > 0 ? new Date(v.reset_at * 1000).toISOString() : v.reset_after_seconds > 0 ? new Date(+new Date(refreshed) + v.reset_after_seconds * 1000).toISOString() : undefined,
    }) : null).filter((row): row is UsageQuotaRow => row !== null)
    for (const sample of info.observed_windows ?? []) {
      const seconds = sample.limit_window_seconds
      if (![18000, 604800].includes(seconds) || sample.utilization_unknown ||
        typeof sample.used_percent !== 'number' || !Number.isFinite(sample.used_percent) || sample.used_percent < 0 || sample.used_percent > 100 ||
        typeof sample.sampled_at !== 'number' || sample.sampled_at <= 0 || sample.sampled_at * 1000 > Date.now() + 5000 || Date.now() - sample.sampled_at * 1000 > 300000 ||
        typeof sample.reset_at !== 'number' || !Number.isFinite(sample.reset_at) || sample.reset_at * 1000 <= Date.now() ||
        !['response_headers', 'websocket'].includes(sample.source)) continue
      if (quota.some(row => row.window?.seconds === seconds && row.usedPercent !== undefined)) continue
      quota = quota.filter(row => row.window?.seconds !== seconds)
      observationExpires = Math.min(observationExpires, sample.sampled_at * 1000 + 300000)
      quota.push({ key: `observed.${seconds}`, label: `${seconds === 18000 ? '5h' : '7d'} · ${new Date(sample.sampled_at * 1000).toLocaleString()}`,
        window: { seconds }, usedPercent: sample.used_percent, resetAt: new Date(sample.reset_at * 1000).toISOString() })
    }
    const hasFiveHour = quota.some(row => row.window?.seconds === 18000 && row.usedPercent !== undefined)
    if (!hasFiveHour && quota.some(row => row.usedPercent !== undefined)) notice = fiveHourUnavailableNotice(refreshed)
  } else {
    let info: RecordData
    try {
      info = await request(`/admin/accounts/${id}/usage`, { source: 'active', force: true }, signal)
    } catch (error) {
      if (a.platform !== 'anthropic' || signal?.aborted) throw error
      const denied = error instanceof BridgeError && error.reason === CLAUDE_SCOPE_REASON
      let passive: RecordData
      try {
        passive = await request(`/admin/accounts/${id}/usage`, { source: 'passive', force: true }, signal)
      } catch {
        if (denied) throw new BridgeError(CLAUDE_SCOPE_NOTICE, 403, CLAUDE_SCOPE_REASON)
        throw error
      }
      if (!quotaRows(passive).some(row => row.usedPercent !== undefined)) {
        if (denied) throw new BridgeError(CLAUDE_SCOPE_NOTICE, 403, CLAUDE_SCOPE_REASON)
        throw error
      }
      info = { ...passive, source: 'passive', query_failed: true, scope_denied: denied }
    }
    if (a.platform === 'anthropic' && a.type === 'setup-token' && !info.source) {
      info = await request(`/admin/accounts/${id}/usage`, { source: 'passive', force: true }, signal)
      info = { ...info, source: 'passive' }
    }
    if (info.error) throw new BridgeError(info.error)
    quota = quotaRows(info); refreshed = info.updated_at || new Date().toISOString()
    for (const key of ['five_hour', 'seven_day', 'seven_day_sonnet', 'seven_day_fable']) {
      const progress = info[key]
      if (!progress?.sampled_at || !progress.measurement_source) continue
      observationExpires = Math.min(observationExpires, progress.sampled_at * 1000 + 300000)
      if (progress.not_applicable && progress.measurement_source === 'quota_api' && progress.sampled_at * 1000 + 300000 > Date.now()) confirmedAbsent = true
    }
    if (info.scope_denied) notice = CLAUDE_SCOPE_NOTICE
  }
  if ((!quota.length || quota.every(row => row.usedPercent === undefined)) && !confirmedAbsent) throw new BridgeError('未知：上游未返回可验证的额度数据 / Upstream quota unavailable')
  const resets = quota.map(row => row.resetAt ? +new Date(row.resetAt) : Infinity).filter(t => t > Date.now())
  const expires = Math.min(Date.now() + 300_000, observationExpires, ...resets)
  return { auth_index: id, status: 'completed', quota: { id, quota, ...(notice ? { notice } : {}) }, refreshed_at: refreshed, expires_at: new Date(expires).toISOString() }
}

async function dispatch(path: string, q: URLSearchParams, init?: RequestInit): Promise<unknown> {
  const signal = init?.signal, method = init?.method || 'GET'
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
  if (path === '/startup/status') {
    const response = await fetch('/api/v1/settings/public', { signal })
    const publicSettings = await response.json()
    if (!response.ok || publicSettings.code !== 0) throw new BridgeError('Sub2API unavailable', 502)
    applyPublicBranding(publicSettings.data || {})
    return { phase: 'ready', message: '', progress: null }
  }
  if (path === '/auth/session') {
    const user = await request('/auth/me', {}, signal)
    if (user.role !== 'admin') throw new BridgeError('Administrator access required', 403)
    return { authenticated: true, role: 'admin', oidc_login_enabled: false }
  }
  if (path === '/auth/logout') {
    // Let the host revoke the session and clear its Pinia state.
    window.parent.postMessage({ type: 'sub2api:logout' }, window.location.origin)
    return {}
  }
  if (path === '/status') {
    await request('/auth/me', {}, signal)
    return { running: true, sync_running: false, timezone: zone, cpa_request_log_access_enabled: false,
      last_warning: 'Sub2API 实时数据：费用为实际扣费；凭证统计为近 30 天；失败来自已记录的请求错误。独立推理 Token 与历史额度百分比未记录。' }
  }
  if (path === '/version') return { version: '', updateCheckEnabled: false }
  if (path === '/quota/cache') return { items: (body.auth_indexes || []).map(String).map((id: string) => {
    const item = quotas.get(id)
    return item && (!item.expires_at || +new Date(item.expires_at) > Date.now()) ? item :
      { auth_index: id, status: 'failed', error: '未知：请点击刷新查询上游额度 / Unknown: refresh to query upstream' }
  }) }
  if (path === '/quota/refresh' && method === 'POST') {
    const ids = [...new Set<string>((body.auth_indexes || []).map(String))]
    if (ids.length > 100) throw new BridgeError('At most 100 accounts per refresh')
    ids.forEach(id => idOf(id))
    const token = localStorage.getItem('auth_token')
    // Bounded concurrency prevents an entire page of upstream quota calls firing at once.
    let chain = Promise.resolve()
    for (let i = 0; i < ids.length; i += 3) {
      const batch = ids.slice(i, i + 3)
      const ready = chain
      const pending = batch.map(id => {
        if (tasks.has(id)) return tasks.get(id)!
        const task = ready.then(() => {
          if (localStorage.getItem('auth_token') !== token) throw new BridgeError('Session changed', 401)
          return loadQuota(id)
        }).catch(e => ({ auth_index: id, status: 'failed' as const, error: e.message, http_status_code: e.status }))
          .then(value => { if (localStorage.getItem('auth_token') === token) { quotas.set(id, value); tasks.delete(id) }; return value })
        tasks.set(id, task); return task
      })
      chain = Promise.all(pending).then(() => {})
    }
    return { tasks: ids.map(authIndex => ({ authIndex })), rejected: [], accepted: ids.length, skipped: 0, limit: ids.length }
  }
  if (path.startsWith('/quota/refresh/')) {
    const id = path.split('/').pop()!; idOf(id)
    if (tasks.has(id)) return { authIndex: id, status: 'running' }
    const value = quotas.get(id)
    return value ? { ...value, authIndex: id } : { authIndex: id, status: 'failed', error: '未知：尚未查询上游 / Not queried' }
  }
  if (path.startsWith('/quota/history/')) throw new BridgeError('Sub2API 尚未保存历史额度快照；历史请求、Token 和费用请查看 Analysis。 / Historical quota snapshots are not recorded.', 501)
  if (path === '/usage/identities' || path === '/usage/identities/page' || /^\/usage\/identities\/\d+$/.test(path)) {
    if (method !== 'GET') throw new BridgeError('请在 Sub2API 账号管理修改账号 / Manage accounts in Sub2API', 501)
    const items = await identities(signal)
    if (/\/\d+$/.test(path)) { const item = items.find(i => i.id === path.split('/').pop()); if (!item) throw new BridgeError('Account not found', 404); return item }
    if (path === '/usage/identities') return { identities: items }
    const types = q.getAll('type'), auth = q.get('auth_type')
    const scoped = items.filter(i => !auth || i.auth_type === Number(auth))
    let filtered = scoped.filter(i => (!types.length || types.includes(i.type)) && (q.get('active_only') !== 'true' || !i.disabled))
    const sort = q.get('sort') || 'priority'
    filtered = [...filtered].sort((a, b) => sort === 'last_used_at' ? +(new Date(b.last_used_at || 0)) - +(new Date(a.last_used_at || 0)) : n(b[sort as keyof UsageIdentity]) - n(a[sort as keyof UsageIdentity]))
    const page = Math.max(1, n(Number(q.get('page'))) || 1), size = Math.max(1, Math.min(100, n(Number(q.get('page_size'))) || 20))
    return { identities: filtered.slice((page - 1) * size, page * size), total_count: filtered.length, page, page_size: size, total_pages: Math.ceil(filtered.length / size),
      type_counts: [...new Set(scoped.map(i => i.type))].map(type => ({ type, count: scoped.filter(i => i.type === type).length })) }
  }
  if (path === '/usage/events/filters/sources') return { sources: (await identities(signal)).map(i => ({ value: i.id, label: i.name, displayName: i.name })) }
  if (path === '/usage/events/filters/models') {
    const data = await request('/admin/dashboard/models', { start_date: date(new Date(Date.now() - 30 * 86400_000)), end_date: date(new Date()), timezone: zone }, signal)
    return { models: data.models.map((m: RecordData) => m.model) }
  }
  if (/^\/usage\/events\/[^/]+\/request-log$/.test(path)) return { available: false, sections: [], downloadable: false }
  if (/^\/usage\/identities\/\d+\/errors$/.test(path)) {
    const id = path.split('/')[3]!; idOf(id)
    const { events } = await dataset(new URLSearchParams({ range: '30d', source: id }), signal)
    const failed = events.filter(e => e.failed), offset = Number(q.get('cursor')) || 0, size = 50
    return { events: failed.slice(offset, offset + size).map(e => ({ id: e.id, timestamp: e.timestamp,
      model: e.model, status_code: e.status_code, body_summary: '', body_truncated: false, retryable: false })),
      has_more: offset + size < failed.length, next_cursor: offset + size < failed.length ? String(offset + size) : undefined }
  }
  if (path === '/usage/api-keys/options') {
    // The upstream selector is reused as the host account selector. Namespace
    // values so account IDs can never collide with real downstream API key IDs.
    const accounts = await cached('accounts', () => all('/admin/accounts'), signal)
    return { options: accounts.map(a => ({ id: `account:${a.id}`, label: `${a.name || 'Account'} (#${a.id})` })) }
  }
  if (path === '/usage/events' || path === '/usage/events/export') {
    let { events } = await dataset(q, signal)
    const auth = q.get('auth_type')
    if (auth) { const ids = new Set((await identities(signal)).filter(i => i.auth_type === Number(auth)).map(i => i.id)); events = events.filter(e => ids.has(e.auth_index!)) }
    const result = q.get('result')
    if (result && result !== 'all') events = events.filter(e => result === 'success' ? !e.failed : e.failed)
    if (path.endsWith('/export')) {
      const csv = q.get('format') === 'csv'
      const fields = ['timestamp', 'request_id', 'model', 'source', 'failed', 'latency_ms', 'cost_usd'] as const
      const escape = (value: unknown) => { const s = String(value ?? ''); return `"${s.replace(/"/g, '""')}"` }
      const content = csv ? [fields.join(','), ...events.map(e => fields.map(k => escape(e[k])).join(','))].join('\r\n') : JSON.stringify(events)
      return new Response(content, { headers: { 'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json', 'Content-Disposition': `attachment; filename="usage.${csv ? 'csv' : 'json'}"` } })
    }
    const size = Math.max(1, Math.min(200, Number(q.get('page_size')) || 50)), page = Math.max(1, Number(q.get('page')) || 1)
    const offset = q.get('cursor') ? Number(q.get('cursor')) : (page - 1) * size
    return { events: events.slice(offset, offset + size), total_count: events.length, page, page_size: size, total_pages: Math.ceil(events.length / size),
      has_more: offset + size < events.length, next_cursor: offset + size < events.length ? String(offset + size) : undefined }
  }
  if (/^\/usage\/(overview|analysis|activity)(\/comparisons|\/realtime|\/latency)?$/.test(path)) return analytics(path, q, signal)
  throw new BridgeError('当前数据源暂不支持该操作，请使用后台对应的管理页面。 / This operation is not supported by the current data source.', 501)
}

export async function sub2apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('auth_token') || ''
  if (owner !== token) { mem.clear(); quotas.clear(); tasks.clear(); owner = token }
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/keeper/api/v1/')) throw new BridgeError('Invalid API origin')
  try { const result = await dispatch(url.pathname.slice('/keeper/api/v1'.length), url.searchParams, init); return result instanceof Response ? result : json(result) }
  catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    const error = e as BridgeError
    if (error.status === 401) {
      if (window.parent !== window) window.parent.postMessage({ type: 'sub2api:logout' }, window.location.origin)
      else window.location.assign('/login')
    }
    return json({ error: error.message || 'Data source unavailable' }, error.status || 502)
  }
}
