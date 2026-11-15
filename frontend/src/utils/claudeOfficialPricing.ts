import type { UserAvailableGroup, UserPricingInterval, UserSupportedModel } from '@/api/channels'

// Anthropic 官方美元价,单位 $/MTok。来源:https://platform.claude.com/docs/en/about-claude/pricing
// 仅收录公开可用模型;缓存写入为 5 分钟档。
interface ClaudePriceRow {
  name: string
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

const CLAUDE_PRICE_ROWS: ClaudePriceRow[] = [
  { name: 'claude-fable-5-2', input: 8, output: 40, cacheWrite: 10, cacheRead: 0.2 },
  { name: 'claude-fable-5-1', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25 },
  { name: 'claude-fable-5', input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
  { name: 'claude-opus-5-5', input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  { name: 'claude-opus-5', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'claude-opus-4-8', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'claude-opus-4-7', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'claude-opus-4-6', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'claude-opus-4-5', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  { name: 'claude-sonnet-5-5', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  { name: 'claude-sonnet-5', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  { name: 'claude-sonnet-4-6', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'claude-sonnet-4-5', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { name: 'claude-haiku-4-5', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
]

// Haiku 5.5 按提示词长度分档:≤100K 与 >100K。
const HAIKU_5_5_TIERS: ClaudePriceRow[] = [
  { name: '≤100K', input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  { name: '>100K', input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
]

const perToken = (usdPerMTok: number) => usdPerMTok / 1_000_000

function tokenModel(row: ClaudePriceRow): UserSupportedModel {
  return {
    name: row.name,
    platform: 'anthropic',
    pricing: {
      billing_mode: 'token',
      input_price: perToken(row.input),
      output_price: perToken(row.output),
      cache_write_price: perToken(row.cacheWrite),
      cache_read_price: perToken(row.cacheRead),
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: [],
    },
  } as UserSupportedModel
}

function haikuTieredModel(): UserSupportedModel {
  const intervals: UserPricingInterval[] = HAIKU_5_5_TIERS.map((row, i) => ({
    min_tokens: i === 0 ? 0 : 100_000,
    max_tokens: i === 0 ? 100_000 : null,
    tier_label: row.name,
    input_price: perToken(row.input),
    output_price: perToken(row.output),
    cache_write_price: perToken(row.cacheWrite),
    cache_read_price: perToken(row.cacheRead),
    per_request_price: null,
  }))
  return {
    name: 'claude-haiku-5-5',
    platform: 'anthropic',
    pricing: {
      billing_mode: 'token',
      input_price: perToken(HAIKU_5_5_TIERS[0].input),
      output_price: perToken(HAIKU_5_5_TIERS[0].output),
      cache_write_price: perToken(HAIKU_5_5_TIERS[0].cacheWrite),
      cache_read_price: perToken(HAIKU_5_5_TIERS[0].cacheRead),
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals,
    },
  } as UserSupportedModel
}

export const claudeOfficialModels: UserSupportedModel[] = [
  ...CLAUDE_PRICE_ROWS.slice(0, 9).map(tokenModel),
  ...CLAUDE_PRICE_ROWS.slice(9, 13).map(tokenModel),
  haikuTieredModel(),
  tokenModel(CLAUDE_PRICE_ROWS[13]),
]

// 后台没有配置 Anthropic 分组时使用的展示分组:倍率 ×1,即官方价。
export const claudeOfficialGroup: UserAvailableGroup = {
  id: -1,
  name: 'Claude 官方价',
  platform: 'anthropic',
  subscription_type: 'standard',
  rate_multiplier: 1,
  peak_rate_enabled: false,
  peak_start: '',
  peak_end: '',
  peak_rate_multiplier: 1,
  is_exclusive: false,
}
