import type { SubscriptionPlan } from '@/types/payment'
import type { UserAvailableChannel, UserSupportedModel } from '@/api/channels'

export function isPreviewMock(query: Record<string, unknown>): boolean {
  return import.meta.env.DEV && query.mock === '1'
}

function plan(id: number, name: string, price: number, rate: number, d: number, w: number, m: number, platform = 'openai'): SubscriptionPlan {
  return {
    id,
    group_id: id,
    group_platform: platform,
    group_name: name,
    rate_multiplier: rate,
    daily_limit_usd: d,
    weekly_limit_usd: w,
    monthly_limit_usd: m,
    name,
    description: `适合日常开发使用,额度每日刷新`,
    price,
    original_price: price * 1.3,
    currency: 'CNY',
    validity_days: 30,
    validity_unit: 'day',
    features: ['支持全部 GPT 模型', '不限并发', '工单支持'],
    for_sale: true,
    sort_order: id,
  }
}

export const mockPlans: SubscriptionPlan[] = [
  plan(1, 'PLUS Lite', 50, 1.25, 20, 100, 300),
  plan(2, 'PLUS 1x', 135, 1.25, 50, 250, 800),
  plan(3, 'PLUS 2x', 270, 1.25, 100, 500, 1600),
  plan(4, 'PLUS 3x', 405, 1.25, 150, 750, 2400),
  plan(5, 'PRO 5x', 675, 1, 250, 1250, 4000, 'anthropic'),
]

function model(name: string, input: number, output: number, cw: number | null, cr: number | null): UserSupportedModel {
  const per = (v: number | null) => (v == null ? null : v / 1_000_000)
  return {
    name,
    platform: 'openai',
    pricing: {
      billing_mode: 'token',
      input_price: per(input),
      output_price: per(output),
      cache_write_price: per(cw),
      cache_read_price: per(cr),
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: [],
    },
  } as UserSupportedModel
}

export const mockChannels: UserAvailableChannel[] = [
  {
    name: 'main',
    description: '',
    platforms: [
      {
        platform: 'openai',
        groups: [
          { id: 11, name: '按量 Token', platform: 'openai', subscription_type: 'standard', rate_multiplier: 0.7, peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1, is_exclusive: false },
          { id: 12, name: 'PLUS 1x', platform: 'openai', subscription_type: 'subscription', rate_multiplier: 1.25, peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1, is_exclusive: false },
        ],
        supported_models: [
          model('gpt-5.6-sol', 5, 30, 6.25, 0.5),
          model('gpt-5.5', 2.5, 15, null, 0.25),
          model('gpt-5-mini', 0.25, 2, null, 0.025),
        ],
      },
      {
        platform: 'anthropic',
        groups: [
          { id: 21, name: 'Claude 官方', platform: 'anthropic', subscription_type: 'standard', rate_multiplier: 1, peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1, is_exclusive: false },
        ],
        supported_models: [model('claude-sonnet-4-5', 3, 15, 3.75, 0.3)],
      },
    ],
  },
]
