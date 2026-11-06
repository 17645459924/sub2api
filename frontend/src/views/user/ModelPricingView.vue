<template>
  <AppLayout>
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('modelPricing.title') }}</h1>
        </div>
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
        </button>
      </div>

      <div
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <span class="font-semibold">{{ t('modelPricing.ruleTitle') }}</span>
        {{ t('modelPricing.pricingRule', {
          symbol: currencySymbol,
          rate: fmtNum(cnyPerUsd),
          recharge: fmtNum(cnyPerBalanceUsd),
        }) }}
      </div>

      <div v-if="loading && platforms.length === 0" class="flex justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
      <div v-else-if="platforms.length === 0" class="card py-16 text-center text-gray-500 dark:text-gray-400">
        {{ t('modelPricing.empty') }}
      </div>

      <template v-else>
        <!-- 平台标签 + 价格口径 -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in platforms"
              :key="p.platform"
              :class="[
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                p.platform === activePlatform
                  ? 'border-primary-500 bg-white text-gray-900 shadow-sm dark:bg-dark-800 dark:text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-dark-600 dark:text-gray-300',
              ]"
              @click="selectPlatform(p.platform)"
            >
              {{ platformLabel(p.platform) }}
            </button>
          </div>
          <div class="flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-dark-600 dark:bg-dark-800">
            <button
              v-for="mode in (['group', 'official'] as const)"
              :key="mode"
              :class="[
                'rounded-md px-3 py-1 text-xs font-medium',
                priceMode === mode ? 'bg-primary-600 text-white' : 'text-gray-500 dark:text-gray-300',
              ]"
              @click="priceMode = mode"
            >
              {{ t(mode === 'group' ? 'modelPricing.groupPrice' : 'modelPricing.officialPrice') }}
            </button>
          </div>
        </div>

        <!-- 分组卡片 -->
        <div v-if="current" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="g in current.groups"
            :key="g.id"
            :class="[
              'relative rounded-xl border bg-white px-4 py-3 text-left transition-all hover:shadow-md dark:bg-dark-800',
              g.id === activeGroupId
                ? 'border-primary-500 ring-1 ring-primary-500'
                : 'border-gray-200 dark:border-dark-700',
            ]"
            @click="activeGroupId = g.id"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                {{ g.name }}
                <Icon v-if="g.id === activeGroupId" name="checkCircle" size="sm" class="text-primary-500" />
              </span>
              <span
                v-if="discountRatio(g) < 1"
                class="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-600 dark:bg-green-500/10 dark:text-green-300"
              >
                {{ discountLabel(discountRatio(g)) }}
              </span>
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('modelPricing.rate') }} ×{{ fmtNum(rateOf(g)) }}
              <span v-if="g.subscription_type === 'subscription'" class="ml-1">· {{ t('modelPricing.subscriptionGroup') }}</span>
            </div>
          </button>
        </div>

        <!-- 价格表 -->
        <div class="card overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700">
            <div class="relative w-full sm:w-72">
              <Icon name="search" size="md" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input v-model="query" type="text" :placeholder="t('modelPricing.searchPlaceholder')" class="input pl-10" />
            </div>
            <div v-if="tierLabels.length > 1" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ t('modelPricing.contextLength') }}</span>
              <div class="flex rounded-lg border border-gray-200 p-0.5 dark:border-dark-600">
                <button
                  v-for="(label, i) in tierLabels"
                  :key="label"
                  :class="[
                    'rounded-md px-3 py-1 text-xs font-medium',
                    i === tierIndex ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500',
                  ]"
                  @click="tierIndex = i"
                >
                  {{ label }}
                </button>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50/60 text-xs text-gray-500 dark:bg-dark-800/50 dark:text-gray-400">
                  <th class="px-4 py-3 text-left font-medium">{{ t('modelPricing.columns.model') }}</th>
                  <th class="px-4 py-3 text-right font-medium">{{ t('modelPricing.columns.input') }}</th>
                  <th class="px-4 py-3 text-right font-medium">{{ t('modelPricing.columns.output') }}</th>
                  <th class="px-4 py-3 text-right font-medium">{{ t('modelPricing.columns.cacheWrite') }}</th>
                  <th class="px-4 py-3 text-right font-medium">{{ t('modelPricing.columns.cacheRead') }}</th>
                  <th class="px-4 py-3 text-right font-medium">{{ t('modelPricing.columns.saving') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="rows.length === 0">
                  <td colspan="6" class="py-10 text-center text-gray-400">{{ t('modelPricing.noMatch') }}</td>
                </tr>
                <tr
                  v-for="r in rows"
                  :key="r.name"
                  class="border-t border-gray-100 dark:border-dark-700"
                >
                  <td class="px-4 py-3 font-mono text-gray-900 dark:text-white">{{ r.name }}</td>
                  <template v-if="r.perRequest != null">
                    <td colspan="4" class="px-4 py-3 text-right">
                      <span class="font-semibold">{{ money(r.perRequest) }}</span>
                      <span class="ml-1 text-xs text-gray-400">/ {{ t('modelPricing.perRequest') }}</span>
                    </td>
                  </template>
                  <template v-else>
                    <td v-for="k in priceKeys" :key="k" class="px-4 py-3 text-right">
                      <div v-if="priceMode === 'official'" class="font-semibold text-gray-900 dark:text-white">
                        {{ money(r.official[k]) }}
                        <span class="text-xs font-normal text-gray-400">/ 1M tokens</span>
                      </div>
                      <template v-else>
                        <div class="font-semibold text-gray-900 dark:text-white">
                          {{ money(r.price[k]) }}
                          <span class="text-xs font-normal text-gray-400">/ 1M tokens</span>
                        </div>
                        <div v-if="r.saving > 0 && r.official[k] != null" class="text-xs text-gray-400">
                          {{ t('modelPricing.officialPrice') }}
                          <span class="line-through">{{ money(r.official[k]) }}</span>
                        </div>
                      </template>
                    </td>
                  </template>
                  <td class="px-4 py-3 text-right">
                    <span
                      v-if="r.saving > 0"
                      class="rounded bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-600 dark:bg-green-500/10 dark:text-green-300"
                    >
                      {{ r.saving }}%
                    </span>
                    <span v-else class="text-gray-300">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import userChannelsAPI, {
  type UserAvailableChannel,
  type UserAvailableGroup,
  type UserSupportedModel,
} from '@/api/channels'
import userGroupsAPI from '@/api/groups'
import { paymentAPI } from '@/api/payment'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { resolveIntervalPrices } from '@/utils/pricing'
import { platformLabel } from '@/utils/platformColors'
import {
  discountRatio as calcDiscountRatio,
  groupPrice,
  normalizePricingRates,
  type PricingRates,
} from '@/utils/modelPricingMath'

// 官方价展示汇率取后台「支付设置 → 订阅 USD→CNY 汇率」;每 $1 余额实付人民币 = 1 / 「余额充值倍率」;未配置均按 1 计。
const pricingRates = ref<PricingRates>({ cnyPerUsd: 1, cnyPerBalanceUsd: 1 })
const cnyPerUsd = computed(() => pricingRates.value.cnyPerUsd)
const cnyPerBalanceUsd = computed(() => pricingRates.value.cnyPerBalanceUsd)
const currencySymbol = '¥'
const PER_MILLION = 1_000_000

type PriceKey = 'input' | 'output' | 'cacheWrite' | 'cacheRead'
type Prices = Record<PriceKey, number | null>
const priceKeys: PriceKey[] = ['input', 'output', 'cacheWrite', 'cacheRead']

interface PlatformBucket {
  platform: string
  groups: UserAvailableGroup[]
  models: UserSupportedModel[]
}

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const channels = ref<UserAvailableChannel[]>([])
const userRates = ref<Record<number, number>>({})
const loading = ref(false)
const query = ref('')
const activePlatform = ref('')
const activeGroupId = ref<number | null>(null)
const tierIndex = ref(0)
const priceMode = ref<'group' | 'official'>('group')

const platforms = computed<PlatformBucket[]>(() => {
  const map = new Map<string, PlatformBucket>()
  for (const ch of channels.value) {
    for (const sec of ch.platforms) {
      let b = map.get(sec.platform)
      if (!b) {
        b = { platform: sec.platform, groups: [], models: [] }
        map.set(sec.platform, b)
      }
      for (const g of sec.groups) if (!b.groups.some((x) => x.id === g.id)) b.groups.push(g)
      for (const m of sec.supported_models) if (!b.models.some((x) => x.name === m.name)) b.models.push(m)
    }
  }
  return [...map.values()].filter((b) => b.groups.length > 0)
})

const current = computed(() => platforms.value.find((p) => p.platform === activePlatform.value) ?? null)
const activeGroup = computed(() => current.value?.groups.find((g) => g.id === activeGroupId.value) ?? null)

function rateOf(g: UserAvailableGroup): number {
  return userRates.value[g.id] ?? g.rate_multiplier ?? 1
}

// 实付价 / 官方展示价:分组倍率 × 每 $1 余额的实付人民币 ÷ 官方展示汇率
function discountRatio(g: UserAvailableGroup): number {
  return calcDiscountRatio(rateOf(g), pricingRates.value)
}

function selectPlatform(p: string) {
  activePlatform.value = p
  activeGroupId.value = platforms.value.find((x) => x.platform === p)?.groups[0]?.id ?? null
  tierIndex.value = 0
}

watch(platforms, (list) => {
  if (list.length === 0) return
  if (!list.some((p) => p.platform === activePlatform.value)) selectPlatform(list[0].platform)
})

const tierLabels = computed(() => {
  let best: string[] = []
  for (const m of current.value?.models ?? []) {
    const ivs = m.pricing?.intervals ?? []
    if (ivs.length > best.length) best = ivs.map((iv, i) => iv.tier_label || tierName(iv.min_tokens, iv.max_tokens, i))
  }
  return best
})

function tierName(min: number, max: number | null, i: number): string {
  const k = (n: number) => `${Math.round(n / 1000)}K`
  if (max == null) return `>${k(min)}`
  return i === 0 ? `≤${k(max)}` : `${k(min)}-${k(max)}`
}

interface Row {
  name: string
  perRequest: number | null
  price: Prices
  official: Prices
  saving: number
}

const rows = computed<Row[]>(() => {
  const g = activeGroup.value
  if (!g || !current.value) return []
  const rate = rateOf(g)
  const ratio = discountRatio(g)
  const q = query.value.trim().toLowerCase()
  const out: Row[] = []
  for (const m of current.value.models) {
    if (q && !m.name.toLowerCase().includes(q)) continue
    const p = m.pricing
    if (!p) continue
    const base = {
      input_price: p.input_price,
      output_price: p.output_price,
      cache_write_price: p.cache_write_price,
      cache_read_price: p.cache_read_price,
    }
    const iv = p.intervals?.[tierIndex.value]
    const src = iv ? resolveIntervalPrices(iv, base) : { ...base, per_request_price: p.per_request_price }
    const official: Prices = {
      input: usd(src.input_price),
      output: usd(src.output_price),
      cacheWrite: usd(src.cache_write_price),
      cacheRead: usd(src.cache_read_price),
    }
    const price = {} as Prices
    for (const k of priceKeys) {
      price[k] = official[k] == null ? null : groupPrice(official[k]! / cnyPerUsd.value, rate, pricingRates.value)
    }
    const per = src.per_request_price ?? p.per_request_price
    out.push({
      name: m.name,
      perRequest:
        p.billing_mode === 'per_request' && per != null ? groupPrice(per, rate, pricingRates.value) : null,
      price,
      official,
      saving: ratio < 1 ? Math.round((1 - ratio) * 100) : 0,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
})

function usd(v: number | null | undefined): number | null {
  return v == null ? null : v * PER_MILLION * cnyPerUsd.value
}

function fmtNum(n: number): string {
  return String(Number(n.toPrecision(6)))
}

function money(v: number | null): string {
  if (v == null) return '-'
  const digits = v !== 0 && Math.abs(v) < 0.01 ? 4 : 2
  return `${currencySymbol}${v.toFixed(digits)}`
}

function discountLabel(rate: number): string {
  const z = Number((rate * 10).toFixed(1))
  return t('modelPricing.discount', { n: z })
}

async function load() {
  loading.value = true
  try {
    const [list, rates, rate] = await Promise.all([
      userChannelsAPI.getAvailable(),
      userGroupsAPI.getUserGroupRates(),
      // 专属倍率或汇率取不到时不能用默认值展示价格(会把错价展示给用户),让整体加载失败并提示重试
      paymentAPI.getCheckoutInfo().then((res) => res.data),
    ])
    channels.value = list
    userRates.value = rates
    pricingRates.value = normalizePricingRates(
      rate.subscription_usd_to_cny_rate,
      rate.balance_recharge_multiplier,
    )
    if (import.meta.env.DEV && route.query.mock === '1') {
      channels.value = (await import('@/dev/previewMock')).mockChannels
    }
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('modelPricing.loadFailed')))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
