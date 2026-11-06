import { describe, expect, it } from 'vitest'
import { discountRatio, groupPrice, normalizePricingRates } from '../modelPricingMath'

describe('modelPricingMath', () => {
  it('未配置时按 1 计,价格 = 官方价 × 倍率', () => {
    const r = normalizePricingRates(0, 0)
    expect(r).toEqual({ cnyPerUsd: 1, cnyPerBalanceUsd: 1 })
    expect(groupPrice(5, 0.8, r)).toBeCloseTo(4)
    expect(discountRatio(0.8, r)).toBeCloseTo(0.8)
  })

  it('展示汇率 7、1 元 = $1 充值、倍率 0.8:官方 ¥35 -> 实付 ¥4', () => {
    const r = normalizePricingRates(7, 1)
    expect(groupPrice(5, 0.8, r)).toBeCloseTo(4)
    expect(discountRatio(0.8, r)).toBeCloseTo(0.8 / 7)
  })

  it('充值倍率 0.5(¥1 到账 $0.5)时每 $1 余额实付 ¥2', () => {
    const r = normalizePricingRates(7, 0.5)
    expect(r.cnyPerBalanceUsd).toBe(2)
    expect(groupPrice(1, 1, r)).toBe(2)
  })

  it('非法值回退为 1', () => {
    expect(normalizePricingRates('abc', undefined)).toEqual({ cnyPerUsd: 1, cnyPerBalanceUsd: 1 })
  })
})
